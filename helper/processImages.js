import { getPutObjectSignedUrl } from "../utils/getSignedUrl.js";

const processImages = async (images) => {
    if (!images || !Array.isArray(images)) {
      return [];
    }
  
    return await Promise.all(images.map(async (image) => {
      if (image === null) return
      
      // Generate a unique bucket key for the image
      const bucketKey = `questions/${new Date().getTime()}-${image.name}`;
      
      const putObjectInfo = {
        Bucket: process.env.LEADLLY_S3_BUCKET_NAME,
        Key: bucketKey,
        ContentType: image.type,
      };
      
      // Get the pre-signed URL for uploading
      const putSignedUrl = await getPutObjectSignedUrl(putObjectInfo);
      
      // Return the URLs and key information
      return { 
        putUrl: putSignedUrl, 
        getUrl: `${process.env.LEADLLY_AWS_ACCOUNT_URL}/${bucketKey}`, 
        key: bucketKey 
      };
    }));
  };
  
  export default processImages