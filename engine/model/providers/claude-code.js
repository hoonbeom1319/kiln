import { Provider, registerProvider } from '../provider.js';
import { agentBin, runAgent, runAgentStream } from '../agent-cli.js';

// Local-agent provider: shells out to the user's own Claude Code CLI (`claude -p`, headless)
// instead of a hosted API with the operator's key. Runs on the user's Claude auth/subscription
// and their chosen model — the harness operator pays nothing (DECISIONS: BYO local-agent seam).
//
// supportsStructured=false: we don't force tool-JSON here — generate() asks for JSON and runs
// its own extract + schema-repair loop, same as any text-only provider.
class ClaudeCodeProvider extends Provider {
  constructor() {
    super('claude-code');
    this.supportsStructured = false;
    // Full agentic tool loop — this is C2's whole point: hand the CC agent a render-in-loop so it
    // builds a screen, renders it (shoot gate as a Bash tool), reads the PNG, and self-corrects.
    this.supportsAgentic = true;
  }

  async generateText({ prompt, system, model }) {
    // --max-turns 1: one assistant turn, no agentic tool loop — we want a completion, not an
    // agent editing files. --output-format json gives us the result text + token usage.
    const args = ['-p', '--output-format', 'json', '--max-turns', '1'];
    if (model) args.push('--model', model); // empty → the user's default CC model
    if (system) args.push('--append-system-prompt', system);

    let stdout;
    try {
      stdout = await runAgent(claudeBin(), args, prompt);
    } catch (e) {
      // claude -p often writes its result JSON (with is_error + a human message) to STDOUT even
      // when it exits non-zero — e.g. a rate/usage limit mid-generation. Surface that real reason
      // instead of a bare exit code, so a failed build says WHY. Fall back to stderr/exit code.
      const detail = claudeErrorDetail(e.stdout) || e.stderr?.trim() || `종료코드 ${e.code ?? '?'}`;
      throw new Error(`claude-code: 실패 — ${detail}`);
    }
    let obj;
    try {
      obj = JSON.parse(stdout);
    } catch {
      throw new Error(`claude-code: JSON 아닌 출력: ${stdout.slice(0, 200)}`);
    }
    if (obj.is_error || obj.subtype === 'error_max_turns' || typeof obj.result !== 'string') {
      throw new Error(`claude-code: 실패(${obj.subtype || 'unknown'}): ${String(obj.result).slice(0, 200)}`);
    }
    const u = obj.usage || {};
    return {
      text: obj.result,
      usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 },
      raw: obj,
    };
  }

  // Multi-turn agentic loop via `claude -p --output-format stream-json`. Unlike generateText's
  // --max-turns 1, here the agent runs a real tool loop: writes screen files, runs the shoot
  // render gate (as an allowed Bash tool), reads the PNGs, and fixes what rendered wrong.
  //
  // Headless posture: --permission-mode bypassPermissions so an unattended run NEVER hangs on a
  // permission prompt (a strict user settings.json would otherwise block a build mid-flight with no
  // TTY to answer). This doesn't widen the trust boundary — it's the user's own agent on their own
  // machine (BYO), which already has full access when they run `claude` interactively. Scope is
  // shaped instead by what the agent CAN reach: --tools exposes only the build toolset,
  // --strict-mcp-config drops the user's ambient MCP servers, --add-dir scopes writes to the
  // project dir, and the task prompt fixes the job. JSONL is parsed line-by-line and mapped to
  // onEvent('turn'|'tool-call', …) live (see mapEvent).
  async runAgentic({ task, system, model, tools, maxTurns = 8, cwd, addDir, env, onEvent }) {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--strict-mcp-config',
      '--max-turns', String(maxTurns), '--permission-mode', 'bypassPermissions'];
    if (tools && tools.length) args.push('--tools', ...tools);
    if (addDir) args.push('--add-dir', addDir);
    if (model) args.push('--model', model);
    if (system) args.push('--append-system-prompt', system);

    const pending = new Map(); // tool_use id → { name, input } — correlate tool_use with its result
    const onLine = (obj) => mapEvent(obj, pending, onEvent);

    let events;
    try {
      // cwd = repo root so `node scripts/shoot.cjs` resolves the same way runGate spawns it;
      // env threads KILN_PROJECTS_ROOT so shoot writes to the pipeline's projects root.
      events = await runAgentStream(claudeBin(), args, task, { onLine, cwd, env });
    } catch (e) {
      // claude exits NON-ZERO when it hits --max-turns, even though the screens it wrote are on
      // disk and valid. If the parsed events still carry a result event, recover them and let the
      // soft/hard logic below decide (max_turns = soft). Only a real spawn/exit with no result
      // is a hard failure.
      if (Array.isArray(e.events) && e.events.some((o) => o.type === 'result')) {
        events = e.events;
      } else {
        const detail = claudeAgenticDetail(e.events) || e.stderr?.trim() || `종료코드 ${e.code ?? '?'}`;
        throw new Error(`claude-code(agentic): 실패 — ${detail}`);
      }
    }

    const result = events.find((o) => o.type === 'result');
    if (!result) {
      throw new Error('claude-code(agentic): 실패 — 결과 이벤트 없음(프로세스가 완료 전에 종료)');
    }
    // error_max_turns is a SOFT boundary, not a crash: the agent ran out of its turn budget but
    // the screens it wrote are on disk and may be perfectly good. Return normally with a flag so
    // the caller can warn — the engine's own render gate is the authoritative judge downstream.
    const maxTurnsHit = result.subtype === 'error_max_turns';
    if (result.is_error && !maxTurnsHit) {
      const why = result.subtype || 'unknown';
      const msg = typeof result.result === 'string' ? result.result.slice(0, 200) : '';
      throw new Error(`claude-code(agentic): 실패(${why})${msg ? ': ' + msg : ''}`);
    }
    const u = result.usage || {};
    return {
      turns: result.num_turns || 0,
      usage: { input: u.input_tokens || 0, output: u.output_tokens || 0 },
      result: typeof result.result === 'string' ? result.result : '',
      maxTurnsHit,
    };
  }
}

