import { Provider, registerProvider } from '../provider.js';
import { agentBin, runAgent } from '../agent-cli.js';

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
  }

  async generateText({ prompt, system, model }) {
    // --max-turns 1: one assistant turn, no agentic tool loop — we want a completion, not an
    // agent editing files. --output-format json gives us the result text + token usage.
    const args = ['-p', '--output-format', 'json', '--max-turns', '1'];
    if (model) args.push('--model', model); // empty → the user's default CC model
    if (system) args.push('--append-system-prompt', system);

    const stdout = await runAgent(claudeBin(), args, prompt);
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
}

// `claude.exe` on Windows, `claude` elsewhere. Override with KILN_CLAUDE_BIN (absolute path).
function claudeBin() {
  return agentBin('KILN_CLAUDE_BIN', 'claude.exe', 'claude');
}

registerProvider(new ClaudeCodeProvider());
