import http from 'http'
import express from 'express'
import path from 'path'
import { WebSocketServer, WebSocket } from 'ws'
import type { RawData } from 'ws'
import { Client, type ConnectConfig } from 'ssh2'
import type { ClientChannel } from 'ssh2'
const PORT = parseInt(process.env.PORT ?? '3001', 10)

function log(message: string) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${message}`)
}

interface ConnectMessage {
  type: 'connect'
  host: string
  port?: number
  username: string
  password?: string
  privateKey?: string
  projectPath?: string
}

interface ResizeMessage {
  type: 'resize'
  cols: number
  rows: number
}

const app = express()

// Serve the compiled React frontend static files
const webDistPath = path.join(__dirname, '../../web/dist')
app.use(express.static(webDistPath))

// Catch-all route for SPA routing (returns index.html)
app.use((req, res, next) => {
  if (req.method === 'GET') {
    res.sendFile(path.join(webDistPath, 'index.html'))
  } else {
    next()
  }
})

const server = http.createServer(app)
const wss = new WebSocketServer({ server })

wss.on('connection', (ws: WebSocket) => {
  log('[connection] New WebSocket connection')
  let ssh: Client | null = null
  let shell: ClientChannel | null = null

  // Buffer for messages arriving during handshake
  let pendingResize: ResizeMessage | null = null
  let pendingData: string[] = []

  function cleanup() {
    log('[cleanup] Closing session')
    shell?.close()
    ssh?.end()
    shell = null
    ssh = null
    pendingResize = null
    pendingData = []
  }

  function sendError(message: string) {
    log(`[error] Sending error to client: ${message}`)
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'error', message }))
    }
  }

  ws.on('message', (raw: RawData, isBinary: boolean) => {
    // 1. Shell is open — forward input or handle control messages
    if (shell) {
      if (!isBinary) {
        const text = raw.toString()
        try {
          const msg = JSON.parse(text)
          if (msg.type === 'resize') {
            const resizeMsg = msg as ResizeMessage
            if (typeof resizeMsg.rows === 'number' && typeof resizeMsg.cols === 'number') {
              shell.setWindow(resizeMsg.rows, resizeMsg.cols, 0, 0)
              return
            }
          }
        } catch {
          // Not JSON — raw terminal input
        }
        shell.write(text)
      } else {
        shell.write(raw as Buffer)
      }
      return
    }

    // 2. Connecting phase (SSH initialized but shell not ready)
    if (ssh) {
      if (!isBinary) {
        const text = raw.toString()
        try {
          const msg = JSON.parse(text)
          if (msg.type === 'resize') {
            log('[buffering] Buffering resize message during handshake')
            pendingResize = msg as ResizeMessage
            return
          }
        } catch {
          // Raw text input
        }
        log('[buffering] Buffering input data during handshake')
        pendingData.push(text)
      } else {
        // Binary input? ignoring for now or buffer as buffer?
        // Simplification: just ignoring binary input during handshake
      }
      return
    }

    // 3. No shell yet — expect the connect message
    let msg: ConnectMessage
    try {
      msg = JSON.parse(raw.toString())
    } catch {
      ws.close(1008, 'expected JSON connect message')
      return
    }

    if (msg.type !== 'connect') {
      ws.close(1008, 'expected connect message')
      return
    }

    log(`[connect] Connecting to ${msg.username}@${msg.host}:${msg.port ?? 22}`)

    ssh = new Client()

    ssh.on('ready', () => {
      log('[ssh] Authentication successful')

      startShell()

      function startShell() {
        const rows = pendingResize?.rows ?? 24
        const cols = pendingResize?.cols ?? 80
        const term = 'xterm-256color'

        log(`[ssh] Starting shell with size ${cols}x${rows}`)

        const onShellReady = (err: Error | undefined, stream: ClientChannel) => {
          if (err) {
            sendError(err.message)
            ws.close()
            return
          }

          shell = stream
          log('[ssh] Shell started')

          // Flush pending data
          if (pendingData.length > 0) {
            log(`[ssh] Flushing ${pendingData.length} buffered input chunks`)
            pendingData.forEach(chunk => stream.write(chunk))
            pendingData = []
          }

          // If we had a buffered resize that might be different from initial pty alloc (unlikely if we used it above, but good practice)
          if (pendingResize) {
            stream.setWindow(pendingResize.rows, pendingResize.cols, 0, 0)
            pendingResize = null
          }

          stream.on('data', (chunk: Buffer) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
          })

          stream.stderr.on('data', (chunk: Buffer) => {
            log(`[ssh] stderr: ${chunk.toString()}`)
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
          })

          stream.on('close', () => {
            log('[ssh] Shell closed')
            ws.close()
          })
        }

        let cmd = msg.projectPath
          ? `tmux new-session -A -D -t . -c "${msg.projectPath}" -s cc \\; set -g mouse on`
          : `tmux new-session -A -D -s cc \\; set -g mouse on`

        log(`[ssh] Spawning command: ${cmd}`)
        ssh!.exec(cmd, { pty: { term, rows, cols } }, onShellReady as any) // exec with pty
      }
    })

    ssh.on('error', (err) => {
      log(`[ssh] Error: ${err.message}`)
      sendError(err.message)
      ws.close()
    })

    const config: ConnectConfig = {
      host: msg.host,
      port: msg.port ?? 22,
      username: msg.username,
      // TODO: proper host key verification post-MVP
      hostVerifier: () => true,
    }
    if (msg.password) config.password = msg.password
    if (msg.privateKey) config.privateKey = msg.privateKey

    ssh.connect(config)
  })

  ws.on('close', () => {
    log('[ws] Client disconnected')
    cleanup()
  })
  ws.on('error', (err) => {
    log(`[ws] Error: ${err.message}`)
    cleanup()
  })
})

server.listen(PORT, () => {
  log(`Relay listening on ws://localhost:${PORT}`)
})
