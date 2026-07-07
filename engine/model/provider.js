// Provider abstraction — the seam the roadmap requires. Every model (Gemini, Claude,
// future ones) plugs in behind this one interface so no SDK is hard-wired across the
// codebase. `generate()` (src/generate.js) is the only thing callers touch; providers
// are an implementation detail selected by the MODELS table in src/config.js.

const registry = new Map();

export class Provider {
  constructor(name) {
    this.name = name;
    // Set true when the provider can emit constrained JSON natively (Gemini
    // responseSchema, Claude forced tool-use). When false, generate() falls back to
    // "ask for JSON + extract" and still validates + repair-retries.
    this.supportsStructured = false;
  }

  // Free-form text. Must return { text, usage:{input,output}, raw }.
  async generateText(_req) {
    throw new Error(`${this.name}.generateText() not implemented`);
  }

  // Native structured output. Must return { data, text, usage, raw }.
  // Only called when supportsStructured is true.
  async generateStructured(_req) {
    throw new Error(`${this.name}.generateStructured() not implemented`);
  }
}

export function registerProvider(instance) {
  registry.set(instance.name, instance);
}

export function getProvider(name) {
  const p = registry.get(name);
  if (!p) {
    const known = [...registry.keys()].join(', ') || '(none registered)';
    throw new Error(`Provider "${name}" not registered. Registered: ${known}`);
  }
  return p;
}

export function listProviders() {
  return [...registry.keys()];
}
