import { writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { isAgentic } from '../model/agentic.js';
import { judgeHiFi, judgeHiFiAgentic } from '../harness/judge.js';
import { PROJECTS_ROOT } from './project.js';

// Adversarial design-verify, shared by the initial build (design.js) and revisions (revise.js) so
// both get the same render-in-loop safety (C2 착수 ③ · revise 확산). Pixel-vision first: when the
// judge is agentic AND the shoot gate produced PNGs, an independent read-only subagent opens the
// render PNGs and judges the real pixels — atelier's design-verifier. Otherwise — non-agentic judge,
// or npx users with no chromium so no shots — fall back to the source-reading judge; a pixel-verify
// parse/schema miss falls back too. Advisory: writes design-verify.md + emits the gate chip, never
// throws or blocks (the run/revision continues on FAIL).
//
// The caller renders first (runGate('shoot.cjs')) so the PNGs exist; this only judges them. `files`
// is the { path, html } set to judge (all screens for a build, only the changed ones for a revision).
export async function verifyScreens({ ctx, files, contract, judge = 'claude-code', emit, scope = '' }) {
  const shotsDir = join(ctx.dir, '_shots', 'screens');
  const hasShots = files.some((f) => existsSync(join(shotsDir, shotName(f))));
  const pixel = isAgentic(judge) && hasShots;
  emit('step', { msg: `독립 검증(design-verifier${pixel ? ' · 픽셀 vision' : ''})${scope} — 화면 ${files.length}개` });

  let judged;
  if (pixel) {
    try {
      judged = await judgeHiFiAgentic({
        model: judge,
        fixture: contract,
        files,
        screensDir: join(ctx.dir, 'screens'),
        shotsDir,
        verdictPath: join(ctx.dir, 'design-verify.json'),
        cwd: process.cwd(),
        env: { KILN_PROJECTS_ROOT: PROJECTS_ROOT },
        emit,
      });
    } catch (e) {
      emit('warn', { msg: `픽셀 검증 실패(${e.message}) — 소스 판정으로 폴백` });
      judged = await judgeHiFi({ model: judge, fixture: contract, files });
    }
  } else {
    judged = await judgeHiFi({ model: judge, fixture: contract, files });
  }
  emit('model', { stage: 'verify', model: judged.judgeModel, usage: judged.usage, attempts: judged.attempts });

  // Guard: drop any screen the judge invented that wasn't in the set (weak judges hallucinate),
  // then recompute the overall result over the real screens only.
  const verdict = reconcile(judged.verdict, files);
  const evidence = judged.pixel ? '렌더 PNG(픽셀 vision)' : 'HTML 소스';
  await writeFile(join(ctx.dir, 'design-verify.md'), verifyDoc(ctx.name, verdict, evidence));
  const pass = verdict.result === 'PASS';
  emit('gate', { name: 'design-verifier', ok: pass, summary: verdictSummary(verdict) });
  if (!pass) emit('warn', { msg: 'design-verifier FAIL — 재작업 지시는 design-verify.md 참고(데모 계속)' });
  return { verdict };
}

function base(f) {
  return f.path.split('/').pop();
}
function shotName(f) {
  return base(f).replace(/\.html$/i, '.png');
}

// Keep only screens that were actually in the set (basename match), and recompute the result.
function reconcile(verdict, files) {
  const built = new Set(files.map((f) => base(f).replace(/\.html$/, '')));
  const norm = (s) => String(s || '').split('/').pop().replace(/\.html$/, '');
  const screens = (verdict.screens || []).filter((s) => built.has(norm(s.screen)));
  const result = screens.length && screens.every((s) => s.verdict === 'PASS') ? 'PASS' : 'FAIL';
  return { ...verdict, screens, result };
}

function verdictSummary(v) {
  const ng = (v.screens || []).flatMap((s) =>
    Object.entries(s).filter(([, x]) => x === 'ng').map(([k]) => `${s.screen}:${k}`));
  return `${v.result} — ${ng.length ? 'ng ' + ng.join(', ') : '전 항목 ok'}`;
}

function verifyDoc(name, v, evidence = 'HTML 소스') {
  const rows = (v.screens || []).map((s) =>
    `| ${s.screen} | ${s.thin} | ${s.bad} | ${s.variantsIdentical} | ${s.offBrief} | ${s.deadControl} | ${s.stateInert} | ${s.wireframey} | ${s.verdict} |`).join('\n');
  const rework = (v.screens || []).filter((s) => s.verdict === 'FAIL')
    .map((s) => `- ${s.screen}: ${s.notes}`).join('\n') || '- (없음)';
  return `# ${name} — 독립 검증 (design-verifier)

검증자: design-verifier (빌더와 다른 컨텍스트) · 심판 모델 기반 · 근거: ${evidence}

## 화면별 render-check
| 화면 | thin | bad | variantsIdentical | off-brief | deadControl | stateInert | wireframey | 판정 |
|---|---|---|---|---|---|---|---|---|
${rows}

## 재작업 지시
${rework}

## 종합
RESULT: ${v.result}

${v.summary || ''}
`;
}
