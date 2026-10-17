export const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const keyOf = (s) => norm(s).toLowerCase();

export function splitText(text, delimiters = [',']) {
  const esc = delimiters.map((d) => d.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('');
  return String(text ?? '').split(new RegExp(`[${esc}\\r\\n]+`)).map(norm).filter(Boolean);
}

export function addMany(values, incoming, { max = Infinity, allowDuplicates = false, validate } = {}) {
  const out = values.slice();
  const seen = new Set(out.map(keyOf));
  const added = [];
  const skipped = { duplicate: [], invalid: [], max: [] };
  const errors = [];
  for (const raw of incoming) {
    const v = norm(raw);
    if (!v) continue;
    if (!allowDuplicates && seen.has(keyOf(v))) { skipped.duplicate.push(v); continue; }
    if (out.length >= max) { skipped.max.push(v); continue; }
    if (validate) {
      const r = validate(v, out.slice());
      if (r === false || typeof r === 'string') {
        skipped.invalid.push(v);
        errors.push(typeof r === 'string' ? r : `${v} is not valid.`);
        continue;
      }
    }
    out.push(v);
    seen.add(keyOf(v));
    added.push(v);
  }
  return { values: out, added, skipped, errors };
}

export function move(list, from, to) {
  if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return list.slice();
  const out = list.slice();
  const [x] = out.splice(from, 1);
  out.splice(to, 0, x);
  return out;
}

export function filterSuggestions(all, query, existing, allowDuplicates = false, limit = 8) {
  const q = keyOf(query);
  const taken = new Set(allowDuplicates ? [] : existing.map(keyOf));
  const pool = all.map(norm).filter((s) => s && !taken.has(keyOf(s)));
  const starts = pool.filter((s) => keyOf(s).startsWith(q));
  const has = pool.filter((s) => !keyOf(s).startsWith(q) && keyOf(s).includes(q));
  return [...starts, ...has].slice(0, limit);
}

export function summary(r, max) {
  const n = r.added.length;
  const skipN = r.skipped.duplicate.length + r.skipped.invalid.length + r.skipped.max.length;
  if (n === 1 && !skipN) return `Added ${r.added[0]}.`;
  if (n === 0 && r.skipped.duplicate.length === 1 && skipN === 1) return `${r.skipped.duplicate[0]} is already added.`;
  if (n === 0 && r.errors.length === 1 && skipN === 1) return r.errors[0];
  if (n === 0 && r.skipped.max.length && skipN === r.skipped.max.length) return `Maximum of ${max} reached.`;
  if (n === 0 && !skipN) return '';
  return `Added ${n}${skipN ? `, skipped ${skipN}` : ''}${r.skipped.max.length ? `. Maximum of ${max} reached` : ''}.`;
}
