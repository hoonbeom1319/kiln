import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { DEFAULTS } from '../src/config.js';

// Load the atelier _fixture contract — the same PRD/flow/tokens that every variant in an
// A/B run must satisfy. Reading straight from ../atelier means the harness measures
// against the real fixture, never a stale copy.
export async function loadFixture(name = '_fixture', atelierDir = DEFAULTS.atelierDir) {
  const dir = resolve(atelierDir, 'projects', name);
  const [prd, flow, tokens] = await Promise.all([
    readFile(join(dir, 'PRD.md'), 'utf8'),
    readFile(join(dir, '00-flow.md'), 'utf8'),
    readFile(join(dir, 'foundation', 'tokens.css'), 'utf8'),
  ]);
  return { name, dir, prd, flow, tokens };
}
