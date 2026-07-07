import { CHECK_ITEMS } from './schemas.js';

// Reduce a verdict to a comparable score: the fraction of (screen × check) cells marked
// "ok". A single "ng" fails the screen (design-verifier rule), so `pass` tracks the
// verdict's own result while `okRate` gives a continuous quality signal for ranking.
export function scoreVerdict(verdict) {
  const screens = verdict.screens || [];
  let cells = 0;
  let ok = 0;
  const ngItems = [];
  for (const s of screens) {
    for (const k of CHECK_ITEMS) {
      cells++;
      if (s[k] === 'ok') ok++;
      else ngItems.push(`${s.screen}:${k}`);
    }
  }
  return {
    result: verdict.result,
    pass: verdict.result === 'PASS',
    screens: screens.length,
    cells,
    ok,
    ng: cells - ok,
    okRate: cells ? ok / cells : 0,
    ngItems,
  };
}
