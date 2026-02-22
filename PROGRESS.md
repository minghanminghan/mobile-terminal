# Implementation Progress

This document tracks milestone-by-milestone implementation for mobile-terminal.
Each milestone includes detailed steps and a verification procedure.

**Context for coding agents:** See `PLAN.md` for the project overview, architecture diagram, and tech stack rationale before starting work here.

---

## M0 — MVP: Web SSH Terminal
**Goal:** A browser tab where you fill in SSH credentials and get a live interactive shell.
No profiles, no Claude-specific features — just SSH in a browser.

### Repository Structure
Set up a monorepo with two packages:
```
mobile-terminal/
  relay/        Node.js WebSocket↔SSH relay server
  web/          Vite + React web app
  PLAN.md
  PROGRESS.md
```

### Steps

#### 1. Relay server scaffold
- Create `relay/` directory
- Init: `npm init -y` inside `relay/`
- Install dependencies:
  - `ws` — WebSocket server
  - `ssh2` — SSH2 client (handles the SSH connection to the remote server)
  - `typescript`, `ts-node`, `@types/node`, `@types/ws` — TypeScript tooling
- Create `relay/tsconfig.json` targeting Node 18+, `commonjs` module
- Create `relay/src/server.ts`

#### 2. Relay server implementation (`relay/src/server.ts`)
The relay must:
- Start an HTTP server and attach a `ws` WebSocket server on a configurable port (default `3001`)
- On each new WebSocket connection, wait for the first message: a JSON connect request
- **Connect message schema** (client → relay):
  ```ts
  {
    type: 'connect',
    host: string,
    port: number,          // default 22
    username: string,
    password?: string,
    privateKey?: string,   // PEM string
  }
  ```
- On receiving the connect message:
  1. Create an `ssh2` `Client`, connect using the provided credentials
  2. On `ssh2` `ready`, call `client.shell({ term: 'xterm-256color', cols: 80, rows: 24 })` to open a PTY
  3. Pipe `stream.stdout` → WebSocket: for each `data` chunk, send it as a binary WebSocket frame
  4. Pipe WebSocket messages → `stream.stdin`: for each incoming binary/text frame after the connect message, write it to the stream
- **Resize message schema** (client → relay):
  ```ts
  { type: 'resize', cols: number, rows: number }
  ```
  On receiving a resize message, call `stream.setWindow(rows, cols, 0, 0)`
- On SSH error or stream close, send a final WebSocket message `{ type: 'error', message }` and close the WebSocket
- On WebSocket close, destroy the SSH connection and stream

#### 3. Web app scaffold
- From `web/`, run: `npm create vite@latest . -- --template react-ts`
- Install dependencies:
  - `@xterm/xterm` — terminal emulator
  - `@xterm/addon-fit` — resizes terminal to fill its container
  - `@xterm/addon-web-links` — makes URLs clickable (nice to have)
  - `tailwindcss`, `@tailwindcss/vite` — styling
- Configure Tailwind in `vite.config.ts` and `index.css`
- Set the base HTML background to black (`bg-black`) to avoid flash of white

#### 4. Web app: WebSocket client service (`web/src/lib/relayClient.ts`)
Create a module that:
- Exports a `connect(credentials, onData, onClose)` function
- Opens `ws://localhost:3001` (URL configurable via `import.meta.env.VITE_RELAY_URL`)
- Sends the connect message as JSON on socket open
- Calls `onData(chunk: Uint8Array)` for every incoming binary frame
- Exposes a `sendData(data: string | Uint8Array)` method for keystrokes
- Exposes a `resize(cols, rows)` method that sends the resize message
- Exposes a `disconnect()` method
- Calls `onClose(reason?: string)` when the socket closes

#### 5. Web app: ConnectionForm component (`web/src/components/ConnectionForm.tsx`)
A form with fields:
- Host (text, required)
- Port (number, default `22`)
- Username (text, required)
- Auth type toggle: **Password** | **Private Key**
- Password field (shown when password auth selected)
- Private key field (textarea, shown when key auth selected; accepts PEM paste)
- Connect button (disabled while connecting)
- Error display area

