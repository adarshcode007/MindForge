import assert from 'assert';
import { applyAnswer, pickNext, filterForMode } from '../src/services/weightedPick.js';
import { generateContentHash } from '../src/services/hash.js';

console.log('Running Recall Unit Tests...');

try {
  // Test 1: Content Hashing
  console.log(' - Testing stable content hash generation...');
  const hash1 = generateContentHash('What is JavaScript? ');
  const hash2 = generateContentHash('  what is javascript?');
  const hash3 = generateContentHash('Different Question');
  assert.strictEqual(hash1, hash2, 'Normalized strings must match hashes');
  assert.notStrictEqual(hash1, hash3, 'Different strings must have different hashes');
  assert.strictEqual(hash1.length, 16, 'Hash must be 16 characters');

  // Test 2: Weight update algorithm (applyAnswer)
  console.log(' - Testing applyAnswer algorithm...');
  
  // Base stats template
  const initialStats = {
    weight: 1,
    timesShown: 0,
    timesCorrect: 0,
    timesWrong: 0,
    consecutiveCorrect: 0,
    consecutiveWrong: 0,
    isLeech: false,
    knewItCount: 0,
    guessedCount: 0,
    lastShownAt: null
  };

  // Correct answer with confidence 'knew_it' (weight goes down, capped at 1)
  let stats = applyAnswer({ ...initialStats, weight: 8 }, true, 'knew_it');
  assert.strictEqual(stats.timesShown, 1);
  assert.strictEqual(stats.timesCorrect, 1);
  assert.strictEqual(stats.weight, 4, 'knew_it must halve weight');
  assert.strictEqual(stats.consecutiveCorrect, 1);
  assert.strictEqual(stats.knewItCount, 1);

  // Correct answer with confidence 'guessed' (weight stays unchanged)
  stats = applyAnswer({ ...initialStats, weight: 8 }, true, 'guessed');
  assert.strictEqual(stats.weight, 8, 'guessed must keep weight unchanged');
  assert.strictEqual(stats.consecutiveCorrect, 0, 'consecutiveCorrect remains unchanged or 0');
  assert.strictEqual(stats.guessedCount, 1);

  // Incorrect answer (weight doubles, consecutiveWrong increments)
  stats = applyAnswer({ ...initialStats, weight: 3 }, false, null);
  assert.strictEqual(stats.timesWrong, 1);
  assert.strictEqual(stats.weight, 6, 'Incorrect answer must double weight');
  assert.strictEqual(stats.consecutiveWrong, 1);
  assert.strictEqual(stats.consecutiveCorrect, 0);

  // Leech flagging threshold (consecutiveWrong >= 4)
  let leechStats = { ...initialStats, consecutiveWrong: 3 };
  leechStats = applyAnswer(leechStats, false, null);
  assert.strictEqual(leechStats.isLeech, true, '4 consecutive wrong answers must set isLeech to true');

  // Leech clearing (confident correct)
  leechStats = applyAnswer(leechStats, true, 'knew_it');
  assert.strictEqual(leechStats.isLeech, false, 'Confident correct answer must clear leech flag');

  // Capping weights (min 1, max 20)
  const capMax = applyAnswer({ ...initialStats, weight: 15 }, false, null);
  assert.strictEqual(capMax.weight, 20, 'Weight should be capped at max 20');
  
  const capMin = applyAnswer({ ...initialStats, weight: 1 }, true, 'knew_it');
  assert.strictEqual(capMin.weight, 1, 'Weight should be capped at min 1');

  // Test 3: pickNext random picker with cooldown
  console.log(' - Testing pickNext selection and cooldown...');
  const pool = [
    { id: 'q1', stats: { weight: 1 } },
    { id: 'q2', stats: { weight: 10 } },
    { id: 'q3', stats: { weight: 1 } }
  ];

  // Cooldown excludes recent IDs
  const picked = pickNext(pool, ['q2']);
  assert.ok(picked.id === 'q1' || picked.id === 'q3', 'Must exclude q2 due to recent list cooldown');

  // Test 4: filterForMode
  console.log(' - Testing session mode filters...');
  const testPool = [
    { id: 'q1', stats: { timesShown: 0, weight: 1, isLeech: false } },
    { id: 'q2', stats: { timesShown: 5, weight: 6, isLeech: false } },
    { id: 'q3', stats: { timesShown: 12, weight: 1, isLeech: true } }
  ];

  const newOnly = filterForMode(testPool, 'new');
  assert.strictEqual(newOnly.length, 1);
  assert.strictEqual(newOnly[0].id, 'q1');

  const focused = filterForMode(testPool, 'focused');
  assert.strictEqual(focused.length, 2, 'Should pick weight >= 4 or leech');
  assert.ok(focused.some(q => q.id === 'q2'));
  assert.ok(focused.some(q => q.id === 'q3'));

  console.log('\nALL UNIT TESTS PASSED SUCCESSFULLY! ✅\n');
} catch (error) {
  console.error('\nUNIT TESTS FAILED ❌');
  console.error(error);
  process.exit(1);
}
