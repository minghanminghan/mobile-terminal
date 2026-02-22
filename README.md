# mobile-terminal

Use Claude Code from any browser or phone. SSH into your dev server and get a full interactive terminal -- no local dev environment required.

---

## Features

### Seamless Session Continuity
Start work on your laptop, close the browser, reopen on your phone, and pick up exactly where you left off. The relay uses `tmux new-session -A -D` to attach existing sessions and resize them to fit whatever screen is connecting.

### Connection Profiles
Save SSH credentials and project paths for one-tap reconnect. Secrets (passwords, private keys) are stored in `sessionStorage` on web (cleared when the tab closes) and in the platform keychain on mobile (iOS Keychain / Android Keystore) -- never on the relay server.

### Touch-Optimized UX
- **Virtual control row** -- scrollable bar with ESC, TAB, CTRL, ALT, SHIFT, DEL, and arrow keys
- **Long-press context menu** -- trigger tmux pane operations (split horizontal/vertical, swap, zoom, kill) without keyboard shortcuts
- **Native mouse mode** -- drag tmux pane borders with your finger to resize

### Voice Input
Tap the mic button in the virtual keyboard row to dictate instead of type. Transcription runs on-device via the browser's Web Speech API -- no cloud API, no external requests. The result appears in an editable preview overlay before anything is sent to the terminal, so a mis-heard command can't execute before you catch it.

Supported on Chrome, Edge, and Safari (iOS 14.5+). The button is hidden automatically on unsupported browsers.

### Tailscale Integration
Set `TAILSCALE_AUTH_KEY` and the relay joins your Tailscale network on boot. Use Tailscale IPs (`100.x.x.x`) as the SSH host to reach machines on your Tailnet without any port forwarding or exposing services to the internet.

### Project Path Navigation
Save a project path per profile. On connect, tmux initializes all panes rooted in that directory -- no manual `cd` after every reconnect.

---

## Security

- Credentials are sent once over the WebSocket and held in memory only for the duration of the SSH session
- Private keys are never written to disk on the relay
- Web: secrets live in `sessionStorage` and are cleared when the tab closes
- Mobile: secrets are encrypted via `expo-secure-store` (iOS Keychain / Android Keystore)
- Voice input uses the browser's on-device speech engine -- no audio leaves the device

---

## SSH Host Requirements

### Required

**tmux** -- mobile-terminal attaches to a tmux session on connect (`tmux new-session -A -s cc`). This is what keeps your terminal alive when you close the browser and lets you reattach from a different device. Without tmux the session ends the moment the WebSocket drops.

**WSL (Windows only)** -- Windows does not ship an SSH server or a native Unix shell. WSL (Windows Subsystem for Linux) provides both. Mac and Linux users can skip this.

### Recommended (Optional)

**Tailscale** -- Lets you connect to your machine using a private Tailscale IP (`100.x.x.x`) instead of opening a port to the public internet. Install it on the machine you want to SSH into and on the device running the relay. See the Tailscale step in the setup guide below.

---

## Architecture

```
[Browser / React Native WebView]
   xterm.js terminal
        |
        | WebSocket
        |
[Relay Server -- Node.js, port 3001]
   Express (static files) + ws + ssh2
        |
        | SSH
        |
[Your Remote Server]
   tmux → shell → claude CLI
```

The relay is stateless. It accepts a WebSocket, opens an SSH PTY on the remote server, and pipes raw bytes in both directions. Credentials are never written to disk on the relay.

### Layers

**`relay/`** -- Node.js WebSocket-to-SSH bridge. Handles the connect/resize message protocol, spawns a tmux session on the remote, and forwards I/O.

**`web/`** -- React + Vite frontend. Runs xterm.js, manages profiles, handles touch events, and renders the virtual keyboard (including voice input).

**`mobile/`** -- React Native + Expo shell. Wraps the web frontend in a WebView, injects credentials on load, and provides native secure storage.

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

---

## Quick Start (requires existing SSH server)

### Docker

```bash
docker build -t mobile-terminal .
docker run -p 3001:3001 mobile-terminal
```

Open `http://localhost:3001`.

### With Tailscale

```bash
docker run -p 3001:3001 \
  -e TAILSCALE_AUTH_KEY=tskey-auth-... \
  mobile-terminal
```

