# cc-mobile

`cc-mobile` is a powerful, self-hosted web and native mobile application that transforms your smartphone or tablet into a first-class remote development environment. Designed to solve the friction of tiny on-screen keyboards and clumsy SSH clients, `cc-mobile` relies on a novel Node.js WebSocket relay and heavy `tmux` integration to provide a fully responsive, session-persistent, touch-optimized terminal.

---

## 🏗 Architecture

The project consists of three deeply integrated layers:

1.  **`relay/` (Node.js backend)**
    *   A local WebSocket server that bridges the gap between browser-based terminal emulators and native SSH binaries.
    *   Utilizes the `ssh2` package to establish raw SSH connections.
    *   Intelligently injects initial SSH commands (like auto-spawning `tmux` or navigating to project paths) and forwards standard I/O streams and resize events between the client and the remote host.

2.  **`web/` (React + Vite Frontend)**
    *   The core terminal renderer powered by **xterm.js**.
    *   Features a custom-built, touch-optimized React Context Menu that intercepts long-presses to trigger native `tmux` window management (splits, zoom, kill).
    *   Fully manages connection state, profiles, and credentials using secure browser APIs (`sessionStorage` for keys/passwords, `localStorage` for metadata).

3.  **`mobile/` (React Native + Expo Wrapper)**
    *   A native iOS/Android shell that wraps the identical Vite frontend via a secure `react-native-webview`.
    *   Bypasses insecure browser limits by utilizing `expo-secure-store` (iOS Keychain / Android Keystore) to safely persist SSH passwords and PEM keys across app launches.
    *   Renders a custom Virtual Keyboard overlay directly below the web terminal, injecting hardware modifier flags (Ctrl, Alt, Shift) down into the xterm context.

---

## ✨ Features

### Seamless Continuity
Start a build on your laptop, close your browser, open the app on your phone on the train, and instantly pick up exactly where you left off. The backend automatically leverages `tmux new-session -A -D` to attach and detach clients, dynamically resizing pane layouts to fit whatever screen dimensions are currently requesting the stream.

### Unified "Projects" Tab
Navigating profound directory structures on a phone keyboard is a nightmare. `cc-mobile` allows you to save profiles with an associated **Project Path**. Connecting to a Project bypasses your home directory and instructs `tmux` to initialize all subsequent terminal panes rooted directly in your workspace (`tmux -c /path`).

### Touch-Optimized UX
We bypass traditional terminal emulators' weaknesses on mobile devices:
*   **Long-Press Menu**: Replaces keyboard shortcuts for tmux on mobile for pane management.
*   **Virtual Control Row**: A native scrolling bar at the bottom of the screen provides fast access to `TAB`, `ESC`, Arrow Keys, and toggleable `CTRL`, `ALT`, and `SHIFT` states—making operations like `Ctrl+C` (SIGINT) effortless.
*   **Native Mouse Mode**: `tmux` mouse mode is enabled by default, allowing you to drag pane borders with your finger to resize them dynamically.

### Ephemeral Secrets
When using the web interface, your passwords and private keys are never stored on disk. They live entirely in memory (`sessionStorage`) and disappear the moment you close the tab. On mobile, they are vaulted using hardware encryption, then injected securely upon boot.

---

## 🚀 Getting Started

To launch the local development environment:

```bash
# clone repo
git clone https://github.com/minghanminghan/cc-mobile.git

# Start both the Node WebSocket relay and the Vite Web frontend concurrently
npm run dev

# In a separate terminal, launch the React Native native bundler
cd mobile
npx expo start
```
