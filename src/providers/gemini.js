import { Provider, registerProvider } from '../provider.js';

// SDK is imported lazily so the offline (echo) path needs no install and so a missing
// GEMINI_API_KEY only errors when Gemini is actually used.
let client;
async function getClient() {
  if (client) return client;
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set');
  const { GoogleGenAI } = await import('@google/genai');
  client = new GoogleGenAI({ apiKey: key });
  return client;
}

class GeminiProvider extends Provider {
  constructor() {
    super('gemini');
    this.supportsStructured = true;
  }

  async generateText({ system, prompt, model, temperature, maxTokens }) {
    const ai = await getClient();
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: { systemInstruction: system, temperature, maxOutputTokens: maxTokens },
    });
    return { text: res.text ?? '', usage: usageOf(res), raw: res };
  }

  async generateStructured({ system, prompt, schema, model, temperature, maxTokens }) {
    const ai = await getClient();
    const res = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        systemInstruction: system,
        temperature,
        maxOutputTokens: maxTokens,
        responseMimeType: 'application/json',
        responseJsonSchema: schema,
      },
    });
    const text = res.text ?? '';
    // responseMimeType:'application/json' guarantees a JSON body; generate() still
    // validates the parsed object and repair-retries on any schema mismatch.
    return { data: JSON.parse(text), text, usage: usageOf(res), raw: res };
  }
}

function usageOf(res) {
  const u = res?.usageMetadata || {};
  return { input: u.promptTokenCount || 0, output: u.candidatesTokenCount || 0 };
}

registerProvider(new GeminiProvider());
