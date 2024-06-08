import { getObjectSignedUrl, getPutObjectSignedUrl } from "../utils/getSignedUrl.js";

const processImages = async (images) => {
    if (!images || !Array.isArray(images)) {
      return [];
    }
  
    return await Promise.all(images.map(async (image) => {
      if (image === null) return
      const bucketKey = `questions/${new Date().getTime()}-${image.name}`;
      const putObjectInfo = {
        Bucket: 'leadlly-questions-options',
        Key: bucketKey,
        ContentType: image.type,
      };
      const putSignedUrl = await getPutObjectSignedUrl(putObjectInfo);
  
      const getObjectInfo = {
        Bucket: 'leadlly-questions-options',
        Key: bucketKey,
      };
      const getSignedUrl = await getObjectSignedUrl(getObjectInfo);
  
      return { putUrl: putSignedUrl, getUrl: getSignedUrl, key: bucketKey };
    }));
  };
  
  export default processImages