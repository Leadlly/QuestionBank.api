const checkAdmin = async (req, res, next) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(400).json({
          success: false,
          message: "Access Denied! You are not an admin",
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
  
  export default checkAdmin;
  