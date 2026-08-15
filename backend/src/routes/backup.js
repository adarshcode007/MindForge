import express from 'express';
import Deck from '../models/Deck.js';
import Question from '../models/Question.js';
import DailyLog from '../models/DailyLog.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// 4.12 GET /export
router.get('/export', async (req, res) => {
  try {
    const decks = await Deck.find();
    const questions = await Question.find();
    const dailyLogs = await DailyLog.find();

    return res.status(200).json({
      exportedAt: new Date().toISOString(),
      decks,
      questions,
      dailyLogs
    });
  } catch (error) {
    console.error('Error exporting backup:', error);
    return res.status(500).json({ error: 'Failed to export backup data' });
  }
});

// 4.13 POST /import-backup
router.post('/import-backup', async (req, res) => {
  try {
    const { decks, questions, dailyLogs } = req.body;

    if (!Array.isArray(decks) || !Array.isArray(questions) || !Array.isArray(dailyLogs)) {
      return res.status(400).json({ error: 'Invalid backup format. decks, questions, and dailyLogs arrays are required.' });
    }

    // Best-effort sequential restore
    // 1. Wipe existing collections
    await Question.deleteMany({});
    await Deck.deleteMany({});
    await DailyLog.deleteMany({});

    // 2. Restore Decks
    if (decks.length > 0) {
      const deckDocs = decks.map(d => {
        const doc = { ...d };
        if (d.id) {
          doc._id = d.id;
          delete doc.id;
        }
        return doc;
      });
      await Deck.insertMany(deckDocs);
    }

    // 3. Restore Questions
    if (questions.length > 0) {
      const questionDocs = questions.map(q => {
        const doc = { ...q };
        if (q.id) {
          doc._id = q.id;
          delete doc.id;
        }
        return doc;
      });
      await Question.insertMany(questionDocs);
    }

    // 4. Restore DailyLogs
    if (dailyLogs.length > 0) {
      const logDocs = dailyLogs.map(l => {
        const doc = { ...l };
        if (l.id) {
          doc._id = l.id;
          delete doc.id;
        }
        return doc;
      });
      await DailyLog.insertMany(logDocs);
    }

    const questionCount = await Question.countDocuments();
    return res.status(200).json({ restored: true, questionCount });
  } catch (error) {
    console.error('Error importing backup:', error);
    return res.status(500).json({ error: 'Failed to restore backup data' });
  }
});

export default router;
