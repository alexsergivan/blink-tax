import './styles.css';
import { BlinkGame } from './game';
import { BlinkDetector, type DetectorState } from './blink-detector';
import { createCartoonFaceDataUrl, drawCartoonFace } from './mugshot';
import { generatePitShareCard, generateShareCard } from './share-card';
import { PitClient, type PitState } from './pit';

const app = document.querySelector<HTMLDivElement>('#app')!;
const bestKey = 'blink-tax-best';
app.className = 'app';
let best = Number(localStorage.getItem(bestKey) ?? 0);
let game: BlinkGame;
let detector: BlinkDetector | null = null;
let pitGame: BlinkGame | null = null;
let pitClient: PitClient | null = null;
let pitDetector: BlinkDetector | null = null;
let pitState: PitState | null = null;
let toastTimer = 0;
let shareCardPromise: Promise<Blob> | null = null;
let shareCardUrl: string | null = null;
let pitShareCardPromise: Promise<Blob> | null = null;
let pitShareCardUrl: string | null = null;
const format = (seconds: number) => seconds.toFixed(1);
const getShareUrl = () => `${window.location.origin}${window.location.pathname}`;
const setScreen = (screen: HTMLElement) => app.replaceChildren(screen);
const button = (label: string, className: string, action: string) => `<button class="${className}" data-action="${action}">${label}</button>`;

