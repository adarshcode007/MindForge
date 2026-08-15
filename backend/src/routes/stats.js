import express from 'express';
import Deck from '../models/Deck.js';
import Question from '../models/Question.js';
import DailyLog from '../models/DailyLog.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// 4.10 GET /stats/overview
router.get('/overview', async (req, res) => {
  try {
    const totalQuestions = await Question.countDocuments();
    const totalDecks = await Deck.countDocuments();

    // Overall Accuracy across all questions
    const statsSummary = await Question.aggregate([
      {
        $group: {
          _id: null,
          totalShown: { $sum: '$stats.timesShown' },
          totalCorrect: { $sum: '$stats.timesCorrect' }
        }
      }
    ]);
    const overallAccuracy = statsSummary.length > 0 && statsSummary[0].totalShown > 0
      ? Number((statsSummary[0].totalCorrect / statsSummary[0].totalShown).toFixed(2))
      : 0;

    // Weakest Tags: aggregate across all questions, sorted ascending by accuracy, top 5, minimum 3 attempts
    const weakestTags = await Question.aggregate([
      { $match: { tags: { $exists: true, $not: { $size: 0 } }, 'stats.timesShown': { $gte: 1 } } },
      { $unwind: '$tags' },
      {
        $group: {
          _id: '$tags',
          attempts: { $sum: '$stats.timesShown' },
          correct: { $sum: '$stats.timesCorrect' }
        }
      },
      { $match: { attempts: { $gte: 3 } } },
      {
        $project: {
          tag: '$_id',
          attempts: 1,
          accuracy: { $round: [{ $divide: ['$correct', '$attempts'] }, 2] }
        }
      },
      { $sort: { accuracy: 1, attempts: -1 } },
      { $limit: 5 }
    ]);

    // Leeches
    const leechQuestions = await Question.find({ 'stats.isLeech': true }).populate('deckId');
    const leeches = leechQuestions.map(q => ({
      id: q._id.toString(),
      deckSlug: q.deckId ? q.deckId.slug : '',
      question: q.question,
      consecutiveWrong: q.stats.consecutiveWrong
    }));

    return res.status(200).json({
      totalQuestions,
      totalDecks,
      overallAccuracy,
      weakestTags,
      leeches
    });
  } catch (error) {
    console.error('Error fetching stats overview:', error);
    return res.status(500).json({ error: 'Failed to fetch stats overview' });
  }
});

// 4.11 GET /stats/trend
router.get('/trend', async (req, res) => {
  try {
    const daysParam = parseInt(req.query.days) || 14;
    const result = [];
    const dateMap = new Map();

    const logs = await DailyLog.find().sort({ date: 1 });
    logs.forEach(log => {
      dateMap.set(log.date, log);
    });

    const now = new Date();
    // Fill gaps from (daysParam - 1) days ago to today
    for (let i = daysParam - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const log = dateMap.get(dateStr);
      if (log) {
        const accuracy = log.questionsShown > 0
          ? Number((log.questionsCorrect / log.questionsShown).toFixed(2))
          : 0;
        result.push({
          date: dateStr,
          shown: log.questionsShown,
          correct: log.questionsCorrect,
          accuracy
        });
      } else {
        result.push({
          date: dateStr,
          shown: 0,
          correct: 0,
          accuracy: 0
        });
      }
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching stats trend:', error);
    return res.status(500).json({ error: 'Failed to fetch stats trend' });
  }
});

export default router;
