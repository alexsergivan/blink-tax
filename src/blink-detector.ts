import { captureCartoonFrame } from './mugshot';

import type { FaceLandmarkerResult } from '@mediapipe/tasks-vision';

type FaceLandmark = { x?: number; y?: number };
export type Landmarker = {
  detectForVideo(video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult;
  close(): void;
};

// Vite bundles the pinned module; WASM and the model ship with the game.
export async function createLandmarker(): Promise<Landmarker> {
  const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const base = new URL('./vision/', document.baseURI).href;
  const vision = await FilesetResolver.forVisionTasks(base);
  return FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: `${base}face_landmarker.task` },
    runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true,
  });
}
const FACE_LOST_FAIL_MS = 340; const HEAD_TURN_FAIL_MS = 240; const HEAD_TURN_RATIO = .42; const NOSE_TIP = 1; const LEFT_EYE_OUTER = 33; const RIGHT_EYE_OUTER = 263;
export type DetectorState = 'starting' | 'searching' | 'ready' | 'denied' | 'unsupported' | 'error' | 'stopped';
export class BlinkDetector {
  private landmarker: Landmarker | null = null; private stream: MediaStream | null = null; private frameId = 0; private openSeen = false; private faceSeen = false; private shutAt = 0; private faceMissingAt = 0; private headTurnAt = 0; private cameraText = ""; private hasMugshotFrame = false; private frozenMugshot: string | null = null; private evidenceLocked = false; private closedCanvas: HTMLCanvasElement | null = null;
  private generation = 0;
  private running = false;
  private startupTimer: ReturnType<typeof setTimeout> | undefined;
  private lastVideoTime = -1;
  private lastFrameAt = 0;
  private scanErrors = 0;
  constructor(
    private video: HTMLVideoElement,
    private mugshotCanvas: HTMLCanvasElement | null,
    private blink: () => void,
    private state: (s: DetectorState, text?: string) => void,
    private makeLandmarker = createLandmarker,
  ) {}

