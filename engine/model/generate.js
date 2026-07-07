import { getProvider } from './provider.js';
import { resolveModel, DEFAULTS } from './config.js';
import { validate, extractJSON } from './schema.js';
import './providers/index.js';

/**
 * The ONE interface the whole codebase talks to. Everything model-related goes through
 * here; no caller ever touches an SDK or a provider directly.
 *
 *   generate(prompt, { model })            -> { text, ... }              (free-form)
 *   generate(prompt, { model, schema })    -> { data, ... }             (validated JSON)
 *
 * Behind it: provider-native constrained decoding when available, our own schema
 * validation, and a repair-retry loop that feeds validation errors back to the model.
 *
 * @param {string} prompt
 * @param {object} [opts]
 * @param {string} [opts.model='echo']  logical alias from MODELS (config.js)
 * @param {object} [opts.schema]        JSON schema; when present the result is validated
 * @param {string} [opts.system]        system instruction
 * @param {number} [opts.temperature]
 * @param {number} [opts.maxTokens]
 * @param {number} [opts.maxRepair]     schema repair attempts (default from config)
 * @returns {Promise<{data:?object,text:string,usage:object,model:string,provider:string,attempts:number}>}
 */
export async function generate(prompt, opts = {}) {
  const {
    model = 'echo',
    schema,
    system,
    temperature = DEFAULTS.temperature,
    maxTokens = DEFAULTS.maxTokens,
    maxRepair = DEFAULTS.maxRepairAttempts,
  } = opts;

  const { provider: providerName, model: modelId } = resolveModel(model);
  const provider = getProvider(providerName);
  const base = { system, model: modelId, temperature, maxTokens };

  if (!schema) {
    const { text, usage } = await provider.generateText({ ...base, prompt });
    return { data: null, text, usage, model, provider: providerName, attempts: 1 };
  }

  const usageAcc = { input: 0, output: 0 };
  let lastErr, lastText;
  let curPrompt = prompt;

  for (let attempt = 0; attempt <= maxRepair; attempt++) {
    let data, text, usage;
    try {
      if (provider.supportsStructured) {
        ({ data, text, usage } = await provider.generateStructured({ ...base, prompt: curPrompt, schema }));
      } else {
        ({ text, usage } = await provider.generateText({
          ...base,
          prompt: `${curPrompt}\n\nReturn ONLY JSON matching this schema — no prose, no code fence:\n${JSON.stringify(schema)}`,
        }));
        data = extractJSON(text);
      }
    } catch (e) {
      lastErr = e;
      lastText = text;
      curPrompt = `${prompt}\n\nYour previous reply could not be parsed as JSON (${e.message}). Return ONLY valid JSON matching the schema.`;
      continue;
    }

    if (usage) { usageAcc.input += usage.input || 0; usageAcc.output += usage.output || 0; }

    const { ok, errors } = validate(schema, data);
    if (ok) {
      return { data, text, usage: usageAcc, model, provider: providerName, attempts: attempt + 1 };
    }
    lastErr = new Error(`schema validation failed: ${errors.join('; ')}`);
    lastText = text;
    curPrompt = `${prompt}\n\nYour previous reply failed schema validation:\n- ${errors.join('\n- ')}\nReturn corrected JSON only.`;
  }

  const err = new Error(
    `generate(): no schema-valid output from "${model}" after ${maxRepair + 1} attempt(s): ${lastErr?.message}`,
  );
  err.lastText = lastText;
  throw err;
}
