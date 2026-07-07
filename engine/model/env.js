import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env loader — no dependency. Reads KEY=VALUE lines and fills process.env
// without clobbering values already set. Loads .env then .env.local (local wins, and is
// gitignored — the usual place for real keys). Kept tiny: the offline path needs no install.
// Order matters: first file to set a key wins (we never clobber), so .env.local is read
// before .env to give it precedence, and real env vars outrank both.
let loaded = false;
export function loadEnv(files = ['.env.local', '.env']) {
  if (loaded) return;
  loaded = true;
  for (const file of files) loadFile(file);
}

function loadFile(file) {
  let text;
  try {
    text = readFileSync(resolve(process.cwd(), file), 'utf8');
  } catch {
    return; // absent — skip
  }
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