  async start() {
    this.release();
    const generation = ++this.generation;
    this.running = true;
    this.openSeen = this.faceSeen = this.evidenceLocked = this.hasMugshotFrame = false;
    this.shutAt = this.faceMissingAt = this.headTurnAt = this.scanErrors = 0;
    this.frozenMugshot = this.closedCanvas = null;
    this.cameraText = '';
    this.lastVideoTime = -1;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.fail('unsupported', 'Camera unavailable · use manual controls');
      return;
    }
    this.state('starting', 'Allow camera access to detect blinks');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });
      if (!this.running || generation !== this.generation) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      this.stream = stream;
      this.startupTimer = setTimeout(() => {
        if (generation === this.generation) this.fail('error', 'Camera setup timed out · retry camera');
      }, 30000);
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (this.running && generation === this.generation) this.fail('error', 'Camera disconnected · retry camera');
      }));
      this.video.muted = true;
      this.video.playsInline = true;
      this.video.srcObject = stream;
      await this.video.play();
      if (!this.running || generation !== this.generation) return;
      this.state('starting', 'Loading blink detection…');
      const landmarker = await this.makeLandmarker();
      if (!this.running || generation !== this.generation) { landmarker.close(); return; }
      this.landmarker = landmarker;
      clearTimeout(this.startupTimer);
      this.lastFrameAt = performance.now();
      this.state('searching', 'Face the camera and open your eyes');
      this.scan();
    } catch (error) {
      if (!this.running || generation !== this.generation) return;
      console.warn('Blink camera setup failed:', error);
      const name = error instanceof Error ? error.name : '';
      this.fail(name === 'NotAllowedError' ? 'denied' : 'error',
        name === 'NotAllowedError' ? 'Camera blocked · allow access, then retry' : 'Camera unavailable · retry or play manually');
    }
  }

  private scan = () => {
    if (!this.running || !this.landmarker) return;
    const now = performance.now();
    if (this.video.readyState >= 2 && this.video.videoWidth > 0 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      this.lastFrameAt = now;
      // Cosmetic rendering must never prevent blink detection.
      if (this.mugshotCanvas && !this.evidenceLocked) {
        try { this.hasMugshotFrame = captureCartoonFrame(this.video, this.mugshotCanvas) || this.hasMugshotFrame; }
        catch { /* Keep detecting even if the evidence canvas is unavailable. */ }
      }
      try {
        const result = this.landmarker.detectForVideo(this.video, now);
        this.scanErrors = 0;
        this.process(result);
      } catch (error) {
        if (++this.scanErrors >= 3) {
          console.warn('Blink detection failed:', error);
          this.fail('error', 'Blink detection interrupted · retry camera');
          return;
        }
      }
    } else if (now - this.lastFrameAt > 10000) {
      this.fail('error', 'Camera paused · retry camera');
      return;
    }
    // A blink callback can synchronously stop this detector.
    if (this.running) this.frameId = requestAnimationFrame(this.scan);
  };

  private fail(state: DetectorState, text: string) {
    this.running = false;
    this.generation += 1;
    this.release();
    this.state(state, text);
  }

  private release() {
    clearTimeout(this.startupTimer);
    cancelAnimationFrame(this.frameId);
    this.landmarker?.close();
    this.landmarker = null;
    this.stopStream();
  }
  private process(result: FaceLandmarkerResult) { const now = performance.now(); const landmarks = result.faceLandmarks[0]; if (!landmarks?.length) { this.headTurnAt = 0; if (this.faceSeen || this.openSeen) { if (!this.faceMissingAt) { this.faceMissingAt = now; this.setCameraText("Face the camera"); } else if (now - this.faceMissingAt >= FACE_LOST_FAIL_MS) this.failLookAway(); } return; } this.faceSeen = true; this.faceMissingAt = 0; if (this.isLookingAway(landmarks)) { if (!this.headTurnAt) { this.headTurnAt = now; this.setCameraText("Face the camera"); } else if (now - this.headTurnAt >= HEAD_TURN_FAIL_MS) this.failLookAway(); return; } if (this.headTurnAt) { this.headTurnAt = 0; this.setCameraText("Mugshot live · eyes locked"); } const shapes = result.faceBlendshapes?.[0]?.categories ?? []; const l = shapes.find((x) => x.categoryName === "eyeBlinkLeft")?.score ?? 0; const r = shapes.find((x) => x.categoryName === "eyeBlinkRight")?.score ?? 0; const closed = (l + r) / 2 > .48; if (closed) { if (this.openSeen) this.stashClosedFrame(); if (this.openSeen && !this.shutAt) this.shutAt = now; else if (this.openSeen && now - this.shutAt > 55) this.triggerBlink(); } else { if (this.shutAt && this.openSeen && now - this.shutAt > 55) this.triggerBlink(); this.openSeen = true; this.shutAt = 0; if (!this.evidenceLocked) this.setCameraText("Mugshot live · eyes locked"); } }
  private isLookingAway(landmarks: FaceLandmark[]) { const nose = landmarks[NOSE_TIP]; const leftEye = landmarks[LEFT_EYE_OUTER]; const rightEye = landmarks[RIGHT_EYE_OUTER]; if (!nose || !leftEye || !rightEye || nose.x == null || leftEye.x == null || rightEye.x == null) return false; const eyeDistance = Math.hypot((rightEye.x ?? 0) - (leftEye.x ?? 0), (rightEye.y ?? 0) - (leftEye.y ?? 0)); if (!eyeDistance) return false; const eyeMidX = ((leftEye.x ?? 0) + (rightEye.x ?? 0)) / 2; return Math.abs((nose.x ?? 0) - eyeMidX) / eyeDistance > HEAD_TURN_RATIO; }
  private failLookAway() { this.setCameraText("Looked away · tax due"); this.triggerBlink(); }
  private triggerBlink() { if (this.evidenceLocked) return; this.evidenceLocked = true; this.encodeFrozenMugshot(); this.blink(); }
  private stashClosedFrame() { if (!this.mugshotCanvas || !this.hasMugshotFrame) return; if (!this.closedCanvas) { this.closedCanvas = document.createElement('canvas'); this.closedCanvas.width = this.mugshotCanvas.width; this.closedCanvas.height = this.mugshotCanvas.height; } const ctx = this.closedCanvas.getContext('2d'); if (!ctx) return; ctx.drawImage(this.mugshotCanvas, 0, 0); }
  private encodeFrozenMugshot() { if (this.frozenMugshot) return; const source = this.closedCanvas ?? (this.hasMugshotFrame ? this.mugshotCanvas : null); if (!source) return; this.frozenMugshot = source.toDataURL('image/png'); }
  private setCameraText(text: string) { if (this.cameraText === text) return; this.cameraText = text; this.state("ready", text); }
  freezeMugshot() { if (this.frozenMugshot) return this.frozenMugshot; this.encodeFrozenMugshot(); return this.frozenMugshot; }
  stop() {
    this.running = false;
    this.generation += 1;
    this.release();
    this.state('stopped', 'Camera off');
  }
  private stopStream() { this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null; this.video.srcObject = null; }
}
