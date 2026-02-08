import { GoogleGenAI } from '@google/genai';

export interface ReorganizedOutputs {
  output1: string;
  output2: string;
}

/**
 * Reorganizes a property listing text into two formats using the Gemini API.
 */
export async function reorganizeListing(prompt: string, apiKey: string): Promise<ReorganizedOutputs> {
  if (!apiKey) {
    throw new Error('API key is required.');
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
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

    const result = JSON.parse(text) as ReorganizedOutputs;
    return result;
  } catch (error: unknown) {
    console.error('Gemini API call failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown API error';
    throw new Error(`Gemini API error: ${errorMessage}`);
  }
}
