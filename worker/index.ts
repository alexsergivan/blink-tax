import { DurableObject } from "cloudflare:workers";

export interface Env {
  PIT_ROOM: DurableObjectNamespace;
  GITHUB_PAGES_ORIGIN?: string;
}

type Phase = 'lobby' | 'countdown' | 'playing' | 'results';
type PlayerStatus = 'waiting' | 'ready' | 'playing' | 'blinked';

type Player = {
  id: string;
  name: string;
  status: PlayerStatus;
  seconds?: number;
};

type RoomState = {
  phase: Phase;
  players: Player[];
  lobbySince: number | null;
  countdown: number | null;
  countdownEndsAt: number | null;
  startedAt: number | null;
};

type ClientMessage =
  | { type: 'join'; name?: string }
  | { type: 'ready'; ready?: boolean }
  | { type: 'blink'; seconds?: number }
  | { type: 'rematch' };

const MAX_PLAYERS = 24;
const PLAY_SECONDS = 90;
const LOBBY_WAIT_MANY = 8_000;
const LOBBY_WAIT_SINGLE = 20_000;
const DEFAULT_NAMES = [
  'Tax Evader', 'Audit Dodger', 'Blink Accountant', 'Fiscal Menace',
  'Late Filer', 'Receipt Goblin', 'Cash Wizard', 'VAT Villain',
  'Ledger Lurker', 'Deduction Gremlin', 'Bracket Bandit', 'Penny Pirate',
];

const json = (body: unknown, status = 200, extra: HeadersInit = {}) => {
  const headers = new Headers(extra);
  headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers });
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin');
    const corsOrigin = allowedOrigin(origin, env.GITHUB_PAGES_ORIGIN);
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(corsOrigin) });
    }
    if (url.pathname === '/' && request.method === 'GET') {
      return json({ ok: true, room: 'pit' }, 200, corsHeaders(corsOrigin));
    }
    if (url.pathname !== '/ws' || request.method !== 'GET') {
      return json({ error: 'Not found' }, 404, corsHeaders(corsOrigin));
    }
    if (url.searchParams.get('room') !== 'pit') {
      return json({ error: 'The public room is pit' }, 400, corsHeaders(corsOrigin));
    }
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return json({ error: 'WebSocket upgrade required' }, 426, corsHeaders(corsOrigin));
    }
    const room = env.PIT_ROOM.get(env.PIT_ROOM.idFromName('pit'));
    const response = await room.fetch(request);
    // The WebSocket handshake cannot carry normal CORS headers in every runtime,
    // but retaining them is useful for local tooling and health checks.
    if (corsOrigin) response.headers.set('Access-Control-Allow-Origin', corsOrigin);
    return response;
  },
};

function allowedOrigin(origin: string | null, configured?: string) {
  if (configured && origin === configured) return configured;
  if (origin && /^https:\/\/[a-z0-9-]+\.github\.io$/i.test(origin)) return origin;
  return configured ?? '*';
}

function corsHeaders(origin: string) {
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'Content-Type',
  };
}

