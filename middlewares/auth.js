import jwt from 'jsonwebtoken'

export const isAuthenticated = async ( req, res, next ) =>{
    const {token} = req.cookies;

    if (!token) return res.status(400).json({success: false, json: "Login into you account first"})

    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    req.user = decoded._id
    next()
}