# Stage 1: Build the Web App
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace package.jsons first for caching layer
COPY package*.json ./
COPY web/package*.json ./web/
COPY relay/package*.json ./relay/

# Install dependencies
RUN npm install

# Copy the rest of the monorepo
COPY . .

# Build the Vite frontend for production
RUN npm run build -w web

# Stage 2: Production Runner
FROM node:22-alpine

# Install tmux, ssh client, and tailscale required by the relay server for App Platform
RUN apk update && apk add --no-cache tmux openssh-client tailscale

# Setup Tailscale directories
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

WORKDIR /app

# Copy package metadata
COPY package*.json ./
COPY web/package*.json ./web/
COPY relay/package*.json ./relay/

# Copy all node_modules from builder (npm workspaces hoists them to the root)
COPY --from=builder /app/node_modules ./node_modules

# Copy the built web assets
COPY --from=builder /app/web/dist ./web/dist

# Copy the relay source code
COPY --from=builder /app/relay/src ./relay/src
COPY --from=builder /app/relay/tsconfig.json ./relay/

# Expose Web port and Relay WebSocket port
EXPOSE 5173
EXPOSE 3001

# Copy the start script and make it executable
COPY start.sh ./
RUN chmod +x start.sh

# Start the application via the wrapper script (boots Tailscale then Node)
CMD ["./start.sh"]
