# cc-mobile

Use Claude Code from any browser or phone. SSH into your dev server and get a full interactive terminal — no local dev environment required.

---

## Features

### Seamless Session Continuity
Start work on your laptop, close the browser, reopen on your phone, and pick up exactly where you left off. The relay uses `tmux new-session -A -D` to attach existing sessions and resize them to fit whatever screen is connecting.

### Connection Profiles
Save SSH credentials and project paths for one-tap reconnect. Secrets (passwords, private keys) are stored in `sessionStorage` on web (cleared when the tab closes) and in the platform keychain on mobile (iOS Keychain / Android Keystore) — never on the relay server.

### Touch-Optimized UX
- **Virtual control row** — scrollable bar with ESC, TAB, CTRL, ALT, SHIFT, DEL, and arrow keys
- **Long-press context menu** — trigger tmux pane operations (split horizontal/vertical, swap, zoom, kill) without keyboard shortcuts
- **Native mouse mode** — drag tmux pane borders with your finger to resize

### Voice Input
Tap the mic button in the virtual keyboard row to dictate instead of type. Transcription runs on-device via the browser's Web Speech API — no cloud API, no external requests. The result appears in an editable preview overlay before anything is sent to the terminal, so a mis-heard command can't execute before you catch it.

Supported on Chrome, Edge, and Safari (iOS 14.5+). The button is hidden automatically on unsupported browsers.

### Tailscale Integration
Set `TAILSCALE_AUTH_KEY` and the relay joins your Tailscale network on boot. Use Tailscale IPs (`100.x.x.x`) as the SSH host to reach machines on your Tailnet without any port forwarding or exposing services to the internet.

### Project Path Navigation
Save a project path per profile. On connect, tmux initializes all panes rooted in that directory — no manual `cd` after every reconnect.

---

## Architecture

```
[Browser / React Native WebView]
   xterm.js terminal
        |
        | WebSocket
        |
[Relay Server — Node.js, port 3001]
   Express (static files) + ws + ssh2
        |
        | SSH
        |
[Your Remote Server]
   tmux → shell → claude CLI
```

The relay is stateless. It accepts a WebSocket, opens an SSH PTY on the remote server, and pipes raw bytes in both directions. Credentials are never written to disk on the relay.

### Layers

**`relay/`** — Node.js WebSocket-to-SSH bridge. Handles the connect/resize message protocol, spawns a tmux session on the remote, and forwards I/O.

**`web/`** — React + Vite frontend. Runs xterm.js, manages profiles, handles touch events, and renders the virtual keyboard (including voice input).

**`mobile/`** — React Native + Expo shell. Wraps the web frontend in a WebView, injects credentials on load, and provides native secure storage.

---

## Quick Start

### Docker

```bash
docker build -t cc-mobile .
docker run -p 3001:3001 cc-mobile
```

Open `http://localhost:3001`.

### With Tailscale

```bash
docker run -p 3001:3001 \
  -e TAILSCALE_AUTH_KEY=tskey-auth-... \
  cc-mobile
```

The container registers as `cc-mobile-app` on your Tailnet. Approve the device in the Tailscale admin console on first run, or use a pre-approved auth key.

### Without Docker

```bash
npm install
npm run build -w web       # build the React frontend
npm run start:node         # relay + static server on :3001
```

### Development

```bash
npm install
npm run dev -w web         # Vite dev server on :5173 with HMR
npm run dev -w relay       # relay on :3001 with ts watch

# Mobile
cd mobile && npx expo start
```

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3001` | Port the relay and web server listen on |
| `TAILSCALE_AUTH_KEY` | — | If set, starts Tailscale and joins your Tailnet on boot |

---

## Security

- Credentials are sent once over the WebSocket and held in memory only for the duration of the SSH session
- Private keys are never written to disk on the relay
- Web: secrets live in `sessionStorage` and are cleared when the tab closes
- Mobile: secrets are encrypted via `expo-secure-store` (iOS Keychain / Android Keystore)
- Voice input uses the browser's on-device speech engine — no audio leaves the device

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS 4 |
| Terminal | xterm.js (fit + web-links addons) |
| Relay | Node.js 22, Express, `ws`, `ssh2` |
| Mobile | React Native, Expo, WebView, expo-secure-store |
| Networking | Tailscale (optional), SOCKS5 proxy support |
| Deployment | Docker (Alpine Linux, Node.js 22) |
