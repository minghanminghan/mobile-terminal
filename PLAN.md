# mobile-terminal

Claude Code for mobile and web. SSH into a remote server from a browser or phone and run Claude Code against a codebase — no local dev environment required.

**Strategy:** build the simplest possible web SSH terminal first, then layer on Claude-specific features, then extend to mobile by reusing the same components.

---

## Goals

- Use Claude Code from any browser or mobile device
- All compute runs on the user's own remote server — no vendor lock-in
- Real-time terminal streaming with an interactive change-approval UI
- Credentials never stored server-side

---

## Architecture

```
[Browser / React Native WebView]
   xterm.js terminal
        |
        | WebSocket (wss://)
        |
[Relay Server — Node.js]
   ws + ssh2 + node-pty
        |
        | SSH (TCP)
        |
[User's Remote Server]
   PTY → claude CLI → codebase
```

### Relay Server
A thin, stateless Node.js process. Accepts a WebSocket connection carrying SSH credentials, opens an SSH PTY to the user's remote server, and pipes raw bytes bidirectionally. It never stores credentials. Self-hosted by the user (local machine or small VPS).

### Web / Mobile Client
An xterm.js terminal rendered in a browser (web) or a React Native WebView (mobile). Sends SSH credentials once on connect, then exchanges raw PTY bytes over the WebSocket.

### Why xterm.js as the reuse bridge
xterm.js runs natively in any browser. On mobile (React Native), a WebView loads the same xterm.js bundle — identical terminal behavior, no separate implementation. This is the same approach Termius uses. The relay never needs to know whether the client is web or mobile.

---

## Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Web app | Vite + React + TypeScript | Minimal setup, fast iteration, one screen for MVP |
| Terminal UI | **xterm.js** | Open source; used by Termius and VS Code; native in browsers, reused via WebView on mobile |
| Relay server | Node.js + `ws` + `ssh2` | Open source; thin SSH↔WebSocket bridge; same server for web and mobile clients |
| Styling | TailwindCSS | Utility-first; works on web and (via NativeWind) in React Native |
| State | Zustand | Minimal footprint; compatible with React and React Native |
| Mobile (later) | React Native + WebView | Wraps the xterm.js bundle; native shell for profile management |

No Next.js — no SSR, routing, or API routes are needed. The relay is its own server.

---

## Feature Roadmap

| Milestone | Description |
|---|---|
| **M0 — MVP** | Web SSH terminal: connection form → xterm.js shell |
| **M1 — Profiles** | Save server profiles in localStorage, one-tap reconnect |
| **M2 — Session persistence** | Relay keeps PTY alive across WebSocket disconnects; client reconnects (tmux) |
| **M3 — Context Tools** | File explorer / Editor side-panel to view repo state while Claude runs |
| **M4 — GitHub** | OAuth, repo browser, clone repo to remote server |
| **M5 — Mobile** | React Native + WebView wrapping the xterm.js terminal |

Detailed implementation steps and verification criteria for each milestone are tracked in `PROGRESS.md`.

---

## Security Model

- SSH credentials are sent once over an encrypted WebSocket and used only for the duration of the connection
- The relay holds credentials in memory only while the SSH session is active
- Private keys are never written to disk on the relay
- For M3 (session persistence): the PTY process is kept alive but credentials are discarded after the SSH handshake

---

## Open Questions

- Self-hosted relay only, or offer a managed hosted option later?
- Session persistence (M3): in-memory PTY map on relay — what TTL before auto-kill?
