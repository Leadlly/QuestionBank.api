import express from 'express'
import { createQuestion } from '../controller/quesController.js'
import { createChapter, createSubject, createTopic, getAllSubject, getChapter, getTopic } from '../controller/subjectController.js'
import isAuthenticated from '../middlewares/auth.js'

const router = express.Router()

router.post('/create/question', isAuthenticated, createQuestion)
router.post('/create/subject', isAuthenticated, createSubject)
router.post('/create/chapter', isAuthenticated, createChapter)
router.post('/create/topic', isAuthenticated, createTopic)
router.get('/get/subject', isAuthenticated, getAllSubject)
router.get('/get/chapter', isAuthenticated, getChapter)
router.get('/get/topic', isAuthenticated, getTopic)

export default router