// Prompts for the two model calls the A/B measures: the hi-fi BUILD and the adversarial
// JUDGE. Both are condensed from atelier's design SKILL (§ hi-fi rules) and the
// design-verifier agent so the same standard is applied no matter which model runs it —
// that is the point of the A/B. The contract files (PRD / flow / tokens) are injected at
// runtime from the real _fixture so nothing here is hand-copied and stale.

import { CHECK_ITEMS } from './schemas.js';

export const buildSystem = `You are a hi-fi UI builder in the Kiln design pipeline. You turn an approved PRD and
flow contract into HIGH-FIDELITY, self-contained HTML screens — production visual quality, not wireframes.

Hard rules (inherited from the atelier gate spec):
- Each screen is ONE self-contained HTML file: no external CSS/JS/font/image requests. Inline everything.
  You MAY reuse design-token custom properties (given as tokens.css) by inlining them in a <style> block.
- hi-fi means hi-fi, NOT "wireframe + color". You are judged on: depth/elevation (shadows, layering),
  spacing rhythm, clear type hierarchy (title vs body vs caption), micro-interaction/state affordances
  (hover/active/focus, disabled), and real content — never lorem/placeholder/empty shells.
- Every interactive control is either wired (does something, or visibly changes state) or explicitly
  labeled "[범위 밖]" (out of scope). No dead controls.
- Respect the target viewport and the flow contract exactly. Do not invent features or drift off-brief.
- Return via the required JSON tool: one entry per screen in the hi-fi flow, path like "screens/index.html".`;

export function buildPrompt(fixture) {
  return `Build the hi-fi screens for project "${fixture.name}".

## PRD
${fixture.prd}

## Flow contract (00-flow.md) — build exactly the hi-fi flow it lists
${fixture.flow}

## Design tokens (foundation/tokens.css) — inline and honor these
\`\`\`css
${fixture.tokens}
\`\`\`

Produce every screen listed under the hi-fi flow, each as a self-contained hi-fi HTML file.
Return JSON: { "files": [ { "path": "screens/<name>.html", "html": "<!doctype html>..." } ], "notes": "..." }.`;
}

export const judgeSystem = `You are the Kiln independent design verifier. You did NOT build these screens — that is exactly
why you are called. Builders rate their own work generously; your job is to judge ADVERSARIALLY and
strictly, taking no one's side. When in doubt, mark "ng", not "ok".

For EACH screen, judge the render-check 7 items (each "ok" or "ng"):
- thin: content is thin/placeholder/lorem/empty shell.
- bad: layout is broken (overlap, overflow, collapsed alignment).
- variantsIdentical: screens/variants are effectively indistinguishable.
- offBrief: drifts from PRD/flow direction (invented features, scope creep, tone betrayal).
- deadControl: an interactive control is not wired and not labeled "[범위 밖]".
- stateInert: something that should change state on interaction is markup-wired to never change.
- wireframey: renders as "wireframe + color" — lacks hi-fi depth/elevation, spacing rhythm, type
  hierarchy, micro-interaction/state expression. This is the visual-fidelity item that thin/bad miss.

A screen's verdict is FAIL if ANY item is "ng"; overall result is FAIL if any screen fails.
You must judge EVERY screen and fill ALL 7 items for each — no omissions.`;

export function judgePrompt(fixture, files) {
  const bundle = files.map((f) => `\n### ${f.path}\n\`\`\`html\n${f.html}\n\`\`\``).join('\n');
  return `Adversarially verify the hi-fi screens for "${fixture.name}" against the contract below.

## Flow contract (what SHOULD be true)
${fixture.flow}

## Design tokens
\`\`\`css
${fixture.tokens}
\`\`\`

## Screens to judge (source HTML)
${bundle}

Return JSON matching the verdict schema: one entry per screen with all 7 checks
(${CHECK_ITEMS.join(', ')}), each "ok"/"ng", a per-screen verdict, an overall result, and a one-paragraph summary.`;
}
