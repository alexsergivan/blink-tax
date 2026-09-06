# Blink Tax

A tiny, tense, absurd staring contest for your phone. Stare at the shifting color. Blink and pay.

## Run locally

Install dependencies and start the Vite dev server with `npm install` and `npm run dev`.

## Build and preview

Use `npm run build` and `npm run preview`. Production files are written to `dist/`.

## Static deploy / GitHub Pages

Build with `npm run build`, then publish `dist/` using GitHub Pages. Relative asset paths mean it works from `/blink-tax/`. Camera access requires HTTPS on the deployed site.

## Privacy and camera

Camera stays local. No accounts. Blink detection uses MediaPipe Face Landmarker in the browser; no video is uploaded. If permission is denied, a camera is unavailable, or the model cannot load, the game remains playable in manual mode with the I BLINKED button, tap, and spacebar controls.
