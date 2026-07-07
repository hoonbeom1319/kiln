import { Provider, registerProvider } from '../provider.js';
import { agentBin, runAgent } from '../agent-cli.js';

// Local-agent provider: shells out to the user's OpenAI Codex CLI (`codex exec`, headless) on
// their ChatGPT/Codex auth and model — operator pays nothing, same BYO seam as claude-code.
//
// `codex exec --json` streams JSONL events (thread.started · turn.started · item.* ·
// turn.completed · error · turn.failed). We feed the prompt on stdin (`-`), collect the agent's
// message text from the item events, and read token usage from turn.completed.
//
// supportsStructured=false: generate() asks for JSON in-prompt and runs its own extract +
// schema-repair loop.
class CodexProvider extends Provider {
  constructor() {
    super('codex');
    this.supportsStructured = false;
  }

  async generateText({ prompt, system, model }) {
    // read-only sandbox: codex may not touch the filesystem — we want a completion, not an agent
    // editing files. Codex has no --append-system-prompt, so the system instruction is prepended.
    const args = ['exec', '--json', '--sandbox', 'read-only'];
    if (model) args.push('-m', model); // empty → the user's configured codex default model
    args.push('-'); // read the prompt from stdin
    const input = system ? `${system}\n\n---\n\n${prompt}` : prompt;

    // codex writes its error events to STDOUT and exits non-zero on turn.failed, so parse the
    // captured stdout even on a non-zero exit — parseCodexJsonl surfaces the real codex message.
    try {
      return parseCodexJsonl(await runAgent(codexBin(), args, input));
    } catch (e) {
      if (e.stdout) return parseCodexJsonl(e.stdout);
      throw e;
    }
  }
}

// Parse codex's JSONL event stream into { text, usage }. Throws with the codex error message on
// an error / turn.failed event (e.g. an account whose plan doesn't allow the chosen model).
function parseCodexJsonl(stdout) {
  let text = '';
  let usage = { input: 0, output: 0 };
  let errMsg = null;

  for (const line of stdout.split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    let ev;
    try {
      ev = JSON.parse(s);
    } catch {
      continue; // ignore any non-JSON noise
    }
    switch (ev.type) {
      case 'error':
        errMsg = codexDetail(ev.message) || errMsg;
        break;
      case 'turn.failed':
        errMsg = codexDetail(ev.error?.message) || errMsg;
        break;
      case 'turn.completed':
        usage = readUsage(ev.usage) || usage;
        break;
      default: {
        // Agent's textual output arrives as item.* events; last assistant/agent message wins.
        const item = ev.item;
        if (item && /message|agent|assistant/i.test(item.type || '') && itemText(item)) {
          text = itemText(item);
        }
        break;
      }
    }
  }

  if (errMsg) throw new Error(`codex: ${errMsg}`);
  if (!text) throw new Error('codex: 응답 메시지를 찾지 못함(빈 출력)');
  return { text, usage };
}

// codex error messages are often a JSON string like {"detail":"..."} — unwrap to the detail.
function codexDetail(msg) {
  if (!msg) return null;
  try {
    const o = JSON.parse(msg);
    return o.detail || o.message || msg;
  } catch {
    return msg;
  }
}

// An item's text may be a plain string or a content array of { type:'text', text }.
function itemText(item) {
  if (typeof item.text === 'string') return item.text;
  if (Array.isArray(item.content)) {
    return item.content
      .map((c) => (typeof c === 'string' ? c : c?.text || ''))
      .join('')
      .trim();
  }
  if (typeof item.content === 'string') return item.content;
  return '';
}

function readUsage(u) {
  if (!u) return null;
  return {
    input: u.input_tokens ?? u.prompt_tokens ?? u.input ?? 0,
    output: u.output_tokens ?? u.completion_tokens ?? u.output ?? 0,
  };
}

// `codex.cmd` on Windows (npm shim, run via shell), `codex` elsewhere. Override with KILN_CODEX_BIN.
function codexBin() {
  return agentBin('KILN_CODEX_BIN', 'codex.cmd', 'codex');
}

registerProvider(new CodexProvider());