On submit, call `relayClient.connect(...)`. Show a spinner while the WebSocket handshake and SSH auth complete (connected state is inferred from the first data frame arriving).

#### 6. Web app: Terminal component (`web/src/components/Terminal.tsx`)
- Accepts a `relayClient` instance as a prop
- On mount: initialize `new Terminal({ cursorBlink: true, theme: { background: '#000000' } })`
- Attach `FitAddon`, call `fitAddon.fit()` on mount and on window `resize` events
- Call `terminal.open(containerRef.current)` after mount
- `terminal.onData(data => relayClient.sendData(data))` — forward keystrokes
- `relayClient.onData(chunk => terminal.write(chunk))` — write incoming bytes
- On window resize: call `fitAddon.fit()` then `relayClient.resize(terminal.cols, terminal.rows)`
- Container must fill the full viewport: `w-screen h-screen`

#### 7. Web app: App.tsx
- State: `status: 'idle' | 'connected'`
- `idle`: render `<ConnectionForm />`
- `connected`: render `<Terminal />` with a small disconnect button overlaid in the corner
- On disconnect (button or socket close): return to `idle` state, reset client

#### 8. Start scripts
- `relay/package.json`: add `"start": "ts-node src/server.ts"` and `"dev": "ts-node-dev src/server.ts"`
- `web/package.json`: `"dev"` is already set by Vite
- Root `package.json`: add workspace scripts to start both with `concurrently`

### Verification
1. Run relay: `cd relay && npm run dev`
2. Run web app: `cd web && npm run dev`, open `http://localhost:5173`
3. Fill in valid SSH credentials for a remote server
4. Click Connect — the form disappears and xterm.js fills the screen
5. The shell prompt appears; type `whoami`, `ls` — output appears immediately
6. Type `claude` (if installed on the remote) — Claude Code launches and is interactive
7. Resize the browser window — the terminal reflows without garbling output
8. Click Disconnect — the form reappears and the SSH session closes

---

## M1 — Connection Profiles
**Goal:** Save server profiles locally so users don't re-enter credentials every visit.

### Steps

#### 1. Profile data model (`web/src/lib/profiles.ts`)
Define and export:
```ts
type AuthType = 'password' | 'key'

interface Profile {
  id: string           // crypto.randomUUID()
  name: string         // display name, e.g. "prod server"
  host: string
  port: number
  username: string
  authType: AuthType
  password?: string    // stored in sessionStorage for security (cleared on tab close)
  privateKey?: string  // PEM string (stored in sessionStorage)
}
```
Implement and export:
- `loadProfiles(): Profile[]` — reads `localStorage` for metadata, merges with `sessionStorage` for secrets
- `saveProfiles(profiles: Profile[]): void` — splits data: metadata → `localStorage`, secrets → `sessionStorage`
- `addProfile(profile: Omit<Profile, 'id'>): Profile` — assigns UUID, saves
- `updateProfile(id: string, updates: Partial<Profile>): void`
- `deleteProfile(id: string): void`

#### 2. ProfileList component (`web/src/components/ProfileList.tsx`)
- Renders a list of saved profiles
- Each profile card shows name, host, username
- **Connect** button on each card — calls `onConnect(profile)`
- **Edit** icon — opens the connection form pre-filled with profile data
- **Delete** icon — confirms then removes the profile
- **New Profile** button at the top

#### 3. Update ConnectionForm
- Add a **Name** field for the profile display name
- Add a **Save Profile** checkbox (default checked)
- If saving, call `addProfile(...)` on successful connect
- Accept an optional `initialValues: Profile` prop for the edit flow

#### 4. Update App.tsx
- Home screen (`idle`): show `<ProfileList />` with a New Connection button
- Clicking a profile's Connect button connects directly using stored credentials — no form shown
- Clicking New Connection shows the connection form

