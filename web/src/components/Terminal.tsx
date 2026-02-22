import { useEffect, useRef, useState } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { WebLinksAddon } from '@xterm/addon-web-links'
import '@xterm/xterm/css/xterm.css'
import { connect, type Credentials, type RelayClient } from '../lib/relayClient'

interface Props {
  credentials: Credentials
  onDisconnect: (reason?: string) => void
  onClientReady?: (client: RelayClient) => void
  className?: string
}

export default function Terminal({ credentials, onDisconnect, onClientReady, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const clientRef = useRef<RelayClient | null>(null)
  const termRef = useRef<XTerm | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)

  // Buffer to track recent keystrokes for 'cls' detection
  const inputBufferRef = useRef<string>('')

  // Long press for context menu
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTouchRef = useRef<{ clientX: number, clientY: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)

  // Disable context menu
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      event.preventDefault()
    }
    document.addEventListener('contextmenu', handleContextMenu)

      // Expose injection for React Native Virtual Keyboard
      ; (window as any).__INJECT_TERMINAL_DATA__ = (data: string) => {
        clientRef.current?.sendData(data)
      }

    return () => {
      document.removeEventListener('contextmenu', handleContextMenu)
      delete (window as any).__INJECT_TERMINAL_DATA__
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: '"Cascadia Code", "Fira Code", "JetBrains Mono", monospace',
      theme: {
        background: '#09090b', // zinc-950 to match app theme
        foreground: '#e4e4e4',
        cursor: '#e4e4e4',
        selectionBackground: '#ffffff40',
      },
      allowProposedApi: true,
      scrollback: 10000,
    })

    termRef.current = term

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.loadAddon(new WebLinksAddon())
    term.open(containerRef.current)

    // Handle custom key events
    term.attachCustomKeyEventHandler((event) => {
      if (event.type === 'keydown') {
        // Ctrl+V / Cmd+V: prevent both \x16 and the native paste event,
        // then read clipboard once ourselves.
        if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
          event.preventDefault() // stops the browser firing a paste event (which xterm.js also handles)
          navigator.clipboard.readText().then(text => {
            if (text) clientRef.current?.sendData(text)
          })
          return false
        }
        // Ctrl+C or Cmd+C for copy (if text selected)
        if ((event.ctrlKey || event.metaKey) && event.key === 'c' && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection())
          term.clearSelection()
          return false
        }
      }
      return true
    })

    const client = connect(
      credentials,
      (chunk) => {
        // Scan for OSC signals before handing bytes to xterm.js.
        // OSC 9999 = cc-mobile custom protocol (JSON payload).
        // OSC 9    = Codex CLI native notifications (plain-text payload).
        // xterm.js silently drops unknown OSC codes so no stripping is needed.
        const text = new TextDecoder().decode(chunk)
        const OSC_RE = /\x1b\](\d+);([^\x07]*)\x07/g
        for (const match of text.matchAll(OSC_RE)) {
          const [, code, payload] = match
          if (code === '9999') {
            try {
              const signal = JSON.parse(payload)
              if ((window as any).ReactNativeWebView) {
                // Native app: hand off to React Native for a local notification
                ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'SIGNAL', signal }))
              } else {
                window.dispatchEvent(new CustomEvent('CC_SIGNAL', { detail: signal }))
              }
            } catch { /* ignore malformed */ }
          } else if (code === '9') {
            const signal = { type: 'stop', tool: 'codex', message: payload }
            if ((window as any).ReactNativeWebView) {
              ;(window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'SIGNAL', signal }))
            } else {
              window.dispatchEvent(new CustomEvent('CC_SIGNAL', { detail: signal }))
            }
          }
        }
        term.write(chunk)
      },
      (reason) => onDisconnect(reason)
    )
    clientRef.current = client
    onClientReady?.(client)

    // Use ResizeObserver to robustly handle layout changes
    const resizeObserver = new ResizeObserver(() => {
      // fit() needs to happen after layout needs are met
      requestAnimationFrame(() => {
        try {
          fitAddon.fit()
          if (term.cols > 0 && term.rows > 0) {
            client.resize(term.cols, term.rows)
          }
        } catch (e) {
          console.error('Resize error:', e)
        }
      })
    })

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Initial fit
    requestAnimationFrame(() => {
      fitAddon.fit()
      client.resize(term.cols, term.rows)
    })

    // Forward terminal input to backend AND check for 'cls'
    term.onData((data) => {
      // Handle mobile modifier keys injected from React Native Virtual Keyboard
      let processedData = data;

      if ((window as any).__MODIFIER_SHIFT__ && processedData.length === 1) {
        processedData = processedData.toUpperCase();
        (window as any).__MODIFIER_SHIFT__ = false;
        (window as any).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'CONSUMED_MODIFIER', modifier: 'shift' }));
        window.dispatchEvent(new CustomEvent('CONSUMED_MODIFIER', { detail: 'shift' }));
      }

      if ((window as any).__MODIFIER_CTRL__ && processedData.length === 1) {
        const char = processedData.toLowerCase();
        if (char >= 'a' && char <= 'z') {
          const code = char.charCodeAt(0) - 96; // 'a' is 97, we want 1 (\x01)
          processedData = String.fromCharCode(code);
          (window as any).__MODIFIER_CTRL__ = false;
          (window as any).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'CONSUMED_MODIFIER', modifier: 'ctrl' }));
          window.dispatchEvent(new CustomEvent('CONSUMED_MODIFIER', { detail: 'ctrl' }));
        }
      } else if ((window as any).__MODIFIER_ALT__ && processedData.length === 1) {
        processedData = '\x1b' + processedData;
        (window as any).__MODIFIER_ALT__ = false;
        (window as any).ReactNativeWebView?.postMessage(JSON.stringify({ type: 'CONSUMED_MODIFIER', modifier: 'alt' }));
        window.dispatchEvent(new CustomEvent('CONSUMED_MODIFIER', { detail: 'alt' }));
      }

      client.sendData(processedData)

      // Simple buffer logic: reset on Enter, append otherwise
      if (processedData === '\r') {
        if (inputBufferRef.current.trim().toLowerCase() === 'cls') {
          // Allow a brief delay for the backend to acknowledge the command, then clear locally
          setTimeout(() => {
            term.clear()
            term.scrollToBottom()
          }, 50)
        }
        inputBufferRef.current = ''
      } else if (processedData === '\u007F') { // Backspace
        inputBufferRef.current = inputBufferRef.current.slice(0, -1)
      } else if (processedData.length === 1 && processedData >= ' ') { // Printable chars
        inputBufferRef.current += processedData
      }
    })

    cleanupRef.current = () => {
      resizeObserver.disconnect()
      client.disconnect()
    }

    return () => {
      cleanupRef.current?.()
      cleanupRef.current = null
      clientRef.current = null
      termRef.current = null
      term.dispose()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps


  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      return
    }
    const touch = e.touches[0]
    lastTouchRef.current = { clientX: touch.clientX, clientY: touch.clientY }

    // Synthesize mousedown for xterm.js mouse tracking (necessary for tmux mouse mode on mobile)
    const target = document.elementFromPoint(touch.clientX, touch.clientY)
    if (target) {
      target.dispatchEvent(new MouseEvent('mousedown', {
        bubbles: true, cancelable: true, view: window,
        button: 0, buttons: 1, clientX: touch.clientX, clientY: touch.clientY
      }))
    }

    longPressTimerRef.current = setTimeout(() => {
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (target) {
        // Dispatch mouseup here before opening menu, since we're stealing the interaction
        target.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true, cancelable: true, view: window,
          button: 0, buttons: 0, clientX: touch.clientX, clientY: touch.clientY
        }))

        // Then open our React context menu at the touch coordinates
        setContextMenu({ x: touch.clientX, y: touch.clientY })

        // Force blur the terminal to prevent the software keyboard from jumping up
        termRef.current?.blur()
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur()
        }
      }
    }, 500) // 500ms long press duration 
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (lastTouchRef.current && e.touches.length === 1) {
      const touch = e.touches[0]
      const dx = Math.abs(touch.clientX - lastTouchRef.current.clientX)
      const dy = Math.abs(touch.clientY - lastTouchRef.current.clientY)
      if (dx > 10 || dy > 10) {
        if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)
      }

      // Synthesize mousemove for xterm.js mouse tracking (dragging tmux panes)
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (target) {
        target.dispatchEvent(new MouseEvent('mousemove', {
          bubbles: true, cancelable: true, view: window,
          button: 0, buttons: 1, clientX: touch.clientX, clientY: touch.clientY
        }))
      }
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current)

    // Synthesize mouseup
    if (e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]
      const target = document.elementFromPoint(touch.clientX, touch.clientY)
      if (target) {
        target.dispatchEvent(new MouseEvent('mouseup', {
          bubbles: true, cancelable: true, view: window,
          button: 0, buttons: 0, clientX: touch.clientX, clientY: touch.clientY
        }))
      }
    }
  }

  // Handle clicking outside the context menu to close it
  useEffect(() => {
    if (!contextMenu) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if ((e.target as Element).closest('.cc-context-menu')) return
      setContextMenu(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
    }
  }, [contextMenu])

  const handleMenuAction = (e: React.MouseEvent | React.TouchEvent, action: string) => {
    e.stopPropagation()
    e.preventDefault()
    setContextMenu(null)

    if (!clientRef.current) return

    const sendTmuxCommand = (key: string) => {
      // Send prefix (Ctrl+B)
      clientRef.current?.sendData('\x02')
      // Send the actual key after a tiny delay to ensure tmux registers the prefix sequence
      setTimeout(() => {
        clientRef.current?.sendData(key)
      }, 50)
    }

    switch (action) {
      case 'paste':
        navigator.clipboard.readText().then(text => clientRef.current?.sendData(text))
        break
      case 'split-h':
        sendTmuxCommand('"')
        break
      case 'split-v':
        sendTmuxCommand('%')
        break
      case 'swap-up':
        sendTmuxCommand('{')
        break
      case 'swap-down':
        sendTmuxCommand('}')
        break
      case 'zoom':
        sendTmuxCommand('z')
        break
      case 'kill':
        clientRef.current.sendData('\x04') // Ctrl+D (EOF) to exit shell and close pane
        break
    }

    // Return focus to terminal
    termRef.current?.focus()
  }

  return (
    <div className={`relative w-full h-full bg-black ${className}`}>
      {/* Terminal Container */}
      <div
        ref={containerRef}
        className="w-full h-full"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

      {/* Custom Context Menu */}
      {contextMenu && (
        <div
          className="cc-context-menu fixed z-50 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl py-2 flex flex-col w-48 text-zinc-300 text-sm animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: `${Math.min(contextMenu.y, window.innerHeight - 300)}px`,
            left: `${Math.min(contextMenu.x, window.innerWidth - 200)}px`
          }}
        >
          <button onTouchEnd={(e) => handleMenuAction(e, 'paste')} onClick={(e) => handleMenuAction(e, 'paste')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            Paste
          </button>

          <div className="h-px bg-zinc-800 my-1 w-full" />

          <button onTouchEnd={(e) => handleMenuAction(e, 'split-h')} onClick={(e) => handleMenuAction(e, 'split-h')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="3" y1="12" x2="21" y2="12" /></svg>
            Horizontal Split
          </button>

          <button onTouchEnd={(e) => handleMenuAction(e, 'split-v')} onClick={(e) => handleMenuAction(e, 'split-v')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" /><line x1="12" y1="3" x2="12" y2="21" /></svg>
            Vertical Split
          </button>

          <div className="h-px bg-zinc-800 my-1 w-full" />

          <button onTouchEnd={(e) => handleMenuAction(e, 'swap-up')} onClick={(e) => handleMenuAction(e, 'swap-up')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15" /></svg>
            Swap Up
          </button>

          <button onTouchEnd={(e) => handleMenuAction(e, 'swap-down')} onClick={(e) => handleMenuAction(e, 'swap-down')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
            Swap Down
          </button>

          <button onTouchEnd={(e) => handleMenuAction(e, 'zoom')} onClick={(e) => handleMenuAction(e, 'zoom')} className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" /></svg>
            Zoom
          </button>

          <div className="h-px bg-zinc-800 my-1 w-full" />

          <button onTouchEnd={(e) => handleMenuAction(e, 'kill')} onClick={(e) => handleMenuAction(e, 'kill')} className="flex items-center gap-3 px-4 py-2.5 text-red-400 hover:bg-red-900/20 hover:text-red-300 transition-colors cursor-pointer text-left w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            Kill
          </button>
        </div>
      )}
    </div>
  )
}

