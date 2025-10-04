import mongoose from "mongoose";
import dotenv from "dotenv";

const connectedToDb = async () => {
  dotenv.config({
    path: "../.env",
  });

  const MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    return;
  }

try {
await mongoose.connect(MONGO_URI, {
dbName: "leadllyQuestions",
});
console.log("Connected to db");
} catch (error) {
console.error("Database connection error:", error);
process.exit(1); // Exit the application if the database connection fails
}
};

export default connectedToDb;
