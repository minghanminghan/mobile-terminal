#!/bin/sh

# If a Tailscale Auth Key is provided, start the daemon
if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  echo "Booting Tailscale daemon..."
  # Start the tailscaled daemon in the background to handle WireGuard traffic
  /usr/sbin/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
  
  # Wait for tailscaled to start
  sleep 3
  
  echo "Authenticating Tailscale..."
  # Bring the Tailscale interface up with the provided auth key
  tailscale up --authkey=$TAILSCALE_AUTH_KEY --hostname=cc-mobile-app
fi

# Finally, start the main Node processes (the VITE static server and the cc-mobile relay)
echo "Starting cc-mobile relay and web server..."
exec npm run start:node
