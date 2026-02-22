import { useRef, useState, useEffect } from 'react'
import Terminal from './Terminal'
import VirtualKeyboard from './VirtualKeyboard'
import SignalBanner from './SignalBanner'
import type { Credentials, RelayClient } from '../lib/relayClient'

interface Props {
    credentials: Credentials
    onDisconnect: (reason?: string) => void
}

export default function TerminalWorkspace({ credentials, onDisconnect }: Props) {
    const clientRef = useRef<RelayClient | null>(null)
    const [showMenu, setShowMenu] = useState(false)
    const [showSetup, setShowSetup] = useState(false)
    const [copied, setCopied] = useState(false)
    const menuRef = useRef<HTMLDivElement>(null)
    const modalRef = useRef<HTMLDivElement>(null)

    const installCmd = `curl -fsSL ${window.location.origin}/install.sh | bash`

    // Close settings menu on outside click
    useEffect(() => {
        if (!showMenu) return
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [showMenu])

    // Close modal on outside click
    useEffect(() => {
        if (!showSetup) return
        const handleClick = (e: MouseEvent) => {
            if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
                setShowSetup(false)
            }
        }
        document.addEventListener('mousedown', handleClick)
        return () => document.removeEventListener('mousedown', handleClick)
    }, [showSetup])

    return (
        <div className="flex flex-col w-screen h-screen bg-zinc-950 overflow-hidden relative">
            {/* Top Navigation Bar */}
            <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 shrink-0 z-20">
                <div className="flex items-center gap-4">
                    <span className="text-zinc-400 text-xs font-mono font-bold">cc-mobile</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-zinc-500 text-xs font-mono hidden sm:block">
                        {credentials.username}@{credentials.host}
                    </div>

                    {/* Settings icon — houses optional features like AI hooks */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setShowMenu(v => !v)}
                            className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer p-1"
                            aria-label="Settings"
                        >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3" />
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                            </svg>
                        </button>

                        {showMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl py-1 z-30">
                                <button
                                    onClick={() => { setShowMenu(false); setShowSetup(true) }}
                                    className="w-full text-left px-4 py-2.5 text-xs text-zinc-300 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer flex items-center gap-2.5"
                                >
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                                    </svg>
                                    AI Agent Hooks
                                    <span className="ml-auto text-zinc-600 text-[10px]">optional</span>
                                </button>
                            </div>
                        )}
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

            {/* AI agent signal banner — only visible when a hook fires */}
            <SignalBanner />

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

            {/* AI Hooks Setup Modal */}
            {showSetup && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
                    <div ref={modalRef} className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-zinc-100 font-semibold text-sm">AI Agent Hooks</h2>
                                <p className="text-zinc-500 text-xs mt-0.5">Optional — enables completion signals in cc-mobile</p>
                            </div>
                            <button onClick={() => { setShowSetup(false); setCopied(false) }} className="text-zinc-500 hover:text-zinc-300 cursor-pointer">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>

                        <p className="text-zinc-400 text-xs leading-relaxed">
                            Run this once on your remote server. It configures Claude Code, Codex, Gemini CLI, and OpenCode to notify cc-mobile when a task finishes — no cloud API, signals travel through the existing terminal connection.
                        </p>

                        <div className="flex items-center gap-2 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2.5">
                            <code className="text-emerald-400 text-xs flex-1 break-all font-mono">{installCmd}</code>
                            <button
                                onClick={() => {
                                    navigator.clipboard.writeText(installCmd)
                                    setCopied(true)
                                    setTimeout(() => setCopied(false), 2000)
                                }}
                                className={`flex-shrink-0 transition-colors cursor-pointer ${copied ? 'text-emerald-400' : 'text-zinc-400 hover:text-zinc-200'}`}
                                aria-label="Copy command"
                            >
                                {copied ? (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : (
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                    </svg>
                                )}
                            </button>
                        </div>

                        <p className="text-zinc-600 text-xs">
                            Safe to run more than once. Only configures tools that are already installed.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}
