import mongoose from "mongoose";

const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017"

const connectedToDb = async() =>{
    try {
       await mongoose.connect(MONGO_URI, {
            dbName: "leadlly"
        })
        console.log("Connected to db")
    } catch (error) {
        console.log("mongo error =========>", error)
    }
}

export default connectedToDb