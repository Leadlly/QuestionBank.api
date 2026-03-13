/**
 * Tool definitions for AWS Bedrock Converse API (tool_use / function-calling).
 * Each entry maps 1-to-1 with an implementation in insertTools.js / getTools.js.
 */

export const toolDefinitions = [
  // ───────── INSERT TOOLS ──────────────────────────────────────────────────

  {
    toolSpec: {
      name: "insertSubject",
      description:
        "Create a new subject document in the database. Subjects are the top-level academic entity (e.g. Mathematics, Physics).",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Name of the subject (e.g. 'Mathematics').",
            },
            standard: {
              type: "number",
              description: "Class / grade standard (e.g. 10 for Class 10).",
            },
          },
          required: ["name", "standard"],
        },
      },
    },
  },

  {
    toolSpec: {
      name: "insertChapter",
      description:
        "Create a new chapter document and link it to its parent subject.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Chapter name (e.g. 'Quadratic Equations').",
            },
            subjectName: {
              type: "string",
              description: "Name of the parent subject.",
            },
            standard: {
              type: "number",
              description: "Class / grade standard.",
            },
            chapterNumber: {
              type: "number",
              description: "Optional chapter number within the subject.",
            },
            exam: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of exams this chapter is relevant to (e.g. ['JEE', 'NEET']).",
            },
          },
          required: ["name", "subjectName", "standard"],
        },
      },
    },
  },

  {
    toolSpec: {
      name: "insertTopic",
      description:
        "Create a new topic document under a chapter and link it to the chapter.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Topic name.",
            },
            chapterName: {
              type: "string",
              description: "Name of the parent chapter.",
            },
            subjectName: {
              type: "string",
              description: "Name of the parent subject.",
            },
            standard: {
              type: "number",
              description: "Class / grade standard.",
            },
            topicNumber: {
              type: "number",
              description: "Optional topic number.",
            },
            exam: {
              type: "array",
              items: { type: "string" },
              description: "Optional list of exams.",
            },
          },
          required: ["name", "chapterName", "subjectName", "standard"],
        },
      },
    },
  },

  {
    toolSpec: {
      name: "insertSubtopic",
      description: "Create a new subtopic document under a topic.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description: "Subtopic name.",
            },
            topicName: {
              type: "string",
              description: "Name of the parent topic.",
            },
            chapterName: {
              type: "string",
              description: "Name of the parent chapter.",
            },
            subjectName: {
              type: "string",
              description: "Name of the parent subject.",
            },
            standard: {
              type: "number",
              description: "Class / grade standard.",
            },
          },
          required: ["name", "topicName", "chapterName", "subjectName", "standard"],
        },
      },
    },
  },

  {
    toolSpec: {
      name: "insertQuestion",
      description:
        "Create a new question document in the question bank. Options should include name and tag fields.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "The full text of the question.",
            },
            options: {
              type: "array",
              description: "Answer options.",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "Option text." },
                  tag: {
                    type: "string",
                    enum: ["Correct", "Incorrect"],
                    description: "Whether this option is the correct answer.",
                    default: "Incorrect",
                  },
                },
              },
            },
            standard: { type: "number", description: "Class / grade standard." },
            subject: { type: "string", description: "Subject name." },
            chapter: {
              type: "array",
              items: { type: "string" },
              description: "Chapter name(s).",
            },
            topics: {
              type: "array",
              items: { type: "string" },
              description: "Topic name(s).",
            },
            subtopics: {
              type: "array",
              items: { type: "string" },
              description: "Subtopic name(s).",
            },
            level: {
              type: "string",
              description: "Difficulty level (e.g. 'Easy', 'Medium', 'Hard').",
            },
            mode: {
              type: "string",
              description: "Question mode (e.g. 'MCQ', 'True/False').",
            },
            nestedSubTopic: {
              type: "string",
              description: "Optional nested subtopic.",
            },
          },
          required: ["question"],
        },
      },
    },
  },

  // ───────── GET TOOLS ─────────────────────────────────────────────────────

  {
    toolSpec: {
      name: "getSubjects",
      description:
        "Fetch subjects from the database. All query fields are optional and case-insensitive.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string", description: "Subject name to search for." },
            standard: { type: "number", description: "Filter by class standard." },
          },
        },
      },
    },
  },

  {
    toolSpec: {
      name: "getChapters",
      description:
        "Fetch chapters from the database. All query fields are optional and case-insensitive.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string", description: "Chapter name to search for." },
            subjectName: { type: "string", description: "Filter by subject name." },
            standard: { type: "number", description: "Filter by class standard." },
            chapterNumber: { type: "number", description: "Filter by chapter number." },
            exam: { type: "string", description: "Filter by exam name." },
          },
        },
      },
    },
  },

  {
    toolSpec: {
      name: "getTopics",
      description:
        "Fetch topics from the database. All query fields are optional and case-insensitive.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string", description: "Topic name to search for." },
            chapterName: { type: "string", description: "Filter by chapter name." },
            subjectName: { type: "string", description: "Filter by subject name." },
            standard: { type: "number", description: "Filter by class standard." },
            topicNumber: { type: "number", description: "Filter by topic number." },
          },
        },
      },
    },
  },

  {
    toolSpec: {
      name: "getSubtopics",
      description:
        "Fetch subtopics from the database. All query fields are optional and case-insensitive.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            name: { type: "string", description: "Subtopic name to search for." },
            topicName: { type: "string", description: "Filter by topic name." },
            chapterName: { type: "string", description: "Filter by chapter name." },
            subjectName: { type: "string", description: "Filter by subject name." },
            standard: { type: "number", description: "Filter by class standard." },
          },
        },
      },
    },
  },

  {
    toolSpec: {
      name: "getQuestions",
      description:
        "Fetch questions from the question bank. Supports flexible filtering by subject, standard, level, mode, chapter, topics, subtopics, and free-text search.",
      inputSchema: {
        json: {
          type: "object",
          properties: {
            subject: { type: "string", description: "Filter by subject name." },
            standard: { type: "number", description: "Filter by class standard." },
            level: { type: "string", description: "Filter by difficulty level." },
            mode: { type: "string", description: "Filter by question mode (e.g. MCQ)." },
            chapter: { type: "string", description: "Filter by chapter name (partial match)." },
            topics: { type: "string", description: "Filter by topic name (partial match)." },
            subtopics: { type: "string", description: "Filter by subtopic name (partial match)." },
            search: { type: "string", description: "Full-text search on the question field." },
          },
        },
      },
    },
  },
];
