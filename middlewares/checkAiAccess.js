const checkAiAccess = (req, res, next) => {
  try {
    if (!req.user?.aiAccess) {
      return res.status(403).json({
        success: false,
        message: "Access Denied! You do not have AI access.",
      });
    }
    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export default checkAiAccess;
