import { loadEnv } from './env.js';

loadEnv();

// Single source of truth for which concrete model each logical alias maps to.
// Swap a model for the ENTIRE codebase by editing here (or via env) — never hard-code
// a model id anywhere else. This table IS the "모델 스위처" the roadmap promotes to prod
// once the A/B harness validates a challenger.
export const MODELS = {
  // Local BYO agents (default path) — run on the USER's own CLI: their auth/subscription, their
  // chosen model. Operator pays nothing. model '' = whatever the CLI defaults to; override via
  // env. See agents.js (detection) + providers/{claude-code,codex}.js.
  'claude-code':  { provider: 'claude-code', model: process.env.KILN_CC_MODEL    || '' },
  'codex':        { provider: 'codex',       model: process.env.KILN_CODEX_MODEL || '' },
  // Hosted Claude API (optional hosted deployment — operator's Anthropic key). Not in the local
  // agent picker; kept for A/B and a future hosted mode.
  'opus':         { provider: 'claude', model: process.env.KILN_OPUS   || 'claude-opus-4-8' },
  'sonnet':       { provider: 'claude', model: process.env.KILN_SONNET || 'claude-sonnet-5' },
  'haiku':        { provider: 'claude', model: process.env.KILN_HAIKU  || 'claude-haiku-4-5-20251001' },
  // Offline mock — lets the whole harness run end-to-end with no key/agent.
  'echo':         { provider: 'echo',   model: 'echo' },
};

// An alias may carry a model override after a colon — "claude-code:opus" means the claude-code
// agent (local CLI, cost 0) run with `--model opus`. The base before the colon selects the
// provider + default model from MODELS; the suffix (if any) overrides only the model id. No
// colon → behaves exactly as before. This is how the two-level picker (agent → model) threads a
// per-agent model choice through the single `model` seam without a second parameter.
export function resolveModel(alias) {
  const raw = String(alias);
  const colon = raw.indexOf(':');
  const base = colon === -1 ? raw : raw.slice(0, colon);
  const override = colon === -1 ? '' : raw.slice(colon + 1);
  const entry = MODELS[base];
  if (!entry) {
    throw new Error(`Unknown model alias "${base}". Known: ${Object.keys(MODELS).join(', ')}`);
  }
  return { provider: entry.provider, model: override || entry.model };
}

export const DEFAULTS = {
  maxTokens: Number(process.env.KILN_MAX_TOKENS || 16000),
  temperature: process.env.KILN_TEMPERATURE !== undefined ? Number(process.env.KILN_TEMPERATURE) : 0.7,
  maxRepairAttempts: Number(process.env.KILN_MAX_REPAIR || 2),
  // Where the atelier repo lives relative to cwd — source of the _fixture contract.
  atelierDir: process.env.KILN_ATELIER_DIR || '../atelier',
};
