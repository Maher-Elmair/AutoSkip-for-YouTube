# YouTube Auto Skip Extension

A privacy-first browser extension that automatically clicks the “Skip Ads” button on YouTube as soon as it becomes available. The experience is powered by **Vite**, **React**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **lucide-react**, and **i18next**.

## Features

- 🚀 Detects and clicks the official “Skip Ads” button without blocking or muting ads
- ⚡ Lightweight content script with smart DOM observers and retry logic
- 🎛️ Modern popup UI with shadcn/ui + Tailwind CSS, theme switcher, and bilingual copy
- 🌐 Arabic/English support via i18next
- 🧠 Persists watcher state through the background service worker (Chrome/Brave/Firefox sync storage)
- 🔒 Runs completely on-device—no analytics and no network calls

## Supported Browsers

- Google Chrome
- Brave Browser
- Mozilla Firefox

## Installation

### Chrome / Brave

1. Run `npm install && npm run build`.
2. You can now either load the project root (the root-level `manifest.json` points Chrome to the compiled files) or load the generated `dist` folder directly.
3. Open `chrome://extensions/` and enable **Developer mode**.
4. Click **Load unpacked** and select the folder you prefer (`.` or `dist`).

### Firefox

1. Run `npm install && npm run build`.
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on…** and choose the `manifest.json` file inside the `dist` folder.

## Development

### Prerequisites

- Node.js (v18+)
- npm

### Setup

```bash
npm install
```

### Run the popup in development mode

```bash
npm run dev
```

### Build the complete extension

```bash
npm run build
```

This command bundles the popup UI, generates `content.js` and `background.js`, copies translations/icons, and produces a ready-to-load `dist` directory for every supported browser. The repository root stays loadable in Chrome because the top-level `manifest.json` references those built assets.

## Key Files

- `src/App.tsx` – React popup with watcher toggle, theming, and localization.
- `src/hooks/useWatcherSetting.ts` – Shared hook that syncs the UI with extension storage.
- `src/utils/watcherStorage.ts` – Safe wrapper around `chrome.storage` with dev fallbacks.
- `src/extension/content.ts` – Content script that detects YouTube skip buttons and simulates human clicks.
- `src/extension/background.ts` – Background service worker that seeds defaults and exposes lightweight messaging.
- `public/manifest.json` – Manifest copied into `dist` during builds.
- `manifest.json` – Root-level manifest that mirrors the one in `dist` so the repo root is loadable for quick testing.
- `scripts/generate-icons.ps1` – Utility to regenerate the PNG icons shipped in `public/icons`.
