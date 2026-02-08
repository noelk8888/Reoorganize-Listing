import { GoogleGenAI } from '@google/genai';

export interface ReorganizedOutputs {
  output1: string;
  output2: string;
}

/**
 * Reorganizes a property listing using the serverless API (for production)
 */
async function reorganizeViaApi(prompt: string): Promise<ReorganizedOutputs> {
  const response = await fetch('/api/reorganize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'API request failed');
  }

  return response.json();
}

/**
 * Reorganizes a property listing using direct Gemini API (for local dev with API key)
 */
async function reorganizeDirectly(prompt: string, apiKey: string): Promise<ReorganizedOutputs> {
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
}

/**
 * Reorganizes a property listing text into two formats.
 * Uses serverless API if no apiKey provided, otherwise uses direct Gemini API.
 */
export async function reorganizeListing(prompt: string, apiKey?: string): Promise<ReorganizedOutputs> {
  try {
    if (apiKey) {
      return await reorganizeDirectly(prompt, apiKey);
    } else {
      return await reorganizeViaApi(prompt);
    }
  } catch (error: unknown) {
    console.error('Reorganize failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(errorMessage);
  }
}
