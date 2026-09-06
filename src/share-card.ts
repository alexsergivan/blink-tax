import { drawCartoonFrame } from './mugshot';

export type ShareCardData = { seconds: number; isNewBest: boolean; best: number; url: string; mugshot?: string | null; receiptId?: string };
const WIDTH = 1080;
const HEIGHT = 1920;
const punchline = (seconds: number) => seconds < 1 ? 'Blink tax evasion failed instantly' : seconds < 5 ? 'Barely human' : seconds < 15 ? 'Suspiciously focused' : 'Possibly a lizard';
const roundedRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
const fitText = (c: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, weight = 900) => { let size = initialSize; do { c.font = `${weight} ${size}px "Barlow Condensed", Impact, sans-serif`; size -= 2; } while (c.measureText(text).width > maxWidth && size > 22); return size + 2; };
const drawStripes = (ctx: CanvasRenderingContext2D) => { for (let stripeX = -1800; stripeX < 1800; stripeX += 72) { ctx.beginPath(); ctx.moveTo(stripeX, -1800); ctx.lineTo(stripeX, 1800); ctx.stroke(); } };

async function drawEvidence(c: CanvasRenderingContext2D, mugshot: string | null | undefined, receiptId?: string) {
  const x = 700; const y = 720; const size = 320;
  c.fillStyle = '#111'; roundedRect(c, x, y, size, 390, 18);
  c.strokeStyle = '#111'; c.lineWidth = 12; c.beginPath(); c.roundRect(x + 4, y + 4, size - 8, 382, 18); c.stroke(); c.strokeStyle = '#ffed00'; c.lineWidth = 4; c.beginPath(); c.roundRect(x + 4, y + 4, size - 8, 382, 18); c.stroke();
  c.fillStyle = '#ffed00'; c.font = '700 28px "Space Mono", monospace'; c.fillText('EVIDENCE #' + (receiptId ?? '----'), x + 18, y + 38);
  const imageX = x + 20; const imageY = y + 58; const imageSize = 280;
  const frame = document.createElement('canvas'); frame.width = imageSize; frame.height = imageSize; const frameContext = frame.getContext('2d');
  if (frameContext) {
    if (mugshot) {
      try { const image = new Image(); image.src = mugshot; if (image.decode) await image.decode(); else await new Promise<void>((resolve) => { image.onload = () => resolve(); image.onerror = () => resolve(); }); drawCartoonFrame(frameContext, image, imageSize); }
      catch { drawCartoonFrame(frameContext, null, imageSize); }
    } else drawCartoonFrame(frameContext, null, imageSize);
    c.drawImage(frame, imageX, imageY, imageSize, imageSize);
  }
  c.fillStyle = '#ffed00'; c.font = '900 42px "Barlow Condensed", Impact, sans-serif'; c.fillText(mugshot ? 'CAUGHT' : 'NO CAMERA', x + 18, y + 370);
}

