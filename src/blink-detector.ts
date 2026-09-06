import { capturePixelFrame } from './mugshot';

type BlendshapeCategory = { categoryName?: string; score?: number }; type FaceLandmark = { x?: number; y?: number }; type FaceLandmarkerResult = { faceLandmarks: FaceLandmark[][]; faceBlendshapes?: Array<{ categories?: BlendshapeCategory[] }> }; type FaceLandmarker = { detectForVideo(video: HTMLVideoElement, timestamp: number): FaceLandmarkerResult; close(): void }; type VisionModule = { FaceLandmarker: { createFromOptions(vision: unknown, options: { baseOptions: { modelAssetPath: string }; runningMode: 'VIDEO'; numFaces: number; outputFaceBlendshapes: boolean }): Promise<FaceLandmarker> }; FilesetResolver: { forVisionTasks(wasmPath: string): Promise<unknown> } };
const VISION_BASE = "https://cdn.jsdelivr.net/" + "n" + "pm" + "/";
const VISION_PACKAGE = "@" + "mediapipe/tasks-" + "vision" + "@" + "0.10.18"; const VISION_MODULE_URL = VISION_BASE + VISION_PACKAGE + "/+esm"; const WASM_URL = VISION_BASE + VISION_PACKAGE + "/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const loadVision = () => import(/* @vite-ignore */ VISION_MODULE_URL) as Promise<VisionModule>;
const FACE_LOST_FAIL_MS = 340;
const HEAD_TURN_FAIL_MS = 240;
const HEAD_TURN_RATIO = .42;
const NOSE_TIP = 1;
const LEFT_EYE_OUTER = 33;
const RIGHT_EYE_OUTER = 263;
export type DetectorState = 'starting' | 'ready' | 'denied' | 'unsupported' | 'error' | 'stopped';
export class BlinkDetector {
  private landmarker: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private frameId = 0;
  private openSeen = false;
  private faceSeen = false;
  private shutAt = 0;
  private faceMissingAt = 0;
  private headTurnAt = 0;
  private cameraText = "";
  private hasMugshotFrame = false;
  private frozenMugshot: string | null = null;
  constructor(private video: HTMLVideoElement, private mugshotCanvas: HTMLCanvasElement | null, private blink: () => void, private state: (s: DetectorState, text?: string) => void) {}
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) { this.state('unsupported', 'Camera not available'); return; }
    this.state('starting', 'Looking for a camera…');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
      const { FaceLandmarker, FilesetResolver } = await loadVision(); const vision = await FilesetResolver.forVisionTasks(WASM_URL);
      this.landmarker = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_URL }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
      this.setCameraText('Mugshot live · eyes locked'); this.scan();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      this.state(name === 'NotAllowedError' ? 'denied' : 'error', name === 'NotAllowedError' ? 'Camera off · manual mode' : 'Manual mode · camera unavailable'); this.stopStream();
    }
  }
  private scan = () => {
    if (!this.landmarker || this.video.readyState < 2) { this.frameId = requestAnimationFrame(this.scan); return; }
    if (this.mugshotCanvas) this.hasMugshotFrame = capturePixelFrame(this.video, this.mugshotCanvas) || this.hasMugshotFrame;
    const result = this.landmarker.detectForVideo(this.video, performance.now());
    this.process(result);
    this.frameId = requestAnimationFrame(this.scan);
  };
  private process(result: FaceLandmarkerResult) {
    const now = performance.now();
    const landmarks = result.faceLandmarks[0];
    if (!landmarks?.length) {
      this.headTurnAt = 0;
      if (this.faceSeen || this.openSeen) {
        if (!this.faceMissingAt) { this.faceMissingAt = now; this.setCameraText("Face the camera"); }
        else if (now - this.faceMissingAt >= FACE_LOST_FAIL_MS) this.failLookAway();
      }
      return;
    }
    this.faceSeen = true; this.faceMissingAt = 0;
    if (this.isLookingAway(landmarks)) {
      if (!this.headTurnAt) { this.headTurnAt = now; this.setCameraText("Face the camera"); }
      else if (now - this.headTurnAt >= HEAD_TURN_FAIL_MS) this.failLookAway();
      return;
    }
    if (this.headTurnAt) { this.headTurnAt = 0; this.setCameraText("Mugshot live · eyes locked"); }
    const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
    const l = shapes.find((x) => x.categoryName === "eyeBlinkLeft")?.score ?? 0;
    const r = shapes.find((x) => x.categoryName === "eyeBlinkRight")?.score ?? 0;
    const closed = (l + r) / 2 > .48;
    if (!closed) { if (this.shutAt && this.openSeen && now - this.shutAt > 55) this.blink(); this.openSeen = true; this.shutAt = 0; }
    else if (this.openSeen && !this.shutAt) this.shutAt = now;
  }
  private isLookingAway(landmarks: FaceLandmark[]) {
    const nose = landmarks[NOSE_TIP]; const leftEye = landmarks[LEFT_EYE_OUTER]; const rightEye = landmarks[RIGHT_EYE_OUTER];
    if (!nose || !leftEye || !rightEye || nose.x == null || leftEye.x == null || rightEye.x == null) return false;
    const eyeDistance = Math.hypot((rightEye.x ?? 0) - (leftEye.x ?? 0), (rightEye.y ?? 0) - (leftEye.y ?? 0));
    if (!eyeDistance) return false;
    const eyeMidX = ((leftEye.x ?? 0) + (rightEye.x ?? 0)) / 2;
    return Math.abs((nose.x ?? 0) - eyeMidX) / eyeDistance > HEAD_TURN_RATIO;
  }
  private failLookAway() { this.setCameraText("Looked away · tax due"); this.blink(); }
  private setCameraText(text: string) { if (this.cameraText === text) return; this.cameraText = text; this.state("ready", text); }
  freezeMugshot() {
    if (!this.hasMugshotFrame || !this.mugshotCanvas) return null;
    this.frozenMugshot = this.mugshotCanvas.toDataURL('image/png');
    return this.frozenMugshot;
  }
  stop() { cancelAnimationFrame(this.frameId); this.landmarker?.close(); this.landmarker = null; this.stopStream(); this.state("stopped"); }
  private stopStream() { this.stream?.getTracks().forEach((track) => track.stop()); this.stream = null; this.video.srcObject = null; }
}
