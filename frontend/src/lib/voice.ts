/**
 * Voice guidance for in-app navigation.
 *
 * The Web Speech API is the only voice engine that needs no audio files, no
 * cloud key and no network once the device has a voice installed. Browsers load
 * their voice list asynchronously, so the preferred voice is resolved at speak
 * time and cached for the session.
 */

let cachedVoice: SpeechSynthesisVoice | null = null;

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  );
}

function resolveVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  if (cachedVoice) return cachedVoice;

  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const english = voices.filter((voice) => /^en([-_]|$)/i.test(voice.lang));
  cachedVoice =
    english.find((voice) => /^en[-_]GB/i.test(voice.lang) && voice.localService) ??
    english.find((voice) => /^en[-_]US/i.test(voice.lang)) ??
    english[0] ??
    voices[0] ??
    null;
  return cachedVoice;
}

/** Asking for the voice list is what makes some browsers load it. */
export function primeVoice(): void {
  if (!speechSupported()) return;
  window.speechSynthesis.getVoices();
}

/**
 * Speak one instruction, replacing anything still being read. A new turn
 * matters more than the tail of the previous one, and cancelling keeps the
 * driver from hearing two manoeuvres back to back.
 */
export function speak(text: string): void {
  if (!speechSupported()) return;

  const phrase = text.trim();
  if (!phrase) return;

  const synth = window.speechSynthesis;
  synth.cancel();

  const utterance = new SpeechSynthesisUtterance(phrase);
  const voice = resolveVoice();
  if (voice) {
    utterance.voice = voice;
    utterance.lang = voice.lang;
  } else {
    utterance.lang = "en-US";
  }
  utterance.rate = 0.98;
  utterance.pitch = 1;
  utterance.volume = 1;
  synth.speak(utterance);
}

export function cancelSpeech(): void {
  if (speechSupported()) window.speechSynthesis.cancel();
}
