import express from 'express';
import multer from 'multer';
import path from 'path';
import { extractQuestionsFromFile } from '../controllers/extractionController.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

// File filter to accept only certain file types
const fileFilter = (req, file, cb) => {
  const allowedFileTypes = [
    '.txt', '.doc', '.docx', '.pdf', '.md',
    '.png', '.jpg', '.jpeg', '.webp' // <-- Add image extensions here
  ];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedFileTypes.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type. Please upload a text, Word, PDF, Markdown, or image file.'));
  }
};

const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Route for extracting questions from a file
router.post('/extract-questions', upload.single('file'), extractQuestionsFromFile);

export default router;