#!/usr/bin/env node
// 무인 forge — 아이디어 한 줄 → PRD → 디자인(tokens+hi-fi+검증) → handoff 패키지.
//
//   node bin/forge.js "<아이디어>" [--name slug] [--model gemini-flash] [--judge gemini-pro]

import { createReporter, cliPrinter } from '../pipeline/events.js';
import { projectName, scaffold, nowStamp } from '../pipeline/project.js';
import { forge } from '../pipeline/forge.js';

function parse(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) args[a.slice(2)] = argv[++i];
    else args._.push(a);
  }
  return args;
}

async function main() {
  const args = parse(process.argv.slice(2));
  const idea = args._.join(' ').trim();
  if (!idea) { console.error('사용법: node bin/forge.js "<아이디어>" [--name slug] [--model gemini-flash] [--judge gemini-pro]'); process.exit(1); }

  const { emit } = createReporter(cliPrinter);
  const name = projectName(idea, args.name, nowStamp());
  const ctx = await scaffold({ name, idea });
  emit('step', { msg: `프로젝트: ${name} — "${idea}"` });

  const r = await forge(ctx, { emit, model: args.model || 'gemini-flash', judge: args.judge || 'gemini-pro' });
  emit('done', { name, dir: `projects/${name}` });
  process.stderr.write(`\n  PRD lint: ${r.prdGate ? 'PASS' : 'FAIL'} · design-verifier: ${r.verdict} · handoff lint: ${r.handoffGate ? 'PASS' : 'FAIL'}\n`);
  process.stderr.write(`  화면 갤러리 열기: projects/${name}/handoff/index.html\n`);
}

main().catch((e) => { console.error('\n[kiln forge] 실패:', e.message); if (e.lastText) console.error(e.lastText.slice(0, 500)); process.exit(1); });
