'use client'

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, X, Search, Mic, ArrowLeftRight, Undo, Redo, ThumbsUp, ThumbsDown, Copy, Volume2, Check, Pause, Loader2, Globe } from 'lucide-react';

const languages = [
  { name: "Detect language", code: "auto" },
  { name: "Bulgarian", code: "BG" },
  { name: "Chinese (simplified)", code: "ZH" },
  { name: "Czech", code: "CS" },
  { name: "Danish", code: "DA" },
  { name: "Dutch", code: "NL" },
  { name: "English", code: "EN" },
  { name: "Estonian", code: "ET" },
  { name: "Finnish", code: "FI" },
  { name: "French", code: "FR" },
  { name: "German", code: "DE" },
  { name: "Greek", code: "EL" },
  { name: "Hungarian", code: "HU" },
  { name: "Indonesian", code: "ID" },
  { name: "Italian", code: "IT" },
  { name: "Japanese", code: "JA" },
  { name: "Korean", code: "KO" },
  { name: "Latvian", code: "LV" },
  { name: "Lithuanian", code: "LT" },
  { name: "Norwegian", code: "NB" },
  { name: "Polish", code: "PL" },
  { name: "Portuguese", code: "PT" },
  { name: "Romanian", code: "RO" },
  { name: "Russian", code: "RU" },
  { name: "Slovak", code: "SK" },
  { name: "Slovenian", code: "SL" },
  { name: "Spanish", code: "ES" },
  { name: "Swedish", code: "SV" },
  { name: "Turkish", code: "TR" },
  { name: "Ukrainian", code: "UK" }
];

