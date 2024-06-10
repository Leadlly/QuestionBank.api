import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import S3 from "../aws/s3.js";

const deleteImages = async (images) => {
    if (!images || !Array.isArray(images)) {
      return [];
    }
  
    return await Promise.all(
      images.map(async (image) => {
        try {
          const params = {
            Bucket: process.env.LEADLLY_S3_BUCKET_NAME,
            Key: image.key,
          };
          const data = await S3.send(new DeleteObjectCommand(params));
          console.log("Success. Object deleted.");
          return data;
        } catch (err) {
          console.log("Error", err);
        }
      })
    );
  };
  
  export default deleteImages;