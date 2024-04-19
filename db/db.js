import mongoose from "mongoose";
import { config } from "dotenv";

const connectedToDb = async () => {
  config({
    path: "./config.env",
  });
  const MONGO_URI = process.env.MONGO_URI;
  try {
    await mongoose.connect(MONGO_URI, {
      dbName: "leadllyQuestions",
    });
    console.log("Connected to db");
  } catch (error) {
    console.log("mongo error =========>", error);
  }
};

export default connectedToDb;
