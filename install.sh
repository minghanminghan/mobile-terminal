#!/bin/sh
# mobile-terminal hook installer
# Configures AI coding agents on the remote server to send completion
# signals back to the mobile-terminal terminal UI via OSC escape sequences.
# Safe to re-run — idempotent.

set -e

INSTALL_DIR="$HOME/.local/bin"
NOTIFY_SCRIPT="$INSTALL_DIR/cc-notify"

echo "mobile-terminal hook installer"
echo "========================"
echo ""

# ── 1. Install cc-notify ────────────────────────────────────────────────────
mkdir -p "$INSTALL_DIR"
cat > "$NOTIFY_SCRIPT" << 'EOF'
#!/bin/sh
# cc-notify: emit an OSC 9999 signal readable by mobile-terminal
# Usage: cc-notify '{"type":"stop","tool":"claude"}'
printf '\033]9999;%s\007' "${1:-{\"type\":\"stop\"}}"
EOF
chmod +x "$NOTIFY_SCRIPT"
echo "  ✓ Installed cc-notify → $NOTIFY_SCRIPT"

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
    echo "  ✓ Added $INSTALL_DIR to PATH"
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
    cmd = f"cc-notify '{payload}'"
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
  echo "  ✓ Claude Code hooks configured → $CLAUDE_SETTINGS"
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
    echo "  ✓ Codex CLI configured (OSC 9 notifications enabled) → $CODEX_CONFIG"
  else
    echo "  ✓ Codex CLI already configured"
  fi
fi

# ── 5. Gemini CLI wrapper ─────────────────────────────────────────────────────
if command -v gemini > /dev/null 2>&1; then
  GEMINI_WRAPPER="$INSTALL_DIR/cc-gemini"
  cat > "$GEMINI_WRAPPER" << 'EOF'
#!/bin/sh
gemini "$@"
cc-notify '{"type":"stop","tool":"gemini"}'
EOF
  chmod +x "$GEMINI_WRAPPER"
  echo "  ✓ Gemini CLI wrapper installed → use 'cc-gemini' instead of 'gemini'"
fi

# ── 6. OpenCode wrapper ───────────────────────────────────────────────────────
if command -v opencode > /dev/null 2>&1; then
  OPENCODE_WRAPPER="$INSTALL_DIR/cc-opencode"
  cat > "$OPENCODE_WRAPPER" << 'EOF'
#!/bin/sh
opencode "$@"
cc-notify '{"type":"stop","tool":"opencode"}'
EOF
  chmod +x "$OPENCODE_WRAPPER"
  echo "  ✓ OpenCode wrapper installed → use 'cc-opencode' instead of 'opencode'"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "Done. Restart your shell or run:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
