import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const output = new URL('../public/vision/', import.meta.url);
const model = new URL('face_landmarker.task', output);
const checksum = '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff';
const valid = bytes => createHash('sha256').update(bytes).digest('hex') === checksum;
await mkdir(output, { recursive: true });
await cp(new URL('../node_modules/@mediapipe/tasks-vision/wasm/', import.meta.url), output, { recursive: true });
const cached = await readFile(model).catch(() => null);
if (!cached || !valid(cached)) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch('https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task', { signal: AbortSignal.timeout(45000) });
      if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!valid(bytes)) throw new Error('Face model checksum mismatch');
      await writeFile(model, bytes);
      break;
    } catch (error) {
      if (attempt === 3) throw error;
      console.warn(`Retrying face model download (${attempt}/3)`);
    }
  }
}
console.log('Local blink detection assets ready');
