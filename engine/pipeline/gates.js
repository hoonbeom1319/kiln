import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { PROJECTS_ROOT } from './project.js';

// Run one of the copied atelier gate scripts (scripts/*.cjs) as a child process.
// The scripts re-derive `projects/<name>/` on their own (env or repo-relative); we pin
// KILN_PROJECTS_ROOT to the SERVER's resolved PROJECTS_ROOT so the gate always inspects the
// exact directory the pipeline wrote to. Without this, a gate whose cwd/repo-root differs from
// the server's (e.g. the packaged launcher spawns the server from the package dir) resolves a
// different projects root, fails to find the project, and exits non-zero — which is what left
// handoff/ unpacked and the gallery blank. Pure Node, no deps.
//
// Returns { ok, output } — ok is exit-code 0. Never throws on gate failure; the caller
// decides whether a failing gate blocks (PRD) or is advisory (handoff).
export function runGate(scriptCjs, project, { cwd = process.cwd() } = {}) {
  const scriptPath = resolve(cwd, 'scripts', scriptCjs);
  return new Promise((res) => {
    const child = spawn(process.execPath, [scriptPath, project], {
      cwd,
      env: { ...process.env, KILN_PROJECTS_ROOT: PROJECTS_ROOT },
    });
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
