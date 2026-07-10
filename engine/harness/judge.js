import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { generate } from '../model/generate.js';
import { runAgentic } from '../model/agentic.js';
import { extractJSON, validate } from '../model/schema.js';
import { VERDICT_SCHEMA } from './schemas.js';
import { judgeSystem, judgePrompt, judgeAgenticSystem, judgeAgenticTask } from './prompts.js';

// Score one variant's hi-fi output with the independent design-verifier logic.
// Temperature 0 — judging should be as deterministic as the model allows.
export async function judgeHiFi({ model, fixture, files }) {
  const res = await generate(judgePrompt(fixture, files), {
    model,
    schema: VERDICT_SCHEMA,
    system: judgeSystem,
    temperature: 0,
  });
  return { verdict: res.data, judgeModel: res.model, usage: res.usage, attempts: res.attempts };
}

// Pixel-vision design-verify (C2 착수 ③). Unlike judgeHiFi (which reads HTML source), this runs an
// independent read-only claude-code subagent that opens the render PNGs (_shots/*.png) with the Read
// tool and judges the actual pixels — atelier's adversarial design-verifier restored. The caller
// (design.js) resolves the pipeline paths (screensDir/shotsDir/env) so this module stays decoupled
// from the projects root. Returns the SAME shape as judgeHiFi so design.js's reconcile/doc/gate are
// unchanged. Throws on a missing/invalid verdict so the caller can fall back to the source judge.
export async function judgeHiFiAgentic({ model, fixture, files, screensDir, shotsDir, verdictPath, cwd, env, emit, maxTurns }) {
  const screens = files.map((f) => {
    const base = f.path.split('/').pop(); // e.g. index.html
    const name = base.replace(/\.html$/i, '');
    const shotPath = join(shotsDir, `${name}.png`);
    return { name, htmlPath: join(screensDir, base), shotPath, hasShot: existsSync(shotPath) };
  });

  const out = await runAgentic(judgeAgenticTask({ fixture, screens, verdictPath }), {
    model,
    system: judgeAgenticSystem,
    // Read (open PNGs + source) + Write (its verdict file only). No Edit/Bash — it can look at the
    // screens but not modify the ones it judges, so it stays an independent verifier.
    tools: ['Read', 'Write'],
    maxTurns: maxTurns ?? Number(process.env.KILN_VERIFY_MAX_TURNS || 8),
    cwd, // repo root — same as the build agent, so shot/source paths resolve
    addDir: cwd, // grant reads across the project dir + writing the verdict file
    env,
    onEvent: emit ? (kind, data) => emit(kind, data) : undefined,
  });

  const verdict = await readVerdict(verdictPath, out.result);
  return { verdict, judgeModel: out.model, usage: out.usage, attempts: out.turns || 1, pixel: true };
}

// Read the verdict the agent wrote to disk (deterministic — models narrate instead of emitting
// clean JSON in the final message). Fall back to parsing the agent's last message if the file is
// missing/malformed, and throw only when neither yields a schema-valid verdict — then design.js
// falls back to the source-reading judge.
async function readVerdict(verdictPath, resultText) {
  const sources = [];
  if (verdictPath) {
    try {
      sources.push(await readFile(verdictPath, 'utf8'));
    } catch { /* not written — fall through to the message text */ }
  }
  if (resultText) sources.push(resultText);

  let lastErr;
  for (const text of sources) {
    try {
      const data = extractJSON(text);
      const { ok, errors } = validate(VERDICT_SCHEMA, data);
      if (ok) return data;
      lastErr = new Error(`판정 스키마 불일치: ${errors.join('; ')}`);
    } catch (e) {
      lastErr = e;
    }
  }
  const err = new Error(`픽셀 검증 판정을 읽지 못함: ${lastErr?.message || '판정 파일/메시지 없음'}`);
  err.lastText = resultText;
  throw err;
}
