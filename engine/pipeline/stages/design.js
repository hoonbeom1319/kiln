import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { generate } from '../../model/generate.js';
import { isAgentic } from '../../model/agentic.js';
import { buildScreens, buildScreensAgentic } from '../build-screens.js';
import { verifyScreens } from '../verify.js';
import { runGate, gateSummary } from '../gates.js';
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

  // Agentic-first, one-shot fallback (DECISIONS: C2 착수 ②). When the selected agent supports a
  // tool loop (claude-code), the agent builds screens and self-corrects them against the real
  // render (shoot as a Bash tool) — atelier's render-in-loop. Otherwise fall back to the one-shot
  // builder + the engine's external shoot gate below (codex/echo/hosted). Both return { files },
  // so everything downstream (blank guard, gate, verifier, traceability) is identical.
  const contract = { name: ctx.name, prd, flow, tokens };
  const agentic = isAgentic(model);
  emit('step', { msg: agentic ? '하이파이 화면 빌드 (렌더-인-루프 자가수정)' : '하이파이 화면 빌드' });
  const build = agentic
    ? await buildScreensAgentic({ model, contract, ctx, emit })
    : await buildScreens({ model, contract });
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

  // Render gate (shoot) — the pixel-level check the source-reading guards above can't do: render
  // each screen headless and catch renders that are blank/near-white even when the HTML source
  // looks fine, and drop the PNGs to _shots/ (input for a later vision pass). Advisory like the
  // design-verifier below: reports + shows a chip, never blocks. Skips gracefully (exit 0) when
  // chromium isn't installed — so npx users who haven't run `playwright install` just see a skip.
  emit('step', { msg: `렌더 게이트(shoot) — 화면 ${build.files.length}개` });
  const shot = await runGate('shoot.cjs', ctx.name);
  emit('gate', { name: 'render-shoot', ok: shot.ok, summary: gateSummary(shot.output) });
  if (!shot.ok) {
    emit('warn', {
      msg: '렌더 게이트 blank 감지 — 아래 리포트 확인(데모 계속)\n' +
        shot.output.split('\n').filter((l) => l.includes('❌')).join('\n'),
    });
  }
  for (const f of build.files) {
    const shotRel = `_shots/${f.path.replace(/\.html$/i, '.png')}`;
    if (existsSync(join(ctx.dir, shotRel))) {
      emit('artifact', { path: `projects/${ctx.name}/${shotRel}`, kind: 'shot' });
    }
  }

  // Design-verify — adversarial, pixel-vision first (C2 착수 ③). Shared with revise.js via
  // verifyScreens: opens the render PNGs shot above and judges the real pixels with an independent
  // subagent (falls back to the source-reading judge when non-agentic / no shots / parse miss).
  // Advisory — writes design-verify.md + emits the gate, never blocks.
  const { verdict } = await verifyScreens({ ctx, files: build.files, contract, judge, emit });

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
