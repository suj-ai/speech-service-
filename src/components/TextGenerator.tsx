import React, { useState } from 'react';
import { Sparkles, Send } from 'lucide-react';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

interface AIConfig {
  openaiKey: string;
  geminiKey: string;
  selectedModel: 'none' | 'openai' | 'gemini';
}

interface TextGeneratorProps {
  onTextGenerated: (text: string) => void;
  onGenerate?: (text: string) => void;
  aiConfig: AIConfig;
}

const predefinedPrompts = [
  {
    title: "Mystical Castle",
    prompt: "Write a two-line description of a magical floating castle in the clouds."
  },
  {
    title: "Enchanted Forest",
    prompt: "Write a two-line description of a mysterious glowing forest at night."
  },
  {
    title: "Ocean Depths",
    prompt: "Write a two-line description of an ancient underwater city."
  },
  {
    title: "Desert Mystery",
    prompt: "Write a two-line description of a magical desert oasis."
  },
  {
    title: "Mountain Secret",
    prompt: "Write a two-line description of a hidden mountain valley."
  }
];

export function TextGenerator({ onTextGenerated, onGenerate, aiConfig }: TextGeneratorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');

  const generateWithOpenAI = async (prompt: string) => {
    if (!aiConfig.openaiKey) {
      alert('Please configure OpenAI API key in settings first');
      return;
    }

    const openai = new OpenAI({
      apiKey: aiConfig.openaiKey,
      dangerouslyAllowBrowser: true
    });

    try {
      const completion = await openai.chat.completions.create({
        messages: [
          { 
            role: "system", 
            content: "You are a creative writer. Keep your responses to exactly two lines. Be concise but descriptive." 
          },
          { role: "user", content: prompt }
        ],
        model: "gpt-3.5-turbo",
      });

      return completion.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI Error:', error);
      alert('Error generating text with OpenAI');
      return '';
    }
  };

  const generateWithGemini = async (prompt: string) => {
    if (!aiConfig.geminiKey) {
      alert('Please configure Gemini API key in settings first');
      return;
    }

    const genAI = new GoogleGenerativeAI(aiConfig.geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-pro"});

    try {
      const result = await model.generateContent([
        "Keep your response to exactly two lines. Be concise but descriptive.",
        prompt
      ]);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini Error:', error);
      alert('Error generating text with Gemini');
      return '';
    }
  };

  const handlePromptClick = async (prompt: string) => {
    if (aiConfig.selectedModel === 'none') {
      alert('Please select an AI model in settings first');
      return;
    }

    setIsGenerating(true);
    try {
      const generatedText = await (aiConfig.selectedModel === 'openai' 
        ? generateWithOpenAI(prompt)
        : generateWithGemini(prompt));
      
      if (generatedText) {
        onTextGenerated(generatedText);
        onGenerate?.(generatedText);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCustomPromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;
    await handlePromptClick(customPrompt);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-700">AI Text Generator</h2>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            {aiConfig.selectedModel === 'none' 
              ? 'No AI model selected' 
              : `Using ${aiConfig.selectedModel === 'openai' ? 'OpenAI' : 'Gemini'}`}
          </span>
          <Sparkles className={`w-4 h-4 ${
            aiConfig.selectedModel === 'openai' 
              ? 'text-green-600' 
              : aiConfig.selectedModel === 'gemini' 
                ? 'text-blue-600' 
                : 'text-gray-400'
          }`} />
        </div>
      </div>

      <form onSubmit={handleCustomPromptSubmit} className="space-y-2">
        <div className="relative">
          <input
            type="text"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            disabled={isGenerating || aiConfig.selectedModel === 'none'}
            placeholder="Enter your custom prompt..."
            className={`w-full px-4 py-2 pr-12 border rounded-lg transition-all duration-300 ${
              isGenerating ? 'animate-pulse shadow-lg ' : ''
            } ${
              aiConfig.selectedModel === 'openai'
                ? `border-green-300 ${isGenerating ? 'shadow-green-200' : ''} focus:ring-2 focus:ring-green-500 focus:border-transparent`
                : aiConfig.selectedModel === 'gemini'
                  ? `border-blue-300 ${isGenerating ? 'shadow-blue-200' : ''} focus:ring-2 focus:ring-blue-500 focus:border-transparent`
                  : 'border-gray-300 focus:ring-2 focus:ring-gray-500 focus:border-transparent'
            } ${
              isGenerating ? `${
                aiConfig.selectedModel === 'openai'
                  ? 'bg-green-50'
                  : aiConfig.selectedModel === 'gemini'
                    ? 'bg-blue-50'
                    : 'bg-gray-50'
              }` : ''
            }`}
          />
          <button
            type="submit"
            disabled={isGenerating || aiConfig.selectedModel === 'none' || !customPrompt.trim()}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full transition-colors ${
              aiConfig.selectedModel === 'openai'
                ? 'text-green-600 hover:bg-green-100'
                : aiConfig.selectedModel === 'gemini'
                  ? 'text-blue-600 hover:bg-blue-100'
                  : 'text-gray-400 hover:bg-gray-100'
            } ${
              (isGenerating || aiConfig.selectedModel === 'none' || !customPrompt.trim()) 
                ? 'opacity-50 cursor-not-allowed' 
                : ''
            }`}
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {predefinedPrompts.map((item) => (
          <button
            key={item.title}
            onClick={() => handlePromptClick(item.prompt)}
            disabled={isGenerating || aiConfig.selectedModel === 'none'}
            className={`flex items-center justify-between p-3 border rounded-lg transition-all duration-300 ${
              isGenerating ? 'animate-pulse shadow-lg ' : ''
            } ${
              aiConfig.selectedModel === 'openai'
                ? `border-green-200 hover:border-green-500 hover:bg-green-50 ${isGenerating ? 'shadow-green-200' : ''}`
                : aiConfig.selectedModel === 'gemini'
                  ? `border-blue-200 hover:border-blue-500 hover:bg-blue-50 ${isGenerating ? 'shadow-blue-200' : ''}`
                  : 'border-gray-200 hover:border-gray-400 hover:bg-gray-50'
            } ${
              isGenerating || aiConfig.selectedModel === 'none' ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <span className="text-sm font-medium text-gray-700">{item.title}</span>
            <Sparkles className={`w-4 h-4 ${
              aiConfig.selectedModel === 'openai'
                ? 'text-green-600'
                : aiConfig.selectedModel === 'gemini'
                  ? 'text-blue-600'
                  : 'text-gray-400'
            }`} />
          </button>
        ))}
      </div>

      {isGenerating && (
        <div className="flex items-center justify-center text-sm text-gray-600">
          <Sparkles className={`w-4 h-4 mr-2 animate-spin ${
            aiConfig.selectedModel === 'openai'
              ? 'text-green-600'
              : 'text-blue-600'
          }`} />
          Generating...
        </div>
      )}
    </div>
  );
}