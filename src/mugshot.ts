export const MUGSHOT_SIZE = 160;
export const CARTOON_MUGSHOT_STYLE = 'cartoon';

const INK = '#111';
const YELLOW = '#ffed00';
const ORANGE = '#ff3d00';
const WHITE = '#fff';
const clamp = (value: number, min = 0, max = 255) => Math.max(min, Math.min(max, value));

/** Draw a goofy, rounded fallback when the camera is unavailable. */
export function drawCartoonFace(context: CanvasRenderingContext2D, size = MUGSHOT_SIZE) {
  context.canvas.dataset.mugshotStyle = CARTOON_MUGSHOT_STYLE; context.canvas.dataset.mugshotFilter = 'COMIC_STAMP';
  context.clearRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.fillStyle = INK; context.fillRect(0, 0, size, size);
  const scale = size / 160; const center = size / 2;
  context.save(); context.translate(center, center); context.strokeStyle = ORANGE; context.lineWidth = 3 * scale;
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8) {
    context.beginPath(); context.moveTo(Math.cos(angle) * 57 * scale, Math.sin(angle) * 57 * scale); context.lineTo(Math.cos(angle) * 77 * scale, Math.sin(angle) * 77 * scale); context.stroke();
  }
  context.restore();
  context.fillStyle = YELLOW;
  context.beginPath(); context.arc(22 * scale, 83 * scale, 14 * scale, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(138 * scale, 83 * scale, 14 * scale, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.ellipse(center, 83 * scale, 57 * scale, 63 * scale, 0, 0, Math.PI * 2); context.fill();
  context.strokeStyle = INK; context.lineWidth = 6 * scale; context.stroke();
  context.fillStyle = INK;
  context.beginPath(); context.arc(51 * scale, 29 * scale, 17 * scale, Math.PI * .9, Math.PI * 1.9); context.fill();
  context.beginPath(); context.arc(109 * scale, 29 * scale, 17 * scale, Math.PI * 1.1, Math.PI * 2.1); context.fill();
  context.strokeStyle = INK; context.lineWidth = 7 * scale; context.lineCap = 'round';
  context.beginPath(); context.moveTo(35 * scale, 49 * scale); context.quadraticCurveTo(51 * scale, 39 * scale, 66 * scale, 49 * scale); context.stroke();
  context.beginPath(); context.moveTo(93 * scale, 48 * scale); context.quadraticCurveTo(111 * scale, 37 * scale, 126 * scale, 51 * scale); context.stroke();
  context.fillStyle = WHITE;
  context.beginPath(); context.ellipse(51 * scale, 68 * scale, 17 * scale, 21 * scale, -.08, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.ellipse(109 * scale, 68 * scale, 17 * scale, 21 * scale, .08, 0, Math.PI * 2); context.fill();
  context.fillStyle = INK;
  context.beginPath(); context.arc(55 * scale, 73 * scale, 8 * scale, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(105 * scale, 73 * scale, 8 * scale, 0, Math.PI * 2); context.fill();
  context.fillStyle = WHITE;
  context.beginPath(); context.arc(58 * scale, 69 * scale, 2.5 * scale, 0, Math.PI * 2); context.fill();
  context.beginPath(); context.arc(108 * scale, 69 * scale, 2.5 * scale, 0, Math.PI * 2); context.fill();
  context.fillStyle = ORANGE;
  context.beginPath(); context.moveTo(78 * scale, 74 * scale); context.quadraticCurveTo(70 * scale, 94 * scale, 82 * scale, 98 * scale); context.quadraticCurveTo(91 * scale, 97 * scale, 87 * scale, 87 * scale); context.closePath(); context.fill();
  context.strokeStyle = INK; context.lineWidth = 4 * scale; context.stroke();
  context.fillStyle = WHITE; context.beginPath(); context.roundRect(42 * scale, 101 * scale, 76 * scale, 31 * scale, 15 * scale); context.fill();
  context.strokeStyle = INK; context.lineWidth = 5 * scale; context.stroke();
  context.fillStyle = ORANGE; context.beginPath(); context.ellipse(center, 126 * scale, 19 * scale, 7 * scale, 0, 0, Math.PI); context.fill();
  context.strokeStyle = INK; context.lineWidth = 3 * scale; context.beginPath(); context.moveTo(68 * scale, 103 * scale); context.lineTo(68 * scale, 128 * scale); context.moveTo(92 * scale, 103 * scale); context.lineTo(92 * scale, 128 * scale); context.stroke();
  context.fillStyle = INK; context.beginPath(); context.arc(34 * scale, 94 * scale, 3 * scale, 0, Math.PI * 2); context.fill(); context.beginPath(); context.arc(126 * scale, 94 * scale, 3 * scale, 0, Math.PI * 2); context.fill();
}

/** Apply five flat comic values with a hard Sobel ink pass. No blur is used. */
function applyComicStamp(context: CanvasRenderingContext2D, width: number, height: number) {
  const image = context.getImageData(0, 0, width, height);
  const source = new Uint8ClampedArray(image.data);
  const gray = new Float32Array(width * height);
  const palette = [[17, 17, 17], [59, 22, 15], [255, 61, 0], [255, 237, 0], [255, 255, 255]];
  const luminanceAt = (x: number, y: number) => gray[Math.max(0, Math.min(height - 1, y)) * width + Math.max(0, Math.min(width - 1, x))];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const index = (y * width + x) * 4;
    gray[y * width + x] = source[index] * .2126 + source[index + 1] * .7152 + source[index + 2] * .0722;
  }
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const pixel = y * width + x; const index = pixel * 4;
    const gx = -luminanceAt(x - 1, y - 1) - 2 * luminanceAt(x - 1, y) - luminanceAt(x - 1, y + 1) + luminanceAt(x + 1, y - 1) + 2 * luminanceAt(x + 1, y) + luminanceAt(x + 1, y + 1);
    const gy = -luminanceAt(x - 1, y - 1) - 2 * luminanceAt(x, y - 1) - luminanceAt(x + 1, y - 1) + luminanceAt(x - 1, y + 1) + 2 * luminanceAt(x, y + 1) + luminanceAt(x + 1, y + 1);
    const level = Math.min(palette.length - 1, Math.floor(clamp(gray[pixel] * 1.08 + 8) / 256 * palette.length));
    const color = Math.abs(gx) + Math.abs(gy) > 170 ? palette[0] : palette[level];
    image.data[index] = color[0]; image.data[index + 1] = color[1]; image.data[index + 2] = color[2]; image.data[index + 3] = source[index + 3];
  }
  context.putImageData(image, 0, 0);
}

export function drawCartoonFrame(context: CanvasRenderingContext2D, source: CanvasImageSource | null, size = MUGSHOT_SIZE) {
  context.canvas.dataset.mugshotStyle = CARTOON_MUGSHOT_STYLE; context.canvas.dataset.mugshotFilter = 'COMIC_STAMP';
  context.clearRect(0, 0, size, size); context.imageSmoothingEnabled = true; context.fillStyle = YELLOW; context.fillRect(0, 0, size, size);
  context.save(); context.beginPath(); context.roundRect(4, 4, size - 8, size - 8, size * .14); context.clip();
  if (source) { context.drawImage(source, 0, 0, size, size); applyComicStamp(context, size, size); } else drawCartoonFace(context, size);
  context.restore(); context.strokeStyle = INK; context.lineWidth = Math.max(4, size * .035); context.beginPath(); context.roundRect(4, 4, size - 8, size - 8, size * .14); context.stroke();
}

export function createCartoonFaceDataUrl() {
  const canvas = document.createElement('canvas'); canvas.width = MUGSHOT_SIZE; canvas.height = MUGSHOT_SIZE;
  const context = canvas.getContext('2d'); if (!context) return ''; drawCartoonFrame(context, null); return canvas.toDataURL('image/png');
}

/** Mirror, goof and hard-posterize a webcam frame for the evidence path only. */
export function captureCartoonFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d'); const width = video.videoWidth; const height = video.videoHeight;
  if (!context || !width || !height) return false;
  const crop = Math.min(width, height); const sourceX = (width - crop) / 2; const sourceY = (height - crop) / 2;
  context.save(); context.imageSmoothingEnabled = true; context.clearRect(0, 0, canvas.width, canvas.height); context.translate(canvas.width, 0); context.scale(-1, 1);
  const punch = 1.06; const offset = (1 - punch) * canvas.width / 2;
  context.drawImage(video, sourceX, sourceY, crop, crop, offset, offset, canvas.width * punch, canvas.height * punch); context.restore();
  applyComicStamp(context, canvas.width, canvas.height);
  canvas.dataset.mugshotStyle = CARTOON_MUGSHOT_STYLE; canvas.dataset.mugshotFilter = 'COMIC_STAMP';
  return true;
}
