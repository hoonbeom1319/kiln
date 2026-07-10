import { spawn } from 'node:child_process';

// Shared plumbing for local BYO-agent providers (claude-code, codex). Each shells out to a CLI
// on the USER's machine — generation runs on their auth/subscription/model, so the harness
// operator pays nothing. This is the "너는 하네스만, 실행은 사용자 로컬 에이전트" seam.

// Resolve the command for an agent CLI: an explicit env override wins (absolute path ok), else
// the platform default name (resolved on PATH by spawn). winName is usually a .cmd/.exe shim.
export function agentBin(envVar, winName, unixName) {
  return process.env[envVar] || (process.platform === 'win32' ? winName : unixName);
}

// Decide whether a command must go through a shell. On Windows only npm .cmd/.bat shims (e.g.
// codex.cmd) need cmd.exe to resolve; a real .exe (claude.exe) must NOT — cmd.exe caps the command
// line at ~8191 chars, so a large --append-system-prompt overflows and the CLI exits 1
// ("명령줄이 너무 깁니다"). Spawning the .exe directly (shell:false) uses CreateProcess (~32KB limit).
function needsShell(cmd) {
  return process.platform === 'win32' && /\.(cmd|bat)$/i.test(cmd);
}

// Spawn an agent CLI, feed the prompt on stdin (avoids arg-length limits for large PRDs),
// collect stdout. Shell only for .cmd/.bat shims (see needsShell); a real .exe runs shell-free so
// large system-prompt args don't hit cmd.exe's line-length cap. Rejects on non-zero exit.
export function runAgent(cmd, args, input, { shell = needsShell(cmd) } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, { stdio: ['pipe', 'pipe', 'pipe'], shell });
    } catch (e) {
      reject(e);
      return;
    }
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => reject(new Error(`'${cmd}' 실행 실패: ${e.message} (env로 경로 지정 가능)`)));
    child.on('close', (code) => {
      if (code === 0) {
        resolve(out);
        return;
      }
      // Some agents (codex) write a useful error to STDOUT and still exit non-zero — attach both
      // streams so the provider can parse the real message instead of a bare exit code.
      const e = new Error(`'${cmd}' 종료코드 ${code}: ${err.slice(0, 300)}`);
      e.stdout = out;
      e.stderr = err;
      e.code = code;
      reject(e);
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}

// Streaming variant for agentic (multi-turn tool-loop) providers. Same spawn rules as runAgent,
// but instead of buffering to a single result it parses stdout as JSONL (one JSON object per line
// — claude's `--output-format stream-json`) and invokes onLine(obj) for each. The pipeline's
// turn/tool-call SSE sub-events are emitted from here, live, as the agent works. Resolves with
// the full array of parsed events once the process closes (caller pulls the final `result` event
// out of it); rejects on non-zero exit with stderr attached, like runAgent.
//
// A partial trailing line (no newline yet) is held in `buf` until the next chunk completes it;
// the final flush parses whatever remains. Non-JSON lines (a stray log) are passed through as
// { type: 'raw', line } so a malformed line never crashes the parse.
export function runAgentStream(cmd, args, input, { onLine, cwd, env, shell = needsShell(cmd) } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(cmd, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        shell,
        ...(cwd ? { cwd } : {}),
        ...(env ? { env: { ...process.env, ...env } } : {}),
      });
    } catch (e) {
      reject(e);
      return;
    }
    const events = [];
    let buf = '';
    let err = '';
    const handleLine = (line) => {
      const s = line.trim();
      if (!s) return;
      let obj;
      try {
        obj = JSON.parse(s);
      } catch {
        obj = { type: 'raw', line: s };
      }
      events.push(obj);
      if (onLine) {
        try { onLine(obj); } catch { /* a listener must never break the stream */ }
      }
    };
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) !== -1) {
        handleLine(buf.slice(0, nl));
        buf = buf.slice(nl + 1);
      }
    });
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => reject(new Error(`'${cmd}' 실행 실패: ${e.message} (env로 경로 지정 가능)`)));
    child.on('close', (code) => {
      if (buf) handleLine(buf); // flush the last line if it had no trailing newline
      if (code === 0) {
        resolve(events);
        return;
      }
      // claude writes its result JSON to stdout even on non-zero exits — hand the parsed events
      // back so the provider can surface the real reason instead of a bare exit code.
      const e = new Error(`'${cmd}' 종료코드 ${code}: ${err.slice(0, 300)}`);
      e.events = events;
      e.stderr = err;
      e.code = code;
      reject(e);
    });
    if (input) child.stdin.write(input);
    child.stdin.end();
  });
}
