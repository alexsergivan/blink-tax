export type PitPhase = 'lobby' | 'countdown' | 'playing' | 'results';
export type PitPlayerStatus = 'waiting' | 'ready' | 'playing' | 'blinked';
export type PitPlayer = { id: string; name: string; status: PitPlayerStatus; seconds?: number };
export type PitState = { phase: PitPhase; countdown?: number; players: PitPlayer[]; playerCount: number; readyCount: number; playersNeeded: number; startedAt?: number; youId: string };

type StateHandler = (state: PitState) => void;
type ErrorHandler = (message: string) => void;

export class PitClient {
  readonly configured: boolean;
  private socket: WebSocket | null = null;
  private readonly stateHandler: StateHandler;
  private readonly errorHandler: ErrorHandler;
  private name: string;

  constructor(onState: StateHandler, onError: ErrorHandler = () => undefined) {
    this.stateHandler = onState;
    this.errorHandler = onError;
    this.name = localStorage.getItem('blink-tax-pit-name') || `Tax Evader ${Math.floor(Math.random() * 90) + 1}`;
    this.configured = Boolean(import.meta.env.VITE_PIT_URL);
  }

  connect() {
    if (!this.configured) {
      this.errorHandler('Pit offline — VITE_PIT_URL is not configured.');
      return;
    }
    const configuredUrl = String(import.meta.env.VITE_PIT_URL).replace(/\/$/, '');
    const wsUrl = `${configuredUrl.replace(/^http/i, 'ws')}/ws?room=pit`;
    try {
      const socket = new WebSocket(wsUrl);
      this.socket = socket;
      socket.addEventListener('open', () => { if (this.socket === socket) this.send({ type: 'join', name: this.name }); });
      socket.addEventListener('message', (event) => {
        if (this.socket !== socket) return;
        try {
          const message = JSON.parse(String(event.data)) as PitState & { type?: string };
          if (message.type === 'state') this.stateHandler(message);
        } catch { this.errorHandler('Pit sent an unreadable receipt.'); }
      });
      socket.addEventListener('error', () => { if (this.socket === socket) this.errorHandler('Pit connection failed.'); });
      socket.addEventListener('close', () => {
        if (this.socket !== socket) return;
        this.socket = null; this.errorHandler('Connection lost. Rejoin the Pit to continue.');
      });
    } catch { this.errorHandler('Pit connection failed.'); }
  }

  setName(name: string) {
    const trimmed = name.trim().slice(0, 24);
    if (!trimmed) return;
    this.name = trimmed;
    localStorage.setItem('blink-tax-pit-name', trimmed);
    this.send({ type: 'join', name: trimmed });
  }

  ready(ready = true) { this.send({ type: 'ready', ready }); }
  blink(seconds: number) { this.send({ type: 'blink', seconds: Number(seconds.toFixed(2)) }); }
  rematch() { this.send({ type: 'rematch' }); }
  close() { const socket = this.socket; this.socket = null; socket?.close(); }

  private send(message: object) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message));
  }
}
