import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import S3 from "../aws/s3.js";

const getSignedRequestUrl = async(info) => {
    try {
        const command = new PutObjectCommand({
            Bucket: info.Bucket,
            Key: info.Key,
            ContentType: info.ContentType,
        });
        const requestURL = await getSignedUrl(S3, command, { expiresIn: 3600 }); // URL valid for 1 hour
        return requestURL;
    } catch (error) {
        console.error("Error generating signed URL:", error);
        throw error;
    }
}

export default getSignedRequestUrl;
