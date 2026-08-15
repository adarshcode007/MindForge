import express from 'express';
import { randomUUID } from 'crypto';
import Deck from '../models/Deck.js';
import Question from '../models/Question.js';
import { generateContentHash } from '../services/hash.js';
import { getCache, setCache, invalidateCache } from '../services/importCache.js';
import authMiddleware from '../middleware/auth.js';

const router = express.Router();

// Apply auth middleware to all deck routes
router.use(authMiddleware);

// Color palette for decks
const COLOR_PALETTE = ['#f5a623', '#5b8dd6', '#4caf82', '#e0524a', '#a679d2', '#3fb8c9'];

// Helper to slugify deck name
function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
// 4.2 GET /decks
router.get('/', async (req, res) => {
  try {
    const decks = await Deck.find().sort({ createdAt: -1 });
    
    // Calculate averageWeight for each deck
    const deckList = await Promise.all(decks.map(async (deck) => {
      const questions = await Question.find({ deckId: deck._id }, 'stats.weight');
      const totalWeight = questions.reduce((sum, q) => sum + (q.stats?.weight || 1), 0);
      const averageWeight = questions.length > 0 ? Number((totalWeight / questions.length).toFixed(2)) : 1.0;
      
      const deckJson = deck.toJSON();
      deckJson.averageWeight = averageWeight;
      return deckJson;
    }));

    return res.status(200).json(deckList);
  } catch (error) {
    console.error('Error fetching decks:', error);
    return res.status(500).json({ error: 'Failed to fetch decks' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Deck name is required' });
    }

    const slug = slugify(name);
    if (!slug) {
      return res.status(400).json({ error: 'Invalid deck name' });
    }

    const existingDeck = await Deck.findOne({ slug });
    if (existingDeck) {
      return res.status(409).json({ error: 'Deck with this name already exists' });
    }

    const deckCount = await Deck.countDocuments();
    const color = COLOR_PALETTE[deckCount % COLOR_PALETTE.length];

    const deck = new Deck({
      name: name.trim(),
      slug,
      color,
      tags: [],
      questionCount: 0
    });

    await deck.save();
    return res.status(201).json(deck);
  } catch (error) {
    console.error('Error creating deck:', error);
    return res.status(500).json({ error: 'Failed to create deck' });
  }
});

// 4.4 DELETE /decks/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deck = await Deck.findById(id);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    // Cascade delete questions
    await Question.deleteMany({ deckId: id });
    await Deck.findByIdAndDelete(id);

    return res.status(204).send();
  } catch (error) {
    console.error('Error deleting deck:', error);
    return res.status(500).json({ error: 'Failed to delete deck' });
  }
});

// 4.5 POST /decks/:id/reset-stats
router.post('/:id/reset-stats', async (req, res) => {
  try {
    const { id } = req.params;
    const deck = await Deck.findById(id);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const result = await Question.updateMany(
      { deckId: id },
      {
        $set: {
          'stats.weight': 1,
          'stats.timesShown': 0,
          'stats.timesCorrect': 0,
          'stats.timesWrong': 0,
          'stats.consecutiveCorrect': 0,
          'stats.consecutiveWrong': 0,
          'stats.isLeech': false,
          'stats.knewItCount': 0,
          'stats.guessedCount': 0,
          'stats.lastShownAt': null
        }
      }
    );

    return res.status(200).json({ resetCount: result.modifiedCount });
  } catch (error) {
    console.error('Error resetting deck stats:', error);
    return res.status(500).json({ error: 'Failed to reset deck stats' });
  }
});

