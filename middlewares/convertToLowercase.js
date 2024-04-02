const convertToLowercase = (req, res, next) => {
  // Convert req.body to lowercase
  if (req.body) {
    for (let key in req.body) {
      if (typeof req.body[key] === "string") {
        req.body[key] = req.body[key].toLowerCase();
      }
    }
  }

  // Convert req.query to lowercase
  if (req.query) {
    for (let key in req.query) {
      if (typeof req.query[key] === "string") {
        req.query[key] = req.query[key].toLowerCase();
      }
    }
  }

  next();
};

export default convertToLowercase;
