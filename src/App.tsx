import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, Play, Pause } from 'lucide-react';

interface VoiceSettings {
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
}

// Default settings
const DEFAULT_SETTINGS: VoiceSettings = {
  voice: null,
  rate: -10, // -10% default speed
  pitch: -10, // -10% default pitch
};

function App() {
  const [text, setText] = useState('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULT_SETTINGS);
  
  // Use refs to maintain state during async operations
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesLoadedRef = useRef(false);
  const autoplayTextRef = useRef<string | null>(null);
  const voiceInitializedRef = useRef(false);

  // Initialize text from URL parameter
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const textParam = urlParams.get('text');
    if (textParam) {
      const decodedText = decodeURIComponent(textParam);
      setText(decodedText);
      autoplayTextRef.current = decodedText;
    }
  }, []);

  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 50; // 5 seconds total (50 * 100ms)

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      
      if (voices.length === 0) {
        if (retryCount < maxRetries) {
          retryCount++;
          setTimeout(loadVoices, 100);
        }
        return;
      }

      if (voicesLoadedRef.current) return;
      voicesLoadedRef.current = true;
      
      // Sort voices to prioritize Microsoft voices
      const sortedVoices = [...voices].sort((a, b) => {
        const aIsMicrosoft = a.name.toLowerCase().includes('microsoft');
        const bIsMicrosoft = b.name.toLowerCase().includes('microsoft');
        
        if (aIsMicrosoft && !bIsMicrosoft) return -1;
        if (!aIsMicrosoft && bIsMicrosoft) return 1;
        return 0;
      });

      setAvailableVoices(sortedVoices);
      
      // Try to find Microsoft voice
      const microsoftVoice = sortedVoices.find(voice =>
        voice.name.toLowerCase().includes('microsoft')
      );
      
      if (microsoftVoice) {
        setSettings(prev => ({ ...prev, voice: microsoftVoice }));
      } else if (sortedVoices.length > 0) {
        setSettings(prev => ({ ...prev, voice: sortedVoices[0] }));
      }

      voiceInitializedRef.current = true;
    };

    // Initial load attempt
    loadVoices();
    
    // Also listen for voiceschanged event
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Cleanup
    return () => {
      if (utteranceRef.current) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Separate effect for autoplay to ensure voice is initialized
  useEffect(() => {
    if (voiceInitializedRef.current && autoplayTextRef.current && settings.voice) {
      const textToSpeak = autoplayTextRef.current;
      autoplayTextRef.current = null; // Clear stored text
      
      // Use a longer delay for Windows to ensure voice is properly initialized
      const delay = navigator.userAgent.toLowerCase().includes('windows') ? 1000 : 500;
      setTimeout(() => speak(textToSpeak), delay);
    }
  }, [settings.voice]);

  // Chrome bug workaround: restart long utterances
  useEffect(() => {
    let intervalId: number;
    
    if (isPlaying) {
      intervalId = window.setInterval(() => {
        if (!window.speechSynthesis.speaking) {
          clearInterval(intervalId);
          return;
        }
        window.speechSynthesis.pause();
        window.speechSynthesis.resume();
      }, 14000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isPlaying]);

  const speak = useCallback((textToSpeak: string) => {
    if (textToSpeak.trim() === '' || !settings.voice) return;

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();
    
    // Create new utterance
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utteranceRef.current = utterance;

    utterance.voice = settings.voice;
    
    // Convert percentage adjustments to actual values
    utterance.rate = 1 + (settings.rate / 100);
    utterance.pitch = 1 + (settings.pitch / 100);

    // Event handlers
    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => {
      setIsPlaying(false);
      utteranceRef.current = null;
    };
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      setIsPlaying(false);
      utteranceRef.current = null;
    };

    // Start speaking
    window.speechSynthesis.speak(utterance);
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    speak(text);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      utteranceRef.current = null;
    } else {
      speak(text);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800">Text to Speech</h1>
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium"
              >
                Browser TTS
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium"
              >
                Azure Speech
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice
                </label>
                <select
                  value={settings.voice?.name || ''}
                  onChange={(e) => {
                    const selectedVoice = availableVoices.find(
                      voice => voice.name === e.target.value
                    );
                    setSettings(prev => ({ ...prev, voice: selectedVoice || null }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                  {availableVoices.map((voice) => (
                    <option
                      key={voice.name}
                      value={voice.name}
                    >
                      {voice.name} ({voice.lang})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Voice Pitch
                </label>
                <div className="relative pt-1">
                  <input
                    type="range"
                    min="-50"
                    max="50"
                    value={settings.pitch}
                    onChange={(e) => setSettings(prev => ({ ...prev, pitch: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 px-2 mt-2">
                    <span>-50%</span>
                    <span className="text-blue-500">{settings.pitch}%</span>
                    <span>50%</span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Adjust Voice Speed
                </label>
                <div className="relative pt-1">
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    value={settings.rate}
                    onChange={(e) => setSettings(prev => ({ ...prev, rate: parseFloat(e.target.value) }))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-gray-600 px-2 mt-2">
                    <span>-100%</span>
                    <span className="text-blue-500">{settings.rate}%</span>
                    <span>100%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to convert to speech..."
                className="w-full h-32 px-4 py-3 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={togglePlayPause}
                  className="flex items-center space-x-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 font-medium"
                >
                  {isPlaying ? (
                    <>
                      <Pause className="w-5 h-5" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5" />
                      <span>Play</span>
                    </>
                  )}
                </button>

                <div className="flex items-center text-sm text-gray-500">
                  Browser TTS
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;