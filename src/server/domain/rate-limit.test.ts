import { describe, it, expect } from 'vitest';
import { createRateLimiter } from './rate-limit';

describe('rate limiter', () => {
  it('blocks a key after max failures', () => {
    const rl = createRateLimiter({ max: 3, windowMs: 1000 });
    for (let i = 0; i < 3; i++) {
      expect(rl.isBlocked('k')).toBe(false);
      rl.recordFailure('k');
    }
    expect(rl.isBlocked('k')).toBe(true);
  });
  it('unblocks after the window passes', () => {
    let t = 0;
    const rl = createRateLimiter({ max: 1, windowMs: 1000, now: () => t });
    rl.recordFailure('k');
    expect(rl.isBlocked('k')).toBe(true);
    t = 1001;
    expect(rl.isBlocked('k')).toBe(false);
  });
  it('isolates keys and supports reset', () => {
    const rl = createRateLimiter({ max: 1, windowMs: 1000 });
    rl.recordFailure('a');
    expect(rl.isBlocked('b')).toBe(false);
    rl.reset('a');
    expect(rl.isBlocked('a')).toBe(false);
  });
});
