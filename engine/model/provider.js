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
    // Set true when the provider can run a multi-turn agentic tool loop (write files, run a
    // renderer, self-correct) instead of a single completion. When false, runAgentic() (agentic.js)
    // is unavailable and the caller falls back to the one-shot generate() + an external gate.
    this.supportsAgentic = false;
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

  // Multi-turn agentic tool loop. The agent works against real files (writes screens, runs the
  // render gate, reads the PNGs, self-corrects) rather than returning text. Reports progress via
  // req.onEvent(kind, data) — the engine maps those to turn/tool-call SSE sub-events. Must return
  // { turns, usage:{input,output}, result }. Only called when supportsAgentic is true.
  async runAgentic(_req) {
    throw new Error(`${this.name}.runAgentic() not implemented`);
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