### Verification
1. Open the app — profile list (empty) is shown, not the connection form
2. Click New Connection, fill in credentials with Save Profile checked, connect successfully
3. Disconnect, reload — the saved profile appears in the list
4. Click Connect on the profile — connects without re-entering credentials
5. Edit the profile (change the name), save — updated name persists after reload
6. Delete the profile — it's gone after page reload

---

## M2 — Session Persistence (via tmux)
**Goal:** The terminal session survives WebSocket drops, relay restarts, and tab closes. Reconnecting reattaches to the running process.

**Approach:** Delegate persistence to tmux on the remote server. The relay stays completely stateless.
User connects -> `tmux new-session -A -s <profile-id>` (or similar unique ID) -> working session.

**Context for Claude:**
When running Claude, users often need to see the file tree or read files to understand what changes are proposed. A simple single-pane terminal is limiting.

## M3 — Context Tools (Split Terminal)
**Goal:** Provide a secondary terminal pane alongside the main session.
**Concept:** A "Sidebar" or "Split" view that opens a second independent SSH shell.
**Use Case:** User runs `claude` in the main terminal, and uses the split terminal to run `ls`, `git status`, or `nano` to inspect files without interrupting Claude.

### Steps

#### 1. No relay changes
`relay/src/server.ts` requires no modifications. The relay is already a stateless SSH bridge. Persistence is entirely handled by tmux on the remote server.

#### 2. Update M2 profile default startup command
In `ConnectionForm.tsx` (added in M1), change the startup command placeholder from `cd ~/myproject && claude` to `tmux new-session -A -s cc`. Document in the UI that this enables session persistence.

#### 3. Auto-reconnect in the web client (`web/src/components/Terminal.tsx`)
When the WebSocket closes unexpectedly (not due to the user clicking disconnect), automatically retry the connection:
- Track whether the disconnect was user-initiated with a `deliberate` ref, set to `true` only when the disconnect button is clicked
- On `onClose` callback: if `deliberate` is false, wait 2 seconds then call `connect()` again with the same credentials
- Retry up to 5 times with 2-second intervals; after 5 failures, call `onDisconnect(reason)` to return to the form
- Each reconnect attempt re-sends the startup command (tmux `-A` reattaches instead of creating a duplicate session)

#### 4. Connection status indicator
Add a small status badge to the terminal overlay (top-left, unobtrusive):
- Green dot + "live" — WebSocket open, shell receiving data
- Yellow dot + "reconnecting…" — WebSocket closed, retrying
- Red dot + "disconnected" — all retries exhausted

Implement with a `status: 'live' | 'reconnecting' | 'disconnected'` state in `Terminal.tsx`, set from the reconnect logic.

### Verification
1. Set startup command on a profile to `tmux new-session -A -s cc`
2. Connect — shell opens inside a tmux session. Run `claude` or any long-running process
3. Close the browser tab; wait 5 seconds; reopen the URL and reconnect using the saved profile
4. The terminal reattaches — the process from step 2 is still running exactly where it was
5. Kill and restart the relay server while connected — the tab should show "reconnecting…" then reattach
6. Click Disconnect explicitly — return to the profile list; reconnect — tmux creates a fresh session (previous one is still alive on the server, accessible via `tmux attach -t cc` manually)
7. Verify that the relay has no session-related state: restarting the relay does not affect any running tmux sessions

---

## M4 — GitHub Credentials
**Goal:** Store GitHub usage tokens for easy authentication in SSH sessions.
**Scope:** Simple token storage and injection.

### Steps
1.  **Token Store:** Store GitHub token securely (sessionStorage/SecureStore).
2.  **Auth Helper:** Inject `GITHUB_TOKEN` env var into the SSH session or provide a helper command to authenticate `gh` cli.
3.  **UI Update:** Add GitHub Token field to Profile settings.

---

## M5 — Mobile (React Native + WebView)
**Goal:** iOS and Android apps wrapping the web terminal in a native shell.

### Steps