// Map one stream-json JSONL object to the pipeline's turn/tool-call sub-events. Assistant text
// blocks become `turn`s (the agent's narration between tools); a tool_use is recorded and, when
// its tool_result lands in the next user message, emitted as one `tool-call` with its outcome —
// one event per completed tool call rather than a call+result pair.
function mapEvent(obj, pending, onEvent) {
  if (!onEvent) return;
  if (obj.type === 'assistant') {
    for (const b of obj.message?.content || []) {
      if (b.type === 'text' && b.text?.trim()) {
        onEvent('turn', { text: b.text.trim() });
      } else if (b.type === 'tool_use') {
        pending.set(b.id, { name: b.name, input: b.input });
      }
    }
  } else if (obj.type === 'user') {
    for (const b of obj.message?.content || []) {
      if (b.type !== 'tool_result') continue;
      const call = pending.get(b.tool_use_id) || { name: 'tool', input: {} };
      pending.delete(b.tool_use_id);
      onEvent('tool-call', {
        tool: call.name,
        summary: toolSummary(call.name, call.input),
        ok: !b.is_error,
        detail: resultText(b.content),
      });
    }
  }
}

// One-line label for a tool call: the file for Write/Edit/Read, the command for Bash, else the
// tool name. Keeps the SSE sub-event readable without dumping the whole tool input.
function toolSummary(name, input = {}) {
  if (name === 'Bash') return String(input.command || '').slice(0, 80);
  if (name === 'Write' || name === 'Edit' || name === 'Read') {
    return String(input.file_path || input.path || '').replace(/\\/g, '/').split('/').slice(-2).join('/');
  }
  const first = Object.values(input).find((v) => typeof v === 'string');
  return first ? String(first).slice(0, 80) : name;
}

// Pull a short human string out of a tool_result content (string or [{type:text,text}] blocks).
function resultText(content) {
  if (typeof content === 'string') return content.split('\n').find((l) => l.trim())?.slice(0, 120) || '';
  if (Array.isArray(content)) {
    const t = content.find((c) => c.type === 'text')?.text || '';
    return t.split('\n').find((l) => l.trim())?.slice(0, 120) || '';
  }
  return '';
}

// Human reason from a failed agentic run's parsed events (result written to stdout even on error).
function claudeAgenticDetail(events) {
  const r = Array.isArray(events) ? events.find((o) => o.type === 'result') : null;
  if (!r) return null;
  const msg = typeof r.result === 'string' ? r.result : '';
  return `${r.subtype || (r.is_error ? 'error' : 'unknown')}${msg ? ': ' + msg.slice(0, 200) : ''}`;
}

// Pull a human-readable reason out of claude's JSON result (written to stdout even on error
// exits). Returns null when stdout is empty/unparseable so the caller can fall back to stderr.
function claudeErrorDetail(stdout) {
  if (!stdout) return null;
  try {
    const o = JSON.parse(stdout);
    const msg = typeof o.result === 'string' ? o.result : '';
    return `${o.subtype || (o.is_error ? 'error' : 'unknown')}${msg ? ': ' + msg.slice(0, 200) : ''}`;
  } catch {
    return String(stdout).trim().slice(0, 200) || null;
  }
}

// `claude.exe` on Windows, `claude` elsewhere. Override with KILN_CLAUDE_BIN (absolute path).
function claudeBin() {
  return agentBin('KILN_CLAUDE_BIN', 'claude.exe', 'claude');
}

registerProvider(new ClaudeCodeProvider());
