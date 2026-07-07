import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../../model/generate.js';
import { runGate, gateSummary } from '../gates.js';
import { noteStatus } from '../project.js';
import { prdSystem, prdPrompt } from '../prompts/prd.js';

// Stage 1 — 기획. idea → PRD.md, gated by lint-prd (blocking, one repair on failure).
// Shared by `kiln plan` (manual) and `kiln forge` (unattended): same function, same gate.
export async function prdStage(ctx, { emit, model = 'gemini-pro', maxTokens = 12000 } = {}) {
  emit('phase', { name: 'PRD' });
  const prdPath = join(ctx.dir, 'PRD.md');

  const write = async (feedback) => {
    emit('step', { msg: feedback ? 'PRD 개정(게이트 지적 반영)' : 'PRD 초안 생성' });
    const res = await generate(prdPrompt(ctx.idea, feedback), { model, system: prdSystem, maxTokens });
    emit('model', { stage: 'prd', model: res.model, usage: res.usage, attempts: res.attempts });
    await writeFile(prdPath, res.text.trim() + '\n');
    emit('artifact', { path: `projects/${ctx.name}/PRD.md`, kind: 'prd' });
  };

  await write();
  let gate = await runGate('lint-prd.cjs', ctx.name);
  emit('gate', { name: 'lint-prd', ok: gate.ok, summary: gateSummary(gate.output) });

  // One repair pass: feed the gate's own report back to the model.
  if (!gate.ok) {
    await write(gate.output);
    gate = await runGate('lint-prd.cjs', ctx.name);
    emit('gate', { name: 'lint-prd', ok: gate.ok, summary: gateSummary(gate.output) });
  }

  await noteStatus(ctx.dir, `기획: PRD.md (lint-prd ${gate.ok ? 'PASS' : 'FAIL'})`);
  if (!gate.ok) emit('warn', { msg: 'lint-prd 미통과 — PRD를 보완해야 하지만 데모 계속 진행' });
  return { prdPath, gate: gate.ok, gateOutput: gate.output };
}
