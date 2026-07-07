import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { loadFixture } from './fixture.js';
import { buildHiFi } from './build.js';
import { judgeHiFi } from './judge.js';
import { scoreVerdict } from './score.js';

// Roadmap ① — the GO/NO-GO gate. Run the SAME fixture PRD through each variant's hi-fi
// build, score every output with one shared independent judge, then decide whether a
// challenger can stand in for the baseline. Everything below the build/judge line is the
// production model-switcher; the only throwaway is the fixture wiring.
//
// @param {object} cfg
// @param {string[]} cfg.variants     model aliases to compare (e.g. ['claude-code','codex'])
// @param {string}   [cfg.baseline]   the incumbent to beat (default 'opus')
// @param {string}   [cfg.judge]      model that scores every variant (default 'opus')
// @param {string}   [cfg.fixtureName]
// @param {string}   [cfg.outDir]     run root (default 'runs')
// @param {string}   [cfg.runId]      subfolder name (caller supplies a timestamp)
// @param {number}   [cfg.epsilon]    okRate tolerance a challenger may trail baseline by
export async function runAB(cfg) {
  const {
    variants,
    baseline = 'opus',
    judge = 'opus',
    fixtureName = '_fixture',
    outDir = 'runs',
    runId = 'run',
    epsilon = 0,
  } = cfg;

  if (!Array.isArray(variants) || variants.length === 0) {
    throw new Error('runAB: at least one variant is required');
  }

  const fixture = await loadFixture(fixtureName);
  const root = join(outDir, runId);
  const results = [];

  for (const model of variants) {
    const build = await buildHiFi({ model, fixture });
    const judged = await judgeHiFi({ model: judge, fixture, files: build.files });
    const score = scoreVerdict(judged.verdict);

    const dir = join(root, sanitize(model));
    for (const f of build.files) {
      const dest = join(dir, f.path);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, f.html);
    }
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'verdict.json'), JSON.stringify(judged.verdict, null, 2));

    results.push({
      model,
      provider: build.provider,
      buildUsage: build.usage,
      judgeUsage: judged.usage,
      score,
      verdict: judged.verdict,
    });
  }

  const report = compare({ fixtureName, judge, baseline, epsilon, results });
  await mkdir(root, { recursive: true });
  await writeFile(join(root, 'report.json'), JSON.stringify(report, null, 2));
  await writeFile(join(root, 'report.md'), renderReport(report));
  return { root, report };
}

// GO/NO-GO: each non-baseline challenger passes the gate if it PASSes on its own AND its
// okRate is within `epsilon` of the baseline's. Overall gate is GO if any challenger does.
function compare({ fixtureName, judge, baseline, epsilon, results }) {
  const byModel = Object.fromEntries(results.map((r) => [r.model, r]));
  const base = byModel[baseline];
  const ranked = [...results].sort((a, b) => b.score.okRate - a.score.okRate);

  const challengers = results
    .filter((r) => r.model !== baseline)
    .map((r) => {
      const meetsBaseline = base ? r.score.okRate >= base.score.okRate - epsilon : null;
      const go = r.score.pass && (base ? meetsBaseline : true);
      return {
        model: r.model,
        pass: r.score.pass,
        okRate: r.score.okRate,
        deltaVsBaseline: base ? r.score.okRate - base.score.okRate : null,
        meetsBaseline,
        decision: go ? 'GO' : 'NO-GO',
      };
    });

  return {
    fixture: fixtureName,
    judge,
    baseline: baseline in byModel ? baseline : null,
    epsilon,
    gate: challengers.some((c) => c.decision === 'GO') ? 'GO' : 'NO-GO',
    winner: ranked[0]?.model ?? null,
    ranking: ranked.map((r) => ({
      model: r.model,
      provider: r.provider,
      result: r.score.result,
      okRate: r.score.okRate,
      ng: r.score.ng,
      ngItems: r.score.ngItems,
    })),
    challengers,
  };
}

function renderReport(report) {
  const pct = (n) => `${(n * 100).toFixed(1)}%`;
  const lines = [];
  lines.push(`# Kiln A/B — roadmap ① Gemini 품질 게이트`);
  lines.push('');
  lines.push(`- fixture: \`${report.fixture}\``);
  lines.push(`- judge: \`${report.judge}\``);
  lines.push(`- baseline: \`${report.baseline ?? '(none)'}\`  · epsilon: ${report.epsilon}`);
  lines.push('');
  lines.push(`## 결과: **${report.gate}**  (winner: \`${report.winner}\`)`);
  lines.push('');
  lines.push(`### Ranking`);
  lines.push('| model | provider | result | ok-rate | ng | ng items |');
  lines.push('|---|---|---|---|---|---|');
  for (const r of report.ranking) {
    lines.push(`| \`${r.model}\` | ${r.provider} | ${r.result} | ${pct(r.okRate)} | ${r.ng} | ${r.ngItems.join(', ') || '—'} |`);
  }
  lines.push('');
  if (report.challengers.length) {
    lines.push(`### Challengers vs baseline`);
    lines.push('| model | decision | pass | ok-rate | Δ vs baseline |');
    lines.push('|---|---|---|---|---|');
    for (const c of report.challengers) {
      const d = c.deltaVsBaseline === null ? '—' : `${c.deltaVsBaseline >= 0 ? '+' : ''}${pct(c.deltaVsBaseline)}`;
      lines.push(`| \`${c.model}\` | **${c.decision}** | ${c.pass} | ${pct(c.okRate)} | ${d} |`);
    }
    lines.push('');
  }
  lines.push(`> GO = 챌린저가 자체 PASS이고 baseline 대비 ok-rate가 epsilon 이내. 이 표가 프로덕션 모델 스위처 승격 근거다.`);
  return lines.join('\n') + '\n';
}

function sanitize(s) {
  return String(s).replace(/[^a-z0-9._-]/gi, '_');
}
