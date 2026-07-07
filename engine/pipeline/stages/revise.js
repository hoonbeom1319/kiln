import { mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { generate } from '../../model/generate.js';
import { buildRevised } from '../build-screens.js';
import { handoffStage } from './handoff.js';
import { mapTraceability } from '../traceability.js';
import { noteStatus } from '../project.js';
import { runGate, gateSummary } from '../gates.js';
import { ensureBaseline, commitRevision, readLog, historyText } from '../versions.js';
import {
  planSystem, planSchema, planPrompt,
  prdReviseSystem, prdRevisePrompt,
  tokensReviseSystem, tokensRevisePrompt,
  flowReviseSystem, flowRevisePrompt,
} from '../prompts/revise.js';

// Stage R — 채팅형 개정. Reasons over the WHOLE project, decides scope, regenerates only the
// affected artifacts while keeping everything coherent, and stacks the result as a new version
// (compare/rollback via engine/pipeline/versions.js). Shared verbatim by bin/revise.js (manual)
// and the web job registry (chat UI) — one implementation, same as every other stage.
//
// Coherence rules the apply step enforces regardless of the plan's phrasing:
//   scope.tokens ⇒ EVERY screen rebuilds (screens inline tokens).
//   scope.flow   ⇒ screen set reconciled to the new flow (add new, drop removed).
//   otherwise    ⇒ only the named screens rebuild, with siblings as visual reference.
/**
 * @param {{name:string,dir:string,idea?:string}} ctx
 * @param {{feedback:string, emit:Function, model?:string, planner?:string}} opts
 */
export async function reviseStage(ctx, { feedback, emit, model = 'gemini-flash', planner = 'gemini-pro' } = {}) {
  emit('phase', { name: 'Revise' });
  emit('step', { msg: `피드백: "${feedback}"` });

  const before = await loadContext(ctx);
  const log = await readLog(ctx.dir);
  await ensureBaseline(ctx.dir); // archive the pre-revision baseline (v1) once

  // Step 1 — PLAN: scope the change over the full context + conversation history.
  emit('step', { msg: '개정 범위 판단(plan)' });
  const planRes = await generate(
    planPrompt({
      idea: before.idea,
      prd: before.prd,
      flow: before.flow,
      tokens: before.tokens,
      screens: before.screens.map((s) => ({ file: s.file, title: s.title, reflects: s.reflects })),
      history: historyText(log),
      feedback,
    }),
    // Headroom: gemini-2.5-pro is a thinking model — a tight cap lets reasoning tokens eat the
    // budget and truncate the JSON body. Give the small plan plenty of room after thinking.
    { model: planner, system: planSystem, schema: planSchema, maxTokens: 8000 },
  );
  emit('model', { stage: 'revise-plan', model: planRes.model, usage: planRes.usage, attempts: planRes.attempts });
  const plan = planRes.data;
  emit('step', { msg: `계획: ${plan.note}` });

  const changed = [];

  // Step 2a — PRD (incremental). Re-lint so a new requirement can't silently break the gate.
  if (plan.scope?.prd) {
    emit('step', { msg: 'PRD 개정' });
    const res = await generate(prdRevisePrompt({ prd: before.prd, feedback, guidance: plan.guidance }), {
      model: planner, system: prdReviseSystem, maxTokens: 12000,
    });
    emit('model', { stage: 'revise-prd', model: res.model, usage: res.usage, attempts: res.attempts });
    await writeFile(join(ctx.dir, 'PRD.md'), res.text.trim() + '\n');
    emit('artifact', { path: `projects/${ctx.name}/PRD.md`, kind: 'prd' });
    changed.push('PRD.md');
    const gate = await runGate('lint-prd.cjs', ctx.name);
    emit('gate', { name: 'lint-prd', ok: gate.ok, summary: gateSummary(gate.output) });
  }

  // Reload PRD so token/flow/screen regen sees the updated requirements.
  const prd = plan.scope?.prd ? await readText(join(ctx.dir, 'PRD.md')) : before.prd;

  // Step 2b — tokens (incremental, names preserved so screens keep referencing them).
  let tokens = before.tokens;
  if (plan.scope?.tokens) {
    emit('step', { msg: '디자인 토큰 개정(→ 전 화면 재생성)' });
    const res = await generate(tokensRevisePrompt({ tokens: before.tokens, prd, feedback, guidance: plan.guidance }), {
      model, system: tokensReviseSystem, maxTokens: 8000, // headroom: flash thinking must not truncate the css body
    });
    emit('model', { stage: 'revise-tokens', model: res.model, usage: res.usage, attempts: res.attempts });
    tokens = stripFence(res.text).trim() + '\n';
    await mkdir(join(ctx.dir, 'foundation'), { recursive: true });
    await writeFile(join(ctx.dir, 'foundation', 'tokens.css'), tokens);
    emit('artifact', { path: `projects/${ctx.name}/foundation/tokens.css` });
    changed.push('foundation/tokens.css');
  }

  // Step 2c — flow (add/remove/rename screens).
  let flow = before.flow;
  if (plan.scope?.flow) {
    emit('step', { msg: '흐름(00-flow.md) 개정' });
    const res = await generate(flowRevisePrompt({ flow: before.flow, prd, feedback, guidance: plan.guidance }), {
      model, system: flowReviseSystem, maxTokens: 8000, // headroom (thinking) so the flow body isn't truncated
    });
    emit('model', { stage: 'revise-flow', model: res.model, usage: res.usage, attempts: res.attempts });
    flow = stripFence(res.text).trim() + '\n';
    await writeFile(join(ctx.dir, '00-flow.md'), flow);
    emit('artifact', { path: `projects/${ctx.name}/00-flow.md` });
    changed.push('00-flow.md');
  }

  // Step 3 — decide which screens to (re)build and reconcile the screen set to the flow.
  const existing = before.screens.map((s) => s.file);
  const intended = plan.scope?.flow ? flowScreens(flow) : existing;
  const removed = existing.filter((f) => !intended.includes(f));
  for (const f of removed) {
    await rm(join(ctx.dir, 'screens', f), { force: true });
    emit('step', { msg: `화면 제거: ${f}` });
    changed.push(`screens/${f} (제거)`);
  }
  const added = intended.filter((f) => !existing.includes(f));
  const named = (plan.screens || []).map(basename).filter((f) => intended.includes(f));
  // tokens change ⇒ rebuild everything; else the union of newly-added and explicitly-named.
  const targetFiles = unique(plan.scope?.tokens ? intended : [...added, ...named]);

  const contract = { name: ctx.name, prd, flow, tokens };
  if (targetFiles.length) {
    emit('step', { msg: `화면 재생성: ${targetFiles.join(', ')}` });
    await mkdir(join(ctx.dir, 'screens'), { recursive: true });
    const siblings = before.screens.filter((s) => !targetFiles.includes(s.file));
    const built = new Map(); // file -> html, accumulated across passes

    // A single generate() may not emit every requested hi-fi screen (large blocks, thinking
    // budget). Loop until all targets are produced: each pass re-requests only the missing
    // ones, and hands the screens already rebuilt THIS revision as extra references so late
    // stragglers match the new look — coherence holds across passes, not just within a call.
    for (let pass = 0; pass < 3; pass++) {
      const remaining = targetFiles.filter((f) => !built.has(f));
      if (!remaining.length) break;
      const targets = remaining.map((f) => ({
        path: `screens/${f}`,
        html: before.screens.find((s) => s.file === f)?.html || '',
      }));
      const references = [...siblings, ...[...built.entries()].map(([file, html]) => ({ file, html }))].map(
        (s) => ({ path: `screens/${s.file}`, html: s.html }),
      );
      const build = await buildRevised({ model, contract, targets, references, guidance: plan.guidance });
      emit('model', { stage: 'revise-build', model: build.model, usage: build.usage, attempts: build.attempts });
      for (const f of build.files) {
        const file = f.path.split('/').pop();
        if (remaining.includes(file) && !built.has(file)) built.set(file, f.html);
      }
    }

    for (const file of targetFiles) {
      const html = built.get(file);
      if (!html) {
        emit('warn', { msg: `화면 재생성 누락: ${file} — 이전 버전 유지(다음 개정에서 재시도 가능)` });
        continue;
      }
      await writeFile(join(ctx.dir, 'screens', file), html);
      emit('artifact', { path: `projects/${ctx.name}/screens/${file}`, kind: 'screen' });
      changed.push(`screens/${file}`);
    }
  }

  // Step 4 — refresh PRD↔screen traceability over the current full screen set.
  const files = await currentScreens(ctx.dir);
  if (files.length) {
    emit('step', { msg: 'PRD↔화면 traceability 갱신' });
    const trace = await mapTraceability({ model, prd, files });
    emit('model', { stage: 'revise-trace', model: trace.model, usage: trace.usage, attempts: trace.attempts });
    await writeFile(join(ctx.dir, 'traceability.json'), JSON.stringify(trace.map, null, 2) + '\n');
    emit('artifact', { path: `projects/${ctx.name}/traceability.json`, kind: 'traceability' });
  }

  // Step 5 — re-pack handoff so the gallery/handoff reflect the revision (handoff is derived).
  await handoffStage(ctx, { emit });

  // Step 6 — stack the new version and record the chat turn.
  const { version } = await commitRevision(ctx.dir, {
    feedback, plan, note: plan.note, changed, at: Date.now(),
  });
  await noteStatus(ctx.dir, `개정 v${version}: ${plan.note} (${changed.length}개 산출물)`);
  emit('revision', { version, note: plan.note, changed, feedback });
  return { version, plan, changed, screens: files };
}

// --- context loading ---

async function loadContext(ctx) {
  const idea = ctx.idea || (await readText(join(ctx.dir, 'idea.txt')));
  const prd = await readText(join(ctx.dir, 'PRD.md'));
  const flow = await readText(join(ctx.dir, '00-flow.md'));
  const tokens = await readText(join(ctx.dir, 'foundation', 'tokens.css'));
  const trace = await readJson(join(ctx.dir, 'traceability.json'));
  const traceByFile = new Map((trace?.screens || []).map((s) => [s.file, s]));
  const files = await currentScreens(ctx.dir);
  const screens = files.map((f) => {
    const hit = traceByFile.get(f.file);
    return { file: f.file, html: f.html, title: hit?.title || '', reflects: hit?.reflects || '' };
  });
  return { idea, prd, flow, tokens, screens };
}

async function currentScreens(dir) {
  const sdir = join(dir, 'screens');
  if (!existsSync(sdir)) return [];
  const names = (await readdir(sdir)).filter((f) => f.toLowerCase().endsWith('.html')).sort(indexFirst);
  return Promise.all(names.map(async (file) => ({ path: `screens/${file}`, file, html: await readText(join(sdir, file)) })));
}

// Parse the hi-fi 화면 table in 00-flow.md for its screen filenames (`index.html`, …).
function flowScreens(flow) {
  const found = [...String(flow).matchAll(/`([a-z0-9_]+\.html)`/gi)].map((m) => m[1].toLowerCase());
  return unique(found).sort(indexFirst);
}

// index.html first (entry point), then alphabetical — a stable, meaningful order.
function indexFirst(a, b) {
  if (a === 'index.html') return -1;
  if (b === 'index.html') return 1;
  return a.localeCompare(b);
}

async function readText(p) {
  return existsSync(p) ? readFile(p, 'utf8') : '';
}
async function readJson(p) {
  if (!existsSync(p)) return null;
  try { return JSON.parse(await readFile(p, 'utf8')); } catch { return null; }
}
// Strip a wrapping code fence tolerantly: models sometimes add an opening ```lang without a
// closing ``` (or vice-versa). Remove either independently so a stray fence never corrupts a
// generated tokens.css / 00-flow.md.
function stripFence(text) {
  return String(text)
    .trim()
    .replace(/^```[\w-]*[ \t]*\r?\n?/, '')
    .replace(/\r?\n?```[ \t]*$/, '');
}
function basename(p) {
  return String(p).split('/').pop();
}
function unique(arr) {
  return [...new Set(arr)];
}
