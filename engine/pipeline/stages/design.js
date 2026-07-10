import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { generate } from '../../model/generate.js';
import { buildScreens } from '../build-screens.js';
import { judgeHiFi } from '../../harness/judge.js';
import { noteStatus } from '../project.js';
import { tokensSystem, tokensPrompt, flowSystem, flowPrompt } from '../prompts/design.js';
import { mapTraceability } from '../traceability.js';

// Stage 2 — 디자인. PRD → tokens.css + 00-flow.md → hi-fi 화면(build) → 독립 검증(judge).
// Reuses the harness build.js/judge.js. The design-verifier gate is advisory for the MVP demo
// — a FAIL records rework notes but does not block. Default model = judge = the user's local
// agent (BYO); pass a different judge only for a hosted A/B comparison.
export async function designStage(ctx, { emit, model = 'claude-code', judge = 'claude-code' } = {}) {
  emit('phase', { name: 'Design' });
  const prd = await readFile(join(ctx.dir, 'PRD.md'), 'utf8');

  emit('step', { msg: '디자인 토큰 생성' });
  const tk = await generate(tokensPrompt(prd), { model, system: tokensSystem, maxTokens: 4000 });
  emit('model', { stage: 'tokens', model: tk.model, usage: tk.usage, attempts: tk.attempts });
  const tokens = stripFence(tk.text).trim() + '\n';
  await mkdir(join(ctx.dir, 'foundation'), { recursive: true });
  await writeFile(join(ctx.dir, 'foundation', 'tokens.css'), tokens);
  emit('artifact', { path: `projects/${ctx.name}/foundation/tokens.css` });

  emit('step', { msg: '흐름 계약(00-flow.md) 생성' });
  const fl = await generate(flowPrompt(prd), { model, system: flowSystem, maxTokens: 3000 });
  emit('model', { stage: 'flow', model: fl.model, usage: fl.usage, attempts: fl.attempts });
  const flow = stripFence(fl.text).trim() + '\n';
  await writeFile(join(ctx.dir, '00-flow.md'), flow);
  emit('artifact', { path: `projects/${ctx.name}/00-flow.md` });

  emit('step', { msg: '하이파이 화면 빌드' });
  const contract = { name: ctx.name, prd, flow, tokens };
  const build = await buildScreens({ model, contract });
  emit('model', { stage: 'hi-fi', model: build.model, usage: build.usage, attempts: build.attempts });
  for (const f of build.files) {
    const dest = join(ctx.dir, f.path);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, f.html);
    emit('artifact', { path: `projects/${ctx.name}/${f.path}`, kind: 'screen' });
  }

  // Deterministic blank-screen guard — separate from the subjective design-verifier below.
  // Catches the failure mode behind "완료인데 흰 화면": the agent returns empty/near-empty
  // shells or a refusal, yet the run finishes "done". A fully-blank build fails hard here so the
  // user sees a clear error instead of a white gallery; a partial blank warns + shows a red chip.
  const blanks = build.files.filter((f) => isBlankScreen(f.html));
  emit('gate', {
    name: 'screens-nonblank',
    ok: blanks.length === 0,
    summary:
      blanks.length === 0
        ? `전 화면 내용 있음 (${build.files.length}개)`
        : `빈 화면 ${blanks.length}/${build.files.length}: ${blanks.map(fileBase).join(', ')}`,
  });
  if (blanks.length === build.files.length) {
    throw new Error(
      `생성된 화면 ${build.files.length}개가 모두 비어 있습니다 — 로컬 에이전트가 화면 HTML을 제대로 만들지 못했습니다. 다시 시도하거나 다른 에이전트/모델을 선택해 주세요.`,
    );
  }
  if (blanks.length) {
    emit('warn', { msg: `빈 화면 감지: ${blanks.map(fileBase).join(', ')} — 재생성을 권장합니다` });
  }

  emit('step', { msg: `독립 검증(design-verifier) — 화면 ${build.files.length}개` });
  const judged = await judgeHiFi({ model: judge, fixture: contract, files: build.files });
  emit('model', { stage: 'verify', model: judged.judgeModel, usage: judged.usage, attempts: judged.attempts });
  // Guard: drop any screen the judge invented that wasn't in the build (weak judges
  // hallucinate), then recompute the overall result over the real screens only.
  const verdict = reconcile(judged.verdict, build.files);
  await writeFile(join(ctx.dir, 'design-verify.md'), verifyDoc(ctx.name, verdict));
  const pass = verdict.result === 'PASS';
  emit('gate', { name: 'design-verifier', ok: pass, summary: verdictSummary(verdict) });
  if (!pass) emit('warn', { msg: 'design-verifier FAIL — 재작업 지시는 design-verify.md 참고(데모 계속)' });

  // PRD ↔ screen traceability: one short line per screen saying which PRD requirement it
  // reflects. Feeds the gallery annotation and (later) revise's requirement↔screen sync.
  emit('step', { msg: 'PRD↔화면 traceability 매핑' });
  const trace = await mapTraceability({ model, prd, files: build.files });
  emit('model', { stage: 'trace', model: trace.model, usage: trace.usage, attempts: trace.attempts });
  await writeFile(join(ctx.dir, 'traceability.json'), JSON.stringify(trace.map, null, 2) + '\n');
  emit('artifact', { path: `projects/${ctx.name}/traceability.json`, kind: 'traceability' });

  await noteStatus(ctx.dir, `디자인: tokens + ${build.files.length}화면 (verifier ${verdict.result})`);
  return { files: build.files, verdict, contract, traceability: trace.map };
}

