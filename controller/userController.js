import { User } from "../model/userModel.js";
import bcrypt from 'bcrypt'
import setCookie from "../utils/setCookie.js";

export const register = async(req, res) =>{
   try {
    const {name, email, password} = req.body;
    
    const user = await User.findOne({email}).select("+password")
    if(user) return res.status(400).json({success: false, message: "User already exists"})

    const hashedPassword = await bcrypt.hash(password, 10)

    await User.create({
        name, email, password, password: hashedPassword
    })

    const admins = await User.find({role: "admin"})
    await admins.notificaitons.push(user._id)

    setCookie(res, user, "Registered Success", 201)
   } catch (error) {
    return res.status(500).json({success: false, message: error.message || "Internal Server Error"})
   }

}