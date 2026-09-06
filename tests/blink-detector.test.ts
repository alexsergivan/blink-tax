import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BlinkDetector, type Landmarker, type DetectorState } from '../src/blink-detector';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
function setup(t: any, options: { media?: Promise<any>; model?: Promise<Landmarker>; captureError?: boolean } = {}) {
  let now = 1000;
  let stopped = 0;
  let closed = 0;
  let blinks = 0;
  let inferenceCalls = 0;
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  const track = { stop: () => { stopped++; }, addEventListener() {} };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  t.mock.method(performance, 'now', () => now);
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => options.media ?? Promise.resolve(stream) } });
  Object.assign(globalThis, {
    requestAnimationFrame: (cb: FrameRequestCallback) => { frames.set(++frameId, cb); return frameId; },
    cancelAnimationFrame: (id: number) => frames.delete(id),
  });
  const states: Array<[DetectorState, string?]> = [];
  let result: any = { faceLandmarks: [], faceBlendshapes: [] };
  let error = false;
  const model: Landmarker = { close: () => { closed++; }, detectForVideo: () => { inferenceCalls++; if (error) throw new Error('inference failed'); return result; } };
  const video: any = { srcObject: null, play: async () => {}, videoWidth: 640, videoHeight: 480, readyState: 2, currentTime: 0 };
  const canvas: any = options.captureError ? { getContext() { throw new Error('canvas unavailable'); } } : null;
  const detector = new BlinkDetector(video, canvas, () => { blinks++; detector.stop(); }, (s, text) => states.push([s, text]), () => options.model ?? Promise.resolve(model));
  t.after(() => { detector.stop(); delete (navigator as any).mediaDevices; });
  return {
    detector, stream, video, model, states, frames,
    stats: () => ({ stopped, closed, blinks, inferenceCalls }),
    eyes(score: number) { result = { faceLandmarks: [[{ x: .5, y: .5 }]], faceBlendshapes: [{ categories: [{ categoryName: 'eyeBlinkLeft', score }, { categoryName: 'eyeBlinkRight', score }] }] }; },
    failInference() { error = true; },
    frame(ms = 33, fresh = true) { now += ms; if (fresh) video.currentTime += ms / 1000; const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(cb => cb(now)); },
  };
}

test('late camera permission after stopping releases the stream', async t => {
  const media = deferred<any>(); const h = setup(t, { media: media.promise });
  const started = h.detector.start(); h.detector.stop(); media.resolve(h.stream); await started;
  assert.equal(h.stats().stopped, 1); assert.equal(h.video.srcObject, null); assert.equal(h.frames.size, 0);
  assert.equal(h.states.at(-1)?.[0], 'stopped');
});

test('model completing after stop is closed without resurrecting detection', async t => {
  const model = deferred<Landmarker>(); const h = setup(t, { model: model.promise });
  const started = h.detector.start(); await Promise.resolve(); await Promise.resolve();
  h.detector.stop(); model.resolve(h.model); await started;
  assert.equal(h.stats().closed, 1); assert.equal(h.stats().stopped, 1); assert.equal(h.frames.size, 0);
});

test('readiness requires eyes, sustained closure loses, and no loop survives the round', async t => {
  const h = setup(t); await h.detector.start();
  assert.equal(h.states.at(-1)?.[0], 'searching');
  h.eyes(0); h.frame(); assert.equal(h.states.at(-1)?.[0], 'ready');
  h.eyes(1); h.frame(); h.frame(60);
  assert.equal(h.stats().blinks, 1); assert.equal(h.frames.size, 0); assert.equal(h.stats().closed, 1);
});

test('a failing mugshot renderer does not disable blink detection', async t => {
  const h = setup(t, { captureError: true }); await h.detector.start();
  h.eyes(0); h.frame(); h.eyes(1); h.frame(); h.frame(60);
  assert.equal(h.stats().blinks, 1);
});

test('duplicate video frames are skipped and repeated inference failures surface', async t => {
  const h = setup(t); await h.detector.start();
  const calls = h.stats().inferenceCalls; h.frame(33, false); assert.equal(h.stats().inferenceCalls, calls);
  h.failInference(); h.frame(); h.frame(); h.frame();
  assert.equal(h.states.at(-1)?.[0], 'error'); assert.equal(h.frames.size, 0); assert.equal(h.stats().stopped, 1);
});

test('denied camera stays manual and can retry successfully', async t => {
  const media = deferred<any>(); const h = setup(t, { media: media.promise });
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new DOMException('denied', 'NotAllowedError'); } } });
  await h.detector.start(); assert.equal(h.states.at(-1)?.[0], 'denied');
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => h.stream } });
  await h.detector.start(); h.eyes(0); h.frame(); assert.equal(h.states.at(-1)?.[0], 'ready');
});
