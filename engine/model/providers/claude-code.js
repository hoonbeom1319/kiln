import { spawn } from 'node:child_process';
import { Provider, registerProvider } from '../provider.js';

// Local-agent provider: instead of calling a hosted model API with the operator's key, this
// shells out to the user's own Claude Code CLI (`claude -p`, headless). Generation runs on
// the user's machine, on their Claude auth/subscription, with whatever model their CLI is
// set to — so the harness operator pays nothing (DECISIONS: kills 실행당 비용 미터링 for the
// local/self-host mode). This is the "너는 하네스만 제공, 실행은 사용자 로컬 에이전트" seam.
//
// supportsStructured=false: we don't force tool-JSON here — generate() asks for JSON and runs
// its own extract + schema-repair loop, same as any text-only provider.
class ClaudeCodeProvider extends Provider {
  constructor() {
    super('claude-code');
    this.supportsStructured = false;
  }

  async generateText({ prompt, system, model }) {
    // --max-turns 1: one assistant turn, no agentic tool loop — we want a completion, not
    // an agent editing files. --output-format json gives us the result text + token usage.
    const args = ['-p', '--output-format', 'json', '--max-turns', '1'];
    if (model) args.push('--model', model); // empty → the user's default CC model
    if (system) args.push('--append-system-prompt', system);

    const stdout = await run(claudeBin(), args, prompt);
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

// The CLI is `claude.exe` on Windows; `claude` elsewhere. Override with KILN_CLAUDE_BIN
// (e.g. an absolute path) if it isn't resolvable on the server process's PATH.
function claudeBin() {
  return process.env.KILN_CLAUDE_BIN || (process.platform === 'win32' ? 'claude.exe' : 'claude');
}

// Spawn the CLI, feed the prompt on stdin (avoids arg-length limits for large PRDs), collect
// stdout. Rejects on non-zero exit with stderr context.
function run(cmd, args, input) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    } catch (e) {
      reject(e);
      return;
    }
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) =>
      reject(new Error(`claude-code: '${cmd}' 실행 실패: ${e.message} (KILN_CLAUDE_BIN로 경로 지정 가능)`)),
    );
    child.on('close', (code) =>
      code === 0 ? resolve(out) : reject(new Error(`claude-code: 종료코드 ${code}: ${err.slice(0, 300)}`)),
    );
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

registerProvider(new ClaudeCodeProvider());
