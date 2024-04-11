const convertToLowercase = (req, res, next) => {
  const convertToLowerCase = (obj) => {
    for (let key in obj) {
      if (typeof obj[key] === "string") {
        obj[key] = obj[key].toLowerCase();
      } else if (typeof obj[key] === "object") {
        convertToLowerCase(obj[key]);
      }
    }
  };

  if (req.body) {
    convertToLowerCase(req.body);
  }

  if (req.query) {
    convertToLowerCase(req.query);
  }

  next();
};

export default convertToLowercase;
