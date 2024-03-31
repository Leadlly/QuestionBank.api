import jwt from 'jsonwebtoken'
import { User } from '../model/userModel.js';

const isAuthenticated = async ( req, res, next ) =>{
    const {token} = req.cookies;

    console.log(token)

    if (!token) return res.status(400).json({success: false, json: "Login into you account first"})

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = await User.findById(decoded._id)
    next()
}

export default isAuthenticated