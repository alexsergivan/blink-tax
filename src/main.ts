import './styles.css';
import { BlinkGame } from './game';
import { BlinkDetector, type DetectorState } from './blink-detector';
import { generateShareCard } from './share-card';

const app = document.querySelector<HTMLDivElement>('#app')!;
const bestKey = 'blink-tax-best';
app.className = 'app';
let best = Number(localStorage.getItem(bestKey) ?? 0);
let game: BlinkGame;
let detector: BlinkDetector | null = null;
let toastTimer = 0;
let shareCardPromise: Promise<Blob> | null = null;
let shareCardUrl: string | null = null;
const format = (seconds: number) => seconds.toFixed(1);
const getShareUrl = () => `${window.location.origin}${window.location.pathname}`;
const setScreen = (screen: HTMLElement) => app.replaceChildren(screen);
const button = (label: string, className: string, action: string) => `<button class="${className}" data-action="${action}">${label}</button>`;

function landing() {
  const screen = document.createElement('main'); screen.className = 'screen landing';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax</span><span>Est. right now</span></header><section class="hero"><p class="eyebrow">A staring contest with consequences</p><h1>BLINK<br>TAX</h1><p class="hero-copy">Stare at the color.<br><em>Blink and pay.</em></p></section><div class="landing-cta"><p class="mechanic-note">Eyes on the color. Blink and you’re done.<br><strong>Camera stays on-device (optional).</strong></p>${button('Pay nothing →', 'cta', 'play')}<div class="footer-note"><span>Camera stays on your device.<br>No accounts. No mercy.</span><span>Best<br><strong>${format(best)}s</strong></span></div></div>`;
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
  const isNewBest = seconds > best;
  if (isNewBest) { best = seconds; localStorage.setItem(bestKey, String(best)); }
  const screen = document.createElement('main'); screen.className = 'screen game-over';
  screen.innerHTML = `<header class="topline"><span class="brand-mark"><span class="brand-dot"></span> Blink Tax</span><span>Receipt #${Math.floor(seconds * 137) % 10000}</span></header><section class="over-content"><div class="result-grid"><div class="result-copy"><div class="over-kicker">Transaction failed</div><h2 class="over-title">YOU<br>BLINKED.</h2><div class="score-label">You stayed open for</div><div class="final-score">${format(seconds)}s</div><div class="best-line">${isNewBest ? 'New personal best. Disgusting.' : `Personal best: <strong>${format(best)}s</strong>`}</div></div><div class="share-card-wrap"><div class="share-card-label">Your feed-ready receipt</div><div class="share-card-frame"><div class="share-card-placeholder" aria-hidden="true"></div><img class="share-card-image" alt="Blink Tax share card preview"></div></div></div></section><div class="over-actions">${button('Share the shame ↗', 'cta share-button', 'share')}${button('Try not to blink again', 'secondary-button', 'retry')}</div>`;
  setScreen(screen); app.style.backgroundColor = '#111'; app.classList.remove('pressure');
  shareCardPromise = generateShareCard({ seconds, isNewBest, best, url: getShareUrl() }).then((blob) => {
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
  const text = `I lasted ${format(seconds)}s without blinking on Blink Tax. Can you beat me?`;
  const url = `${getShareUrl()}?score=${encodeURIComponent(format(seconds))}`;
  try {
    const blob = shareCardPromise ? await shareCardPromise : null;
    const file = blob ? new File([blob], `blink-tax-${format(seconds)}s.png`, { type: 'image/png' }) : null;
    if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ title: 'Blink Tax', text, files: [file] }); showToast('Receipt shared. Cause problems.'); return;
    }
    if (file) downloadCard(file);
    if (navigator.clipboard) { await navigator.clipboard.writeText(`${text} ${url}`); showToast(file ? 'PNG saved. Challenge copied.' : 'Challenge copied. Go cause problems.'); }
    else showToast(file ? 'PNG saved. Go cause problems.' : text);
  } catch (error) { if (error instanceof DOMException && error.name === 'AbortError') { showToast('Share dismissed.'); return; } if (error instanceof Error && error.message === 'Share card generation failed') { showToast('Receipt printer jammed — try again.'); return; } showToast('Share failed. Try again.'); }
}
function downloadCard(file: File) { const link = document.createElement('a'); const objectUrl = URL.createObjectURL(file); link.href = objectUrl; link.download = file.name; link.click(); window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000); }
function showToast(message: string) { let toast = document.querySelector<HTMLDivElement>('.toast'); if (!toast) { toast = document.createElement('div'); toast.className = 'toast'; document.body.append(toast); } toast.textContent = message; toast.classList.add('show'); window.clearTimeout(toastTimer); toastTimer = window.setTimeout(() => toast?.classList.remove('show'), 3000); }

app.addEventListener('click', (event) => { const target = event.target as HTMLElement; const action = target.closest<HTMLElement>('[data-action]')?.dataset.action; if (action === 'play') play(); if (action === 'blink') game?.blink(); if (action === 'retry') play(); });
window.addEventListener('keydown', (event) => { if (event.code === 'Space' && game?.status === 'playing') { event.preventDefault(); game.blink(); } });
app.addEventListener('pointerdown', (event) => { const target = event.target as HTMLElement; if (game?.status === 'playing' && !target.closest('button')) game.blink(); });
if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js?v=3').catch(() => undefined));
landing();
