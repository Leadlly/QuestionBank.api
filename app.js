import express from 'express'
import { config } from 'dotenv'
import cookieParser from 'cookie-parser'
import connectedToDb from './db/db.js'
import { createQuestion } from './controller/quesController.js'
import { createChapter, createSubject, createTopic } from './controller/subjectController.js'
import { register } from './controller/userController.js'

config({
    path: './config.env'
})

const app = express()
const port = process.env.PORT || 4000

connectedToDb()

app.use(express.json())
app.use(cookieParser())

app.post('/api/user/register', register)
app.post('/api/question/create', createQuestion)
app.post('/api/subject/create', createSubject)
app.post('/api/chapter/create', createChapter)
app.post('/api/topic/create', createTopic)
app.get('/', (req, res) => {
    res.send("Server is working fine")
})

app.listen(port, () => console.log(`Server is listening at port ${port}`))