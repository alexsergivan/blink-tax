export const MUGSHOT_SIZE = 48;

export function drawPixelSkull(context: CanvasRenderingContext2D, size = MUGSHOT_SIZE) {
  const unit = size / 16;
  context.clearRect(0, 0, size, size);
  context.fillStyle = "#111";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#ffed00";
  const block = (x: number, y: number, width: number, height: number) => context.fillRect(x * unit, y * unit, width * unit, height * unit);
  block(4, 1, 8, 1); block(2, 3, 12, 2); block(1, 5, 14, 7); block(3, 12, 10, 2); block(5, 14, 6, 1);
  context.fillStyle = "#111";
  block(4, 5, 3, 3); block(9, 5, 3, 3); block(5, 10, 2, 1); block(9, 10, 2, 1); block(7, 12, 2, 1);
}

export function createPixelSkullDataUrl() {
  const canvas = document.createElement("canvas");
  canvas.width = MUGSHOT_SIZE; canvas.height = MUGSHOT_SIZE;
  const context = canvas.getContext("2d");
  if (!context) return "";
  drawPixelSkull(context);
  return canvas.toDataURL("image/png");
}

export function capturePixelFrame(video: HTMLVideoElement, canvas: HTMLCanvasElement) {
  const context = canvas.getContext("2d");
  const width = video.videoWidth; const height = video.videoHeight;
  if (!context || !width || !height) return false;
  const crop = Math.min(width, height);
  const sourceX = (width - crop) / 2; const sourceY = (height - crop) / 2;
  context.save(); context.imageSmoothingEnabled = false; context.clearRect(0, 0, canvas.width, canvas.height);
  context.translate(canvas.width, 0); context.scale(-1, 1);
  context.drawImage(video, sourceX, sourceY, crop, crop, 0, 0, canvas.width, canvas.height); context.restore();
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    image.data[index] = Math.min(255, Math.round(Math.max(0, image.data[index] * 1.08 - 8) / 64) * 64);
    image.data[index + 1] = Math.min(255, Math.round(Math.max(0, image.data[index + 1] * 1.08 - 8) / 64) * 64);
    image.data[index + 2] = Math.min(255, Math.round(Math.max(0, image.data[index + 2] * 1.08 - 8) / 64) * 64);
  }
  context.putImageData(image, 0, 0); return true;
}
