import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from '@mediapipe/tasks-vision';
export type DetectorState = 'starting' | 'ready' | 'denied' | 'unsupported' | 'error' | 'stopped';
export class BlinkDetector {
  private landmarker: FaceLandmarker | null = null;
  private stream: MediaStream | null = null;
  private frameId = 0;
  private openSeen = false;
  private shutAt = 0;
  constructor(private video: HTMLVideoElement, private blink: () => void, private state: (s: DetectorState, text?: string) => void) {}
  async start() {
    if (!navigator.mediaDevices?.getUserMedia) { this.state('unsupported', 'Camera not available'); return; }
    this.state('starting', 'Looking for a camera…');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();
      const vision = await FilesetResolver.forVisionTasks('./wasm');
      this.landmarker = await FaceLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: './face_landmarker.task' }, runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: true });
      this.state('ready', 'Eyes locked · camera stays local'); this.scan();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      this.state(name === 'NotAllowedError' ? 'denied' : 'error', name === 'NotAllowedError' ? 'Camera off · manual mode' : 'Manual mode · camera unavailable'); this.stopStream();
    }
  }
  private scan = () => {
    if (!this.landmarker || this.video.readyState < 2) { this.frameId = requestAnimationFrame(this.scan); return; }
    const result = this.landmarker.detectForVideo(this.video, performance.now());
    this.process(result);
    this.frameId = requestAnimationFrame(this.scan);
  };
  private process(result: FaceLandmarkerResult) {
    if (!result.faceLandmarks.length) return;
    const shapes = result.faceBlendshapes?.[0]?.categories ?? [];
    const l = shapes.find((x) => x.categoryName === 'eyeBlinkLeft')?.score ?? 0;
    const r = shapes.find((x) => x.categoryName === 'eyeBlinkRight')?.score ?? 0;
    const closed = (l + r) / 2 > .48;
    const now = performance.now();
    if (!closed) { if (this.shutAt && this.openSeen && now - this.shutAt > 55) this.blink(); this.openSeen = true; this.shutAt = 0; }
    else if (this.openSeen && !this.shutAt) this.shutAt = now;
  }
  stop() {
    cancelAnimationFrame(this.frameId);
    this.landmarker?.close(); this.landmarker = null; this.stopStream(); this.state("stopped");
  }
  private stopStream() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null; this.video.srcObject = null;
  }
}
