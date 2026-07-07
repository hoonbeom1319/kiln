import { generate } from '../model/generate.js';
import { traceSystem, tracePrompt, traceSchema } from './prompts/traceability.js';

// PRD ↔ screen traceability, shared by the design stage (initial forge) and the revise stage
// (keeps annotations in sync after a revision). Ask the model to map each built screen to the
// PRD requirement it reflects, then reconcile to exactly the built screens (one entry each, in
// build order) so the gallery never has a screen with no annotation or an annotation for a
// screen that doesn't exist.
export async function mapTraceability({ model, prd, files }) {
  const screens = files.map((f) => ({
    file: f.path.split('/').pop(),
    title: screenTitle(f.html),
  }));
  const res = await generate(tracePrompt(prd, screens), {
    model,
    system: traceSystem,
    schema: traceSchema,
    maxTokens: 2000,
  });
  const byFile = new Map((res.data?.screens || []).map((s) => [String(s.file).split('/').pop(), s]));
  const mapped = screens.map((s) => {
    const hit = byFile.get(s.file);
    return {
      file: s.file,
      title: s.title,
      reflects: (hit?.reflects || '').trim() || '(연결된 PRD 항목 미상)',
    };
  });
  return { map: { screens: mapped }, model: res.model, usage: res.usage, attempts: res.attempts };
}

// Best-effort human title for a screen: <title>, else first <h1>, else the filename.
export function screenTitle(html) {
  const t = String(html).match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t && t[1].trim()) return decodeEntities(t[1].trim());
  const h = String(html).match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h) return decodeEntities(h[1].replace(/<[^>]+>/g, '').trim());
  return '';
}

export function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}
