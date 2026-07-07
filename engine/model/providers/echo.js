import { Provider, registerProvider } from '../provider.js';

// Offline mock provider. Emits a schema-shaped stub so validation passes and the whole
// build → judge → compare pipeline runs end-to-end with no API key. Use it to smoke-test
// wiring; swap `--variants echo,echo` for `gemini-pro,opus` once keys are set.
class EchoProvider extends Provider {
  constructor() {
    super('echo');
    this.supportsStructured = true;
  }

  async generateText({ prompt }) {
    return { text: `[echo] ${String(prompt).slice(0, 120)}`, usage: { input: 0, output: 0 }, raw: null };
  }

  async generateStructured({ schema }) {
    const data = stub(schema);
    return { data, text: JSON.stringify(data), usage: { input: 0, output: 0 }, raw: null };
  }
}

// Build a minimal value that satisfies the given schema.
function stub(schema) {
  if (!schema || typeof schema !== 'object') return null;
  if (schema.const !== undefined) return schema.const;
  if (schema.enum) return schema.enum[0];
  switch (schema.type) {
    case 'object': {
      const o = {};
      for (const req of schema.required || []) {
        o[req] = stub((schema.properties || {})[req] || {});
      }
      for (const [k, s] of Object.entries(schema.properties || {})) {
        if (!(k in o)) o[k] = stub(s);
      }
      return o;
    }
    case 'array': return [stub(schema.items || {})];
    case 'number': case 'integer': return 0;
    case 'boolean': return false;
    case 'string': return 'echo';
    case 'null': return null;
    default: return 'echo';
  }
}

registerProvider(new EchoProvider());
