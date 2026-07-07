#!/usr/bin/env node
// Manual mode — 디자인만. 기존 프로젝트(PRD.md 있음)에 tokens + hi-fi + 독립검증.
//
//   node bin/design.js <project> [--model claude-code|codex] [--judge …]

import { createReporter, cliPrinter } from '../engine/pipeline/events.js';
import { loadProject } from '../engine/pipeline/project.js';
import { designStage } from '../engine/pipeline/stages/design.js';

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
  const name = args._[0];
  if (!name) { console.error('사용법: node bin/design.js <project> [--model claude-code|codex] [--judge …]'); process.exit(1); }

  const { emit } = createReporter(cliPrinter);
  const ctx = await loadProject(name);
  const agent = args.model || 'claude-code';
  await designStage(ctx, { emit, model: agent, judge: args.judge || agent });
  emit('done', { name, dir: `projects/${name}` });
}

main().catch((e) => { console.error('\n[kiln design] 실패:', e.message); if (e.lastText) console.error(e.lastText.slice(0, 500)); process.exit(1); });
