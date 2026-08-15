/**
 * Apply the weight update algorithm based on correctness and confidence.
 * @param {Object} stats - The stats object of a question
 * @param {boolean} correct - Whether the answer was correct
 * @param {string|null} confidence - Confidence value ('knew_it' | 'guessed' | null)
 * @returns {Object} Updated stats object
 */
export function applyAnswer(stats, correct, confidence) {
  const next = { ...stats };
  next.timesShown += 1;
  next.lastShownAt = new Date();

  if (correct) {
    next.timesCorrect += 1;
    if (confidence === 'knew_it') {
      next.weight = Math.max(1, next.weight * 0.5);
      next.consecutiveCorrect += 1;
      next.consecutiveWrong = 0;
      next.knewItCount += 1;
      if (next.consecutiveCorrect >= 1) next.isLeech = false;
    } else if (confidence === 'guessed') {
      next.guessedCount += 1;
    }
  } else {
    next.timesWrong += 1;
    next.weight = Math.min(20, next.weight * 2);
    next.consecutiveWrong += 1;
    next.consecutiveCorrect = 0;
    if (next.consecutiveWrong >= 4) next.isLeech = true;
  }
  return next;
}

/**
 * Perform a weighted random selection with rolling cooldown.
 * @param {Array} pool - The filtered question list
 * @param {Array} recentIds - Array of recent question IDs
 * @returns {Object|null} Picked question
 */
export function pickNext(pool, recentIds = []) {
  if (pool.length === 0) return null;
  const candidates = pool.filter(q => {
    const qId = q.id || q._id;
    return !recentIds.includes(qId?.toString());
  });
  const usePool = candidates.length > 0 ? candidates : pool;
  const totalWeight = usePool.reduce((sum, q) => sum + q.stats.weight, 0);
  let r = Math.random() * totalWeight;
  for (const q of usePool) {
    r -= q.stats.weight;
    if (r <= 0) return q;
  }
  return usePool[usePool.length - 1];
}

/**
 * Filter questions for session modes client-side.
 * @param {Array} pool - Complete question pool
 * @param {string} mode - The session mode
 * @returns {Array} Filtered list
 */
export function filterForMode(pool, mode) {
  switch (mode) {
    case 'new':
      return pool.filter(q => q.stats.timesShown === 0);
    case 'focused':
      return pool.filter(q => q.stats.weight >= 4 || q.stats.isLeech);
    case 'full_random':
    case 'quick10':
    case 'drill':
    default:
      return pool;
  }
}
