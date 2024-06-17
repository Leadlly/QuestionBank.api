import express from "express";
import {config} from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import connectedToDb from "./db/db.js";
import UserRouter from "./routes/userRoutes.js";
import QuestionRouter from "./routes/questionRoutes.js";
import TopicRouter from "./routes/topicRoutes.js";
import ChapterRouter from "./routes/chapterRoutes.js"
import SubTopicRouter from "./routes/subtopicRoutes.js";
import SubjectRouter from "./routes/subjectRoutes.js"
import serverless from "serverless-http";


config({
  path: "./.env",
});

const app = express();
const port = process.env.PORT || 4000;

connectedToDb();

app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
      origin: (origin, callback) => {
          console.log('Request from origin:', origin);
          if (origin === undefined || origin === null) {
               callback(null, true);
          } else if (
              origin.match(/^https?:\/\/(.*\.)?vercel\.app$/) ||
              origin === process.env.FRONTEND_URL
          ) {
              callback(null, true);
          } else {
              console.log('Not allowed by CORS:', origin);
              callback(new Error('Not allowed by CORS'));
          }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
  })
);



app.use("/api", QuestionRouter, TopicRouter, SubjectRouter, ChapterRouter, SubTopicRouter);
app.use("/api/user", UserRouter);
app.get("/", (req, res) => {
  res.send("Server is working fine");
});

// export const handler = serverless(app);
app.listen(port, () => console.log(`Server is listening at port ${port}`));
