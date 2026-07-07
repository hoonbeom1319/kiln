#!/usr/bin/env node
// Manual mode — 기획만. idea → PRD.md (+ lint-prd gate).
//
//   node bin/plan.js "<아이디어>" [--name slug] [--model gemini-pro|gemini-flash]

import { createReporter, cliPrinter } from '../engine/pipeline/events.js';
import { projectName, scaffold, nowStamp } from '../engine/pipeline/project.js';
import { prdStage } from '../engine/pipeline/stages/prd.js';

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
  if (!idea) { console.error('사용법: node bin/plan.js "<아이디어>" [--name slug] [--model gemini-pro]'); process.exit(1); }

  const { emit } = createReporter(cliPrinter);
  const name = projectName(idea, args.name, nowStamp());
  const ctx = await scaffold({ name, idea });
  emit('step', { msg: `프로젝트: ${name}` });

  const model = args.model || 'gemini-pro';
  const r = await prdStage(ctx, { emit, model });
  emit('done', { name, dir: `projects/${name}` });
  process.exit(r.gate ? 0 : 2);
}

main().catch((e) => { console.error('\n[kiln plan] 실패:', e.message); if (e.lastText) console.error(e.lastText.slice(0, 500)); process.exit(1); });
