import { generate } from '../model/generate.js';
import { BUILD_SCHEMA } from './schemas.js';
import { buildSystem, buildPrompt } from './prompts.js';

// Build hi-fi screens for one variant (model alias) from the fixture contract.
export async function buildHiFi({ model, fixture, temperature }) {
  const res = await generate(buildPrompt(fixture), {
    model,
    schema: BUILD_SCHEMA,
    system: buildSystem,
    temperature,
  });
  return {
    model: res.model,
    provider: res.provider,
    usage: res.usage,
    attempts: res.attempts,
    files: res.data.files,
    notes: res.data.notes || '',
  };
}
