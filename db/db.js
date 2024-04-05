import mongoose from "mongoose";

const connectedToDb = async () => {
  const MONGO_URI = process.env.MONGO_URI;
  try {
    await mongoose.connect(MONGO_URI, {
      dbName: "leadlly_question_bank",
    });
    console.log("Connected to db");
  } catch (error) {
    console.log("mongo error =========>", error);
  }
};

export default connectedToDb;
