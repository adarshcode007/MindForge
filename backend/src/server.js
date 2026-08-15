import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';
import authRouter from './routes/auth.js';
import decksRouter from './routes/decks.js';
import questionsRouter from './routes/questions.js';
import statsRouter from './routes/stats.js';
import backupRouter from './routes/backup.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Serve frontend build files
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/decks', decksRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/stats', statsRouter);
app.use('/api', backupRouter); // Handles GET /api/export and POST /api/import-backup

// Health check
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Catch-all route to serve React's index.html for clientside routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
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
