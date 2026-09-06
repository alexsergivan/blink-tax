# Blink Tax

A tiny, tense, absurd staring contest for your phone. Stare at the shifting color. Blink and pay.

## Run locally

Use Node 24 or newer. Install the locked dependencies with `npm ci`, then run `npm run dev`.
The predev/prebuild step copies MediaPipe WASM from the pinned npm package and downloads a checksum-verified face model. These files are served locally with the app; camera startup does not import scripts from a CDN.

## Build and preview

Use `npm run build` and `npm run preview`. Production files are written to `dist/`.
Run `npm test` for camera lifecycle, detection, and timer regression tests. For a real WASM/model smoke test without a physical webcam, open `/tests/camera-smoke.html` on the development server and use the test buttons (the synthetic image should remain in the “searching” state).

## Static deploy / GitHub Pages

Build with `npm run build`, then publish `dist/` using GitHub Pages. Relative asset paths mean it works from `/blink-tax/`. Camera access requires HTTPS on the deployed site.
The workflow tests and builds `main`, then deploys that artifact. Do not hand-edit compiled assets on `gh-pages`: that can replace the camera-enabled game with a different implementation. `VITE_PIT_URL` can be overridden through a repository Actions variable; CI defaults to the existing production Pit worker.

## Privacy and camera

Camera stays local. No accounts. Blink detection uses MediaPipe Face Landmarker in the browser; no video is uploaded. If permission is denied, a camera is unavailable, or the model cannot load, the game remains playable in manual mode with the I BLINKED button, tap, and spacebar controls.
