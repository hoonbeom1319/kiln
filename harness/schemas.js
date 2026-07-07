// Structured-output schemas for the A/B harness. Both are plain JSON Schema and go
// straight into generate({ schema }) — same shape providers hand to native structured
// output, same shape src/schema.js validates.

// render-check 7 items, ported verbatim from ../atelier/.claude/agents/design-verifier.md.
// (offBrief is the JSON-safe spelling of the doc's "off-brief".)
export const CHECK_ITEMS = ['thin', 'bad', 'variantsIdentical', 'offBrief', 'deadControl', 'stateInert', 'wireframey'];

const okng = { type: 'string', enum: ['ok', 'ng'] };

export const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['screens', 'result', 'summary'],
  properties: {
    screens: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['screen', ...CHECK_ITEMS, 'verdict', 'notes'],
        properties: {
          screen: { type: 'string' },
          ...Object.fromEntries(CHECK_ITEMS.map((k) => [k, okng])),
          verdict: { type: 'string', enum: ['PASS', 'FAIL'] },
          notes: { type: 'string' },
        },
      },
    },
    result: { type: 'string', enum: ['PASS', 'FAIL'] },
    summary: { type: 'string' },
  },
};

// hi-fi build output: a set of named, self-contained HTML files.
export const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['files'],
  properties: {
    files: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'html'],
        properties: {
          path: { type: 'string' },
          html: { type: 'string' },
        },
      },
    },
    notes: { type: 'string' },
  },
};