#### 1. Create Expo app
- From repo root: `npx create-expo-app mobile --template blank-typescript`
- Install:
  - `react-native-webview` — WebView for the xterm.js terminal
  - `@react-navigation/native`, `@react-navigation/stack`, `react-native-screens`, `react-native-safe-area-context` — navigation
  - `expo-secure-store` — encrypted storage for private keys and passwords
  - `@react-native-async-storage/async-storage` — non-sensitive profile data

#### 2. Native profile store (`mobile/src/lib/profiles.ts`)
Same `Profile` type as the web app.
- Store non-sensitive fields (host, port, username, name) in `AsyncStorage`
- Store `password` and `privateKey` in `expo-secure-store` (encrypted, keyed by `profile-<id>-secret`)
- Implement the same CRUD API: `loadProfiles`, `addProfile`, `updateProfile`, `deleteProfile`

#### 3. Navigation structure
Stack navigator with three screens:
- `ProfileListScreen` — default screen, lists saved profiles
- `ProfileFormScreen` — add/edit a profile (same fields as web ConnectionForm)
- `TerminalScreen` — full-screen WebView

#### 4. ProfileListScreen (`mobile/src/screens/ProfileListScreen.tsx`)
- Native `FlatList` of profile cards
- Each card: name, host, username; **Connect** and **Edit** buttons
- **New Profile** button in the header

#### 5. TerminalScreen (`mobile/src/screens/TerminalScreen.tsx`)
- Receives a `Profile` object via navigation params
- Renders a full-screen `<WebView source={{ uri: WEB_APP_URL }} />`
- On WebView load, injects the profile credentials so the web app auto-connects:
  ```js
  injectedJavaScript={`window.__INITIAL_PROFILE__ = ${JSON.stringify(profile)};`}
  ```
- The web app must read `window.__INITIAL_PROFILE__` on load and call `relayClient.connect(...)` automatically if present
- Sets `keyboardDisplayRequiresUserAction={false}` so the terminal can capture focus
- Wraps in `SafeAreaView` to respect notch and home indicator

#### 6. Update web app to accept injected credentials
In `web/src/main.tsx` (or `App.tsx`), before rendering:
```ts
const injected = (window as any).__INITIAL_PROFILE__
if (injected) {
  // skip profile list, connect immediately using injected credentials
}
```

### Verification
1. `expo start`, open on iOS Simulator and Android Emulator
2. Create a profile using the native form
3. Tap Connect — WebView loads and auto-connects to the SSH session
4. Terminal is interactive: type commands, output appears
5. Rotate the device — terminal reflows correctly
6. Background the app, foreground it — session is still live (M3 persistence)
7. Test on a physical iOS device and physical Android device
8. Verify private key is stored encrypted (check that it does not appear in plain text in app storage)

---

## M6 — Voice-to-Text Input
**Goal:** Let mobile users dictate text instead of typing. A mic button in the virtual keyboard row starts speech recognition; transcribed text appears in an editable preview overlay before being sent to the terminal.

**Approach:** Use the browser's built-in Web Speech API (`webkitSpeechRecognition`) — no external API, no new packages, no backend changes. The mic button only renders if the API is available in the current browser, so unsupported browsers see no change. Transcribed text is never injected directly into the terminal; it always passes through an editable preview step first, preventing accidental command execution.

### Steps

#### 1. Add voice input state to `VirtualKeyboard.tsx`
- Add `isListening: boolean` state — controls mic button appearance and recognition lifecycle
- Add `preview: string | null` state — holds transcribed text; `null` means overlay is hidden
- Add `speechRef` ref to hold the `SpeechRecognition` instance across renders
- Add `supported` constant: `!!(window.SpeechRecognition ?? window.webkitSpeechRecognition)` — gates rendering of the mic button

#### 2. Implement `startListening()` helper
- Instantiate `SpeechRecognition` (prefixed or unprefixed)
- Set `lang = 'en-US'`, `interimResults = false`, `maxAlternatives = 1`
- `onresult`: take `event.results[0][0].transcript`, set `preview` to that string, set `isListening = false`
- `onerror` / `onend`: set `isListening = false`
- Call `recognition.start()` and set `isListening = true`
- Store instance in `speechRef` so `stopListening()` can call `recognition.abort()`