export async function generateShareCard({ seconds, isNewBest, best, url, mugshot, receiptId }: ShareCardData): Promise<Blob> {
  try { if (document.fonts?.ready) await document.fonts.ready; } catch { /* Continue with fallback fonts. */ }
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas is not supported');
  c.fillStyle = '#ff3d00'; c.fillRect(0, 0, WIDTH, HEIGHT);
  c.save(); c.translate(WIDTH * .42, HEIGHT * .55); c.rotate(-.22); c.strokeStyle = 'rgba(17,17,17,.13)'; c.lineWidth = 22; drawStripes(c); c.restore();
  c.fillStyle = '#111'; c.beginPath(); c.arc(920, 185, 185, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffed00'; c.beginPath(); c.arc(920, 185, 132, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(920, 185, 43, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.font = '700 38px "Space Mono", monospace'; c.letterSpacing = '5px'; c.fillText('THE INTERNET’S WORST STARE-OFF', 76, 112); c.letterSpacing = '0px';
  c.font = '900 190px "Barlow Condensed", Impact, sans-serif'; c.fillText('BLINK', 70, 350); c.fillText('TAX', 70, 510);
  c.fillStyle = '#ffed00'; c.fillRect(70, 590, 940, 7); c.fillStyle = '#111'; c.font = '700 34px "Space Mono", monospace'; c.fillText('RECEIPT OF SHAME', 74, 660);
  const score = seconds.toFixed(1) + 's'; c.fillStyle = '#111'; const scoreSize = fitText(c, score, 590, 420); c.font = '900 ' + scoreSize + 'px "Barlow Condensed", Impact, sans-serif'; c.fillText(score, 58, 1085); await drawEvidence(c, mugshot, receiptId);
  c.fillStyle = '#ffed00'; roundedRect(c, 70, 1170, 940, 160, 10); c.fillStyle = '#111'; const line = punchline(seconds); const lineSize = fitText(c, line, 850, 74); c.font = '900 ' + lineSize + 'px "Barlow Condensed", Impact, sans-serif'; c.fillText(line, 112, 1270);
  c.fillStyle = '#111'; c.font = '700 39px "Space Mono", monospace'; c.fillText('STARE. DON’T BLINK.', 76, 1450); c.font = '400 34px "Space Mono", monospace'; c.fillText('Can you beat me?', 76, 1510);
  if (isNewBest) { c.fillStyle = '#ffed00'; roundedRect(c, 680, 1435, 330, 104, 8); c.fillStyle = '#111'; c.font = '900 34px "Barlow Condensed", Impact, sans-serif'; c.fillText('NEW PERSONAL BEST', 704, 1498); } else { c.fillStyle = '#111'; c.font = '700 28px "Space Mono", monospace'; c.fillText('BEST: ' + best.toFixed(1) + 's', 76, 1590); }
  c.fillStyle = '#111'; c.fillRect(70, 1690, 940, 3); c.font = '700 28px "Space Mono", monospace'; c.fillText(url, 76, 1765); c.font = '400 25px "Space Mono", monospace'; c.fillText('I blinked. I paid. Your turn.', 76, 1820);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export share card')), 'image/png'));
}

export type PitShareCardData = { rank: number; total: number; seconds: number; winner: string; url: string; mugshot?: string | null };
export async function generatePitShareCard({ rank, total, seconds, winner, url, mugshot }: PitShareCardData): Promise<Blob> {
  try { if (document.fonts?.ready) await document.fonts.ready; } catch { /* Continue with fallback fonts. */ }
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas is not supported');
  c.fillStyle = '#ff3d00'; c.fillRect(0, 0, WIDTH, HEIGHT);
  c.save(); c.translate(WIDTH * .42, HEIGHT * .55); c.rotate(-.22); c.strokeStyle = 'rgba(17,17,17,.13)'; c.lineWidth = 22; drawStripes(c); c.restore();
  c.fillStyle = '#111'; c.beginPath(); c.arc(920, 185, 185, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffed00'; c.beginPath(); c.arc(920, 185, 132, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(920, 185, 43, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.font = '700 38px "Space Mono", monospace'; c.fillText('THE INTERNET’S WORST STARE-OFF', 76, 112);
  c.font = '900 190px "Barlow Condensed", Impact, sans-serif'; c.fillText('THE', 70, 350); c.fillText('PIT', 70, 510);
  c.fillStyle = '#ffed00'; c.fillRect(70, 590, 940, 7); c.fillStyle = '#111'; c.font = '700 34px "Space Mono", monospace'; c.fillText('RANKED RECEIPT OF SHAME', 74, 660);
  c.fillStyle = '#111'; c.font = '900 270px "Barlow Condensed", Impact, sans-serif'; c.fillText('#' + rank, 68, 1030);
  c.save(); c.translate(0, -30); await drawEvidence(c, mugshot); c.restore();
  c.fillStyle = '#ffed00'; roundedRect(c, 70, 1100, 940, 180, 10); c.fillStyle = '#111'; c.font = '900 70px "Barlow Condensed", Impact, sans-serif'; c.fillText(seconds.toFixed(1) + 's STARE TIME', 112, 1215);
  c.fillStyle = '#111'; c.font = '700 39px "Space Mono", monospace'; c.fillText('WINNER: ' + winner, 76, 1435); c.font = '400 34px "Space Mono", monospace'; c.fillText('YOU PLACED ' + rank + ' OF ' + total, 76, 1500);
  c.fillStyle = '#ffed00'; roundedRect(c, 70, 1580, 940, 120, 8); c.fillStyle = '#111'; c.font = '900 48px "Barlow Condensed", Impact, sans-serif'; c.fillText('I BLINKED. I PAID. YOUR TURN.', 108, 1655);
  c.fillStyle = '#111'; c.fillRect(70, 1760, 940, 3); c.font = '700 28px "Space Mono", monospace'; c.fillText(url, 76, 1835);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export share card')), 'image/png'));
}
