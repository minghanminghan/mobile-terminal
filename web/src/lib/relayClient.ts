const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost'
const RELAY_URL = (import.meta.env.VITE_RELAY_URL as string | undefined) ?? `ws://${host}:3001`

export interface Credentials {
  host: string
  port: number
  username: string
  password?: string
  privateKey?: string
  shell?: 'bash' | 'wsl'
  projectPath?: string
}

export interface RelayClient {
  sendData(data: string | Uint8Array): void
  resize(cols: number, rows: number): void
  disconnect(): void
}

export function connect(
  credentials: Credentials,
  onData: (chunk: Uint8Array) => void,
  onClose: (reason?: string) => void
): RelayClient {
  const ws = new WebSocket(RELAY_URL)
  ws.binaryType = 'arraybuffer'

  let pendingResize: { cols: number, rows: number } | null = null

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'connect', ...credentials }))
    if (pendingResize) {
      ws.send(JSON.stringify({ type: 'resize', cols: pendingResize.cols, rows: pendingResize.rows }))
      pendingResize = null
    }
  }

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      onData(new Uint8Array(event.data))
    } else {
      try {
        const msg = JSON.parse(event.data as string) as { type: string; message?: string }
        if (msg.type === 'error') {
          onClose(msg.message)
        }
      } catch {
        // ignore unexpected text frames
      }
    }
  }

  ws.onclose = (event) => {
    onClose(event.reason || undefined)
  }

  ws.onerror = () => {
    onClose('Connection error')
  }

  return {
    sendData(data) {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    },
    resize(cols, rows) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      } else if (ws.readyState === WebSocket.CONNECTING) {
        pendingResize = { cols, rows }
      }
    },
    disconnect() {
      ws.onclose = null
      ws.onerror = null
      ws.onmessage = null
      ws.onopen = null
      ws.close()
    }
  }
}

