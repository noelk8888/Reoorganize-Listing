import { GoogleGenAI } from '@google/genai';

export interface ReorganizedOutputs {
  output1: string;
  output2: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 2000;

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    // Retry on 429 (Rate Limit) and 5xx (Server Error)
    return (
      msg.includes('429') || 
      msg.includes('rate limit') || 
      msg.includes('resource exhausted') ||
      msg.includes('500') ||
      msg.includes('502') ||
      msg.includes('503') ||
      msg.includes('504') ||
      msg.includes('api request failed with status 5')
    );
  }
  return false;
}

function isRateLimitError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('resource exhausted');
  }
  return false;
}

/**
 * Wraps an async function with exponential backoff retry logic for rate limit and transient errors.
 */
async function withRetry<T>(fn: () => Promise<T>, onRetry?: (attempt: number, delay: number) => void): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Transient error or rate limit hit. Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        if (onRetry) onRetry(attempt + 1, delay);
        await sleep(delay);
        continue;
      }
      
      // If it's not a retryable error, or we've exhausted retries, throw immediately
      throw error;
    }
  }

  throw lastError;
}

/**
 * Reorganizes a property listing using the serverless API (for production)
 */
async function reorganizeViaApi(prompt: string, onRetry?: (attempt: number, delay: number) => void): Promise<ReorganizedOutputs> {
  return withRetry(async () => {
    const response = await fetch('/api/reorganize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: `API request failed with status ${response.status}` }));
      
      // Pass the 429 status code clearly in the error message so `withRetry` can catch it
      if (response.status === 429) {
        throw new Error(`429 Rate limit: ${error.error || 'Too many requests'}`);
      }
      
      throw new Error(error.error || `API request failed with status ${response.status}`);
    }

    return response.json();
  }, onRetry);
}

/**
 * Reorganizes a property listing using direct Gemini API (for local dev with API key)
 */
async function reorganizeDirectly(prompt: string, apiKey: string, onRetry?: (attempt: number, delay: number) => void): Promise<ReorganizedOutputs> {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini API returned an empty response.');
    }

    return JSON.parse(text) as ReorganizedOutputs;
  }, onRetry);
}

/**
 * Reorganizes a property listing text into two formats.
 * Uses serverless API if no apiKey provided, otherwise uses direct Gemini API.
 */
export async function reorganizeListing(
  prompt: string, 
  apiKey?: string, 
  onRetry?: (attempt: number, delay: number) => void
): Promise<ReorganizedOutputs> {
  try {
    if (apiKey) {
      return await reorganizeDirectly(prompt, apiKey, onRetry);
    } else {
      return await reorganizeViaApi(prompt, onRetry);
    }
  } catch (error: unknown) {
    console.error('Reorganize failed:', error);
    
    // Check if we exhausted retries and it was a rate limit error
    if (isRateLimitError(error)) {
       throw new Error('Rate limit reached. Please wait a moment and try again.');
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(errorMessage);
  }
}
