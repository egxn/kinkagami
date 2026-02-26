let lockOwner: string | null = null;
let lockAcquiredAt = 0;

const STALE_LOCK_MS = 2000;

export const tryAcquireHandDetectionLock = (owner: string): boolean => {
  const now = Date.now();

  if (lockOwner && now - lockAcquiredAt > STALE_LOCK_MS) {
    lockOwner = null;
    lockAcquiredAt = 0;
  }

  if (lockOwner && lockOwner !== owner) {
    return false;
  }

  lockOwner = owner;
  lockAcquiredAt = now;
  return true;
};

export const releaseHandDetectionLock = (owner: string) => {
  if (lockOwner === owner) {
    lockOwner = null;
    lockAcquiredAt = 0;
  }
};
