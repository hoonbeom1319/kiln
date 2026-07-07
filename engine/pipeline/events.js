// Progress reporting seam. The whole pipeline reports progress by calling emit(type, data).
// Today the CLI subscribes and prints; later the web layer subscribes with a handler that
// pushes each event down an SSE/WebSocket stream — same events, no pipeline change. This is
// how "실시간 스트리밍" comes for free once the engine emits.

export function createReporter(onEvent) {
  const listeners = [];
  if (onEvent) listeners.push(onEvent);
  let seq = 0;
  const emit = (type, data = {}) => {
    const ev = { seq: seq++, type, t: null, ...data, type };
    for (const l of listeners) {
      try { l(ev); } catch { /* a listener must never break the pipeline */ }
    }
    return ev;
  };
  return { emit, on: (fn) => listeners.push(fn) };
}

// Event vocabulary (documented so the web layer and CLI agree):
//   phase    { name }                     — a top-level stage began (PRD / Design / Handoff)
//   step     { msg }                       — a sub-step within a phase
//   model    { stage, model, usage, attempts } — a generate() call finished
//   gate     { name, ok, summary }         — a code gate ran (lint-prd, lint-handoff, verifier)
//   artifact { path, kind }                — a file was written
//   warn     { msg }
//   revision { version, note, changed, feedback } — a chat-style revise produced a new version
//   done     { name, dir }                 — pipeline finished
//   error    { msg }

// Default CLI printer.
export function cliPrinter(ev) {
  switch (ev.type) {
    case 'phase':    process.stderr.write(`\n\x1b[1m▸ ${ev.name}\x1b[0m\n`); break;
    case 'step':     process.stderr.write(`  · ${ev.msg}\n`); break;
    case 'model':    process.stderr.write(`    ↳ ${ev.stage} via ${ev.model} (${ev.attempts || 1} try, ${(ev.usage?.output ?? 0)} out tok)\n`); break;
    case 'gate':     process.stderr.write(`  ${ev.ok ? '\x1b[32m✓' : '\x1b[31m✗'} gate ${ev.name}\x1b[0m — ${ev.summary || ''}\n`); break;
    case 'artifact': process.stderr.write(`    → ${ev.path}\n`); break;
    case 'revision': process.stderr.write(`\n\x1b[1m✎ v${ev.version}\x1b[0m — ${ev.note || ''} (${(ev.changed || []).length}개 산출물)\n`); break;
    case 'warn':     process.stderr.write(`  \x1b[33m⚠ ${ev.msg}\x1b[0m\n`); break;
    case 'done':     process.stderr.write(`\n\x1b[1m✓ done\x1b[0m → ${ev.dir}\n`); break;
    case 'error':    process.stderr.write(`\n\x1b[31m✗ ${ev.msg}\x1b[0m\n`); break;
    default: break;
  }
}
