import { useRef } from 'react'
import Terminal from './Terminal'
import VirtualKeyboard from './VirtualKeyboard'
import type { Credentials, RelayClient } from '../lib/relayClient'

interface Props {
    credentials: Credentials
    onDisconnect: (reason?: string) => void
}

export default function TerminalWorkspace({ credentials, onDisconnect }: Props) {
    const clientRef = useRef<RelayClient | null>(null)

    return (
        <div className="flex flex-col w-screen h-screen bg-zinc-950 overflow-hidden relative">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <span className="text-zinc-400 text-xs font-mono font-bold">cc-mobile</span>
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-zinc-500 text-xs font-mono hidden sm:block">
                        {credentials.username}@{credentials.host}
                    </div>
                    <button
                        onClick={() => {
                            if ((window as any).ReactNativeWebView) {
                                (window as any).ReactNativeWebView.postMessage(JSON.stringify({ type: 'DISCONNECT' }));
                            } else {
                                onDisconnect();
                            }
                        }}
                        className="text-red-400 hover:text-red-300 text-xs px-3 py-1 rounded border border-red-900/50 hover:bg-red-900/20 transition-colors cursor-pointer"
                    >
                        Disconnect
                    </button>
                </div>
            </div>

            {/* Main Workspace Area */}
            <div className="flex-1 relative overflow-hidden min-h-0">
                <Terminal
                    credentials={credentials}
                    onDisconnect={onDisconnect}
                    onClientReady={(client: RelayClient) => clientRef.current = client}
                />
            </div>

            {/* Virtual Control Row for Mobile Web Browsers */}
            <VirtualKeyboard />
        </div>
    )
}
