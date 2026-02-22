#!/bin/sh
# mobile-terminal hook installer
# Configures AI coding agents on the remote server to send completion
# signals back to the mobile-terminal terminal UI via OSC escape sequences.
# Safe to re-run — idempotent.

set -e

INSTALL_DIR="$HOME/.local/bin"
NOTIFY_SCRIPT="$INSTALL_DIR/mobile-notify"

# ── Help / list mode ──────────────────────────────────────────────────────────
# Running with no arguments (or --list / --help) shows all available options
# without installing anything.
if [ "$1" = "--list" ] || [ "$1" = "--help" ] || [ "$1" = "-h" ]; then
  echo "mobile-terminal hook installer"
  echo "=============================="
  echo ""
  echo "Configures AI coding agents to send completion signals to mobile-terminal."
  echo "Signals travel through the existing SSH connection — no additional API required."
  echo ""
  # echo "Usage:"
  # echo "  curl -fsSL <relay-url>/install.sh | bash"
  # echo ""
  echo "Available integrations:"
  echo ""
  echo "  Claude Code     — adds Stop/Notification hooks to ~/.claude/settings.json"
  echo "                    use 'claude' as normal"
  echo ""
  echo "  Codex CLI       — enables OSC 9 notifications in ~/.codex/config.toml"
  echo "                    use 'codex' as normal"
  echo ""
  echo "  Gemini CLI      — installs a 'mobile-gemini' wrapper script"
  echo "                    use 'mobile-gemini' instead of 'gemini'"
  echo ""
  echo "  OpenCode        — installs a 'mobile-opencode' wrapper script"
  echo "                    use 'mobile-opencode' instead of 'opencode'"
  echo ""
  echo "The script detects which tools are installed and configures only those."
  echo "Safe to re-run — idempotent."
  echo ""
  exit 0
fi

echo "mobile-terminal hook installer"
echo "=============================="
echo ""

# ── 1. Install mobile-notify ────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cat > "$NOTIFY_SCRIPT" << 'EOF'
#!/bin/sh
# mobile-notify: emit an OSC 9999 signal readable by mobile-terminal
# Usage: mobile-notify '{"type":"stop","tool":"claude"}'
printf '\033]9999;%s\007' "${1:-{\"type\":\"stop\"}}"
EOF
chmod +x "$NOTIFY_SCRIPT"
echo "  [success] Installed mobile-notify → $NOTIFY_SCRIPT"

# ── 2. Ensure ~/.local/bin is on PATH ────────────────────────────────────────
case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    for rc in "$HOME/.bashrc" "$HOME/.zshrc" "$HOME/.profile"; do
      [ -f "$rc" ] || continue
      grep -qF "$INSTALL_DIR" "$rc" && continue
      echo "" >> "$rc"
      echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$rc"
    done
    export PATH="$INSTALL_DIR:$PATH"
    echo "  [success] Added $INSTALL_DIR to PATH"
    ;;
esac

# ── 3. Claude Code ───────────────────────────────────────────────────────────
if command -v claude > /dev/null 2>&1; then
  CLAUDE_SETTINGS="$HOME/.claude/settings.json"
  mkdir -p "$HOME/.claude"
  [ -f "$CLAUDE_SETTINGS" ] || echo '{}' > "$CLAUDE_SETTINGS"

  python3 - "$CLAUDE_SETTINGS" << 'PYEOF'
import json, sys

path = sys.argv[1]
with open(path) as f:
    cfg = json.load(f)

hooks = cfg.setdefault("hooks", {})
to_add = [
    ("Stop",         '{"type":"stop","tool":"claude"}'),
    ("Notification", '{"type":"notify","tool":"claude"}'),
]
for event, payload in to_add:
    entries = hooks.setdefault(event, [])
    cmd = f"mobile-notify '{payload}'"
    already = any(
        h.get("command", "") == cmd
        for entry in entries
        for h in entry.get("hooks", [])
    )
    if not already:
        entries.append({"hooks": [{"type": "command", "command": cmd}]})

with open(path, "w") as f:
    json.dump(cfg, f, indent=2)
PYEOF
  echo "  [success] Claude Code hooks configured → $CLAUDE_SETTINGS"
fi

# ── 4. Codex CLI ─────────────────────────────────────────────────────────────
if command -v codex > /dev/null 2>&1; then
  CODEX_CONFIG="$HOME/.codex/config.toml"
  mkdir -p "$HOME/.codex"
  touch "$CODEX_CONFIG"
  if ! grep -q "notification_method" "$CODEX_CONFIG"; then
    # Append [tui] section if missing, or add key under existing section
    if grep -q "^\[tui\]" "$CODEX_CONFIG"; then
      # Insert after the [tui] header line
      sed -i '/^\[tui\]/a notification_method = "osc9"' "$CODEX_CONFIG"
    else
      printf '\n[tui]\nnotification_method = "osc9"\n' >> "$CODEX_CONFIG"
    fi
    echo "  [success] Codex CLI configured (OSC 9 notifications enabled) → $CODEX_CONFIG"
  else
    echo "  [success] Codex CLI already configured"
  fi
fi

# ── 5. Gemini CLI wrapper ─────────────────────────────────────────────────────
if command -v gemini > /dev/null 2>&1; then
  GEMINI_WRAPPER="$INSTALL_DIR/mobile-gemini"
  cat > "$GEMINI_WRAPPER" << 'EOF'
#!/bin/sh
gemini "$@"
mobile-notify '{"type":"stop","tool":"gemini"}'
EOF
  chmod +x "$GEMINI_WRAPPER"
  echo "  [success] Gemini CLI wrapper installed → use 'mobile-gemini' instead of 'gemini'"
fi

# ── 6. OpenCode wrapper ───────────────────────────────────────────────────────
if command -v opencode > /dev/null 2>&1; then
  OPENCODE_WRAPPER="$INSTALL_DIR/mobile-opencode"
  cat > "$OPENCODE_WRAPPER" << 'EOF'
#!/bin/sh
opencode "$@"
mobile-notify '{"type":"stop","tool":"opencode"}'
EOF
  chmod +x "$OPENCODE_WRAPPER"
  echo "  [success] OpenCode wrapper installed → use 'mobile-opencode' instead of 'opencode'"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "Done. Restart your shell or run:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "Available integrations:"
if command -v claude > /dev/null 2>&1; then
  echo "  claude          — hooks configured, use as normal"
else
  echo "  claude          — not detected (install Claude Code to enable)"
fi
if command -v codex > /dev/null 2>&1; then
  echo "  codex           — OSC notifications enabled, use as normal"
else
  echo "  codex           — not detected (install Codex CLI to enable)"
fi
if command -v gemini > /dev/null 2>&1; then
  echo "  mobile-gemini   — use instead of 'gemini' to get completion signals"
else
  echo "  mobile-gemini   — not detected (install Gemini CLI to enable)"
fi
if command -v opencode > /dev/null 2>&1; then
  echo "  mobile-opencode — use instead of 'opencode' to get completion signals"
else
  echo "  mobile-opencode — not detected (install OpenCode to enable)"
fi
