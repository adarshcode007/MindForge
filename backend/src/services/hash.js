import crypto from 'crypto';

/**
 * Generates a stable 16-character content hash for question text.
 * @param {string} questionText 
 * @returns {string} First 16 hex characters of SHA1 hash
 */
export function generateContentHash(questionText) {
  if (!questionText) return '';
  const normalized = questionText.trim().toLowerCase();
  return crypto.createHash('sha1').update(normalized).digest('hex').substring(0, 16);
}
