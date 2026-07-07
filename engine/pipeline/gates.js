import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

// Run one of the copied atelier gate scripts (scripts/*.cjs) as a child process.
// They resolve `projects/<name>/` from their own repo root (kiln), so a project
// scaffolded under kiln/projects/ is exactly what they inspect. Pure Node, no deps.
//
// Returns { ok, output } — ok is exit-code 0. Never throws on gate failure; the caller
// decides whether a failing gate blocks (PRD) or is advisory (handoff).
export function runGate(scriptCjs, project, { cwd = process.cwd() } = {}) {
  const scriptPath = resolve(cwd, 'scripts', scriptCjs);
  return new Promise((res) => {
    const child = spawn(process.execPath, [scriptPath, project], { cwd });
    let out = '';
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (out += d));
    child.on('error', (e) => res({ ok: false, output: `게이트 실행 실패: ${e.message}` }));
    child.on('close', (code) => res({ ok: code === 0, output: out.trim() }));
  });
}

// Condense a gate's multi-line report to a one-line summary for the progress stream:
// the ✅/⚠️/❌ tallies + the final pass/fail line.
export function gateSummary(output) {
  const lines = output.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const err = lines.filter((l) => l.startsWith('❌')).length;
  const warn = lines.filter((l) => l.startsWith('⚠')).length;
  const last = [...lines].reverse().find((l) => /통과|실패|✅|❌/.test(l)) || '';
  return `${err} error · ${warn} warn — ${last.replace(/\s+/g, ' ').slice(0, 80)}`;
}
