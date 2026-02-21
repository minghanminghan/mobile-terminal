import { useState, useEffect, useRef } from 'react';

const VIRTUAL_KEYS: Array<{ label: string, value?: string, toggle?: 'ctrl' | 'alt' | 'shift' }> = [
    { label: 'ESC', value: '\x1b' },
    { label: 'TAB', value: '\t' },
    { label: 'CTRL', toggle: 'ctrl' },
    { label: 'ALT', toggle: 'alt' },
    { label: 'SHIFT', toggle: 'shift' },
    { label: 'DEL', value: '\x7f' },
    { label: 'UP', value: '\x1b[A' },
    { label: 'DOWN', value: '\x1b[B' },
    { label: 'LEFT', value: '\x1b[D' },
    { label: 'RIGHT', value: '\x1b[C' },
];

const SpeechRecognitionAPI =
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;

export default function VirtualKeyboard() {
    const [ctrlActive, setCtrlActive] = useState(false);
    const [altActive, setAltActive] = useState(false);
    const [shiftActive, setShiftActive] = useState(false);

    const [isListening, setIsListening] = useState(false);
    const [preview, setPreview] = useState<string | null>(null);
    const speechRef = useRef<any>(null);

    const supported = !!SpeechRecognitionAPI;

    useEffect(() => {
        const handleConsumed = (e: CustomEvent<string>) => {
            if (e.detail === 'ctrl') setCtrlActive(false);
            if (e.detail === 'alt') setAltActive(false);
            if (e.detail === 'shift') setShiftActive(false);
        };

        window.addEventListener('CONSUMED_MODIFIER', handleConsumed as EventListener);
        return () => window.removeEventListener('CONSUMED_MODIFIER', handleConsumed as EventListener);
    }, []);

    const handleKeyPress = (key: typeof VIRTUAL_KEYS[0]) => {
        if (key.toggle) {
            const isCtrl = key.toggle === 'ctrl';
            const isAlt = key.toggle === 'alt';

            let isActive = false;
            if (isCtrl) {
                isActive = !ctrlActive;
                setCtrlActive(isActive);
                (window as any).__MODIFIER_CTRL__ = isActive;
            } else if (isAlt) {
                isActive = !altActive;
                setAltActive(isActive);
                (window as any).__MODIFIER_ALT__ = isActive;
            } else {
                isActive = !shiftActive;
                setShiftActive(isActive);
                (window as any).__MODIFIER_SHIFT__ = isActive;
            }
        } else if (key.value) {
            if ((window as any).__INJECT_TERMINAL_DATA__) {
                (window as any).__INJECT_TERMINAL_DATA__(key.value);
            }
        }
    };

    const startListening = () => {
        const recognition = new SpeechRecognitionAPI();
        recognition.lang = 'en-US';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (e: any) => {
            const text = e.results[0][0].transcript;
            setPreview(text);
            setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);

        speechRef.current = recognition;
        recognition.start();
        setIsListening(true);
    };

    const stopListening = () => {
        speechRef.current?.abort();
        setIsListening(false);
    };

    const sendPreview = () => {
        if (preview !== null && (window as any).__INJECT_TERMINAL_DATA__) {
            (window as any).__INJECT_TERMINAL_DATA__(preview);
        }
        setPreview(null);
    };

    return (
        <>
            {/* Voice preview overlay */}
            {preview !== null && (
                <div className="fixed bottom-[52px] left-0 right-0 z-50 bg-zinc-900 border-t border-zinc-700 p-3 flex flex-col gap-2 shadow-xl">
                    <textarea
                        className="w-full bg-zinc-800 text-zinc-100 text-sm rounded px-3 py-2 resize-none border border-zinc-700 focus:outline-none focus:border-blue-500"
                        rows={2}
                        value={preview}
                        onChange={e => setPreview(e.target.value)}
                        autoFocus
                    />
                    <div className="flex gap-2 justify-end">
                        <button
                            onClick={() => setPreview(null)}
                            className="px-4 py-1.5 rounded text-xs font-semibold bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={sendPreview}
                            className="px-4 py-1.5 rounded text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                        >
                            Send
                        </button>
                    </div>
                </div>
            )}

            {/* Virtual keyboard row */}
            <div className="md:hidden flex overflow-x-auto bg-zinc-900 border-t border-zinc-800 p-2 gap-2 shrink-0 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
                {VIRTUAL_KEYS.map((k) => {
                    const isActive = (k.toggle === 'ctrl' && ctrlActive) ||
                        (k.toggle === 'alt' && altActive) ||
                        (k.toggle === 'shift' && shiftActive);

                    return (
                        <button
                            key={k.label}
                            onClick={() => handleKeyPress(k)}
                            className={`flex-shrink-0 px-4 py-2.5 rounded text-xs font-bold font-mono transition-colors cursor-pointer active:scale-95 ${isActive
                                ? 'bg-blue-500 text-white'
                                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                                }`}
                        >
                            {k.label}
                        </button>
                    );
                })}

                {supported && (
                    <button
                        onClick={isListening ? stopListening : startListening}
                        className={`flex-shrink-0 px-3 py-2.5 rounded transition-colors cursor-pointer active:scale-95 relative ${isListening
                            ? 'bg-red-600 text-white'
                            : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                            }`}
                        aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                    >
                        {isListening && (
                            <span className="absolute inset-0 rounded animate-ping bg-red-500 opacity-50" />
                        )}
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="relative z-10">
                            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm7 8a1 1 0 0 1 1 1 8 8 0 0 1-7 7.938V21h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-1.062A8 8 0 0 1 4 12a1 1 0 0 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1z"/>
                        </svg>
                    </button>
                )}
            </div>
        </>
    );
}
