import { S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";

config();

const S3 = new S3Client({
  region: 'ap-south-1', 
  credentials: {
    accessKeyId: process.env.LEADLLY_AWS_ACCESS_KEY,
    secretAccessKey: process.env.LEADLLY_AWS_SECRET_KEY,
  },
});

export default S3;
