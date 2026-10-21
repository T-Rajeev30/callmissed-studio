# CallMissed Studio

A small full-stack voice agent workspace for the CallMissed internship exercise. It has three experiences: chat, image generation, and a live voice agent.

## Stack

- React, TypeScript, and Vite for the browser app
- Express for a same-origin API proxy that keeps the CallMissed key on the server
- CallMissed Chat Completions, Images, and Voice Sessions APIs
- `livekit-client` for the browser WebRTC connection returned by the CallMissed Voice Session API

The app makes no AI requests to other providers. The only external AI endpoints used are CallMissed's `https://api.callmissed.com/v1` endpoints. The browser connects to the voice session's issued WebRTC URL and token; it never receives the CallMissed API key.

## Run locally

1. Create a CallMissed API key with `llm`, `image`, `stt`, and `tts` permissions. Set a **$20 budget cap** for the key in the CallMissed console to stay within the assignment budget.
2. Copy `.env.example` to `.env` and set `CALLMISSED_API_KEY`.
3. Install and run:

   ```sh
   npm install
   npm run dev
   ```

   Vite runs the interface at `http://localhost:5173`; the Express API proxy listens on port 3000.

4. For a production build and local production server:

   ```sh
   npm run build
   npm start
   ```

   Open `http://localhost:3000`.

## Deploy

Deploy as a Node web service on Render, Railway, Fly.io, or an equivalent host. Set `CALLMISSED_API_KEY` as a private environment variable and use `npm run build` as the build command and `npm start` as the start command. The server listens on the host's `PORT`. Do not add the key to Vite variables (such as `VITE_*`) or commit it.

## Usage and budget

- Chat uses `kimi-k2.5` and limits each reply to 700 output tokens.
- Image generation makes one 1024×1024 request using `flux-2-klein-9b` per click.
- Voice sessions stop after three minutes; ending the conversation early disconnects the WebRTC room.
- Set the key's $20 budget cap in the CallMissed console; the server does not store API keys or usage data.

The API key status indicator reflects whether the server has `CALLMISSED_API_KEY` configured. Chat and image creation require an internet connection. Voice requires microphone permission and HTTPS after deployment (localhost is also allowed by browsers).
