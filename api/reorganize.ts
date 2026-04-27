import type { VercelRequest, VercelResponse } from '@vercel/node';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000; // 2s, 4s, 8s

async function callGemini(prompt: string, apiKey: string): Promise<{ text: string, status?: number }> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          response_mime_type: 'application/json' 
        },
      }),
    }
  );

  if (response.ok) {
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return { text };
  }

  if (response.status === 429) {
    const error = new Error('Rate limit reached (429). Please wait a moment and try again.');
    (error as any).status = 429;
    throw error;
  }

  if (response.status >= 500) {
    const error = new Error(`Gemini server error (${response.status}). Please try again.`);
    (error as any).status = response.status;
    throw error;
  }

  const errorText = await response.text();
  throw new Error(`Gemini API error (${response.status}): ${errorText}`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'Prompt is required' });
  }

  try {
    const { text } = await callGemini(prompt, apiKey);
    const result = JSON.parse(text);
    return res.status(200).json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = (error as any).status || 500;
    return res.status(status).json({ error: message });
  }
}
