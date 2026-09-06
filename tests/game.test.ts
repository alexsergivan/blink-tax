import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlinkGame } from '../src/game';

test('Pit timer starts at server elapsed time and cleanup stops ticks', t => {
  t.mock.method(performance, 'now', () => 10000);
  const frames = new Map<number, FrameRequestCallback>();
  Object.assign(globalThis, { requestAnimationFrame: (cb: FrameRequestCallback) => { frames.set(1, cb); return 1; }, cancelAnimationFrame: (id: number) => frames.delete(id) });
  let score = 0; let ended = false;
  const game = new BlinkGame(seconds => { score = seconds; }, () => { ended = true; });
  game.start(7000); assert.equal(score, 3);
  game.stop(); assert.equal(frames.size, 0); assert.equal(game.status, 'idle'); assert.equal(ended, false);
});
