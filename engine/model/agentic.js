import { getProvider } from './provider.js';
import { resolveModel, DEFAULTS } from './config.js';
import './providers/index.js';

/**
 * The agentic sibling of generate(). Where generate() returns text/JSON for the caller to write,
 * runAgentic() hands the model a multi-turn tool loop so it edits real files itself (build a
 * screen → render it with the shoot gate → read the PNG → fix it → repeat). This is atelier's
 * "render-in-loop" self-correction the one-shot generate() gave up (DECISIONS: C2 착수 ②).
 *
 * Only providers with supportsAgentic run here (claude-code). Others throw NOT_AGENTIC so the
 * stage falls back to generate() + an external gate — same contract, no branch leaks upward.
 *
 * @param {string} task                    the instruction (goes on stdin — large PRDs are fine)
 * @param {object} opts
 * @param {string} [opts.model='claude-code']
 * @param {string} [opts.system]           appended system prompt
 * @param {string[]} [opts.tools]          built-in tools to expose (e.g. ['Write','Read','Edit','Bash'])
 * @param {number} [opts.maxTurns=8]       hard cap on agentic turns (cost/latency guard)
 * @param {string} [opts.cwd]              working dir for the agent (repo root, so scripts/ resolves)
 * @param {string} [opts.addDir]           extra dir the agent may write to (the project dir)
 * @param {object} [opts.env]              extra env for the child (e.g. KILN_PROJECTS_ROOT)
 * @param {(kind:string,data:object)=>void} [opts.onEvent]  turn/tool-call progress
 * @returns {Promise<{turns:number,usage:{input:number,output:number},result:string,model:string,provider:string}>}
 */
export async function runAgentic(task, opts = {}) {
  const { model = 'claude-code', maxTurns = 8 } = opts;
  const { provider: providerName, model: modelId } = resolveModel(model);
  const provider = getProvider(providerName);

  if (!provider.supportsAgentic) {
    const err = new Error(`Provider "${providerName}" is not agentic — fall back to generate()`);
    err.code = 'NOT_AGENTIC';
    throw err;
  }

  const out = await provider.runAgentic({
    task,
    model: modelId,
    system: opts.system,
    tools: opts.tools,
    maxTurns,
    cwd: opts.cwd,
    addDir: opts.addDir,
    env: opts.env,
    onEvent: opts.onEvent,
  });
  return { ...out, model, provider: providerName };
}

// Whether the given model alias resolves to an agentic provider — lets a stage decide
// "agentic-first, one-shot fallback" without try/catch on NOT_AGENTIC for the common case.
export function isAgentic(model = 'claude-code') {
  try {
    const { provider } = resolveModel(model);
    return getProvider(provider).supportsAgentic;
  } catch {
    return false;
  }
}

// Re-export so callers can tune the turn cap against DEFAULTS if desired.
export { DEFAULTS };
