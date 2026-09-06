export type GameStatus = 'idle' | 'playing' | 'over';
export class BlinkGame {
  status: GameStatus = 'idle'; startedAt = 0; score = 0; private frame = 0;
  constructor(private onTick: (seconds: number, intensity: number) => void, private onOver: (seconds: number) => void) {}
  start(startedAt = performance.now()) { this.status = 'playing'; this.startedAt = startedAt; this.score = 0; cancelAnimationFrame(this.frame); this.tick(); }
  stop() { this.status = 'idle'; cancelAnimationFrame(this.frame); }
  private tick = () => { if (this.status !== 'playing') return; const elapsed = (performance.now() - this.startedAt) / 1000; this.score = elapsed; this.onTick(elapsed, Math.min(1, elapsed / 30)); this.frame = requestAnimationFrame(this.tick); };
  blink() { if (this.status !== 'playing') return; this.status = 'over'; cancelAnimationFrame(this.frame); this.onOver(this.score); }
}
