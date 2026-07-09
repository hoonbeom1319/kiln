import { spawn } from 'node:child_process';
import { agentBin } from './agent-cli.js';

// The local BYO coding agents kiln can drive headless. Each maps to a provider (providers/*.js)
// and a CLI on the user's machine. Adding an agent = one row here + its provider. This registry
// is the single source of truth for what the UI offers and what forge/revise can run.
//
// `alias` is the model alias passed to generate() (must exist in config.js MODELS).
//
// `models` is the per-agent model menu the two-level picker offers. Every option runs on the
// user's OWN CLI/subscription (cost 0) — the picker sends `alias:value` (e.g. "claude-code:opus")
// and the provider passes `--model value`. value '' = the CLI's own default model (no --model).
// These can't be detected (they depend on the user's plan), so they're a curated list.
export const AGENTS = [
  {
    alias: 'claude-code',
    label: 'Claude Code',
    win: 'claude.exe',
    unix: 'claude',
    env: 'KILN_CLAUDE_BIN',
    models: [
      { value: '', label: '구독 기본' },
      { value: 'opus', label: 'Opus' },
      { value: 'sonnet', label: 'Sonnet' },
      { value: 'haiku', label: 'Haiku' },
    ],
  },
  {
    alias: 'codex',
    label: 'Codex',
    win: 'codex.cmd',
    unix: 'codex',
    env: 'KILN_CODEX_BIN',
    // Only the plan default for now — codex model slugs vary by account plan; add them here once
    // confirmed for the target plan (they flow through as `codex exec -m <value>`).
    models: [{ value: '', label: '기본' }],
  },
];

// Detect which agents are actually installed. For each, resolve its bin (env override or PATH
// lookup) and confirm it runs with `--version`. Returns a row per agent so the UI can show
// available ones and grey out the rest. Cheap: no model call, just presence + version.
export async function detectAgents() {
  return Promise.all(
    AGENTS.map(async (a) => {
      const bin = agentBin(a.env, a.win, a.unix);
      const resolved = await onPath(bin);
      if (!resolved) return { alias: a.alias, label: a.label, available: false, models: a.models };
      const version = await probeVersion(bin).catch(() => null);
      return {
        alias: a.alias,
        label: a.label,
        available: version != null,
        models: a.models,
        bin: resolved,
        version,
      };
    }),
  );
}

// Resolve a command on PATH: `where` (Windows) / `command -v` (unix). Returns the first path or
// null. An absolute-path override (from env) is returned as-is if it exists as a command.
function onPath(name) {
  const win = process.platform === 'win32';
  const cmd = win ? 'where' : 'command';
  const args = win ? [name] : ['-v', name];
  return new Promise((resolve) => {
    let child;
    try {
      // `command -v` is a shell builtin — needs a shell; `where` is a real exe.
      child = spawn(cmd, args, { shell: !win });
    } catch {
      resolve(null);
      return;
    }
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      const first = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean);
      resolve(code === 0 && first ? first : null);
    });
  });
}

// Run `<bin> --version` and return the trimmed first line, or throw if it doesn't run.
function probeVersion(bin) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(bin, ['--version'], { shell: process.platform === 'win32' });
    } catch (e) {
      reject(e);
      return;
    }
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.on('error', reject);
    child.on('close', (code) => {
      const line = out.split(/\r?\n/).map((l) => l.trim()).find(Boolean) || '';
      code === 0 ? resolve(line) : reject(new Error(`exit ${code}`));
    });
  });
}
