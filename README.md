# KoinX Support Operations Web

React app for the KoinX support operations hub. The API is a separate repository. This app only talks to it over HTTP.

**Git:** `origin` → https://github.com/ashish-borchate/koinx-support-ops-frontend (`main`). This is the deployment source of truth for the frontend.

You need **Node.js 22+** and a running API.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Open [http://127.0.0.1:4178](http://127.0.0.1:4178).

`VITE_API_URL` in `.env` is the API origin (default `http://127.0.0.1:4179`). The API must allow this app's origin through `CLIENT_ORIGIN`. Sign in with a development account from that API, for example `ashish@koinx.com` / `DevOnly#2026`.

## Scripts

- `npm run dev` — Vite dev server
- `npm run build` — production build
- `npm run preview` — serve the production build
- `npm run typecheck`