function landing() {
  const screen = document.createElement('main'); screen.className = 'screen landing';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax</span><span>Est. right now</span></header><section class="hero"><p class="eyebrow">A staring contest with consequences</p><h1>BLINK<br>TAX</h1><p class="hero-copy">Stare at the color.<br><em>Blink and pay.</em></p></section><div class="landing-cta"><p class="mechanic-note">Eyes on the color. Blink and you’re done.<br><strong>Camera stays on-device (optional).</strong></p>${button('Pay nothing →', 'cta', 'play')}${button('Enter the Pit →', 'pit-cta', 'pit')}<div class="footer-note"><span>Camera stays on your device.<br>No accounts. No mercy.</span><span>Best<br><strong>${format(best)}s</strong></span></div></div>`;
  setScreen(screen);
}

function play() {
  pitClient?.close(); pitClient = null;
  const screen = document.createElement('main'); screen.className = 'screen game-screen';
  screen.innerHTML = `<header class="game-header"><div class="game-label"><span class="live">Live</span><br>Do not blink</div><div class="game-label">Space / tap<br>to surrender</div></header><div class="camera-status" data-state="starting" aria-live="polite">Looking for a camera…</div><video class="camera-video" playsinline muted></video><div class="mugshot-unit" data-state="starting"><div class="mugshot-label">MUGSHOT OFF</div><canvas class="mugshot-canvas" width="160" height="160" aria-label="Cartoon fallback mugshot"></canvas><div class="mugshot-caption">MANUAL MODE</div></div><section class="timer-wrap" aria-live="polite"><div class="timer">0.0</div><div class="timer-unit">seconds unpaid</div><p class="instruction">Keep your eyes open.<br>It gets worse.</p></section><div>${button('I blinked', 'blink-button', 'blink')}<div class="manual-hint">Tap anywhere or hit spacebar if the tax collector missed you</div></div>`;
  setScreen(screen);
  const video = screen.querySelector<HTMLVideoElement>('.camera-video')!;
  const status = screen.querySelector<HTMLElement>('.camera-status')!;
  const mugshotCanvas = screen.querySelector<HTMLCanvasElement>('.mugshot-canvas')!;
  const mugshotUnit = screen.querySelector<HTMLElement>('.mugshot-unit')!;
  const mugshotContext = mugshotCanvas.getContext('2d'); if (mugshotContext) drawCartoonFace(mugshotContext);
  const timer = screen.querySelector<HTMLElement>('.timer')!;
  game = new BlinkGame((seconds, intensity) => {
    timer.textContent = format(seconds);
    const hue = (12 + seconds * (1.4 + intensity * 3.9)) % 360;
    const saturation = 89 - intensity * 10; const lightness = 53 - intensity * 8;
    app.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    app.classList.toggle('pressure', intensity > .53);
  }, endGame);
  game.start();
  detector = new BlinkDetector(video, mugshotCanvas, () => game.blink(), (state, detail) => setCameraStatus(status, mugshotUnit, state, detail));
  void detector.start();
}
function setCameraStatus(element: HTMLElement, mugshot: HTMLElement, state: DetectorState, detail?: string) {
  element.dataset.state = state; mugshot.dataset.state = state; if (detail) element.textContent = detail;
  if (state === 'starting' || state === 'denied' || state === 'unsupported' || state === 'error' || state === 'stopped') {
    mugshot.querySelector<HTMLElement>('.mugshot-label')!.textContent = 'MUGSHOT OFF';
    mugshot.querySelector<HTMLElement>('.mugshot-caption')!.textContent = 'MANUAL MODE';
  } else if (state === 'ready') {
    mugshot.querySelector<HTMLElement>('.mugshot-label')!.textContent = detail?.startsWith('Looked away') ? 'CAUGHT' : 'MUGSHOT LIVE';
  }
}

function endGame(seconds: number) {
  const frozenMugshot = detector?.freezeMugshot() ?? null;
  detector?.stop(); detector = null;
  const isNewBest = seconds > best;
  if (isNewBest) { best = seconds; localStorage.setItem(bestKey, String(best)); }
  const receiptId = String(Math.floor(seconds * 137) % 10000).padStart(4, '0');
  const fallbackMugshot = createCartoonFaceDataUrl();
  const screen = document.createElement('main'); screen.className = 'screen game-over';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax</span><span>Receipt #${receiptId}</span></header><section class="over-content"><div class="result-grid"><div class="result-copy"><div class="over-kicker">Transaction failed</div><h2 class="over-title">YOU<br>BLINKED.</h2><div class="score-label">You stayed open for</div><div class="final-score">${format(seconds)}s</div><div class="best-line">${isNewBest ? 'New personal best. Disgusting.' : `Personal best: <strong>${format(best)}s</strong>`}</div></div><div class="mugshot-result"><div class="frozen-label">${frozenMugshot ? 'CAUGHT' : 'NO CAMERA'}</div><img class="frozen-mugshot" src="${frozenMugshot || fallbackMugshot}" alt="${frozenMugshot ? 'Frozen cartoon mugshot' : 'Cartoon face showing camera was unavailable'}"><div class="frozen-caption">EVIDENCE</div></div></div><div class="over-actions">${button('Share the shame ↗', 'cta share-button', 'share')}${button('Try not to blink again', 'secondary-button', 'retry')}</div><div class="share-card-wrap"><div class="share-card-label">Your feed-ready receipt</div><div class="share-card-frame"><div class="share-card-placeholder" aria-hidden="true"></div><img class="share-card-image" alt="Blink Tax share card preview"></div></div></section>`;
  setScreen(screen); app.style.backgroundColor = '#111'; app.classList.remove('pressure');
  shareCardPromise = generateShareCard({ seconds, isNewBest, best, url: getShareUrl(), mugshot: frozenMugshot, receiptId }).then((blob) => {
    if (shareCardUrl) URL.revokeObjectURL(shareCardUrl);
    shareCardUrl = URL.createObjectURL(blob);
    const image = screen.querySelector<HTMLImageElement>('.share-card-image');
    const placeholder = screen.querySelector<HTMLElement>('.share-card-placeholder');
    if (image) image.src = shareCardUrl;
    if (placeholder) placeholder.remove();
    return blob;
  }).catch(() => { throw new Error('Share card generation failed'); });
  screen.querySelector('[data-action="share"]')?.addEventListener('click', () => shareScore(seconds));
}

