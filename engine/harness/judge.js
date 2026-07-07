import { generate } from '../model/generate.js';
import { VERDICT_SCHEMA } from './schemas.js';
import { judgeSystem, judgePrompt } from './prompts.js';

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