#### 3. Add mic button to the key row
- Append a mic button after the existing virtual keys (outside the `VIRTUAL_KEYS` array — it has distinct behaviour)
- While `isListening`: red background, pulsing ring animation, tapping again calls `stopListening()`
- While idle: standard zinc-800 style, tapping calls `startListening()`
- Use an inline SVG mic icon to avoid adding an icon package

#### 4. Add preview overlay
- Render only when `preview !== null`
- Fixed panel anchored above the virtual keyboard row (use `fixed bottom-[56px]` to clear the key row height)
- Contains:
  - A `<textarea>` pre-filled with `preview`, `onChange` updates `preview` state so user can edit before sending
  - **Send** button: calls `(window as any).__INJECT_TERMINAL_DATA__(preview)` then sets `preview = null`
  - **Cancel** button: sets `preview = null`
- Tapping Send does **not** append `\r` — the user presses Enter in the terminal if they want to execute

### Verification
1. Open the web app on Chrome or Safari (desktop or mobile — narrow the window to ≤ 767px wide to make the virtual keyboard visible)
2. Connect to an SSH session and reach the terminal view
3. Confirm the virtual keyboard row is visible and a microphone icon button appears at the right end
4. Tap the mic button — the browser prompts for microphone permission; grant it
5. Speak a short phrase, e.g. **"git status"**
6. Confirm the mic button turns red with a pulsing animation while listening
7. After speaking, confirm a preview overlay appears above the key row containing the transcribed text in an editable box
8. Edit the text in the overlay to correct any mis-transcription
9. Tap **Send** — the text is injected at the terminal cursor; the overlay closes; nothing is auto-executed (no Enter sent)
10. Repeat: speak, then tap **Cancel** — the overlay closes and nothing is sent to the terminal
11. On Firefox (no `webkitSpeechRecognition`): confirm the mic button does not appear and all other virtual keys still work

---

## M7 — AI Agent Signal Integration (OSC Protocol)
**Goal:** Receive structured, reliable signals from AI coding agents running on the remote server (task complete, notification) and surface them as UI events in mobile-terminal — without regex-parsing terminal output.

**Supported agents:** Claude Code, Codex CLI, Gemini CLI, OpenCode.

**Approach:** Use OSC (Operating System Command) escape sequences as an in-band signal channel. The hook on the remote server writes a short invisible byte sequence into the terminal stream; the relay forwards it untouched; the mobile-terminal frontend intercepts it before xterm.js and dispatches a structured window event. xterm.js silently drops unknown OSC codes so the terminal display is unaffected.

Two OSC codes are handled:
- **OSC 9999** — mobile-terminal's own protocol, emitted by `cc-notify` and all wrapper scripts. Payload is JSON: `{"type":"stop","tool":"claude"}`.
- **OSC 9** — Codex CLI's native notification channel (enabled via `notification_method = "osc9"` in its config). Payload is plain text interpreted as a stop signal.

The install script is served by the relay at `GET /install.sh`. Users run one curl command in their already-open terminal to configure everything on the host.

### Steps

#### 1. `install.sh` — host-side installer (new file, repo root)
A POSIX shell script that:
- Creates `~/.local/bin/cc-notify`: a one-liner that emits `\033]9999;<json>\007` to stdout
- Adds `~/.local/bin` to PATH in `.bashrc`/`.zshrc`/`.profile` if not already present
- **Claude Code** (if `claude` is in PATH): merges `Stop` and `Notification` hooks into `~/.claude/settings.json` using `python3` for safe JSON merge; hook command calls `cc-notify '{"type":"stop"}'` / `cc-notify '{"type":"notify"}'`
- **Codex CLI** (if `codex` is in PATH): appends `notification_method = "osc9"` under `[tui]` in `~/.codex/config.toml` if not already set; Codex then emits OSC 9 natively on task completion
- **Gemini CLI** (if `gemini` is in PATH): installs `~/.local/bin/cc-gemini` wrapper that runs `gemini "$@"` then calls `cc-notify '{"type":"stop","tool":"gemini"}'`
- **OpenCode** (if `opencode` is in PATH): installs `~/.local/bin/cc-opencode` wrapper that runs `opencode "$@"` then calls `cc-notify '{"type":"stop","tool":"opencode"}'`
- Idempotent: safe to re-run; never duplicates hooks or overwrites unrelated config
- Prints a clear summary of what was installed/configured