async function shareScore(seconds: number) {
  const text = 'I lasted ' + format(seconds) + 's without blinking on Blink Tax. Can you beat me?';
  const url = `${getShareUrl()}?score=${encodeURIComponent(format(seconds))}`;
  try {
    const blob = shareCardPromise ? await shareCardPromise : null;
    const file = blob ? new File([blob], `blink-tax-${format(seconds)}s.png`, { type: 'image/png' }) : null;
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: 'Blink Tax', text, files: [file] }); showToast('Receipt shared. Cause problems.'); return; }
    if (file) downloadCard(file);
    if (navigator.clipboard) { await navigator.clipboard.writeText(`${text} ${url}`); showToast(file ? 'PNG saved. Challenge copied.' : 'Challenge copied. Go cause problems.'); }
    else showToast(file ? 'PNG saved. Go cause problems.' : text);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') { showToast('Share dismissed.'); return; }
    if (error instanceof Error && error.message === 'Share card generation failed') { showToast('Receipt printer jammed — try again.'); return; }
    showToast('Share failed. Try again.');
  }
}
function downloadCard(file: File) { const link = document.createElement('a'); const objectUrl = URL.createObjectURL(file); link.href = objectUrl; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
function showToast(message: string) { let toast = document.querySelector<HTMLDivElement>('.toast'); if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; const host = document.querySelector<HTMLElement>('.game-over .over-actions'); (host ?? document.body).append(toast); } toast.textContent = message; toast.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast?.classList.remove('show'), 3000); }

function pit() {
  cleanupPit();
  pitClient = new PitClient((state) => { pitState = state; renderPit(state); }, (message) => { if (!pitState || pitState.phase !== 'playing') renderPitOffline(message); });
  if (!pitClient.configured) { renderPitOffline('Pit offline — add VITE_PIT_URL to connect.'); return; }
  renderPitConnecting(); pitClient.connect();
}
function renderPitConnecting() {
  const screen = document.createElement('main'); screen.className = 'screen pit-screen';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax / The Pit</span><span>Connecting…</span></header><section class="pit-connect"><div class="pit-kicker">PUBLIC ROOM · PIT</div><h2>JOINING<br>THE PUBLIC ROOM.</h2><p>You join the public Pit automatically. Choose an alias, mark Ready, then keep staring. Twenty-four max.</p></section>${button('Back to solo', 'secondary-button', 'pit-back')}`;
  setScreen(screen);
}
function renderPitOffline(message: string) {
  cleanupPit();
  const screen = document.createElement('main'); screen.className = 'screen pit-screen';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax / The Pit</span><span>Offline</span></header><section class="pit-connect"><div class="pit-kicker">PUBLIC ROOM · PIT</div><h2>PIT<br>OFFLINE.</h2><p>${message}</p><p class="pit-note">The solo contest still works. Set <strong>VITE_PIT_URL</strong> when the worker is live.</p></section>${button('Back to solo', 'secondary-button', 'pit-back')}`;
  setScreen(screen);
}
function pitRoomCounts(state: PitState) {
  const playerCount = state.playerCount ?? state.players.length;
  const readyCount = state.readyCount ?? state.players.filter((player) => player.status === 'ready').length;
  const playersNeeded = state.playersNeeded ?? Math.max(0, 2 - playerCount);
  return { playerCount, readyCount, playersNeeded };
}

function resetPitShareCard() {
  pitShareCardPromise = null;
  if (pitShareCardUrl) URL.revokeObjectURL(pitShareCardUrl);
  pitShareCardUrl = null;
}

