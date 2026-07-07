import { Provider, registerProvider } from '../provider.js';

// SDK imported lazily (see gemini.js for the rationale).
let client;
async function getClient() {
  if (client) return client;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  client = new Anthropic({ apiKey: key });
  return client;
}

class ClaudeProvider extends Provider {
  constructor() {
    super('claude');
    this.supportsStructured = true;
  }

  async generateText({ system, prompt, model, temperature, maxTokens }) {
    const c = await getClient();
    const res = await c.messages.create({
      model,
      system,
      temperature,
      max_tokens: maxTokens,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    return { text, usage: usageOf(res), raw: res };
  }

  // Force structured output by requiring a single tool call whose input_schema IS the
  // target schema — Claude then fills arguments that conform. (input_schema must be an
  // object schema; the harness verdict/build schemas both are.)
  async generateStructured({ system, prompt, schema, model, temperature, maxTokens }) {
    const c = await getClient();
    const tool = { name: 'emit', description: 'Return the result as structured JSON.', input_schema: schema };
    const res = await c.messages.create({
      model,
      system,
      temperature,
      max_tokens: maxTokens,
      tools: [tool],
      tool_choice: { type: 'tool', name: 'emit' },
      messages: [{ role: 'user', content: prompt }],
    });
    const use = res.content.find((b) => b.type === 'tool_use');
    if (!use) throw new Error('claude: no tool_use block in response');
    return { data: use.input, text: JSON.stringify(use.input), usage: usageOf(res), raw: res };
  }
}

function usageOf(res) {
  const u = res?.usage || {};
  return { input: u.input_tokens || 0, output: u.output_tokens || 0 };
}

registerProvider(new ClaudeProvider());
