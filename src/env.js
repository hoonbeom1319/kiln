import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Minimal .env loader — no dependency. Reads KEY=VALUE lines from ./.env (if present)
// and fills process.env without clobbering values already set in the real environment.
// Kept tiny on purpose: the offline (echo) path must run with zero installs.
let loaded = false;
export function loadEnv(file = '.env') {
  if (loaded) return;
  loaded = true;
  let text;
  try {
    text = readFileSync(resolve(process.cwd(), file), 'utf8');
  } catch {
    return; // no .env — real env vars only
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
