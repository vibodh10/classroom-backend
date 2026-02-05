import 'dotenv/config';
import express from 'express';
import cors from 'cors';

console.log('🔥 BACKEND FILE LOADED');

import subjectsRouter from "./routes/subjects";
import securityMiddleware from "./middleware/security";

const app = express();
const PORT = 8000;

if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not set in .env');
}

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  exposedHeaders: ["X-Total-Count"],
}));

// 🔥 Explicit OPTIONS response (this is the missing piece)
app.options("*", cors(), (_req, res) => {
  res.sendStatus(204);
});

app.use(express.json());

app.use(securityMiddleware);

app.use('/api/subjects', subjectsRouter);

app.get('/', (_req, res) => {
  res.send('Hello, welcome to the Classroom API!');
});

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
