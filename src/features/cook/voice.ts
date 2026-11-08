/**
 * Hands-free cooking. Voice commands use the browser's speech recognition
 * where it exists (Chrome, Edge, Safari); devices without it still get
 * read-aloud through expo-speech.
 */

import * as Speech from 'expo-speech';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type VoiceCommand = 'next' | 'back' | 'repeat' | 'timer' | 'ingredients' | 'done';

interface RecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult:
    | ((event: {
        resultIndex: number;
        results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
      }) => void)
    | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  start: () => void;
  stop: () => void;
}

type RecognitionCtor = new () => RecognitionLike;

function recognitionCtor(): RecognitionCtor | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export const voiceCommandsSupported = (): boolean => !!recognitionCtor();

/** Maps a spoken phrase to a command ("next step", "go back", "start the timer"). */
export function parseVoiceCommand(transcript: string): VoiceCommand | undefined {
  const t = transcript.toLowerCase();
  if (/\b(next|forward|continue)\b/.test(t)) return 'next';
  if (/\b(back|previous|go back)\b/.test(t)) return 'back';
  if (/\b(repeat|again|read)\b/.test(t)) return 'repeat';
  if (/\b(timer|start)\b/.test(t)) return 'timer';
  if (/\b(ingredients?)\b/.test(t)) return 'ingredients';
  if (/\b(done|finish|finished)\b/.test(t)) return 'done';
  return undefined;
}

/** Listens continuously while `enabled`, calling `onCommand` for each recognised phrase. */
export function useVoiceCommands(
  enabled: boolean,
  onCommand: (command: VoiceCommand) => void,
): { listening: boolean; error?: string } {
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const handler = useRef(onCommand);
  useEffect(() => {
    handler.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    const Ctor = recognitionCtor();
    if (!enabled || !Ctor) return;
    let stopped = false;
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const command = result.isFinal ? parseVoiceCommand(result[0]?.transcript ?? '') : undefined;
        if (command) handler.current(command);
      }
    };
    // Browsers end recognition after silence; keep listening until disabled.
    recognition.onend = () => {
      if (!stopped) {
        try {
          recognition.start();
        } catch {
          setListening(false);
        }
      } else setListening(false);
    };
    recognition.onerror = (event) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        stopped = true;
        setError('Microphone access was blocked.');
      }
    };
    try {
      recognition.start();
      setTimeout(() => setListening(true), 0);
    } catch {
      setTimeout(() => setError('Voice control could not start.'), 0);
    }
    return () => {
      stopped = true;
      recognition.stop();
      setListening(false);
    };
  }, [enabled]);

  return { listening, ...(error ? { error } : {}) };
}

export function speak(text: string): void {
  Speech.stop();
  Speech.speak(text, { rate: Platform.OS === 'ios' ? 0.5 : 1 });
}

export function stopSpeaking(): void {
  Speech.stop();
}
