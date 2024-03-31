import express from 'express'
import { config } from 'dotenv'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import connectedToDb from './db/db.js'
import UserRouter from './routes/userRoutes.js'
import QuestionRouter from './routes/questionRoutes.js'

config({
    path: './config.env'
})

const app = express();
const port = process.env.PORT || 4000

connectedToDb();

app.use(express.json());
app.use(cookieParser());
app.use(cors());

app.use('/api/user', UserRouter)
app.use('/api/create', QuestionRouter)
app.get('/', (req, res) => {
    res.send("Server is working fine")
})

app.listen(port, () => console.log(`Server is listening at port ${port}`))