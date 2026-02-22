import { useEffect, useRef, useState } from 'react';
import { StyleSheet, StatusBar, Platform, View, TouchableOpacity, Text, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Notifications from 'expo-notifications';
import type { RootStackParamList } from '../../App';

// Show notifications even when the app is foregrounded
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
    }),
});

// VOICE TO TEXT — ready to enable, blocked by mac/windows build toolchain incompatibility.
// To re-enable:
//   1. Uncomment the import below
//   2. Uncomment the voice state, event hooks, and handlers in the component body
//   3. Uncomment the preview overlay JSX and mic button in the keyboard row
//   4. Uncomment the voice-related styles at the bottom
//   5. Restore TextInput to the react-native import above
// import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

// In development, you usually need to point to your computer's local IP address
// Because the iOS Simulator / Android Emulator is running on a different network interface
// e.g., 'http://192.168.1.X:5173'
// Update this to your computer's actual local IPv4 address found via ipconfig/ifconfig
const WEB_APP_URL = 'http://192.168.1.133:5173';

type Props = NativeStackScreenProps<RootStackParamList, 'Terminal'>;

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

export default function TerminalScreen({ route, navigation }: Props) {
    const { profile } = route.params;
    const webviewRef = useRef<WebView>(null);
    const [ctrlActive, setCtrlActive] = useState(false);
    const [altActive, setAltActive] = useState(false);
    const [shiftActive, setShiftActive] = useState(false);

    // Request notification permission once when the terminal opens
    useEffect(() => {
        Notifications.requestPermissionsAsync();
    }, []);

    // VOICE TO TEXT — uncomment to enable (see note at top of file)
    // const [isListening, setIsListening] = useState(false);
    // const [preview, setPreview] = useState<string | null>(null);
    //
    // useSpeechRecognitionEvent('start', () => setIsListening(true));
    // useSpeechRecognitionEvent('end', () => setIsListening(false));
    // useSpeechRecognitionEvent('error', () => setIsListening(false));
    // useSpeechRecognitionEvent('result', (event) => {
    //     const transcript = event.results[0]?.transcript;
    //     if (event.isFinal && transcript) {
    //         setPreview(transcript);
    //     }
    // });
    //
    // const startListening = async () => {
    //     const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    //     if (!granted) return;
    //     ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: false });
    // };
    //
    // const stopListening = () => {
    //     ExpoSpeechRecognitionModule.stop();
    // };
    //
    // const sendPreview = () => {
    //     if (preview !== null) {
    //         const js = `
    //             if (window.__INJECT_TERMINAL_DATA__) {
    //                 window.__INJECT_TERMINAL_DATA__(${JSON.stringify(preview)});
    //             }
    //             true;
    //         `;
    //         webviewRef.current?.injectJavaScript(js);
    //     }
    //     setPreview(null);
    // };

    // We inject the entire profile object (including passwords/private keys) into the window
    // The web app will read this on boot and immediately connect.
    const injectedJavaScript = `
    window.__INITIAL_PROFILE__ = ${JSON.stringify(profile)};
    true;
  `;

    const handleMessage = (event: any) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'DISCONNECT') {
                navigation.goBack();
            } else if (data.type === 'CONSUMED_MODIFIER') {
                if (data.modifier === 'ctrl') setCtrlActive(false);
                if (data.modifier === 'alt') setAltActive(false);
                if (data.modifier === 'shift') setShiftActive(false);
            } else if (data.type === 'SIGNAL') {
                const signal = data.signal ?? {};
                const title = signal.type === 'stop' ? 'Task complete' : 'Notification';
                const body = signal.tool ? `${title} · ${signal.tool}` : title;
                Notifications.scheduleNotificationAsync({
                    content: { title, body, sound: true },
                    trigger: null,
                });
            }
        } catch (e) {
            // ignore JSON parse errors from other messages
        }
    };

    const handleKeyPress = (key: typeof VIRTUAL_KEYS[0]) => {
        if (key.toggle) {
            const isCtrl = key.toggle === 'ctrl';
            const isAlt = key.toggle === 'alt';

            let isActive = false;
            if (isCtrl) {
                isActive = !ctrlActive;
                setCtrlActive(isActive);
            } else if (isAlt) {
                isActive = !altActive;
                setAltActive(isActive);
            } else {
                isActive = !shiftActive;
                setShiftActive(isActive);
            }

            // Inject the modifier state directly into the window object
            const js = `
                window.__MODIFIER_${key.toggle.toUpperCase()}__ = ${isActive};
                true;
            `;
            webviewRef.current?.injectJavaScript(js);
        } else if (key.value) {
            const js = `
                if (window.__INJECT_TERMINAL_DATA__) {
                    window.__INJECT_TERMINAL_DATA__(${JSON.stringify(key.value)});
                }
                true;
            `;
            webviewRef.current?.injectJavaScript(js);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar barStyle="light-content" />
            <WebView
                ref={webviewRef}
                source={{ uri: WEB_APP_URL }}
                style={styles.webview}
                injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
                onMessage={handleMessage}
                keyboardDisplayRequiresUserAction={false}
                bounces={false}
                scrollEnabled={false}
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
                scalesPageToFit={Platform.OS === 'android'}
            />

            {/* VOICE TO TEXT — uncomment to enable (see note at top of file) */}
            {/* {preview !== null && (
                <View style={styles.previewOverlay}>
                    <TextInput
                        style={styles.previewInput}
                        value={preview}
                        onChangeText={setPreview}
                        multiline
                        autoFocus
                    />
                    <View style={styles.previewButtons}>
                        <TouchableOpacity style={[styles.previewBtn, styles.cancelPreviewBtn]} onPress={() => setPreview(null)}>
                            <Text style={styles.cancelPreviewText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.previewBtn, styles.sendPreviewBtn]} onPress={sendPreview}>
                            <Text style={styles.sendPreviewText}>Send</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )} */}

            {/* Virtual Keyboard Row */}
            <View style={styles.keyboardRow}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.keyboardScroll}>
                    {VIRTUAL_KEYS.map((k) => (
                        <TouchableOpacity
                            key={k.label}
                            style={[
                                styles.keyBtn,
                                (k.toggle === 'ctrl' && ctrlActive) && styles.keyBtnActive,
                                (k.toggle === 'alt' && altActive) && styles.keyBtnActive,
                                (k.toggle === 'shift' && shiftActive) && styles.keyBtnActive
                            ]}
                            onPress={() => handleKeyPress(k)}
                        >
                            <Text style={[
                                styles.keyText,
                                ((k.toggle === 'ctrl' && ctrlActive) ||
                                    (k.toggle === 'alt' && altActive) ||
                                    (k.toggle === 'shift' && shiftActive)) && styles.keyTextActive
                            ]}>{k.label}</Text>
                        </TouchableOpacity>
                    ))}

                    {/* VOICE TO TEXT — uncomment to enable (see note at top of file) */}
                    {/* <TouchableOpacity
                        style={[styles.keyBtn, isListening && styles.keyBtnListening]}
                        onPress={isListening ? stopListening : startListening}
                        accessibilityLabel={isListening ? 'Stop listening' : 'Start voice input'}
                    >
                        <Text style={[styles.keyText, isListening && styles.keyTextActive]}>🎙</Text>
                    </TouchableOpacity> */}
                </ScrollView>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#09090b', // match zinc-950 of the terminal background
    },
    webview: {
        flex: 1,
        backgroundColor: '#09090b',
    },
    keyboardRow: {
        backgroundColor: '#18181b', // zinc-900
        borderTopWidth: 1,
        borderTopColor: '#27272a', // zinc-800
        paddingVertical: 8,
    },
    keyboardScroll: {
        paddingHorizontal: 12,
        gap: 8,
    },
    keyBtn: {
        backgroundColor: '#27272a', // zinc-800
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
    },
    keyBtnActive: {
        backgroundColor: '#3b82f6', // blue-500
    },
    // VOICE TO TEXT — uncomment to enable (see note at top of file)
    // keyBtnListening: {
    //     backgroundColor: '#dc2626', // red-600
    // },
    // previewOverlay: {
    //     backgroundColor: '#18181b', // zinc-900
    //     borderTopWidth: 1,
    //     borderTopColor: '#3f3f46', // zinc-700
    //     padding: 12,
    //     gap: 8,
    // },
    // previewInput: {
    //     backgroundColor: '#27272a', // zinc-800
    //     borderWidth: 1,
    //     borderColor: '#3f3f46', // zinc-700
    //     borderRadius: 6,
    //     padding: 10,
    //     color: '#f4f4f5', // zinc-100
    //     fontSize: 14,
    //     minHeight: 60,
    //     textAlignVertical: 'top',
    // },
    // previewButtons: {
    //     flexDirection: 'row',
    //     justifyContent: 'flex-end',
    //     gap: 8,
    // },
    // previewBtn: {
    //     paddingHorizontal: 16,
    //     paddingVertical: 8,
    //     borderRadius: 6,
    // },
    // cancelPreviewBtn: {
    //     backgroundColor: '#27272a', // zinc-800
    // },
    // cancelPreviewText: {
    //     color: '#d4d4d8', // zinc-300
    //     fontSize: 13,
    //     fontWeight: '600',
    // },
    // sendPreviewBtn: {
    //     backgroundColor: '#3b82f6', // blue-500
    // },
    // sendPreviewText: {
    //     color: '#fff',
    //     fontSize: 13,
    //     fontWeight: '600',
    // },
    keyText: {
        color: '#e4e4e7', // zinc-200
        fontSize: 12,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    },
    keyTextActive: {
        color: '#ffffff',
    }
});
