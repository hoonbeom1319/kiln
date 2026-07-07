import { loadEnv } from './env.js';

loadEnv();

// Single source of truth for which concrete model each logical alias maps to.
// Swap a model for the ENTIRE codebase by editing here (or via env) — never hard-code
// a model id anywhere else. This table IS the "모델 스위처" the roadmap promotes to prod
// once the A/B harness validates a challenger.
export const MODELS = {
  'gemini-pro':   { provider: 'gemini', model: process.env.KILN_GEMINI_PRO   || 'gemini-2.5-pro' },
  'gemini-flash': { provider: 'gemini', model: process.env.KILN_GEMINI_FLASH || 'gemini-2.5-flash' },
  'opus':         { provider: 'claude', model: process.env.KILN_OPUS         || 'claude-opus-4-8' },
  'sonnet':       { provider: 'claude', model: process.env.KILN_SONNET       || 'claude-sonnet-5' },
  'haiku':        { provider: 'claude', model: process.env.KILN_HAIKU        || 'claude-haiku-4-5-20251001' },
  // Local agent — runs on the user's own Claude Code CLI (their auth/subscription, their
  // chosen model). model '' = whatever their CLI defaults to; override via KILN_CC_MODEL
  // (e.g. 'opus', 'sonnet'). Operator pays nothing. See src/providers/claude-code.js.
  'claude-code':  { provider: 'claude-code', model: process.env.KILN_CC_MODEL || '' },
  // Offline mock — lets the whole harness run end-to-end with no API key.
  'echo':         { provider: 'echo',   model: 'echo' },
};

export function resolveModel(alias) {
  const entry = MODELS[alias];
  if (!entry) {
    throw new Error(`Unknown model alias "${alias}". Known: ${Object.keys(MODELS).join(', ')}`);
  }
  return entry;
}

export const DEFAULTS = {
  maxTokens: Number(process.env.KILN_MAX_TOKENS || 16000),
  temperature: process.env.KILN_TEMPERATURE !== undefined ? Number(process.env.KILN_TEMPERATURE) : 0.7,
  maxRepairAttempts: Number(process.env.KILN_MAX_REPAIR || 2),
  // Where the atelier repo lives relative to cwd — source of the _fixture contract.
  atelierDir: process.env.KILN_ATELIER_DIR || '../atelier',
};
