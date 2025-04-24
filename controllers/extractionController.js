import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';

// Initialize Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Function to extract text from file
const extractTextFromFile = async (filePath) => {
  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    return fileContent;
  } catch (error) {
    console.error('Error reading file:', error);
    throw new Error('Failed to read file content');
  }
};

// Function to process PDF files if needed
// This is a placeholder - you may need a PDF library like pdf-parse
const extractTextFromPDF = async (filePath) => {
  // Implement PDF extraction logic here
  throw new Error('PDF extraction not implemented');
};

// Extract questions and options using Gemini API
const extractQuestionsWithGemini = async (fileBuffer, mimeType) => {
  try {
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash"
    });

    console.log("processing with gemini...");
    const result = await model.generateContent({
      contents: [{
        parts: [
          { 
            text: `Extract all questions and multiple choice options from this document or image.
Please preserve any HTML tags (such as <sup>, <sub>, <b>, <i>, <u>, <math>, <span>, etc.) that represent formatting, math, or scientific notation (like powers, roots, fractions, etc.) in the question or options. 
Format response as JSON array with structure:
[
  {
    "question": "text or HTML",
    "options": ["A (text or HTML)", "B (text or HTML)", "C (text or HTML)", "D (text or HTML)"],
    "correctAnswer": "A" // omit if unavailable
  }
]`
          },
          {
            inlineData: {
              mimeType: mimeType,
              data: Buffer.from(fileBuffer).toString("base64")
            }
          }
        ]
      }]
    });

    const response = await result.response;
    const responseText = await response.text();
    console.log("responseText", responseText);

    // Robust JSON extraction and error handling
    let extractedQuestions = [];
    try {
      const jsonStart = responseText.indexOf('[');
      const jsonEnd = responseText.lastIndexOf(']') + 1;
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        const jsonString = responseText.slice(jsonStart, jsonEnd);

        try {
          extractedQuestions = JSON.parse(jsonString);
        } catch (parseError) {
          let fixedJsonString = jsonString
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/\\'/g, "'")
            .replace(/[\u2018\u2019]/g, "'")
            .replace(/[\u201C\u201D]/g, '"');
          try {
            extractedQuestions = JSON.parse(fixedJsonString);
          } catch (secondParseError) {
            console.error('Second JSON parsing error:', secondParseError);
            const objectMatches = fixedJsonString.match(/{[^}]*}/g);
            if (objectMatches && objectMatches.length > 0) {
              extractedQuestions = objectMatches.map(objStr => {
                try {
                  return JSON.parse(objStr.endsWith('}') ? objStr : objStr + '}');
                } catch {
                  return null;
                }
              }).filter(Boolean);
            } else {
              extractedQuestions = [];
            }
          }
        }
      } else {
        extractedQuestions = [];
      }
    } catch (outerError) {
      console.error('Outer JSON extraction error:', outerError);
      extractedQuestions = [];
    }

    return extractedQuestions;

  } catch (error) {
    console.error('Error with Gemini API:', error);
    return [];
  }
};

export const extractQuestionsFromFile = async (req, res) => {
  let filePath;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    filePath = req.file.path;
    const fileExtension = path.extname(filePath).toLowerCase();

    // Detect MIME type for images, pdf, and text
    let mimeType;
    if (fileExtension === '.pdf') {
      mimeType = 'application/pdf';
    } else if (fileExtension === '.png') {
      mimeType = 'image/png';
    } else if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
      mimeType = 'image/jpeg';
    } else if (fileExtension === '.webp') {
      mimeType = 'image/webp';
    } else {
      mimeType = 'text/plain';
    }

    const fileBuffer = fs.readFileSync(filePath);

    // Process with Gemini
    const extractedQuestions = await extractQuestionsWithGemini(fileBuffer, mimeType);

    return res.status(200).json({
      success: true,
      data: extractedQuestions
    });

  } catch (error) {
    console.error('Error in extraction process:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to extract questions from file'
    });
  } finally {
    // Always remove the file if it exists
    if (filePath && fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
      } catch (unlinkErr) {
        console.error('Failed to remove file:', unlinkErr);
      }
    }
  }
};