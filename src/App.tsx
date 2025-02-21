import React, { useState, useEffect, useCallback } from "react";
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

  const speak = useCallback(
    (textToSpeak: string) => {
      if (useAzure) {
        speakWithAzure(textToSpeak);
        return;
      }

      window.speechSynthesis.cancel();

      if (textToSpeak.trim() === "") return;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      if (settings.voice) utterance.voice = settings.voice;

      utterance.rate = 1 + settings.rate / 100;
      utterance.pitch = 1 + settings.pitch / 100;

      utterance.onstart = () => setIsPlaying(true);
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = () => setIsPlaying(false);

      window.speechSynthesis.speak(utterance);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [settings, useAzure]
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

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    // Handle URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    let textParam = urlParams.get("text");

    if (textParam) {
      // Remove surrounding quotes if present
      textParam = textParam.replace(/^["'](.*)["']$/, "$1");
      // Decode URL-encoded characters
      textParam = decodeURIComponent(textParam);
      setText(textParam);
      // Wait for voices to load before speaking
      setTimeout(() => speak(textParam || ""), 500);
    }

    return () => {
      window.speechSynthesis.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speak]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
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
