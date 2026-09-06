export type ShareCardData = { seconds: number; isNewBest: boolean; best: number; url: string };
const WIDTH = 1080;
const HEIGHT = 1920;
const punchline = (seconds: number) => seconds < 1 ? 'Blink tax evasion failed instantly' : seconds < 5 ? 'Barely human' : seconds < 15 ? 'Suspiciously focused' : 'Possibly a lizard';
const roundedRect = (c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x, y, w, h, r); c.fill(); };
const fitText = (c: CanvasRenderingContext2D, text: string, maxWidth: number, initialSize: number, weight = 900) => { let size = initialSize; do { c.font = `${weight} ${size}px "Barlow Condensed", Impact, sans-serif`; size -= 2; } while (c.measureText(text).width > maxWidth && size > 22); return size + 2; };
const drawStripes = (ctx: CanvasRenderingContext2D) => { for (let stripeX = -1800; stripeX < 1800; stripeX += 72) { ctx.beginPath(); ctx.moveTo(stripeX, -1800); ctx.lineTo(stripeX, 1800); ctx.stroke(); } };

export async function generateShareCard({ seconds, isNewBest, best, url }: ShareCardData): Promise<Blob> {
  try { if (document.fonts?.ready) await document.fonts.ready; } catch { /* Continue with fallback fonts. */ }
  const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
  const c = canvas.getContext('2d'); if (!c) throw new Error('Canvas is not supported');
  c.fillStyle = '#ff3d00'; c.fillRect(0, 0, WIDTH, HEIGHT);
  c.save(); c.translate(WIDTH * .42, HEIGHT * .55); c.rotate(-.22); c.strokeStyle = 'rgba(17,17,17,.13)'; c.lineWidth = 22;
  drawStripes(c); c.restore();
  c.fillStyle = '#111'; c.beginPath(); c.arc(870, 280, 330, 0, Math.PI * 2); c.fill(); c.fillStyle = '#ffed00'; c.beginPath(); c.arc(870, 280, 245, 0, Math.PI * 2); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(870, 280, 82, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#111'; c.font = '700 38px "Space Mono", monospace'; c.letterSpacing = '5px'; c.fillText('THE INTERNET’S WORST STARE-OFF', 76, 112); c.letterSpacing = '0px';
  c.font = '900 190px "Barlow Condensed", Impact, sans-serif'; c.fillText('BLINK', 70, 350); c.fillText('TAX', 70, 510);
  c.fillStyle = '#ffed00'; c.fillRect(70, 590, 940, 7); c.fillStyle = '#111'; c.font = '700 34px "Space Mono", monospace'; c.fillText('RECEIPT OF SHAME', 74, 660);
  const score = `${seconds.toFixed(1)}s`; c.fillStyle = '#111'; const scoreSize = fitText(c, score, 940, 420); c.font = `900 ${scoreSize}px "Barlow Condensed", Impact, sans-serif`; c.fillText(score, 58, 1090);
  c.fillStyle = '#ffed00'; roundedRect(c, 70, 1170, 940, 160, 10); c.fillStyle = '#111'; const line = punchline(seconds); const lineSize = fitText(c, line, 850, 74); c.font = `900 ${lineSize}px "Barlow Condensed", Impact, sans-serif`; c.fillText(line, 112, 1270);
  c.fillStyle = '#111'; c.font = '700 39px "Space Mono", monospace'; c.fillText('STARE. DON’T BLINK.', 76, 1450); c.font = '400 34px "Space Mono", monospace'; c.fillText('Can you beat me?', 76, 1510);
  if (isNewBest) { c.fillStyle = '#ffed00'; roundedRect(c, 680, 1435, 330, 104, 8); c.fillStyle = '#111'; c.font = '900 34px "Barlow Condensed", Impact, sans-serif'; c.fillText('NEW PERSONAL BEST', 704, 1498); } else { c.fillStyle = '#111'; c.font = '700 28px "Space Mono", monospace'; c.fillText(`BEST: ${best.toFixed(1)}s`, 76, 1590); }
  c.fillStyle = '#111'; c.fillRect(70, 1690, 940, 3); c.font = '700 28px "Space Mono", monospace'; c.fillText(url, 76, 1765); c.font = '400 25px "Space Mono", monospace'; c.fillText('I blinked. I paid. Your turn.', 76, 1820);
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not export share card')), 'image/png'));
}
