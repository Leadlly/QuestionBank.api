import express from 'express'
import { createQuestion } from '../controller/quesController.js'
import { createChapter, createSubject, createTopic } from '../controller/subjectController.js'
import isAuthenticated from '../middlewares/auth.js'

const router = express.Router()

router.post('/question', isAuthenticated, createQuestion)
router.post('/subject', isAuthenticated, createSubject)
router.post('/chapter', isAuthenticated, createChapter)
router.post('/topic', isAuthenticated, createTopic)

export default router