const translateText = async (text: string, source: string, target: string) => {
  const apiKey = process.env.NEXT_PUBLIC_DEEPL_API_KEY;

  if (!apiKey) {
    throw new Error('DeepL API key is not configured.');
  }

  const params = new URLSearchParams();
  params.append('auth_key', apiKey);
  params.append('text', text);
  params.append('target_lang', target.toUpperCase());
  if (source.toUpperCase() !== 'AUTO') {
    params.append('source_lang', source.toUpperCase());
  }

  const response = await fetch('https://api-free.deepl.com/v2/translate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params,
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Translation error: ${errorData.message}`);
  }

  const data = await response.json();
  return {
    text: data.translations[0].text,
    detectedLanguage: data.translations[0].detected_source_language
  };
};

const getDictionaryEntry = async (word: string) => {
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch dictionary entry');
    }
    const data = await response.json();
    return data[0];
  } catch (error) {
    console.error('Error fetching dictionary entry:', error);
    return null;
  }
};

declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

export default function TranslatorUi() {
  const [isSourceLanguageMenuOpen, setIsSourceLanguageMenuOpen] = useState(false);
  const [isTargetLanguageMenuOpen, setIsTargetLanguageMenuOpen] = useState(false);
  const [sourceLanguage, setSourceLanguage] = useState('auto');
  const [targetLanguage, setTargetLanguage] = useState('EN');
  const [sourceSearchQuery, setSourceSearchQuery] = useState('');
  const [targetSearchQuery, setTargetSearchQuery] = useState('');
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [inputHistory, setInputHistory] = useState<string[]>(['']);
  const [historyIndex, setHistoryIndex] = useState(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [swapCount, setSwapCount] = useState(0);
  const [isOutputPlaying, setIsOutputPlaying] = useState(false);
  const [isDictionaryPlaying, setIsDictionaryPlaying] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isDisliked, setIsDisliked] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const sourceMenuRef = useRef<HTMLDivElement>(null);
  const targetMenuRef = useRef<HTMLDivElement>(null);
  const [selectedWord, setSelectedWord] = useState('');
  const [dictionaryEntry, setDictionaryEntry] = useState<any>(null);
  const inputTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const outputTextAreaRef = useRef<HTMLTextAreaElement>(null);

  const filteredSourceLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(sourceSearchQuery.toLowerCase())
  );

  const filteredTargetLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(targetSearchQuery.toLowerCase())
  );

  const toggleLanguageMenu = (menu: 'source' | 'target') => {
    if (menu === 'source') {
      setIsSourceLanguageMenuOpen(!isSourceLanguageMenuOpen);
      setIsTargetLanguageMenuOpen(false);
    } else {
      setIsTargetLanguageMenuOpen(!isTargetLanguageMenuOpen);
      setIsSourceLanguageMenuOpen(false);
    }
  };

  const handleLanguageSelect = (lang: { name: string, code: string }, type: 'source' | 'target') => {
    if (type === 'source') {
      setSourceLanguage(lang.code);
      setIsSourceLanguageMenuOpen(false);
    } else {
      setTargetLanguage(lang.code);
      setIsTargetLanguageMenuOpen(false);
    }
    setDictionaryEntry(null);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setInputText(newText);
    setIsCopied(false);

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      setInputHistory(prev => [...prev.slice(0, historyIndex + 1), newText]);
      setHistoryIndex(prev => prev + 1);
    }, 300);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(prev => prev - 1);
      setInputText(inputHistory[historyIndex - 1]);
    }
  };

  const handleRedo = () => {
    if (historyIndex < inputHistory.length - 1) {
      setHistoryIndex(prev => prev + 1);
      setInputText(inputHistory[historyIndex + 1]);
    }
  };

  const swapLanguages = () => {
    setSwapCount(prev => prev + 1);
    const tempLang = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(tempLang);
    setInputText(outputText);
    setOutputText('');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(outputText).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }).catch(err => {
      console.error('Failed to copy text: ', err);
    });
  };

  const handleLike = () => {
    setIsLiked(!isLiked);
    setIsDisliked(false);
  };

  const handleDislike = () => {
    setIsDisliked(!isDisliked);
    setIsLiked(false);
  };

  const handleSpeak = (text: string, type: 'output' | 'dictionary') => {
    const language = type === 'output' ? targetLanguage : 'EN';
    const setIsPlaying = type === 'output' ? setIsOutputPlaying : setIsDictionaryPlaying;
    const isPlaying = type === 'output' ? isOutputPlaying : isDictionaryPlaying;
  
    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    } else {
      const utterance = new SpeechSynthesisUtterance(text);
      
      let languageCode = 'en-US';
      if (language === 'ES') {
        languageCode = 'es-ES';
      }
      utterance.lang = languageCode;
  
      const voices = window.speechSynthesis.getVoices();
      console.log('Available voices:', voices);
  
      const languageVoice = voices.find(voice => voice.lang.startsWith(languageCode.slice(0, 2)));
      console.log('Selected voice:', languageVoice);
  
      if (languageVoice) {
        utterance.voice = languageVoice;
      } else {
        console.warn(`No voice found for language: ${languageCode}`);
      }
  
      utterance.onend = () => setIsPlaying(false);
      utterance.onerror = (event) => {
        console.error('SpeechSynthesis error:', event);
        setIsPlaying(false);
      };
  
      window.speechSynthesis.speak(utterance);
      setIsPlaying(true);
    }
  };

  const handleVoiceInput = () => {
    if (!('webkitSpeechRecognition' in window)) {
      alert("Voice recognition is not supported in your browser.");
      return;
    }

    const SpeechRecognition = window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = sourceLanguage === 'ES' ? 'es-ES' : 'en-US';
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prevText => {
        const newText = prevText ? `${prevText} ${transcript}` : transcript;
        return newText.trim();
      });
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setIsListening(false);
    };

    recognition.start();
  };

  const handleWordSelect = async (e: React.MouseEvent<HTMLTextAreaElement>, type: 'input' | 'output') => {
    const selection = window.getSelection();
    if (selection && selection.toString().trim() !== '') {
      const word = selection.toString().trim();
      setSelectedWord(word);
      
      const language = type === 'input' ? sourceLanguage : targetLanguage;
      
      if (language === 'EN') {
        try {
          const entry = await getDictionaryEntry(word);
          if (entry) {
            setDictionaryEntry(entry);
          } else {
            setDictionaryEntry(null);
          }
        } catch (error) {
          console.error('Error fetching dictionary entry:', error);
          setDictionaryEntry(null);
        }
      } else {
        setDictionaryEntry(null);
      }
    } else {
      setDictionaryEntry(null);
    }
  };

  useEffect(() => {
    const translateAsync = async () => {
      if (inputText && targetLanguage) {
        try {
          setIsLoading(true);
          const result = await translateText(inputText, sourceLanguage, targetLanguage);
          setOutputText(result.text);
          if (sourceLanguage === 'auto') {
            const detectedLanguage = languages.find(lang => lang.code === result.detectedLanguage.toUpperCase());
            if (detectedLanguage) {
              setSourceLanguage(detectedLanguage.code);
            }
          }
        } catch (error) {
          console.error('Translation error:', error);
          setOutputText('Error: Could not translate text');
        } finally {
          setIsLoading(false);
        }
      } else {
        setOutputText('');
      }
    };

    const debounceTranslate = setTimeout(() => {
      translateAsync();
    }, 300);

    return () => clearTimeout(debounceTranslate);
  }, [inputText, sourceLanguage, targetLanguage]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sourceMenuRef.current && !sourceMenuRef.current.contains(event.target as Node)) {
        setIsSourceLanguageMenuOpen(false);
      }
      if (targetMenuRef.current && !targetMenuRef.current.contains(event.target as Node)) {
        setIsTargetLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      console.log('Loaded voices:', voices);
    };
  
    loadVoices();
    if (typeof window !== 'undefined' && window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  const LanguageSelector = ({ language, type }: { language: string, type: 'source' | 'target' }) => (
    <div className="relative mb-2" ref={type === 'source' ? sourceMenuRef : targetMenuRef}>
      <button
        onClick={() => toggleLanguageMenu(type)}
        className="flex items-center justify-between w-full p-2 bg-gray-800 border border-pink-500 rounded-lg hover:bg-gray-700 transition-colors duration-300 text-sm subtle-neon-text"
      >
        <span>{languages.find(lang => lang.code === language)?.name || language}</span>
        {(type === 'source' ? isSourceLanguageMenuOpen : isTargetLanguageMenuOpen) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      <AnimatePresence>
        {(type === 'source' ? isSourceLanguageMenuOpen : isTargetLanguageMenuOpen) && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute z-10 w-full mt-1 bg-gray-800 border border-pink-500 rounded-lg shadow-lg overflow-hidden"
          >
            <div className="flex items-center p-2 bg-gray-700">
              <Search size={16} className="text-pink-500 mr-2" />
              <input
                type="text"
                placeholder="Search language"
                value={type === 'source' ? sourceSearchQuery : targetSearchQuery}
                onChange={(e) => type === 'source' ? setSourceSearchQuery(e.target.value) : setTargetSearchQuery(e.target.value)}
                className="w-full bg-transparent text-pink-300 placeholder-pink-600 focus:outline-none text-sm"
              />
              <button
                onClick={() => toggleLanguageMenu(type)}
                className="ml-2 text-pink-500 hover:text-pink-300"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="max-h-48 overflow-y-auto custom-scrollbar">
              {(type === 'source' ? filteredSourceLanguages : filteredTargetLanguages).length > 0 ? (
                (type === 'source' ? filteredSourceLanguages : filteredTargetLanguages).map((lang) => (
                  <li
                    key={lang.code}
                    onClick={() => handleLanguageSelect(lang, type)}
                    className="p-2 hover:bg-gray-700 cursor-pointer transition-colors duration-300 text-sm subtle-neon-text"
                  >
                    {(type === 'source' ? sourceSearchQuery : targetSearchQuery) ? (
                      <span dangerouslySetInnerHTML={{
                        __html: lang.name.replace(
                          new RegExp((type === 'source' ? sourceSearchQuery : targetSearchQuery), 'gi'),
                          (match) => `<span class="font-bold text-red-500">${match}</span>`
                        )
                      }} />
                    ) : (
                      lang.name
                    )}
                  </li>
                ))
              ) : (
                <li className="p-2 text-sm text-gray-400">
                  No hay resultados para &apos;{type === 'source' ? sourceSearchQuery : targetSearchQuery}&apos;.
                  <br />
                  Estamos trabajando para añadir más idiomas lo antes posible.
                  <br />
                  El idioma que buscas puede estar disponible pronto.
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-pink-600 p-4 font-mono cyberpunk-bg">
      <div className="max-w-7xl mx-auto relative">
        <motion.div 
          className="absolute top-0 left-1/2 transform -translate-x-1/2 p-4 md:p-0 md:top-4"
          animate={{
            color: ['#ff6600', '#00ffff', '#ff0000', '#00ff00'],
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            repeatType: "reverse"
          }}
        >
          <Globe size={48} />
        </motion.div>
        <h1 className="text-4xl md:text-6xl font-bold mb-6 md:mb-10 text-center cyberpunk-title pt-16 md:pt-20">
          Translator 
        </h1>
        <div className="bg-gradient-to-br from-gray-800 to-purple-800 border-2 border-pink-500 rounded-lg overflow-hidden cyberpunk-container">
          <div className="flex flex-col md:flex-row items-center justify-between p-4 border-b border-pink-500">
            <div className="w-full md:w-2/5 mb-4 md:mb-0">
              <LanguageSelector language={sourceLanguage} type="source" />
            </div>
            <motion.button
              onClick={swapLanguages}
              className="p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors duration-300 subtle-neon-border mb-4 md:mb-0"
              animate={{ rotate: swapCount * 180 }}
              transition={{ duration: 0.5 }}
            >
              <ArrowLeftRight size={24} className="text-pink-500" />
            </motion.button>
            <div className="w-full md:w-2/5">
              <LanguageSelector language={targetLanguage} type="target" />
            </div>
          </div>
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/2 p-4 md:p-6 border-b md:border-b-0 md:border-r border-pink-500 relative">
              <textarea
                ref={inputTextAreaRef}
                value={inputText}
                onChange={handleInputChange}
                onMouseUp={(e) => handleWordSelect(e, 'input')}
                placeholder="Enter text to translate..."
                className="w-full h-40 md:h-64 p-3 bg-gray-700 border border-pink-500 rounded-lg resize-none text-purple-500 placeholder-purple-400 focus:outline-none focus:border-cyan-500 transition-colors duration-300 text-lg subtle-neon-text"

              />
              <div className="flex justify-between mt-3">
                <div className="flex space-x-2 md:space-x-3">
                  <button
                    onClick={handleVoiceInput}
                    className={`p-2 md:p-3 rounded-full transition-colors duration-300 ${
                      isListening ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-700 hover:bg-gray-600'
                    } subtle-neon-border`}
                  >
                    <Mic size={20} className={isListening ? "text-white" : "text-pink-500"} />
                  </button>
                  <button
                    onClick={handleUndo}
                    className={`p-2 md:p-3 rounded-full transition-colors duration-300 ${
                      historyIndex > 0 ? 'bg-cyan-600 hover:bg-cyan-700 subtle-neon-border' : 'bg-gray-700 cursor-not-allowed'
                    }`}
                    disabled={historyIndex <= 0}
                  >
                    <Undo size={20} className="text-pink-300" />
                  </button>
                  <button
                    onClick={handleRedo}
                    className={`p-2 md:p-3 rounded-full transition-colors duration-300 ${
                      historyIndex < inputHistory.length - 1 ? 'bg-cyan-600 hover:bg-cyan-700 subtle-neon-border' : 'bg-gray-700 cursor-not-allowed'
                    }`}
                    disabled={historyIndex >= inputHistory.length - 1}
                  >
                    <Redo size={20} className="text-pink-300" />
                  </button>
                </div>
                <p className="text-sm text-pink-600">{inputText.length} / 5000</p>
              </div>
            </div>
            <div className="w-full md:w-1/2 p-4 md:p-6 relative">
              <textarea
                ref={outputTextAreaRef}
                value={outputText}
                readOnly
                onMouseUp={(e) => handleWordSelect(e, 'output')}
                className="w-full h-40 md:h-64 p-3 bg-gray-700 border border-pink-500 rounded-lg resize-none text-purple-500 placeholder-purple-400 focus:outline-none focus:border-cyan-500 transition-colors duration-300 text-lg subtle-neon-text"
                placeholder="Translation will appear here..."

              />
              {isLoading && (
                <div className="absolute bottom-4 right-4 md:bottom-6 md:right-6">
                  <Loader2 className="w-6 h-6 text-pink-500 animate-spin" />
                </div>
              )}
              {outputText && (
                <div className="flex justify-between mt-3">
                  {(targetLanguage === 'EN' || targetLanguage === 'ES') && (
                    <button
                      onClick={() => handleSpeak(outputText, 'output')}
                      className={`p-2 md:p-3 rounded-full transition-colors duration-300 ${
                        isOutputPlaying ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-gray-700 hover:bg-gray-600'
                      } subtle-neon-border`}
                    >
                      {isOutputPlaying ? (
                        <Pause size={20} className="text-pink-300" />
                      ) : (
                        <Volume2 size={20} className="text-pink-500" />
                      )}
                    </button>
                  )}
                  <div className="flex space-x-2 md:space-x-3">
                    <button
                      onClick={handleLike}
                      className={`p-2 md:p-3 rounded-full transition-colors duration-300 ${
                        isLiked ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
                      } subtle-neon-border`}
                    >
                      <ThumbsUp size={20} className={isLiked ? 'text-white' : 'text-pink-500'} />
                    </button>
                    <button
                      onClick={handleDislike}
                      className={`p-2 md:p-3 rounded-full transition-colors duration-300 ${
                        isDisliked ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
                      } subtle-neon-border`}
                    >
                      <ThumbsDown size={20} className={isDisliked ? 'text-white' : 'text-pink-500'} />
                    </button>
                    <button
                      onClick={handleCopy}
                      className="p-2 md:p-3 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors duration-300 subtle-neon-border"
                    >
                      {isCopied ? (
                        <Check size={20} className="text-green-500" />
                      ) : (
                        <Copy size={20} className="text-pink-500" />
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="mt-6 bg-gradient-to-br from-gray-800 to-purple-800 border-2 border-pink-500 rounded-lg p-4">
          <h2 className="text-xl md:text-2xl font-bold mb-4 subtle-neon-text">Dictionary</h2>
          {dictionaryEntry ? (
            <div>
              <p className="text-lg md:text-xl font-bold mb-2 text-cyan-400">{dictionaryEntry.word}</p>
              {dictionaryEntry.phonetic && (
                <p className="mb-2 text-pink-300">{dictionaryEntry.phonetic}</p>
              )}
              {dictionaryEntry.meanings && dictionaryEntry.meanings.map((meaning: any, index: number) => (
                <div key={index} className="mb-4">
                  <p className="font-semibold text-purple-400">{meaning.partOfSpeech}</p>
                  <ul className="list-disc list-inside">
                    {meaning.definitions.map((def: any, defIndex: number) => (
                      <li key={defIndex} className="mb-2">
                        <p className="text-cyan-300">{def.definition}</p>
                        {def.example && (
                          <p className="text-sm text-pink-300 mt-1">Example: {def.example}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <div className="flex space-x-2 mt-4">
                <button
                  onClick={() => handleSpeak(dictionaryEntry.word, 'dictionary')}
                  className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors duration-300 subtle-neon-border"
                >
                  <Volume2 size={20} className="text-pink-500" />
                  <span className="sr-only">Pronunciar palabra</span>
                </button>
                {dictionaryEntry.phonetics && dictionaryEntry.phonetics.length > 0 && dictionaryEntry.phonetics[0].audio && (
                  <button
                    onClick={() => {
                      const audio = new Audio(dictionaryEntry.phonetics[0].audio);
                      audio.play();
                    }}
                    className="p-2 bg-gray-700 rounded-full hover:bg-gray-600 transition-colors duration-300 subtle-neon-border"
                  >
                    <Volume2 size={20} className="text-cyan-500" />
                    <span className="sr-only">Reproducir audio de pronunciación</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="text-pink-300">
              {sourceLanguage === 'EN' || targetLanguage === 'EN' ?
                "The dictionary only works with English words." :
                "The dictionary does not work with this language, it will be added soon."}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}