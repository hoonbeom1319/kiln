#!/usr/bin/env node
// Manual mode — 채팅형 개정. 기존 프로젝트에 자연어 피드백을 걸어 전역 컨텍스트 인지 재생성 + 새 버전.
//
//   node bin/revise.js <project> "<피드백>" [--model claude-code|codex] [--planner …]
//
// 웹 chat UI와 같은 reviseStage를 재사용한다(구현 1개).

import { createReporter, cliPrinter } from '../engine/pipeline/events.js';
import { loadProject } from '../engine/pipeline/project.js';
import { reviseStage } from '../engine/pipeline/stages/revise.js';

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
  const feedback = args._.slice(1).join(' ').trim();
  if (!name || !feedback) {
    console.error('사용법: node bin/revise.js <project> "<피드백>" [--model claude-code|codex] [--planner …]');
    process.exit(1);
  }

  const { emit } = createReporter(cliPrinter);
  const ctx = await loadProject(name);
  const agent = args.model || 'claude-code';
  const r = await reviseStage(ctx, {
    feedback,
    emit,
    model: agent,
    planner: args.planner || agent,
  });
  emit('done', { name, dir: `projects/${name}` });
  process.stderr.write(`\n  개정 v${r.version} · 변경 산출물 ${r.changed.length}개 · 화면 ${r.screens.length}개\n`);
  process.stderr.write(`  갤러리: projects/${name}/handoff/index.html · 버전: projects/${name}/versions/\n`);
}

main().catch((e) => { console.error('\n[kiln revise] 실패:', e.message); if (e.lastText) console.error(e.lastText.slice(0, 500)); process.exit(1); });