#### 2. Relay — serve `install.sh` (`relay/src/server.ts`)
Add a `GET /install.sh` route before the existing SPA catch-all that sends the file with `Content-Type: text/plain`. The script is read from `../../install.sh` relative to the compiled relay — the Dockerfile already copies the repo root so no Dockerfile changes are needed.

#### 3. Frontend — OSC stream analyzer (`web/src/components/Terminal.tsx`)
In the `onData` callback passed to `connect()` (currently `(chunk) => term.write(chunk)`), intercept each chunk before writing to xterm.js:
- Decode the chunk to a string and run a regex: `/\x1b\](\d+);([^\x07]*)\x07/g`
- For each match where code is `9999`: parse payload as JSON, dispatch `window.dispatchEvent(new CustomEvent('CC_SIGNAL', { detail: event }))`
- For each match where code is `9` (Codex): dispatch `CC_SIGNAL` with `{ type: 'stop', tool: 'codex', message: payload }`
- Always call `term.write(chunk)` unchanged — xterm.js ignores unknown OSC codes natively, no stripping needed
- Wrap JSON.parse in try/catch; malformed payloads are silently ignored

#### 4. `SignalBanner` component (new: `web/src/components/SignalBanner.tsx`)
A self-contained component that:
- Listens for `CC_SIGNAL` on `window` via `useEffect`
- Maintains `signal: { type: string, tool?: string, message?: string } | null` state
- When a signal arrives: set state, start a 5-second auto-dismiss timer (clearTimeout + reset on each new signal)
- Renders a fixed banner at the top of the viewport (below the nav bar, `z-40`)
- **`stop` signal**: green background, checkmark icon, "Task complete" label + tool name if present
- **`notify` signal**: blue background, bell icon, message text
- Dismiss button (×) clears state immediately
- Returns `null` when no signal is active

#### 5. `TerminalWorkspace` — integrate banner + setup button (`web/src/components/TerminalWorkspace.tsx`)
- Import and render `<SignalBanner />` inside the workspace (above the terminal, below the nav bar)
- Add a "Setup Hooks" button to the top nav bar
- On click: show a small modal/popover containing the install command pre-filled with `window.location.origin`:
  ```
  curl -fsSL <origin>/install.sh | bash
  ```
- One-tap copy button copies the command to the clipboard
- Modal dismisses on outside click or pressing ×

### Verification
1. SSH into a remote server that has at least one of: `claude`, `codex`, `gemini`, `opencode`
2. In the mobile-terminal terminal, click **Setup Hooks** in the nav bar — confirm the install command appears with the correct relay URL
3. Copy and run the install command in the terminal — confirm it prints a summary of what was configured for each detected tool
4. **Claude Code**: run `claude` and complete a task; confirm a green "Task complete" banner appears in mobile-terminal within a second of Claude finishing
5. **Codex CLI**: run `codex` and complete a task; confirm the banner appears via OSC 9
6. **Gemini CLI**: run `cc-gemini` and let it finish; confirm the banner appears
7. **OpenCode**: run `cc-opencode` and let it finish; confirm the banner appears
8. Confirm the banner auto-dismisses after ~5 seconds
9. Confirm the × button dismisses the banner immediately
10. Confirm the terminal output is visually unchanged — no garbled characters or missing output from OSC stripping
11. Confirm running the install script a second time is safe — no duplicate hooks in `~/.claude/settings.json`, no duplicate lines in config files
12. On a server with none of the supported tools installed, confirm the install script exits cleanly with an appropriate message