// Keep only screens that were actually built (basename match), and recompute the result.
function reconcile(verdict, files) {
  const built = new Set(files.map((f) => f.path.split('/').pop().replace(/\.html$/, '')));
  const norm = (s) => String(s || '').split('/').pop().replace(/\.html$/, '');
  const screens = (verdict.screens || []).filter((s) => built.has(norm(s.screen)));
  const result = screens.length && screens.every((s) => s.verdict === 'PASS') ? 'PASS' : 'FAIL';
  return { ...verdict, screens, result };
}

function fileBase(f) {
  return f.path.split('/').pop();
}

// A hi-fi screen has real body content — dozens of elements and real copy. Trip only on a
// genuinely empty/near-empty shell (agent refusal or truncated output), never a legit screen,
// so this can gate the run without false-failing good builds. (Calibrated against the packaged
// example screens: ~50+ body elements, hundreds of visible chars each.)
function isBlankScreen(html) {
  const m = String(html).match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const body = m ? m[1] : String(html);
  const elements = (body.match(/<[a-zA-Z]/g) || []).length;
  const text = body
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return elements < 8 || text.length < 30;
}

function stripFence(text) {
  const m = String(text).match(/```(?:\w+)?\s*([\s\S]*?)```/);
  return m ? m[1] : text;
}

function verdictSummary(v) {
  const ng = (v.screens || []).flatMap((s) =>
    Object.entries(s).filter(([, x]) => x === 'ng').map(([k]) => `${s.screen}:${k}`));
  return `${v.result} — ${ng.length ? 'ng ' + ng.join(', ') : '전 항목 ok'}`;
}

function verifyDoc(name, v) {
  const rows = (v.screens || []).map((s) =>
    `| ${s.screen} | ${s.thin} | ${s.bad} | ${s.variantsIdentical} | ${s.offBrief} | ${s.deadControl} | ${s.stateInert} | ${s.wireframey} | ${s.verdict} |`).join('\n');
  const rework = (v.screens || []).filter((s) => s.verdict === 'FAIL')
    .map((s) => `- ${s.screen}: ${s.notes}`).join('\n') || '- (없음)';
  return `# ${name} — 독립 검증 (design-verifier)

검증자: design-verifier (빌더와 다른 컨텍스트) · 심판 모델 기반

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
