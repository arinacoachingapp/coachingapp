import { useCallback, useEffect, useRef, useState } from 'react';

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false;
  return !!window.speechSynthesis;
}

export function useSpeechRecognition({ onResult, onError, lang = 'en-US' } = {}) {
  const recognitionRef = useRef(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(isSpeechRecognitionSupported());
  }, []);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!isSpeechRecognitionSupported()) {
      onError?.('Voice input is not supported in this browser. Try Chrome or Safari.');
      return;
    }

    stop();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = true;

    let finalTranscript = '';

    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += text;
        } else {
          interim += text;
        }
      }
      onResult?.(finalTranscript + interim, finalTranscript);
    };

    recognition.onerror = (event) => {
      if (event.error !== 'aborted') {
        onError?.(event.error === 'not-allowed' ? 'Microphone permission denied' : event.error);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [lang, onError, onResult, stop]);

  useEffect(() => () => stop(), [stop]);

  return { listening, supported, start, stop };
}

export function useSpeechSynthesis() {
  const utteranceRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const supported = isSpeechSynthesisSupported();

  const stop = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text, { rate = 0.95, pitch = 1 } = {}) => {
      if (!text?.trim() || !supported) return;

      stop();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.lang = 'en-US';

      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => v.lang.startsWith('en') && v.name.includes('Samantha')) ||
        voices.find((v) => v.lang.startsWith('en'));
      if (preferred) utterance.voice = preferred;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported, stop]
  );

  useEffect(() => () => stop(), [stop]);

  return { speaking, supported, speak, stop };
}
