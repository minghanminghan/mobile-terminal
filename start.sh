#!/bin/sh

# If a Tailscale Auth Key is provided, start the daemon
if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  SOCKS5_PORT=1055

  echo "Booting Tailscale daemon..."
  # Start the tailscaled daemon in the background to handle WireGuard traffic
  /usr/sbin/tailscaled --tun=userspace-networking --socks5-server=localhost:$SOCKS5_PORT &

  # Wait for tailscaled to start
  sleep 3

  echo "Authenticating Tailscale..."
  # Bring the Tailscale interface up with the provided auth key
  tailscale up --authkey=$TAILSCALE_AUTH_KEY --hostname=mobile-terminal-app

  # Signal the relay to route Tailscale IPs through the local SOCKS5 proxy.
  # Without this (e.g. in native dev), the OS kernel handles routing directly.
  export TAILSCALE_SOCKS5=localhost:$SOCKS5_PORT
fi

# Finally, start the main Node processes (the VITE static server and the mobile-terminal relay)
echo "Starting mobile-terminal relay and web server..."
exec npm run start:node
