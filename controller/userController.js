import { User } from "../model/userModel.js";
import bcrypt from "bcrypt";
import setCookie from "../utils/setCookie.js";

export const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    let user = await User.findOne({ email }).select("+password");
    if (user)
      return res
        .status(400)
        .json({ success: false, message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    user = await User.create({
      name,
      email,
      password,
      password: hashedPassword,
    });

    const admins = await User.find({ role: "admin" });
    if (admins.length > 0) {
      admins.forEach(async (admin) => {
        admin.requests.unshift(user._id);
        await admin.save();
      });
    }

    res.status(201).json({
      success: true,
      message:
        "Verification Request send to admin, you can login after approval. Please wait till approval",
      user,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user)
      return res
        .status(400)
        .json({ success: false, message: "User not exists" });

    if (user.status !== "Verified")
      return res
        .status(400)
        .json({
          success: false,
          message: "You are not verified! Please Contact Admin",
        });

    const isMatched = await bcrypt.compare(password, user.password);
    if (!isMatched)
      return res
        .status(400)
        .json({ success: false, message: "Wrong credentials" });

    setCookie(res, user, "Login Success", 201);
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const verification = async (req, res) => {
  try {
      const user = await User.findById(req.params.id);
      if (!user)
        return res
          .status(404)
          .json({ success: false, message: "User not found" });

      if (user.status === "Not Verified") {
        user.status = "Verified";

        await user.save();
        res.status(200).json({
          success: false,
          message: `Status of user changed to ${user.status}`,
        });
      } else {
        user.status = "Not Verified";

        await user.save();
        res.status(200).json({
          success: false,
          message: `Status of user changed to ${user.status}`,
        });
      }
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "requests questions",
    );
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.status(200).json({ success: true, user });
  } catch (error) {
    console.log(error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const getUserQuestions = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const user = await User.findById(req.user._id)
      .populate('questions') 
      .exec();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, questions: user.questions });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
};

export const logout = (req, res) => {
  res
    .status(200)
    .cookie("token", null, {
      expires: new Date(Date.now()),
      sameSite: "none",
      secure: true,
    })
    .json({
      success: true,
      message: "Logged Out",
    });
};
