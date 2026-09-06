import './styles.css';
import { BlinkGame } from './game';
import { BlinkDetector, type DetectorState } from './blink-detector';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.className = 'app';
const bestKey = 'blink-tax-best';
let best = Number(localStorage.getItem(bestKey) ?? 0);
let game: BlinkGame;
let detector: BlinkDetector | null = null;
let toastTimer = 0;
const format = (seconds: number) => seconds.toFixed(1);
const setScreen = (screen: HTMLElement) => app.replaceChildren(screen);
const button = (label: string, className: string, action: string) => `<button class="${className}" data-action="${action}">${label}</button>`;

function landing() {
  const screen = document.createElement('main'); screen.className = 'screen landing';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax</span><span>Est. right now</span></header><section class="hero"><p class="eyebrow">A staring contest with consequences</p><h1>BLINK<br>TAX</h1><p class="hero-copy">Stare at the color.<br><em>Blink and pay.</em></p></section><div>${button('Pay nothing →', 'cta', 'play')}<div class="footer-note"><span>Camera stays on your device.<br>No accounts. No mercy.</span><span>Best<br><strong>${format(best)}s</strong></span></div></div>`;
  setScreen(screen);
}

function play() {
  const screen = document.createElement('main'); screen.className = 'screen game-screen';
  screen.innerHTML = `<header class="game-header"><div class="game-label"><span class="live">Live</span><br>Do not blink</div><div class="game-label">Space / tap<br>to surrender</div></header><div class="camera-status" data-state="starting" aria-live="polite">Looking for a camera…</div><video class="camera-video" playsinline muted></video><section class="timer-wrap" aria-live="polite"><div class="timer">0.0</div><div class="timer-unit">seconds unpaid</div><p class="instruction">Keep your eyes open.<br>It gets worse.</p></section><div>${button('I blinked', 'blink-button', 'blink')}<div class="manual-hint">Tap anywhere or hit spacebar if the tax collector missed you</div></div>`;
  setScreen(screen);
  const video = screen.querySelector<HTMLVideoElement>('.camera-video')!;
  const status = screen.querySelector<HTMLElement>('.camera-status')!;
  const timer = screen.querySelector<HTMLElement>('.timer')!;
  game = new BlinkGame((seconds, intensity) => {
    timer.textContent = format(seconds);
    const hue = (12 + seconds * (1.4 + intensity * 3.9)) % 360;
    const saturation = 89 - intensity * 10; const lightness = 53 - intensity * 8;
    app.style.backgroundColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    app.classList.toggle('pressure', intensity > .53);
  }, endGame);
  game.start();
  detector = new BlinkDetector(video, () => game.blink(), (state, detail) => setCameraStatus(status, state, detail));
  void detector.start();
}
function setCameraStatus(element: HTMLElement, state: DetectorState, detail?: string) { element.dataset.state = state; if (detail) element.textContent = detail; }

function endGame(seconds: number) {
  detector?.stop(); detector = null; const previousBest = best;
  if (seconds > best) { best = seconds; localStorage.setItem(bestKey, String(best)); }
  const screen = document.createElement('main'); screen.className = 'screen game-over';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax</span><span>Receipt #${Math.floor(seconds * 137) % 10000}</span></header><section class="over-content"><div class="over-kicker">Transaction failed</div><h2 class="over-title">YOU<br>BLINKED.</h2><div class="score-label">You stayed open for</div><div class="final-score">${format(seconds)}s</div><div class="best-line">${seconds > previousBest ? 'New personal best. Disgusting.' : `Personal best: <strong>${format(best)}s</strong>`}</div></section><div class="over-actions">${button('Share the shame ↗', 'cta share-button', 'share')}${button('Try not to blink again', 'secondary-button', 'retry')}</div>`;
  setScreen(screen); app.style.backgroundColor = '#111'; app.classList.remove('pressure');
  screen.querySelector('[data-action="share"]')?.addEventListener('click', () => shareScore(seconds));
}
async function shareScore(seconds: number) {
  const text = `I lasted ${format(seconds)}s without blinking on Blink Tax. Can you beat me?`;
  const url = `${window.location.origin}${window.location.pathname}?score=${encodeURIComponent(format(seconds))}`;
  try { if (navigator.share) await navigator.share({ title: 'Blink Tax', text, url }); else if (navigator.clipboard) { await navigator.clipboard.writeText(`${text} ${url}`); showToast('Challenge copied. Go cause problems.'); } else showToast(text); }
  catch (error) { if (error instanceof DOMException && error.name === 'AbortError') return; showToast('Share cancelled. Coward.'); }
}
function showToast(message: string) { let toast = document.querySelector<HTMLDivElement>('.toast'); if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.append(toast); } toast.textContent = message; toast.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast?.classList.remove('show'), 3000); }

app.addEventListener('click', (event) => { const target = event.target as HTMLElement; const action = target.closest<HTMLElement>('[data-action]')?.dataset.action; if (action === 'play') play(); if (action === 'blink') game?.blink(); if (action === 'retry') play(); });
window.addEventListener('keydown', (event) => { if (event.code === 'Space' && game?.status === 'playing') { event.preventDefault(); game.blink(); } });
app.addEventListener('pointerdown', (event) => { const target = event.target as HTMLElement; if (game?.status === 'playing' && !target.closest('button')) game.blink(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => undefined));
landing();
