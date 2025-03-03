import React, { useState, useEffect, useCallback, useRef } from "react";
import { Volume2, Play, Pause, Settings, Cloud, Monitor } from "lucide-react";
import * as sdk from "microsoft-cognitiveservices-speech-sdk";

interface VoiceSettings {
  voice: SpeechSynthesisVoice | null;
  rate: number;
  pitch: number;
}

interface AzureConfig {
  key: string;
  region: string;
  voice: string;
}

function App() {
  const [text, setText] = useState("");
  const [availableVoices, setAvailableVoices] = useState<
    SpeechSynthesisVoice[]
  >([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [useAzure, setUseAzure] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<VoiceSettings>({
    voice: null,
    rate: -10,
    pitch: -10,
  });
  const [azureConfig, setAzureConfig] = useState<AzureConfig>({
    key: "",
    region: "",
    voice: "en-US-JennyNeural",
  });

  // Add a ref to track if we've already spoken from URL
  const hasSpokenFromUrl = useRef(false);
  // Add a ref to check if speech synthesis is supported
  const speechSynthesisSupported = useRef(
    typeof window !== "undefined" && "speechSynthesis" in window
  );
  // Detect Safari browser for special handling
  const isSafari = useRef(
    typeof window !== "undefined" &&
      /^((?!chrome|android).)*safari/i.test(navigator.userAgent)
  );
  // Add state to track if auto-speech was blocked
  const [autoSpeechBlocked, setAutoSpeechBlocked] = useState(false);
  // Add ref to store text from URL for later playback
  const textFromUrl = useRef<string | null>(null);

  // Initialize speech synthesis when component mounts
  useEffect(() => {
    if (!speechSynthesisSupported.current) {
      console.warn("Speech synthesis is not supported in this browser");
      return;
    }

    // Log browser info for debugging
    console.log("Browser: ", navigator.userAgent);
    console.log("Is Safari: ", isSafari.current);

    // Force initialize the speech synthesis on component mount
    // This helps in some browsers that need a "kick" to initialize
    try {
      const tempUtterance = new SpeechSynthesisUtterance("");

      // Safari needs special handling
      if (isSafari.current) {
        // Safari needs a small delay before canceling
        window.speechSynthesis.speak(tempUtterance);
        setTimeout(() => {
          window.speechSynthesis.cancel();
        }, 100);
      } else {
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(tempUtterance);
        window.speechSynthesis.cancel();
      }
    } catch (e) {
      console.error("Error initializing speech synthesis:", e);
    }
  }, []);

  // Handle "not-allowed" error by showing a message to the user
  const handleNotAllowedError = (text: string) => {
    setAutoSpeechBlocked(true);
    textFromUrl.current = text;
    console.log("Auto speech blocked by browser. User interaction required.");
  };

  const speak = useCallback(
    (textToSpeak: string) => {
      if (useAzure) {
        speakWithAzure(textToSpeak);
        return;
      }

      // Check if speech synthesis is supported
      if (!speechSynthesisSupported.current) {
        console.error("Speech synthesis is not supported in this browser");
        return;
      }

      // Ensure text exists
      if (textToSpeak.trim() === "") return;

      // Create a new utterance first before cancelling any ongoing speech
      const utterance = new SpeechSynthesisUtterance(textToSpeak);

      // Set voice if available
      if (settings.voice) {
        utterance.voice = settings.voice;
      } else if (availableVoices.length > 0) {
        // Fallback to first available voice if none selected
        utterance.voice = availableVoices[0];
      }

      // Set rate and pitch based on settings
      utterance.rate = 1 + settings.rate / 100;
      utterance.pitch = 1 + settings.pitch / 100;

      // Set up event handlers and timeout variables before cancelling
      let speechTimeoutId: number;

      // Set event handlers
      utterance.onstart = () => {
        console.log("Speech started");
        setIsPlaying(true);
        // If speech starts, we know auto-speech is allowed
        setAutoSpeechBlocked(false);
      };

      // Fix for bug that affects some browsers where long text gets cut off
      const maxTimeout = 15000; // 15 seconds

      const restartSpeech = () => {
        if (window.speechSynthesis.speaking) {
          try {
            window.speechSynthesis.pause();
            window.speechSynthesis.resume();
            speechTimeoutId = window.setTimeout(restartSpeech, maxTimeout);
          } catch {
            // Ignore errors in the restart loop
          }
        }
      };

      // Clear the timeout when speech ends
      utterance.onend = () => {
        if (speechTimeoutId) {
          window.clearTimeout(speechTimeoutId);
        }
        console.log("Speech ended normally");
        setIsPlaying(false);
      };

      // Handle interruption errors more gracefully
      utterance.onerror = (event) => {
        if (speechTimeoutId) {
          window.clearTimeout(speechTimeoutId);
        }

        // Handle specific error types
        if (event.error === "not-allowed") {
          // This typically happens when the browser blocks auto-playback
          handleNotAllowedError(textToSpeak);
        } else if (event.error !== "interrupted") {
          console.error("Speech synthesis error:", event);
        } else {
          // Interruption is normal during operation
          console.log("Speech was interrupted (normal during operation)");
        }

        setIsPlaying(false);
      };

      // Safely cancel any ongoing speech
      try {
        window.speechSynthesis.cancel();
      } catch {
        // Ignore errors when cancelling speech
      }

      // Fix for Chrome/Safari bug where speech doesn't start sometimes
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      } catch {
        // Ignore errors when resuming speech
      }

      // Short delay before starting new speech after cancellation
      setTimeout(() => {
        try {
          // Set up speech timeout after we start speaking
          window.speechSynthesis.speak(utterance);
          speechTimeoutId = window.setTimeout(restartSpeech, maxTimeout);
        } catch (error) {
          console.error("Error initiating speech:", error);
        }
      }, 50);
    },
    [settings.voice, settings.rate, settings.pitch, availableVoices, useAzure]
  );

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();

      const sortedVoices = [...voices].sort((a, b) => {
        // Prioritize Microsoft Zira
        const aIsZira = a.name.toLowerCase().includes("microsoft zira");
        const bIsZira = b.name.toLowerCase().includes("microsoft zira");

        if (aIsZira && !bIsZira) return -1;
        if (!aIsZira && bIsZira) return 1;
        return 0;
      });

      setAvailableVoices(sortedVoices);

      // Try to find Microsoft Zira
      const ziraVoice = sortedVoices.find((voice) =>
        voice.name.toLowerCase().includes("microsoft zira")
      );

      if (
        ziraVoice &&
        (!settings.voice ||
          !settings.voice.name.toLowerCase().includes("microsoft zira"))
      ) {
        setSettings((prev) => ({ ...prev, voice: ziraVoice }));
      } else if (sortedVoices.length > 0 && !settings.voice) {
        // If Zira is not available, use the first available voice
        setSettings((prev) => ({ ...prev, voice: sortedVoices[0] }));
      }
    };

    // Load voices initially
    loadVoices();

    // Safari and some browsers may need this event to load voices
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Separate effect for handling URL parameters to prevent infinite loops
  useEffect(() => {
    // Skip if we've already spoken the text, if there are no voices available,
    // or if speech synthesis is not supported
    if (
      hasSpokenFromUrl.current ||
      availableVoices.length === 0 ||
      !speechSynthesisSupported.current
    ) {
      return;
    }

    // Handle URL parameters for automatic speech
    const urlParams = new URLSearchParams(window.location.search);
    const textParam = urlParams.get("text");

    if (textParam) {
      // Remove surrounding quotes if present
      const processedText = textParam.replace(/^["'](.*)["']$/, "$1").trim();

      // Decode URL-encoded characters
      const decodedText = decodeURIComponent(processedText);

      setText(decodedText);

      // Store the text from URL for possible manual playback later
      textFromUrl.current = decodedText;

      // Only try once to speak automatically
      hasSpokenFromUrl.current = true;

      // Try to speak after a delay to let the browser initialize
      setTimeout(
        () => {
          speak(decodedText);
        },
        isSafari.current ? 800 : 300
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableVoices]);

  const speakWithAzure = async (textToSpeak: string) => {
    if (!azureConfig.key || !azureConfig.region) {
      alert("Please configure Azure Speech Service first");
      setShowSettings(true);
      return;
    }

    const speechConfig = sdk.SpeechConfig.fromSubscription(
      azureConfig.key,
      azureConfig.region
    );
    speechConfig.speechSynthesisVoiceName = azureConfig.voice;

    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    setIsPlaying(true);

    try {
      const result = await new Promise<sdk.SpeechSynthesisResult>(
        (resolve, reject) => {
          synthesizer.speakTextAsync(
            textToSpeak,
            (result) => resolve(result),
            (error) => reject(error)
          );
        }
      );

      if (result) {
        synthesizer.close();
      }
    } catch (error) {
      console.error("Error synthesizing speech:", error);
      alert(
        "Error synthesizing speech. Please check your Azure configuration."
      );
    } finally {
      setIsPlaying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    speak(text);
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      if (!useAzure) {
        window.speechSynthesis.cancel();
      }
      setIsPlaying(false);
    } else {
      speak(text);
    }
  };

  const isZiraVoice = (voice: SpeechSynthesisVoice) =>
    voice.name.toLowerCase().includes("microsoft zira");

  // Set up a general effect for cleanup
  useEffect(() => {
    return () => {
      // Make sure to cancel any ongoing speech when component unmounts
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
          {/* Show auto-speech blocked message if needed */}
          {autoSpeechBlocked && textFromUrl.current && (
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-yellow-400"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    Auto-speech was blocked by your browser. Click the play
                    button to start speaking.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Volume2 className="w-8 h-8 text-indigo-600" />
              <h1 className="text-2xl font-bold text-gray-800">
                Text to Speech
              </h1>
            </div>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 text-gray-600 hover:text-indigo-600 transition-colors"
              title="Settings"
            >
              <Settings className="w-6 h-6" />
            </button>
          </div>

          {showSettings && (
            <div className="p-4 bg-gray-50 rounded-lg space-y-4">
              <div className="flex items-center space-x-4 mb-4">
                <button
                  onClick={() => setUseAzure(false)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                    !useAzure
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  <Monitor className="w-4 h-4" />
                  <span>Browser TTS</span>
                </button>
                <button
                  onClick={() => setUseAzure(true)}
                  className={`flex items-center space-x-2 px-4 py-2 rounded-lg ${
                    useAzure
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  <Cloud className="w-4 h-4" />
                  <span>Azure Speech</span>
                </button>
              </div>

              {useAzure ? (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Azure Key
                    </label>
                    <input
                      type="password"
                      value={azureConfig.key}
                      onChange={(e) =>
                        setAzureConfig((prev) => ({
                          ...prev,
                          key: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="Enter your Azure Speech Service key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Azure Region
                    </label>
                    <input
                      type="text"
                      value={azureConfig.region}
                      onChange={(e) =>
                        setAzureConfig((prev) => ({
                          ...prev,
                          region: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g., eastus"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Azure Voice
                    </label>
                    <select
                      value={azureConfig.voice}
                      onChange={(e) =>
                        setAzureConfig((prev) => ({
                          ...prev,
                          voice: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      <option value="en-US-JennyNeural">Jenny (Neural)</option>
                      <option value="en-US-GuyNeural">Guy (Neural)</option>
                      <option value="en-US-AriaNeural">Aria (Neural)</option>
                      <option value="en-US-DavisNeural">Davis (Neural)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Voice
                    </label>
                    <select
                      value={settings.voice?.name || ""}
                      onChange={(e) => {
                        const selectedVoice = availableVoices.find(
                          (voice) => voice.name === e.target.value
                        );
                        setSettings((prev) => ({
                          ...prev,
                          voice: selectedVoice || null,
                        }));
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    >
                      {availableVoices.map((voice) => (
                        <option
                          key={voice.name}
                          value={voice.name}
                          className={
                            isZiraVoice(voice)
                              ? "font-bold text-indigo-600"
                              : ""
                          }
                        >
                          {voice.name}{" "}
                          {isZiraVoice(voice)
                            ? "(Recommended)"
                            : `(${voice.lang})`}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Voice Pitch
                    </label>
                    <div className="relative pt-1">
                      <input
                        type="range"
                        min="-50"
                        max="50"
                        value={settings.pitch}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            pitch: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-xs text-gray-600 px-2 mt-2">
                        <span>-50%</span>
                        <span className="text-blue-500">{settings.pitch}%</span>
                        <span>50%</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Adjust Voice Speed
                    </label>
                    <div className="relative pt-1">
                      <input
                        type="range"
                        min="-100"
                        max="100"
                        value={settings.rate}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            rate: parseFloat(e.target.value),
                          }))
                        }
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
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Enter text to convert to speech..."
                className="w-full h-32 px-4 py-2 text-gray-700 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={togglePlayPause}
                className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
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

              <div className="flex items-center space-x-2 text-sm text-gray-600">
                {useAzure ? (
                  <div className="flex items-center space-x-1">
                    <Cloud className="w-4 h-4" />
                    <span>Azure Speech</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <Monitor className="w-4 h-4" />
                    <span>Browser TTS</span>
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