function renderPit(state: PitState) {
  if (state.phase === 'playing' && document.querySelector('.pit-play')) { updatePitBoard(state); return; }
  if (state.phase === 'results' && document.querySelector('.pit-results')) { updatePitResults(state); return; }
  if (state.phase === 'playing') { renderPitPlay(state); return; }
  if (state.phase === 'results') { renderPitResults(state); return; }
  const screen = document.createElement('main'); screen.className = 'screen pit-screen';
  const board = state.players.map((player) => `<li class="pit-player ${player.status}"><span class="pit-player-dot"></span><span>${escapeHtml(player.name)}${player.id === state.youId ? ' <b>(you)</b>' : ''}</span><strong>${player.status === 'ready' ? 'READY' : player.status.toUpperCase()}</strong></li>`).join('');
  const { playerCount, readyCount, playersNeeded } = pitRoomCounts(state);
  const me = state.players.find((player) => player.id === state.youId);
  const lobbyStatus = me?.status === 'ready' ? 'You are ready. Waiting for the room to start.' : 'You are in the room. Mark Ready when you are set.';
  const countdown = state.phase === 'countdown' ? `<div class="pit-countdown"><span>BLINK IN</span><strong>${state.countdown ?? 1}</strong></div>` : '';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax / The Pit</span><span>${playerCount}/24 in room</span></header><section class="pit-lobby"><div class="pit-kicker">PUBLIC ROOM · PIT</div><h2>LAST BLINKER<br>WINS.</h2><p class="pit-sub">You are in the public room. The roster and readiness update live.</p><div class="pit-room-status"><strong>${playerCount} · ${readyCount} ready · need ${playersNeeded}</strong><span>${lobbyStatus} Solo rooms start after the solo wait.</span></div><div class="pit-name-row"><label for="pit-name">Your alias</label><input id="pit-name" maxlength="24" value="${escapeHtml(localStorage.getItem('blink-tax-pit-name') || '')}" placeholder="Tax Evader 7"><button data-action="pit-name">Save</button></div><div class="pit-board-head"><span>Players in room</span><span>${readyCount} ready</span></div><ul class="pit-players">${board || '<li class="pit-empty">Waiting for blinkers to enter…</li>'}</ul>${state.phase === 'lobby' ? button('I’m ready →', 'cta pit-ready', 'pit-ready') : ''}${button('Leave the pit', 'secondary-button', 'pit-back')}</section>${countdown}`;
  setScreen(screen);
  const readyButton = screen.querySelector<HTMLButtonElement>('[data-action="pit-ready"]');
  if (readyButton) readyButton.textContent = me?.status === 'ready' ? 'I’m not ready' : 'I’m ready →';
}
function renderPitPlay(state: PitState) {
  const screen = document.createElement('main'); screen.className = 'screen pit-screen pit-play';
  screen.innerHTML = `<header class="game-header"><div class="game-label"><span class="live">Live</span><br>The Pit</div><div class="game-label pit-count-label"><span data-pit-count>0 still staring / 0 out</span><br>90s hard cap</div><div class="pit-status" data-pit-status aria-live="polite">YOU’RE STILL IN · KEEP STARING</div></header><div class="camera-status" data-state="starting">Looking for a camera…</div><video class="camera-video" playsinline muted></video><div class="mugshot-unit" data-state="starting"><div class="mugshot-label">MUGSHOT OFF</div><canvas class="mugshot-canvas" width="160" height="160"></canvas><div class="mugshot-caption">MANUAL MODE</div></div><section class="timer-wrap"><div class="timer">0.0</div><div class="timer-unit">seconds unpaid</div><p class="instruction">Keep your eyes open.<br>They are watching.</p></section><div>${button('I blinked', 'blink-button pit-blink', 'pit-blink')}<div class="manual-hint">Spacebar, blink button, or camera blink to surrender</div></div><aside class="pit-live-board"><div class="pit-board-head"><span>Live board</span><span>Standings</span></div><ul class="pit-players" data-pit-board></ul></aside>`;
  setScreen(screen); setupPitPlay(screen, state);
}
function setupPitPlay(screen: HTMLElement, state: PitState) {
  const video = screen.querySelector<HTMLVideoElement>('.camera-video')!;
  const status = screen.querySelector<HTMLElement>('.camera-status')!;
  const canvas = screen.querySelector<HTMLCanvasElement>('.mugshot-canvas')!;
  const mugshot = screen.querySelector<HTMLElement>('.mugshot-unit')!;
  const context = canvas.getContext('2d'); if (context) drawCartoonFace(context);
  const timer = screen.querySelector<HTMLElement>('.timer')!;
  pitGame = new BlinkGame((seconds, intensity) => { timer.textContent = format(seconds); app.style.backgroundColor = `hsl(${(12 + seconds * (1.4 + intensity * 3.9)) % 360}, ${89 - intensity * 10}%, ${53 - intensity * 8}%)`; app.classList.toggle('pressure', intensity > .53); }, (seconds) => { pitDetector?.stop(); const pitStatus = document.querySelector<HTMLElement>('[data-pit-status]'); if (pitStatus) { pitStatus.textContent = 'YOU’RE OUT · SPECTATING'; pitStatus.dataset.state = 'out'; } const blinkButton = document.querySelector<HTMLButtonElement>('[data-action="pit-blink"]'); if (blinkButton) blinkButton.disabled = true; pitClient?.blink(seconds); });
  pitGame.startedAt = state.startedAt ? performance.now() - (Date.now() - state.startedAt) : performance.now();
  pitGame.start();
  pitDetector = new BlinkDetector(video, canvas, () => pitGame?.blink(), (next, detail) => setCameraStatus(status, mugshot, next, detail));
  void pitDetector.start(); updatePitBoard(state);
}
function updatePitBoard(state: PitState) {
  const board = document.querySelector<HTMLElement>('[data-pit-board]'); if (!board) return;
  const stillStaring = state.players.filter((player) => player.status === 'playing').length;
  const out = state.players.filter((player) => player.status === 'blinked').length;
  const count = document.querySelector<HTMLElement>('[data-pit-count]'); if (count) count.textContent = `${stillStaring} still staring / ${out} out`;
  board.innerHTML = state.players.map((player) => `<li class="pit-player ${player.status}"><span class="pit-player-dot"></span><span>${escapeHtml(player.name)}${player.id === state.youId ? ' <b>(you)</b>' : ''}</span><strong>${player.status === 'blinked' ? `${format(player.seconds ?? 0)}s` : player.status.toUpperCase()}</strong></li>`).join('');
  const me = state.players.find((player) => player.id === state.youId);
  const pitStatus = document.querySelector<HTMLElement>('[data-pit-status]');
  if (pitStatus) { const isOut = me?.status === 'blinked'; pitStatus.textContent = isOut ? 'YOU’RE OUT · SPECTATING' : 'YOU’RE STILL IN · KEEP STARING'; pitStatus.dataset.state = isOut ? 'out' : 'in'; }
  const blinkButton = document.querySelector<HTMLButtonElement>('[data-action="pit-blink"]'); if (blinkButton) blinkButton.disabled = me?.status === 'blinked';
}
function updatePitResults(state: PitState) {
  const ranked = [...state.players].sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0));
  const rows = ranked.map((player, index) => `<li class="pit-rank"><b>${String(index + 1).padStart(2, '0')}</b><span>${escapeHtml(player.name)}${player.id === state.youId ? ' <em>(you)</em>' : ''}</span><strong>${format(player.seconds ?? 0)}s</strong></li>`).join('');
  const list = document.querySelector<HTMLElement>('[data-pit-results-list]'); if (list) list.innerHTML = rows;
  const winner = ranked[0];
  const callout = document.querySelector<HTMLElement>('[data-pit-winner]');
  if (callout && winner) callout.textContent = 'WINNER · ' + winner.name + ' · ' + format(winner.seconds ?? 0) + 's';
}
function renderPitResults(state: PitState) {
  cleanupPitPlay();
  const screen = document.createElement('main'); screen.className = 'screen pit-screen pit-results';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax / The Pit</span><span>Final receipt</span></header><section class="pit-result-content"><div class="pit-kicker">THE PIT · RANKED BY STARE TIME</div><div class="pit-winner" data-pit-winner>WINNER CALLING…</div><h2>BLINKED.<br>COLLECTIVELY.</h2><ol class="pit-results-list" data-pit-results-list></ol><div class="share-card-wrap pit-share-card-wrap"><div class="share-card-label">Your ranked Pit receipt</div><div class="share-card-frame"><div class="share-card-placeholder" data-pit-share-card-placeholder aria-hidden="true"></div><img class="share-card-image pit-share-card-image" data-pit-share-card-image alt="Pit ranked share card preview"></div></div><div class="pit-result-actions">${button('Share the shame ↗', 'cta', 'pit-share')}${button('Run it back', 'secondary-button', 'pit-rematch')}${button('Leave the pit', 'secondary-button', 'pit-back')}</div></section>`;
  setScreen(screen); updatePitResults(state); preparePitShareCard(state, screen);
}
function preparePitShareCard(state: PitState, screen: HTMLElement) {
  const ranked = [...state.players].sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0));
  const me = ranked.findIndex((player) => player.id === state.youId);
  const winner = ranked[0];
  resetPitShareCard();
  pitShareCardPromise = generatePitShareCard({ rank: me + 1, total: ranked.length, seconds: ranked[me]?.seconds ?? 0, winner: winner?.name ?? 'Unknown', url: getShareUrl() }).then((blob) => {
    pitShareCardUrl = URL.createObjectURL(blob);
    const image = screen.querySelector<HTMLImageElement>('[data-pit-share-card-image]');
    const placeholder = screen.querySelector<HTMLElement>('[data-pit-share-card-placeholder]');
    if (image) image.src = pitShareCardUrl;
    if (placeholder) placeholder.remove();
    return blob;
  });
}

