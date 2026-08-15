import express from 'express';
import Question from '../models/Question.js';
import Deck from '../models/Deck.js';
import DailyLog from '../models/DailyLog.js';
import { applyAnswer } from '../services/weightedPick.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// 4.9 POST /questions/:id/answer
router.post('/:id/answer', async (req, res) => {
  try {
    const { id } = req.params;
    const { selectedOption, confidence } = req.body;

    if (selectedOption === undefined) {
      return res.status(400).json({ error: 'selectedOption is required' });
    }

    const question = await Question.findById(id);
    if (!question) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const deck = await Deck.findById(question.deckId);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found for this question' });
    }

    const isCorrect = (selectedOption === question.answer);

    // Apply the weight update algorithm
    const nextStats = applyAnswer(question.stats.toJSON ? question.stats.toJSON() : question.stats, isCorrect, confidence);
    question.stats = nextStats;
    await question.save();

    // Increment today's DailyLog
    const todayStr = new Date().toISOString().split('T')[0];

    const updateFields = {
      $inc: {
        questionsShown: 1,
        [`deckBreakdown.${deck.slug}.shown`]: 1
      }
    };

    if (isCorrect) {
      updateFields.$inc.questionsCorrect = 1;
      updateFields.$inc[`deckBreakdown.${deck.slug}.correct`] = 1;
    }

    await DailyLog.findOneAndUpdate(
      { date: todayStr },
      updateFields,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return res.status(200).json({
      correct: isCorrect,
      correctOption: question.answer,
      description: question.description,
      isLeech: question.stats.isLeech,
      newWeight: question.stats.weight
    });
  } catch (error) {
    console.error('Error recording answer:', error);
    return res.status(500).json({ error: 'Failed to record answer' });
  }
});

export default router;