// 4.6 POST /decks/:id/import/preview
router.post('/:id/import/preview', async (req, res) => {
  try {
    const { id: deckId } = req.params;
    const deck = await Deck.findById(deckId);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const { questions } = req.body;
    if (!Array.isArray(questions)) {
      return res.status(400).json({ error: 'Questions array is required' });
    }

    const errors = [];
    const validQuestions = [];

    // 1. Validate each entry
    questions.forEach((q, idx) => {
      // Question field validation
      if (!q.question || typeof q.question !== 'string' || !q.question.trim()) {
        errors.push({ index: idx, message: 'question is required' });
        return;
      }
      // Options field validation
      if (!Array.isArray(q.options) || q.options.length < 2 || q.options.some(o => typeof o !== 'string')) {
        errors.push({ index: idx, message: 'options must be an array of at least 2 strings' });
        return;
      }
      // Answer field validation
      if (typeof q.answer !== 'number' || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length) {
        errors.push({ index: idx, message: 'answer must be a valid index into options' });
        return;
      }
      // Difficulty field validation
      if (q.difficulty && !['easy', 'medium', 'hard'].includes(q.difficulty)) {
        errors.push({ index: idx, message: 'difficulty must be easy, medium, or hard' });
        return;
      }
      // Tags validation
      if (q.tags && (!Array.isArray(q.tags) || q.tags.some(t => typeof t !== 'string'))) {
        errors.push({ index: idx, message: 'tags must be an array of strings' });
        return;
      }

      validQuestions.push({
        question: q.question.trim(),
        options: q.options.map(o => o.trim()),
        answer: q.answer,
        description: q.description ? q.description.trim() : '',
        difficulty: q.difficulty || 'medium',
        tags: Array.isArray(q.tags) ? q.tags.map(t => t.trim().toLowerCase()) : [],
        contentHash: generateContentHash(q.question)
      });
    });

    // 2. Fetch existing questions in deck to classify
    const existingQuestions = await Question.find({ deckId });
    const existingMap = new Map();
    existingQuestions.forEach(q => {
      existingMap.set(q.contentHash, q);
    });

    let newCount = 0;
    let changedCount = 0;
    let unchangedCount = 0;

    const classifiedNew = [];
    const classifiedChanged = [];

    validQuestions.forEach(q => {
      const existing = existingMap.get(q.contentHash);
      if (!existing) {
        newCount++;
        classifiedNew.push(q);
      } else {
        // Compare content fields
        const questionDiffers = q.question !== existing.question;
        const optionsDiffer = q.options.length !== existing.options.length || q.options.some((o, i) => o !== existing.options[i]);
        const answerDiffers = q.answer !== existing.answer;
        const descDiffers = q.description !== existing.description;
        const diffDiffers = q.difficulty !== existing.difficulty;
        
        // Sort-based tags comparison
        const tagsDiffer = q.tags.length !== existing.tags.length || [...q.tags].sort().some((t, i) => t !== [...existing.tags].sort()[i]);

        if (questionDiffers || optionsDiffer || answerDiffers || descDiffers || diffDiffers || tagsDiffer) {
          changedCount++;
          classifiedChanged.push({
            id: existing._id,
            ...q
          });
        } else {
          unchangedCount++;
        }
      }
    });

    const previewId = randomUUID();
    setCache(previewId, {
      deckId,
      newQuestions: classifiedNew,
      changedQuestions: classifiedChanged,
      unchangedCount
    });

    return res.status(200).json({
      previewId,
      summary: {
        new: newCount,
        changed: changedCount,
        unchanged: unchangedCount,
        errors: errors.length
      },
      errors
    });
  } catch (error) {
    console.error('Error during import preview:', error);
    return res.status(500).json({ error: 'Failed to generate import preview' });
  }
});

// 4.7 POST /decks/:id/import/confirm
router.post('/:id/import/confirm', async (req, res) => {
  try {
    const { id: deckId } = req.params;
    const { previewId } = req.body;
    if (!previewId) {
      return res.status(400).json({ error: 'previewId is required' });
    }

    const cached = getCache(previewId);
    if (!cached || cached.deckId !== deckId) {
      return res.status(410).json({ error: 'Preview expired, re-run import' });
    }

    const { newQuestions, changedQuestions, unchangedCount } = cached;

    // 1. Insert new questions
    if (newQuestions.length > 0) {
      const docs = newQuestions.map(q => ({
        ...q,
        deckId
      }));
      await Question.insertMany(docs);
    }

    // 2. Update changed questions (update content only, do not touch stats)
    for (const q of changedQuestions) {
      await Question.findByIdAndUpdate(q.id, {
        $set: {
          question: q.question,
          options: q.options,
          answer: q.answer,
          description: q.description,
          difficulty: q.difficulty,
          tags: q.tags
        }
      });
    }

    // Invalidate preview cache
    invalidateCache(previewId);

    // 3. Rollup tags and count for the deck
    const allTags = await Question.distinct('tags', { deckId });
    const questionCount = await Question.countDocuments({ deckId });

    await Deck.findByIdAndUpdate(deckId, {
      $set: {
        tags: allTags,
        questionCount
      }
    });

    return res.status(200).json({
      imported: newQuestions.length,
      updated: changedQuestions.length,
      skipped: unchangedCount
    });
  } catch (error) {
    console.error('Error during import confirmation:', error);
    return res.status(500).json({ error: 'Failed to confirm import' });
  }
});

// 4.8 GET /decks/:id/questions
router.get('/:id/questions', async (req, res) => {
  try {
    const { id: deckId } = req.params;
    const { tags, mode } = req.query;

    const deck = await Deck.findById(deckId);
    if (!deck) {
      return res.status(404).json({ error: 'Deck not found' });
    }

    const query = { deckId };

    // Apply tags filter if provided
    if (tags) {
      const tagList = tags.split(',').map(t => t.trim().toLowerCase());
      query.tags = { $in: tagList };
    }

    // Apply mode filter at query level
    if (mode === 'focused') {
      query.$or = [
        { 'stats.weight': { $gte: 4 } },
        { 'stats.isLeech': true }
      ];
    } else if (mode === 'new') {
      query['stats.timesShown'] = 0;
    }

    const questions = await Question.find(query);
    return res.status(200).json(questions);
  } catch (error) {
    console.error('Error fetching deck questions:', error);
    return res.status(500).json({ error: 'Failed to fetch questions' });
  }
});

export default router;
