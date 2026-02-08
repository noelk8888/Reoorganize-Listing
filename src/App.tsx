import React, { useState, useCallback, useRef, useEffect } from 'react';
import { reorganizeListing, ReorganizedOutputs } from './services/geminiService';
import { GEMINI_PROMPT_PREFIX } from './constants';
import { Button } from './components/Button';
import { TextArea } from './components/TextArea';

// Check if we're in production (Vercel) - API key not needed
const isProduction = import.meta.env.PROD;

function App() {
  const [inputText, setInputText] = useState<string>('');
  const [apiKey, setApiKey] = useState<string>(() => localStorage.getItem('gemini_api_key') || '');
  const [showApiKey, setShowApiKey] = useState<boolean>(false);
  const [outputs, setOutputs] = useState<ReorganizedOutputs | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [copyFeedback1, setCopyFeedback1] = useState<string>('Copy');
  const [copyFeedback2, setCopyFeedback2] = useState<string>('Copy');

  const copyTimeout1Ref = useRef<number | null>(null);
  const copyTimeout2Ref = useRef<number | null>(null);

  // Save API key to localStorage when it changes
  useEffect(() => {
    if (apiKey) {
      localStorage.setItem('gemini_api_key', apiKey);
    }
  }, [apiKey]);

  const handleReorganize = useCallback(async () => {
    if (!inputText.trim()) {
      setError('Please enter some text to reorganize.');
      return;
    }

    // Only require API key in development if not using serverless
    if (!isProduction && !apiKey.trim()) {
      setError('Please enter your Gemini API key (or deploy to Vercel).');
      return;
    }

    setIsLoading(true);
    setError(null);
    setOutputs(null);
    setCopyFeedback1('Copy');
    setCopyFeedback2('Copy');

    try {
      const prompt = `${GEMINI_PROMPT_PREFIX}\n\nINPUT:\n${inputText}`;
      // Use serverless API in production, direct API in development
      const result = await reorganizeListing(prompt, isProduction ? undefined : apiKey);
      setOutputs(result);
    } catch (err: unknown) {
      console.error('Error reorganizing listing:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Failed to reorganize text: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, [inputText, apiKey]);

  const handleCopy = useCallback((text: string, setFeedback: React.Dispatch<React.SetStateAction<string>>, timeoutRef: React.MutableRefObject<number | null>) => {
    if (text.trim()) {
      navigator.clipboard.writeText(text)
        .then(() => {
          setFeedback('Copied!');
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = window.setTimeout(() => setFeedback('Copy'), 2000);
        })
        .catch(() => setFeedback('Error'));
    }
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimeout1Ref.current) clearTimeout(copyTimeout1Ref.current);
      if (copyTimeout2Ref.current) clearTimeout(copyTimeout2Ref.current);
    };
  }, []);

  const handleClear = useCallback(() => {
    setInputText('');
    setOutputs(null);
    setError(null);
    setCopyFeedback1('Copy');
    setCopyFeedback2('Copy');
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-800">
      <header className="w-full max-w-7xl text-center py-6">
        <h1 className="text-xl md:text-3xl font-extrabold text-indigo-700 mb-1">
          Property Listing Reorganizer
        </h1>
        <p className="text-sm md:text-base text-gray-600">
          Transform raw data into polished Social and Client formats.
        </p>
      </header>

      <main className="w-full max-w-7xl flex flex-col gap-6">

        {/* Output Section (At Top) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {error && (
            <div className="lg:col-span-2 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
              {error}
            </div>
          )}

          {/* Output 1: Social */}
          <div className="flex flex-col min-h-[400px] bg-white shadow-xl rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-indigo-500">
                Output 1: Social Media
              </h2>
              <Button
                onClick={() => handleCopy(outputs?.output1 || '', setCopyFeedback1, copyTimeout1Ref)}
                disabled={!outputs?.output1 || isLoading}
                className={`px-4 py-2 text-sm font-semibold rounded-lg
                  ${copyFeedback1 === 'Copied!' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {copyFeedback1}
              </Button>
            </div>
            <div className="relative flex-1 bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm md:text-base font-sans whitespace-pre-wrap overflow-auto min-h-[350px]">
              {isLoading && !outputs && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80 rounded-xl z-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-indigo-500 border-t-transparent"></div>
                </div>
              )}
              {outputs?.output1 || <span className="text-gray-300 italic text-sm">Awaiting reorganization...</span>}
            </div>
          </div>

          {/* Output 2: Client */}
          <div className="flex flex-col min-h-[400px] bg-white shadow-xl rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold uppercase tracking-wider text-emerald-500">
                Output 2: Client Version
              </h2>
              <Button
                onClick={() => handleCopy(outputs?.output2 || '', setCopyFeedback2, copyTimeout2Ref)}
                disabled={!outputs?.output2 || isLoading}
                className={`px-4 py-2 text-sm font-semibold rounded-lg
                  ${copyFeedback2 === 'Copied!' ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {copyFeedback2}
              </Button>
            </div>
            <div className="relative flex-1 bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm md:text-base font-sans whitespace-pre-wrap overflow-auto min-h-[350px]">
              {isLoading && !outputs && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 bg-opacity-80 rounded-xl z-10">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-emerald-500 border-t-transparent"></div>
                </div>
              )}
              {outputs?.output2 || <span className="text-gray-300 italic text-sm">Awaiting reorganization...</span>}
            </div>
          </div>
        </div>

        {/* Input Section (At Bottom) */}
        <div className="bg-white shadow-xl rounded-2xl p-6 md:p-8">
          {/* API Key Input - only show in development or if user wants to override */}
          {!isProduction && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700">
                  Gemini API Key
                </label>
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="text-xs text-indigo-500 hover:text-indigo-700"
                >
                  {showApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="w-full p-3 border-2 border-gray-200 rounded-lg text-sm
                  focus:outline-none focus:border-indigo-400 transition-all"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4 mb-4">
            <Button
              onClick={handleReorganize}
              disabled={isLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-indigo-200 text-lg"
            >
              {isLoading ? 'PROCESSING...' : 'REORGANIZE LISTING'}
            </Button>
            <Button
              onClick={handleClear}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg transform active:scale-95 focus:outline-none focus:ring-4 focus:ring-red-200"
            >
              Clear
            </Button>
          </div>

          {/* Input Textarea */}
          <TextArea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Paste raw listing here (e.g. G07398, *FOR SALE*, description, price, etc.)"
            rows={10}
            className="min-h-[200px] bg-gray-50"
          />
        </div>
      </main>

      <footer className="w-full max-w-7xl text-center py-8 mt-4 text-gray-400 text-xs">
        <p>&copy; {new Date().getFullYear()} Property Listing Reorganizer | Powered by Gemini AI</p>
      </footer>
    </div>
  );
}

export default App;
