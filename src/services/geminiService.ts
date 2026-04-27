const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

export interface ReorganizedOutputs {
  output1: string;
  output2: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 3000;

/**
 * Calls the Gemini REST API directly from the browser using the user's private API key.
 * Uses the exact same request format as api/reorganize.ts.
 */
async function callGeminiDirect(prompt: string, apiKey: string): Promise<string> {
  const response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (response.ok) {
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text;
  }

  // Read error body for diagnosis
  const errorBody = await response.json().catch(() => ({ error: { message: `HTTP ${response.status}` } }));
  const errorMessage = errorBody?.error?.message || `HTTP ${response.status}`;

  const err = new Error(`[${response.status}] ${errorMessage}`);
  (err as any).httpStatus = response.status;
  throw err;
}

/**
 * Determines whether an error is worth retrying (only genuine 429 and 5xx).
 */
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const status = (error as any).httpStatus as number | undefined;
    // Only retry on true rate limit (429) or server errors (5xx)
    if (status !== undefined) {
      return status === 429 || status >= 500;
    }
    // Fallback: check message for keywords (SDK path)
    const msg = error.message.toLowerCase();
    return msg.includes('429') || msg.includes('rate limit') || msg.includes('resource exhausted');
  }
  return false;
}

/**
 * Parses JSON from a Gemini text response, handling optional markdown code fences.
 */
function parseGeminiJson(text: string): ReorganizedOutputs {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonText = fenceMatch ? fenceMatch[1].trim() : text.trim();
  return JSON.parse(jsonText) as ReorganizedOutputs;
}

/**
 * Wraps an async function with exponential backoff retry logic.
 * Only retries on genuine 429 and 5xx errors.
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  onRetry?: (attempt: number, delay: number, errorMsg: string) => void
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (isRetryableError(error) && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.warn(`Retryable error: ${errorMsg}. Retrying in ${delay}ms (attempt ${attempt + 1}/${MAX_RETRIES})`);
        if (onRetry) onRetry(attempt + 1, delay, errorMsg);
        await sleep(delay);
        continue;
      }

      // Non-retryable error or exhausted retries — throw immediately
      throw error;
    }
  }

  throw lastError;
}

/**
 * Reorganizes via the Vercel serverless function (no private key).
 */
async function reorganizeViaApi(
  prompt: string,
  onRetry?: (attempt: number, delay: number, errorMsg: string) => void
): Promise<ReorganizedOutputs> {
  return withRetry(async () => {
    const response = await fetch('/api/reorganize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
      const err = new Error(errorBody.error || `HTTP ${response.status}`);
      (err as any).httpStatus = response.status;
      throw err;
    }

    return response.json();
  }, onRetry);
}

/**
 * Reorganizes via a direct browser fetch using the user's private API key.
 * Uses identical request format to the serverless function.
 */
async function reorganizeDirectly(
  prompt: string,
  apiKey: string,
  onRetry?: (attempt: number, delay: number, errorMsg: string) => void
): Promise<ReorganizedOutputs> {
  return withRetry(async () => {
    const text = await callGeminiDirect(prompt, apiKey);
    return parseGeminiJson(text);
  }, onRetry);
}

/**
 * Main entry point. Uses private key (direct) if provided, otherwise serverless API.
 */
export async function reorganizeListing(
  prompt: string,
  apiKey?: string,
  onRetry?: (attempt: number, delay: number, errorMsg: string) => void
): Promise<ReorganizedOutputs> {
  try {
    if (apiKey) {
      return await reorganizeDirectly(prompt, apiKey, onRetry);
    } else {
      return await reorganizeViaApi(prompt, onRetry);
    }
  } catch (error: unknown) {
    console.error('Reorganize failed:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(errorMessage);
  }
}