export class PitRoom extends DurableObject {
  private room: RoomState = emptyRoom();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      const saved = await ctx.storage.get<RoomState>('room');
      if (saved) this.room = normalizeRoom(saved);
    });
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') {
      return new Response('WebSocket upgrade required', { status: 426 });
    }
    if (this.room.players.length >= MAX_PLAYERS) {
      return new Response('The Pit is full (24 blinkers max).', { status: 503 });
    }
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
    const id = crypto.randomUUID();
    const name = this.nextName();
    server.serializeAttachment({ id });
    this.ctx.acceptWebSocket(server);
    this.room.players.push({ id, name, status: 'waiting' });
    if (!this.room.lobbySince) this.room.lobbySince = Date.now();
    await this.persist();
    await this.broadcast();
    await this.scheduleLobbyAlarm();
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    const id = this.socketId(socket);
    if (!id) return;
    let payload: ClientMessage;
    try {
      payload = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message)) as ClientMessage;
    } catch {
      return;
    }
    const player = this.room.players.find((item) => item.id === id);
    if (!player) return;
    if (payload.type === 'join') {
      const requested = typeof payload.name === 'string' ? payload.name.trim().slice(0, 24) : '';
      if (requested) player.name = requested;
      await this.persist();
      await this.broadcast();
      return;
    }
    if (payload.type === 'ready' && this.room.phase === 'lobby') {
      const ready = typeof payload.ready === 'boolean' ? payload.ready : player.status !== 'ready';
      player.status = ready ? 'ready' : 'waiting';
      await this.persist();
      await this.broadcast();
      return;
    }
    if (payload.type === 'blink' && this.room.phase === 'playing' && player.status === 'playing') {
      const elapsed = this.room.startedAt ? (Date.now() - this.room.startedAt) / 1000 : 0;
      const sent = Number(payload.seconds);
      player.seconds = clamp(Number.isFinite(sent) ? sent : elapsed, 0, PLAY_SECONDS);
      // The server is authoritative, while allowing a small client clock skew.
      player.seconds = Math.min(player.seconds, elapsed + 0.75);
      player.status = 'blinked';
      if (this.room.players.filter((item) => item.status === 'playing').length === 0) {
        await this.finishResults();
      } else {
        await this.persist();
        await this.broadcast();
      }
      return;
    }
    if (payload.type === 'rematch' && this.room.phase === 'results') {
      const previousPlayers = this.room.players;
      this.room = emptyRoom();
      // Keep connected players and their names for a fast rematch.
      for (const ws of this.ctx.getWebSockets()) {
        const wsId = this.socketId(ws);
        const old = wsId ? previousPlayers.find((item) => item.id === wsId) : undefined;
        if (wsId) this.room.players.push({ id: wsId, name: old?.name ?? this.nextName(), status: 'waiting' });
      }
      this.room.lobbySince = Date.now();
      await this.persist();
      await this.broadcast();
      await this.scheduleLobbyAlarm();
    }
  }

  async webSocketClose(socket: WebSocket) {
    const id = this.socketId(socket);
    if (!id) return;
    this.room.players = this.room.players.filter((player) => player.id !== id);
    if (this.room.phase === 'lobby' && this.room.players.length === 0) this.room.lobbySince = null;
    await this.persist();
    await this.broadcast();
  }

  async webSocketError(socket: WebSocket) {
    await this.webSocketClose(socket);
  }

  async alarm() {
    const now = Date.now();
    if (this.room.phase === 'lobby') {
      const age = this.room.lobbySince ? now - this.room.lobbySince : 0;
      const enoughPlayers = this.room.players.length >= 2 && age >= LOBBY_WAIT_MANY;
      const soloDeadline = this.room.players.length >= 1 && age >= LOBBY_WAIT_SINGLE;
      if (enoughPlayers || soloDeadline) {
        this.room.phase = 'countdown';
        this.room.countdown = 3;
        this.room.countdownEndsAt = now + 1_000;
        this.room.players.forEach((player) => { player.status = 'playing'; });
        await this.persist();
        await this.broadcast();
        await this.ctx.storage.setAlarm(this.room.countdownEndsAt);
      } else {
        await this.scheduleLobbyAlarm();
      }
      return;
    }
    if (this.room.phase === 'countdown') {
      if ((this.room.countdown ?? 1) > 1) {
        this.room.countdown = (this.room.countdown ?? 2) - 1;
        this.room.countdownEndsAt = now + 1_000;
        await this.persist();
        await this.broadcast();
        await this.ctx.storage.setAlarm(this.room.countdownEndsAt);
      } else {
        await this.startPlaying();
      }
      return;
    }
    if (this.room.phase === 'playing' && this.room.startedAt && now >= this.room.startedAt + PLAY_SECONDS * 1_000) {
      this.room.players.forEach((player) => {
        if (player.status === 'playing') {
          player.status = 'blinked';
          player.seconds = PLAY_SECONDS;
        }
      });
      await this.finishResults();
    }
  }

  private async startPlaying() {
    this.room.phase = 'playing';
    this.room.countdown = null;
    this.room.countdownEndsAt = null;
    this.room.startedAt = Date.now();
    this.room.players.forEach((player) => { player.status = 'playing'; delete player.seconds; });
    await this.persist();
    await this.broadcast();
    await this.ctx.storage.setAlarm(this.room.startedAt + PLAY_SECONDS * 1_000);
  }

  private async finishResults() {
    this.room.players.sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0));
    this.room.phase = 'results';
    this.room.countdown = null;
    this.room.countdownEndsAt = null;
    await this.persist();
    await this.broadcast();
  }

  private async scheduleLobbyAlarm() {
    const age = this.room.lobbySince ? Date.now() - this.room.lobbySince : 0;
    const wait = this.room.players.length >= 2 ? Math.max(250, LOBBY_WAIT_MANY - age) : Math.max(250, LOBBY_WAIT_SINGLE - age);
    await this.ctx.storage.setAlarm(Date.now() + Math.min(wait, 1_000));
  }

  private async broadcast() {
    const playerCount = this.room.players.length;
    const readyCount = this.room.players.filter((player) => player.status === 'ready').length;
    const message = JSON.stringify({
      type: 'state',
      phase: this.room.phase,
      ...(this.room.countdown ? { countdown: this.room.countdown } : {}),
      players: this.room.players,
      playerCount,
      readyCount,
      playersNeeded: Math.max(0, 2 - playerCount),
      ...(this.room.startedAt ? { startedAt: this.room.startedAt } : {}),
    });
    for (const socket of this.ctx.getWebSockets()) {
      try {
        const id = this.socketId(socket);
        socket.send(JSON.stringify({ ...JSON.parse(message), youId: id }));
      } catch {
        // Hibernating sockets can disappear between getWebSockets and send.
      }
    }
  }

  private socketId(socket: WebSocket) {
    const attachment = socket.deserializeAttachment() as { id?: string } | null;
    return attachment?.id ?? null;
  }

  private nextName() {
    const used = new Set(this.room.players.map((player) => player.name));
    const base = DEFAULT_NAMES.find((name) => !used.has(name)) ?? 'Tax Evader';
    if (!used.has(base)) return `${base} ${Math.floor(Math.random() * 90) + 1}`;
    let index = this.room.players.length + 1;
    while (used.has(`${base} ${index}`)) index += 1;
    return `${base} ${index}`;
  }

  private async persist() {
    await this.ctx.storage.put('room', this.room);
  }
}

function emptyRoom(): RoomState {
  return { phase: 'lobby', players: [], lobbySince: null, countdown: null, countdownEndsAt: null, startedAt: null };
}

function normalizeRoom(input: RoomState): RoomState {
  return {
    ...emptyRoom(), ...input,
    players: Array.isArray(input.players) ? input.players.slice(0, MAX_PLAYERS) : [],
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
