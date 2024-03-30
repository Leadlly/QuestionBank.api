import express from 'express'
import { createQuestion } from '../controller/quesController.js'
import { createChapter, createSubject, createTopic } from '../controller/subjectController.js'

const router = express.Router()

router.post('/question', createQuestion)
router.post('/subject', createSubject)
router.post('/chapter', createChapter)
router.post('/topic', createTopic)

export default router