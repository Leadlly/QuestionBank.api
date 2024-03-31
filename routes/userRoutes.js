import express from 'express'
import { login, register, verification } from '../controller/userController.js'
import isAuthenticated from '../middlewares/auth.js'

const router = express.Router()

router.post('/register', register)
router.post('/login', login)
router.get('/verify/:id', isAuthenticated, verification)

export default router