/**
 * SwasthaSetu Offline-First Outbox Synchronization Logic
 * Handles exponential backoff, jitter, and retry scheduling.
 */

export const OUTBOX_STATUS = {
  PENDING: 'pending',
  SENDING: 'sending',
  SENT: 'sent',
  FAILED: 'failed'
};

/**
 * Calculates exponential backoff with capped ceiling.
 * formula: Math.min(baseDelay * (2 ** attempt), maxDelay) + jitter
 */
export function calculateBackoff(attempt = 0, baseDelayMs = 1000, maxDelayMs = 30000, enableJitter = false) {
  const exponential = baseDelayMs * Math.pow(2, attempt);
  const capped = Math.min(exponential, maxDelayMs);
  if (enableJitter) {
    // ±20% jitter
    const jitter = capped * 0.2 * (Math.random() * 2 - 1);
    return Math.max(100, Math.round(capped + jitter));
  }
  return capped;
}

/**
 * Sorts pending outbox queue: higher priority actions (cases > advice > messages > attachments)
 * and FIFO created_at.
 */
export function sortOutboxQueue(items = []) {
  const priorityOrder = {
    'case': 1,
    'advice': 2,
    'message': 3,
    'upload_chunk': 4
  };

  return [...items].sort((a, b) => {
    const pA = priorityOrder[a.type] || 99;
    const pB = priorityOrder[b.type] || 99;
    if (pA !== pB) return pA - pB;
    return (a.createdAt || 0) - (b.createdAt || 0);
  });
}
