#!/usr/bin/env node
// Kiln A/B CLI — roadmap ① Gemini 품질 게이트.
//
//   node bin/ab.js                                   # offline dry-run (echo,echo) — no keys
//   node bin/ab.js --variants gemini-pro,opus        # the real A/B
//   node bin/ab.js --variants gemini-pro,opus --judge opus --baseline opus --epsilon 0.05
//
// Flags:
//   --variants a,b     model aliases to compare      (default echo,echo)
//   --baseline name    incumbent to beat             (default opus)
//   --judge name       model that scores everyone     (default opus)
//   --fixture name     atelier project fixture        (default _fixture)
//   --epsilon n        ok-rate tolerance for GO       (default 0)
//   --out dir          run root                       (default runs)

import { runAB } from '../engine/harness/ab.js';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) out[a.slice(2)] = argv[++i];
  }
  return out;
}

function timestamp() {
  // Local ISO-ish stamp, filesystem-safe. (Runs as a normal CLI, so Date is available.)
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const variants = (args.variants || 'echo,echo').split(',').map((s) => s.trim()).filter(Boolean);
  const baseline = args.baseline || (variants.includes('opus') ? 'opus' : variants[variants.length - 1]);

  const cfg = {
    variants,
    baseline,
    judge: args.judge || (variants.includes('opus') ? 'opus' : 'echo'),
    fixtureName: args.fixture || '_fixture',
    epsilon: args.epsilon !== undefined ? Number(args.epsilon) : 0,
    outDir: args.out || 'runs',
    runId: timestamp(),
  };

  console.error(`[kiln-ab] variants=${cfg.variants.join(',')} judge=${cfg.judge} baseline=${cfg.baseline}`);
  const { root, report } = await runAB(cfg);

  console.log(`\nGATE: ${report.gate}   winner: ${report.winner}`);
  for (const r of report.ranking) {
    console.log(`  ${r.result.padEnd(4)} ${(r.okRate * 100).toFixed(1).padStart(5)}%  ${r.model}`);
  }
  console.log(`\nreport → ${root}/report.md`);
}

main().catch((e) => {
  console.error('[kiln-ab] failed:', e.message);
  if (e.lastText) console.error('--- last model output ---\n', e.lastText.slice(0, 800));
  process.exit(1);
});
