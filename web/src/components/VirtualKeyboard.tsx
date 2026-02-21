import { useState, useEffect } from 'react';

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

export default function VirtualKeyboard() {
    const [ctrlActive, setCtrlActive] = useState(false);
    const [altActive, setAltActive] = useState(false);
    const [shiftActive, setShiftActive] = useState(false);

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

    return (
        <div className="md:hidden flex overflow-x-auto bg-zinc-900 border-t border-zinc-800 p-2 gap-2 shrink-0 hide-scrollbar" style={{ WebkitOverflowScrolling: 'touch' }}>
            {VIRTUAL_KEYS.map((k) => {
                const isActive = (k.toggle === 'ctrl' && ctrlActive) ||
                    (k.toggle === 'alt' && altActive) ||
                    (k.toggle === 'shift' && shiftActive);

                return (
                    <button
                        key={k.label}
                        onClick={() => handleKeyPress(k)}
                        className={`flex-shrink-0 px-4 py-2.5 rounded text-xs font-bold font-mono transition-colors active:scale-95 ${isActive
                                ? 'bg-blue-500 text-white'
                                : 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700'
                            }`}
                    >
                        {k.label}
                    </button>
                );
            })}
        </div>
    );
}