async function sharePit(state: PitState) {
  const ranked = [...state.players].sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0));
  const me = ranked.findIndex((player) => player.id === state.youId);
  const seconds = ranked[me]?.seconds ?? 0;
  const text = "I ranked #" + (me + 1) + " in Blink Tax The Pit with " + format(seconds) + "s. Last blinker wins. Can you beat me?";
  try {
    const blob = pitShareCardPromise ? await pitShareCardPromise : null;
    const file = blob ? new File([blob], 'blink-tax-pit-receipt.png', { type: 'image/png' }) : null;
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) { await navigator.share({ title: 'Blink Tax — The Pit', text, files: [file] }); showToast('Pit receipt shared. Cause problems.'); return; }
    if (file) downloadCard(file);
    if (navigator.clipboard) { await navigator.clipboard.writeText(text + ' ' + getShareUrl()); showToast(file ? 'PNG saved. Pit ranking copied.' : 'Pit ranking copied. Go cause problems.'); }
    else showToast(file ? 'PNG saved. Go cause problems.' : text);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') { showToast('Share dismissed.'); return; }
    showToast('Share failed. Try again.');
  }
}

function cleanupPitPlay() { pitDetector?.stop(); pitDetector = null; pitGame = null; app.classList.remove('pressure'); app.style.backgroundColor = '#ff3d00'; }
function cleanupPit() { cleanupPitPlay(); resetPitShareCard(); pitClient?.close(); pitClient = null; pitState = null; }
function escapeHtml(value: string) { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }

