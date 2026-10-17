import { test } from 'node:test';
import assert from 'node:assert/strict';
import { norm, keyOf, splitText, addMany, move, filterSuggestions, summary } from '../src/logic.js';

test('norm trims and collapses whitespace', () => {
  assert.equal(norm('  New   York  '), 'New York');
  assert.equal(norm('   '), '');
  assert.equal(norm(null), '');
});
test('splitText splits on commas and newlines', () => {
  assert.deepEqual(splitText('a, b,, c\nd\r\ne'), ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(splitText(' , \n '), []);
});
test('splitText with custom delimiters', () => {
  assert.deepEqual(splitText('a;b,c', [';']), ['a', 'b,c']);
  assert.deepEqual(splitText('a.b', ['.']), ['a', 'b']);
});
test('addMany rejects duplicates case-insensitively', () => {
  const r = addMany(['Design'], ['design', 'UI', ' ui '], {});
  assert.deepEqual(r.values, ['Design', 'UI']);
  assert.deepEqual(r.skipped.duplicate, ['design', 'ui']);
});
test('addMany allows duplicates when asked', () => {
  const r = addMany(['a'], ['a', 'A'], { allowDuplicates: true });
  assert.deepEqual(r.values, ['a', 'a', 'A']);
});
test('addMany ignores whitespace-only items', () => {
  const r = addMany([], ['  ', '', '\n', 'x']);
  assert.deepEqual(r.values, ['x']);
  assert.equal(r.skipped.duplicate.length + r.skipped.invalid.length + r.skipped.max.length, 0);
});
test('paste of 200 items against max', () => {
  const items = Array.from({ length: 200 }, (_, i) => `t${i}`);
  const r = addMany([], items, { max: 5 });
  assert.equal(r.values.length, 5);
  assert.equal(r.skipped.max.length, 195);
  assert.equal(summary(r, 5), 'Added 5, skipped 195. Maximum of 5 reached.');
});
test('validate: false and string reject, true and undefined accept', () => {
  const v = (s) => (s === 'no' ? false : s === 'msg' ? 'Custom message.' : s === 'undef' ? undefined : true);
  const r = addMany([], ['ok', 'no', 'msg', 'undef'], { validate: v });
  assert.deepEqual(r.values, ['ok', 'undef']);
  assert.deepEqual(r.errors, ['no is not valid.', 'Custom message.']);
});
test('validate receives current values', () => {
  const seen = [];
  addMany(['a'], ['b', 'c'], { validate: (v, cur) => { seen.push(cur.join()); return true; } });
  assert.deepEqual(seen, ['a', 'a,b']);
});
test('move', () => {
  assert.deepEqual(move(['a', 'b', 'c'], 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(move(['a', 'b', 'c'], 2, 0), ['c', 'a', 'b']);
  assert.deepEqual(move(['a', 'b'], 0, -1), ['a', 'b']);
  assert.deepEqual(move(['a', 'b'], 1, 5), ['a', 'b']);
});
test('filterSuggestions ranks prefix first, hides existing', () => {
  const all = ['design', 'research', 'redesign', 'Desk', 'ui'];
  assert.deepEqual(filterSuggestions(all, 'de', ['Desk']), ['design', 'redesign']);
  assert.deepEqual(filterSuggestions(all, 'de', [], false), ['design', 'Desk', 'redesign']);
  assert.deepEqual(filterSuggestions(all, 'de', ['design'], true).includes('design'), true);
  assert.equal(filterSuggestions(Array.from({ length: 20 }, (_, i) => `a${i}`), 'a', []).length, 8);
});
test('keyOf', () => assert.equal(keyOf('  Hello  World '), 'hello world'));
test('summary messages', () => {
  assert.equal(summary(addMany([], ['x']), 5), 'Added x.');
  assert.equal(summary(addMany(['x'], ['X']), 5), 'X is already added.');
  assert.equal(summary(addMany([], ['a', 'b']), 5), 'Added 2.');
  assert.equal(summary(addMany(['q'], ['b'], { max: 1 }), 1), 'Maximum of 1 reached.');
  assert.equal(summary(addMany([], ['']), 5), '');
});
