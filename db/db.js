import mongoose from "mongoose";
import dotenv from "dotenv";
import fs from 'fs'; // Import the 'fs' module
const connectedToDb = async () => {
// Check if the .env file exists
if (!fs.existsSync('../.env')) {
console.error("Error: .env file not found!");
return;
}
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
console.error("mongo error =========>", error);
}
};
export default connectedToDb;
    console.error("mongo error =========>", error);
  }
};

export default connectedToDb;
