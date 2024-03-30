import jwt from 'jsonwebtoken'

const setCookie = async(res, user, message, statusCode) =>{
    const token = jwt.sign({_id: user._id}, process.env.JWT_SECRET);

    res.status(statusCode).cookie("token", token, {
        httpOnly: true,
        expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    }).json({
        success: true,
        message,
        user
    })
}

export default setCookie