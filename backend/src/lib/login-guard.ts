import { unauthorized } from './errors.js';

interface LockoutEntry {
  failures: number;
  firstFailure: number;      // timestamp in ms
  lockedUntil: number | null; // timestamp in ms, or null if not locked
}

// Tier 1: 5 failures within the window → 15 minute lockout
const TIER1_THRESHOLD = 5;
const TIER1_LOCKOUT_MS = 15 * 60 * 1000;

// Tier 2: 10 failures within the window → 1 hour lockout
const TIER2_THRESHOLD = 10;
const TIER2_LOCKOUT_MS = 60 * 60 * 1000;

// Tracking window: reset all failures after this much idle time (30 minutes)
const WINDOW_MS = 30 * 60 * 1000;

// Periodic cleanup: run every 10 minutes
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

const attempts = new Map<string, LockoutEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function startCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    try {
      const now = Date.now();
      for (const [email, entry] of attempts) {
        if (now - entry.firstFailure > WINDOW_MS && entry.lockedUntil === null) {
          attempts.delete(email);
        }
        if (entry.lockedUntil !== null && now > entry.lockedUntil) {
          attempts.delete(email);
        }
      }
      // Stop the timer if the map is empty
      if (attempts.size === 0 && cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }
    } catch (err) {
      // Non-fatal: cleanup errors should not crash the process
      console.error('[login-guard] Cleanup loop error:', err instanceof Error ? err.message : err);
    }
  }, CLEANUP_INTERVAL_MS).unref();
}

/**
 * Check whether the given email is currently locked out.
 * If locked, throws an unauthorized AppError with the remaining time.
 */
export function checkLockout(email: string): void {
  const entry = attempts.get(email);
  if (!entry || entry.lockedUntil === null) return;

  const now = Date.now();
  if (now < entry.lockedUntil) {
    const remainingMinutes = Math.ceil((entry.lockedUntil - now) / 60000);
    throw unauthorized(
      `Account temporarily locked. Try again in ${remainingMinutes} minute(s).`,
    );
  }

  // Lockout expired — clear state for this email
  attempts.delete(email);
}

/**
 * Record a failed login attempt for the given email.
 * Call AFTER verifying the password was wrong.
 */
export function recordFailedAttempt(email: string): void {
  const now = Date.now();
  const entry = attempts.get(email);

  if (!entry || now - entry.firstFailure > WINDOW_MS) {
    // First failure, or window expired — start fresh
    attempts.set(email, { failures: 1, firstFailure: now, lockedUntil: null });
    startCleanup();
    return;
  }

  entry.failures += 1;

  if (entry.failures >= TIER2_THRESHOLD) {
    entry.lockedUntil = now + TIER2_LOCKOUT_MS;
  } else if (entry.failures >= TIER1_THRESHOLD) {
    entry.lockedUntil = now + TIER1_LOCKOUT_MS;
  }
}

/**
 * Reset the failure counter for the given email.
 * Call after a SUCCESSFUL login.
 */
export function resetFailedAttempts(email: string): void {
  attempts.delete(email);
}
