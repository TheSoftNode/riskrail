import { describe, expect, it } from 'vitest';
import { jobId } from './index.js';

/**
 * These exist because the whole async pipeline was broken by a single
 * character. BullMQ throws `Custom Id cannot contain :` at `queue.add` time,
 * so nothing could be enqueued -- and no unit test caught it, because they all
 * mock the queue.
 */
describe('jobId', () => {
  it('joins parts without a colon', () => {
    expect(jobId('portfolio', 'abc-123')).toBe('portfolio-abc-123');
  });

  it('never emits a colon, whatever it is given', () => {
    expect(jobId('chainhook:protocol', 'SP2ABC', 184233)).not.toContain(':');
  });

  it('replaces colons inside a part rather than dropping them', () => {
    expect(jobId('a:b', 'c')).toBe('a-b-c');
  });

  it('drops empty and nullish parts so no separator dangles', () => {
    expect(jobId('wh', 'evt1', undefined)).toBe('wh-evt1');
    expect(jobId('wh', null, 'end1')).toBe('wh-end1');
    expect(jobId('wh', '', 'end1')).toBe('wh-end1');
  });

  it('keeps numbers, including zero', () => {
    expect(jobId('attempt', 0)).toBe('attempt-0');
  });

  it('stays stable for the same inputs, so dedupe still works', () => {
    expect(jobId('chainhook', 'protocol', 'SP2ABC', 1)).toBe(
      jobId('chainhook', 'protocol', 'SP2ABC', 1),
    );
  });

  it('distinguishes different inputs', () => {
    expect(jobId('wh', 'e1', 'x')).not.toBe(jobId('wh', 'e1', 'y'));
  });
});