app.addEventListener('click', (event) => {
  const target = event.target as HTMLElement; const action = target.closest<HTMLElement>('[data-action]')?.dataset.action;
  if (action === 'play') play();
  if (action === 'pit') pit();
  if (action === 'blink') game?.blink();
  if (action === 'retry') play();
  if (action === 'pit-back') { cleanupPit(); landing(); }
  if (action === 'pit-ready') { const me = pitState?.players.find((player) => player.id === pitState?.youId); pitClient?.ready(me?.status !== 'ready'); }
  if (action === 'pit-blink') pitGame?.blink();
  if (action === 'pit-rematch') { pitClient?.rematch(); }
  if (action === 'pit-share' && pitState) sharePit(pitState);
  if (action === 'pit-name') { const input = document.querySelector<HTMLInputElement>('#pit-name'); if (input) pitClient?.setName(input.value); }
});
window.addEventListener('keydown', (event) => { if (event.code === 'Space') { if (game?.status === 'playing') { event.preventDefault(); game.blink(); } else if (pitGame?.status === 'playing') { event.preventDefault(); pitGame.blink(); } } });
app.addEventListener('pointerdown', (event) => { const target = event.target as HTMLElement; if (game?.status === 'playing' && !target.closest('button')) game.blink(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=12').catch(() => undefined));
landing();
