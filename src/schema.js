// Self-contained JSON-Schema validator + JSON extractor — no dependency.
// Covers the subset the harness uses: type, required, properties, items, enum,
// const, additionalProperties:false, minItems/maxItems. Kept dependency-free so
// the offline path runs with zero installs; the schema flavor here is the same one
// providers hand to native structured output, so there is a single source of shape.

export function validate(schema, data, path = '(root)') {
  const errors = [];
  check(schema, data, path, errors);
  return { ok: errors.length === 0, errors };
}

function check(schema, data, path, errors) {
  if (!schema || typeof schema !== 'object') return;

  if (schema.const !== undefined && data !== schema.const) {
    errors.push(`${path}: expected const ${JSON.stringify(schema.const)}`);
    return;
  }
  if (schema.enum && !schema.enum.includes(data)) {
    errors.push(`${path}: value ${JSON.stringify(data)} not in enum [${schema.enum.join(', ')}]`);
    return;
  }

  const t = schema.type;
  if (t && !typeOk(t, data)) {
    errors.push(`${path}: expected type ${t}, got ${jsType(data)}`);
    return;
  }

  if (t === 'object' || (schema.properties && jsType(data) === 'object')) {
    const props = schema.properties || {};
    for (const req of schema.required || []) {
      if (!(req in data)) errors.push(`${path}: missing required property "${req}"`);
    }
    if (schema.additionalProperties === false) {
      for (const k of Object.keys(data)) {
        if (!(k in props)) errors.push(`${path}: unexpected property "${k}"`);
      }
    }
    for (const [k, sub] of Object.entries(props)) {
      if (k in data) check(sub, data[k], `${path}.${k}`, errors);
    }
  }

  if (t === 'array' && Array.isArray(data)) {
    if (schema.minItems !== undefined && data.length < schema.minItems) {
      errors.push(`${path}: expected at least ${schema.minItems} items, got ${data.length}`);
    }
    if (schema.maxItems !== undefined && data.length > schema.maxItems) {
      errors.push(`${path}: expected at most ${schema.maxItems} items, got ${data.length}`);
    }
    if (schema.items) data.forEach((el, i) => check(schema.items, el, `${path}[${i}]`, errors));
  }
}

function typeOk(t, v) {
  switch (t) {
    case 'object': return jsType(v) === 'object';
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'number': return typeof v === 'number' && !Number.isNaN(v);
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    case 'boolean': return typeof v === 'boolean';
    case 'null': return v === null;
    default: return true;
  }
}

function jsType(v) {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

// Pull the first balanced JSON object/array out of a text blob (handles ```json fences
// and prose wrappers). Returns the parsed value or throws.
export function extractJSON(text) {
  if (typeof text !== 'string') throw new Error('extractJSON: input is not a string');
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fenced ? fenced[1] : text;
  const start = body.search(/[[{]/);
  if (start === -1) throw new Error('extractJSON: no JSON object/array found');
  const open = body[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let i = start; i < body.length; i++) {
    const c = body[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === open) depth++;
    else if (c === close) {
      if (--depth === 0) return JSON.parse(body.slice(start, i + 1));
    }
  }
  throw new Error('extractJSON: unbalanced JSON');
}
