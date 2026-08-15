import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './config/db.js';
import authRouter from './routes/auth.js';
import decksRouter from './routes/decks.js';
import questionsRouter from './routes/questions.js';
import statsRouter from './routes/stats.js';
import backupRouter from './routes/backup.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Connect to Database
connectDB();

// Middlewares
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json({ limit: '10mb' })); // Allow larger backups

// Routes
app.use('/auth', authRouter);
app.use('/decks', decksRouter);
app.use('/questions', questionsRouter);
app.use('/stats', statsRouter);
app.use('/', backupRouter); // Handles GET /export and POST /import-backup

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});
