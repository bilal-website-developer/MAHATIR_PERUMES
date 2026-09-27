const SOUND_ENABLED_KEY = 'ui_sound_enabled';
const SOUND_SETTING_EVENT = 'ui-sound-enabled-change';

let audioContext: AudioContext | null = null;
let isPlaying = false;

export function isSoundEnabled(): boolean {
    try {
        return localStorage.getItem(SOUND_ENABLED_KEY) !== 'false';
    } catch {
        return true;
    }
}

export function setSoundEnabled(enabled: boolean): void {
    try {
        localStorage.setItem(SOUND_ENABLED_KEY, String(enabled));
        window.dispatchEvent(new Event(SOUND_SETTING_EVENT));
    } catch {
        // Storage is optional; sound remains enabled by default.
    }
}

export function subscribeToSoundSetting(listener: () => void): () => void {
    window.addEventListener(SOUND_SETTING_EVENT, listener);
    return () => window.removeEventListener(SOUND_SETTING_EVENT, listener);
}

/**
 * Synthesized placeholder for the Ascending Alert Chime.
 * Replace with a properly recorded/licensed under-300ms asset before launch.
 */
export function playClickSound(): void {
    if (!isSoundEnabled() || isPlaying || typeof window === 'undefined') return;

    try {
        const AudioContextConstructor = window.AudioContext
            || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextConstructor) return;

        audioContext ??= new AudioContextConstructor();
        const context = audioContext;
        isPlaying = true;
        if (context.state === 'suspended') void context.resume().catch(() => undefined);

        const masterGain = context.createGain();
        masterGain.gain.setValueAtTime(0.16, context.currentTime);
        masterGain.connect(context.destination);

        [660, 880, 1108].forEach((frequency, index) => {
            const start = context.currentTime + index * 0.09;
            const oscillator = context.createOscillator();
            const gain = context.createGain();
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(frequency, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.8, start + 0.012);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.075);
            oscillator.connect(gain);
            gain.connect(masterGain);
            oscillator.start(start);
            oscillator.stop(start + 0.08);
        });

        window.setTimeout(() => {
            isPlaying = false;
            masterGain.disconnect();
        }, 320);
    } catch {
        isPlaying = false;
        // Browser audio restrictions must never interrupt the button action.
    }
}