The container registers as `mobile-terminal-app` on your Tailnet. Approve the device in the Tailscale admin console on first run, or use a pre-approved auth key.

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

## Starting an SSH Server

### Mac / Linux

**1. Install tmux**

```bash
# macOS
brew install tmux

# Ubuntu / Debian
sudo apt install tmux

# Fedora / RHEL
sudo dnf install tmux
```

**2. Enable the SSH server**

```bash
# macOS -- enable Remote Login in System Settings > General > Sharing
# or from the terminal:
sudo systemsetup -setremotelogin on

# Ubuntu / Debian
sudo apt install openssh-server
sudo systemctl enable --now ssh

# Fedora / RHEL
sudo dnf install openssh-server
sudo systemctl enable --now sshd
```

**3. Find your local IP**

```bash
# macOS
ipconfig getifaddr en0

# Linux
ip addr show | grep "inet " | grep -v 127.0.0.1
```

Use this IP as the host in mobile-terminal. Your username is the output of `whoami`.

---

### Windows (requires WSL)

**1. Install WSL**

Open PowerShell as Administrator and run:

```powershell
wsl --install
```

Restart when prompted. This installs WSL 2 with Ubuntu by default.

**2. Install tmux inside WSL**

```bash
sudo apt update && sudo apt install tmux openssh-server
```

**3. Start the SSH server inside WSL**

```bash
sudo service ssh start
```

To start SSH automatically when WSL launches, add that line to your `~/.bashrc` or `~/.profile`.

**4. Find your WSL IP**

```bash
hostname -I | awk '{print $1}'
```

Use this IP as the host in mobile-terminal. Your username is the output of `whoami` inside WSL.

> Note: The WSL IP changes on each reboot. For a stable address, use Tailscale (see below).

---

### (Optional) Tailscale -- stable private IP across reboots and networks

Tailscale assigns your machine a permanent private IP (`100.x.x.x`) that works from anywhere without port forwarding. This removes the need to look up your local IP each time and lets you connect from outside your home network.

**1. Install Tailscale on the SSH host**

```bash
# macOS
brew install tailscale

# Ubuntu / Debian / WSL
curl -fsSL https://tailscale.com/install.sh | sh
```

**2. Start and authenticate**

```bash
sudo tailscale up
```

Follow the link to log in. After authentication, run:

```bash
tailscale ip -4
```

This is your stable Tailscale IP. Use it as the host in mobile-terminal from any device on your Tailnet.

**3. (Optional) Connect the relay to your Tailnet too**

If you're running mobile-terminal via Docker and want the relay itself to reach Tailnet addresses, pass your Tailscale auth key (generated in settings) at startup:

```bash
docker run -p 3001:3001 \
  -e TAILSCALE_AUTH_KEY=tskey-auth-... \
  mobile-terminal
```

---

## Environment Variables

| Variable             | Default | Description                                             |
|---                   |---      |---                                                      |
| `PORT`               | `3001`  | Port the relay and web server listen on                 |
| `TAILSCALE_AUTH_KEY` | --      | If set, starts Tailscale and joins your Tailnet on boot |

---

## AI Agent Hooks (Optional)

Run this once on your remote server to configure your AI coding tools to send completion signals back to the terminal UI. When a task finishes, a banner appears in mobile-terminal — no polling, no watching the screen.

**From the hosted app:**

```bash
curl -fsSL https://cc-mobile-3jd6f.ondigitalocean.app/install.sh | bash
```

**From a self-hosted relay** (the script is served automatically):

```bash
curl -fsSL http://<your-relay-host>:3001/install.sh | bash
```

**Or copy `install.sh` directly from this repo** and run it on the server.

The script detects which tools are installed and configures only those:

| Tool | What it does |
|---|---|
| **Claude Code** | Adds `Stop` and `Notification` hooks to `~/.claude/settings.json` — use `claude` as normal |
| **Codex CLI** | Enables OSC 9 notifications in `~/.codex/config.toml` — use `codex` as normal |
| **Gemini CLI** | Installs a `mobile-gemini` wrapper — use `mobile-gemini` instead of `gemini` |
| **OpenCode** | Installs a `mobile-opencode` wrapper — use `mobile-opencode` instead of `opencode` |

Safe to re-run. Only touches config for tools that are already installed.
