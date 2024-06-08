import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import S3 from "../aws/s3.js";

export const getPutObjectSignedUrl = async(info) => {
    try {
        const command = new PutObjectCommand({
            Bucket: info.Bucket,
            Key: info.Key,
            ContentType: info.ContentType,
        });
        const requestURL = await getSignedUrl(S3, command, { expiresIn: 3600 }); // URL valid for 1 hour
        return requestURL;
    } catch (error) {
        console.error("Error generating put signed URL:", error);
        throw error;
    }
}

export const getObjectSignedUrl = async(info) => {
    try {
        const command = new GetObjectCommand({
            Bucket: info.Bucket,
            Key: info.Key,
        });
        const requestURL = await getSignedUrl(S3, command);
        return requestURL;
    } catch (error) {
        console.error("Error generating get signed URL:", error);
        throw error;
    }
}


