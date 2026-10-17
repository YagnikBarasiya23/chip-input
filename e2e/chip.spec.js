import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const axeSrc = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');
const input = (p) => p.locator('.chip-input__input');
const chips = (p) => p.locator('.chip-input__chip:not(.is-leaving)');
const vals = (p) => p.evaluate(() => window.chips.values);
const status = (p) => p.locator('[role=status]');

test.beforeEach(async ({ page }) => {
  page.errors = [];
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
});
test.afterEach(async ({ page }) => { expect(page.errors).toEqual([]); });

async function pasteText(page, text) {
  await page.evaluate((t) => {
    const i = document.querySelector('.chip-input__input');
    const dt = new DataTransfer(); dt.setData('text', t);
    i.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  }, text);
}

test('default render with no config', async ({ page }) => {
  await page.goto('/');
  await expect(chips(page)).toHaveCount(0);
  await expect(input(page)).toHaveAttribute('placeholder', 'Add a tag…');
  await expect(input(page)).toHaveAttribute('aria-label', 'Topics');
  await expect(page.locator('.chip-input__chips')).toHaveAttribute('aria-label', /added/);
  expect(await vals(page)).toEqual([]);
});

test('Enter and comma commit; Space types a space', async ({ page }) => {
  await page.goto('/');
  await input(page).click();
  await page.keyboard.type('design');
  await page.keyboard.press('Enter');
  await page.keyboard.type('New York,');
  await page.keyboard.type('ui');
  await page.keyboard.press(',');
  expect(await vals(page)).toEqual(['design', 'New York', 'ui']);
  await expect(input(page)).toHaveValue('');
  await expect(chips(page)).toHaveCount(3);
});

test('whitespace-only never commits; values are trimmed', async ({ page }) => {
  await page.goto('/');
  await input(page).click();
  await page.keyboard.type('   ');
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual([]);
  await page.keyboard.type('  spaced   out  ');
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual(['spaced out']);
});

test('blur commits pending text', async ({ page }) => {
  await page.goto('/');
  await input(page).fill('pending');
  await input(page).blur();
  expect(await vals(page)).toEqual(['pending']);
});

test('duplicates are rejected case-insensitively and the existing tag reacts', async ({ page }) => {
  await page.goto('/?values=Design');
  await input(page).click();
  await page.keyboard.type('design');
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual(['Design']);
  await expect(input(page)).toHaveValue('');
  await expect(status(page)).toContainText('already added');
  await expect(page.locator('.chip-input__chip.is-dup')).toHaveCount(1);
});

test('dups option allows duplicates', async ({ page }) => {
  await page.goto('/?dups=1');
  await input(page).click();
  await page.keyboard.type('a,a,');
  expect(await vals(page)).toEqual(['a', 'a']);
});

test('Backspace on empty input pulls the last tag back to edit', async ({ page }) => {
  await page.goto('/?values=one,two');
  await input(page).click();
  await page.keyboard.press('Backspace');
  expect(await vals(page)).toEqual(['one']);
  await expect(input(page)).toHaveValue('two');
  await page.keyboard.type('s');
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual(['one', 'twos']);
});

test('Backspace with text deletes characters only', async ({ page }) => {
  await page.goto('/?values=one');
  await input(page).click();
  await page.keyboard.type('ab');
  await page.keyboard.press('Backspace');
  await expect(input(page)).toHaveValue('a');
  expect(await vals(page)).toEqual(['one']);
});

test('remove button removes, focus returns to the input', async ({ page }) => {
  await page.goto('/?values=one,two');
  await page.getByRole('button', { name: 'Remove one' }).click();
  expect(await vals(page)).toEqual(['two']);
  await expect(input(page)).toBeFocused();
  await expect(status(page)).toContainText('Removed one');
});

test('keyboard: ArrowLeft walks tags, Delete removes, focus moves on', async ({ page }) => {
  await page.goto('/?values=a,b,c');
  await input(page).click();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.chip-input__chip[data-value=c]')).toBeFocused();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.chip-input__chip[data-value=b]')).toBeFocused();
  await page.keyboard.press('Delete');
  expect(await vals(page)).toEqual(['a', 'c']);
  await expect(page.locator('.chip-input__chip[data-value=c]')).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(input(page)).toBeFocused();
});

test('keyboard reorder with Alt+Arrow', async ({ page }) => {
  await page.goto('/?values=a,b,c');
  await input(page).click();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Alt+ArrowLeft');
  expect(await vals(page)).toEqual(['a', 'c', 'b']);
  await expect(page.locator('.chip-input__chip[data-value=c]')).toBeFocused();
  await expect(status(page)).toContainText('Moved c to position 2 of 3');
  await page.keyboard.press('Alt+ArrowLeft');
  await page.keyboard.press('Alt+ArrowLeft');
  expect(await vals(page)).toEqual(['c', 'a', 'b']);
  const order = await page.locator('.chip-input__chip').evaluateAll((els) => els.map((e) => e.dataset.value));
  expect(order).toEqual(['c', 'a', 'b']);
});

test('paste splits on commas and newlines, skips duplicates and blanks', async ({ page }) => {
  await page.goto('/');
  await pasteText(page, 'design, research,, Design\nui\r\n  \nmotion');
  expect(await vals(page)).toEqual(['design', 'research', 'ui', 'motion']);
  await expect(status(page)).toContainText('Added 4, skipped 1');
});

test('paste of 200 items against max', async ({ page }) => {
  await page.goto('/?max=5');
  await pasteText(page, Array.from({ length: 200 }, (_, i) => `t${i}`).join(','));
  expect((await vals(page)).length).toBe(5);
  await expect(status(page)).toContainText('Added 5, skipped 195');
  await expect(page.locator('.chip-input.is-full')).toHaveCount(1);
});

test('plain paste without delimiters stays in the field', async ({ page }) => {
  await page.goto('/');
  await input(page).click();
  await pasteText(page, 'single');
  expect(await vals(page)).toEqual([]);
});

test('max: cue near the limit and rejection at the limit', async ({ page }) => {
  await page.goto('/?max=5&values=a,b,c');
  await expect(page.locator('.chip-input.is-nearly-full')).toHaveCount(0);
  await input(page).click();
  await page.keyboard.type('d,');
  await expect(page.locator('.chip-input.is-nearly-full')).toHaveCount(1);
  await page.keyboard.type('e,');
  await page.keyboard.type('f,');
  expect(await vals(page)).toEqual(['a', 'b', 'c', 'd', 'e']);
  await expect(status(page)).toContainText('Maximum of 5');
});

test('IME composition does not commit', async ({ page }) => {
  await page.goto('/');
  await input(page).click();
  await page.evaluate(() => {
    const i = document.querySelector('.chip-input__input');
    i.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    i.value = 'にほん';
    i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: true, bubbles: true, cancelable: true }));
  });
  expect(await vals(page)).toEqual([]);
  await expect(input(page)).toHaveValue('にほん');
  await page.evaluate(() => {
    const i = document.querySelector('.chip-input__input');
    i.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }));
  });
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual(['にほん']);
});

test('Safari-style confirming Enter (keyCode 229, isComposing false) is ignored', async ({ page }) => {
  await page.goto('/');
  await input(page).fill('かな');
  await page.evaluate(() => document.querySelector('.chip-input__input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, isComposing: false, bubbles: true, cancelable: true })));
  expect(await vals(page)).toEqual([]);
});

test('Android-style delimiter arrives through the input event', async ({ page }) => {
  await page.goto('/');
  await input(page).evaluate((i) => { i.value = 'abc,'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  expect(await vals(page)).toEqual(['abc']);
  await expect(input(page)).toHaveValue('');
});

test('validate: rejects with a message and keeps the text', async ({ page }) => {
  await page.goto('/?validate=1');
  await input(page).click();
  await page.keyboard.type('x');
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual([]);
  await expect(input(page)).toHaveValue('x');
  await expect(input(page)).toHaveAttribute('aria-invalid', 'true');
  await expect(status(page)).toContainText('two or more');
  await page.keyboard.type('y');
  await expect(input(page)).not.toHaveAttribute('aria-invalid', 'true');
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual(['xy']);
});

test('suggestions: filter, arrows, aria-activedescendant, Enter, Escape', async ({ page }) => {
  await page.goto('/?sugg=1');
  await input(page).click();
  await expect(input(page)).toHaveAttribute('role', 'combobox');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.type('de');
  await expect(page.getByRole('option')).toHaveCount(2);
  await expect(input(page)).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowDown');
  const id = await input(page).getAttribute('aria-activedescendant');
  await expect(page.locator(`#${id}`)).toHaveAttribute('aria-selected', 'true');
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Enter');
  expect(await vals(page)).toEqual(['design']);
  await page.keyboard.type('re');
  await expect(page.getByRole('option')).toHaveCount(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('.chip-input__list')).toBeHidden();
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('suggestions: click picks, existing tags are excluded', async ({ page }) => {
  await page.goto('/?sugg=1&values=design');
  await input(page).click();
  await page.keyboard.type('de');
  await expect(page.getByRole('option')).toHaveCount(1);
  await page.getByRole('option', { name: 'redesign' }).click();
  expect(await vals(page)).toEqual(['design', 'redesign']);
  await expect(input(page)).toBeFocused();
});

test('suggestions: ArrowDown on empty field opens the list', async ({ page }) => {
  await page.goto('/?sugg=1');
  await input(page).click();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('option').first()).toBeVisible();
});

test('native form submit includes the values; Enter on empty field submits, Enter with text does not', async ({ page }) => {
  await page.goto('/?values=a,b');
  await input(page).click();
  await page.keyboard.type('c');
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.submitted)).toBeUndefined();
  expect(await vals(page)).toEqual(['a', 'b', 'c']);
  await page.keyboard.press('Enter');
  expect(await page.evaluate(() => window.submitted)).toEqual(['a', 'b', 'c']);
  expect(await page.locator('input[type=hidden][name=topics]').count()).toBe(3);
});

test('typed but uncommitted text is committed before submit via blur', async ({ page }) => {
  await page.goto('/');
  await input(page).fill('last');
  await page.getByRole('button', { name: 'Save' }).click();
  expect(await page.evaluate(() => window.submitted)).toEqual(['last']);
});

test('form reset restores the initial values', async ({ page }) => {
  await page.goto('/?values=a,b');
  await page.evaluate(() => window.chips.add('c'));
  await page.evaluate(() => document.getElementById('f').reset());
  expect(await vals(page)).toEqual(['a', 'b']);
});

test('onChange fires with type and values', async ({ page }) => {
  await page.goto('/');
  await input(page).click();
  await page.keyboard.type('a,b,');
  await page.getByRole('button', { name: 'Remove a' }).click();
  const ch = await page.evaluate(() => window.changes.map((c) => c[0]));
  expect(ch).toEqual(['add', 'add', 'remove']);
  expect((await page.evaluate(() => window.changes)).at(-1)[1]).toEqual(['b']);
});

test('public methods: add, remove, clear, setValues, focus, values copy', async ({ page }) => {
  await page.goto('/');
  const r = await page.evaluate(() => {
    const c = window.chips, out = {};
    out.add = c.add(['x', 'y', 'x']).added;
    out.removed = c.remove('X');
    out.missing = c.remove('nope');
    c.setValues(['p', 'q'], true);
    out.afterSet = c.values;
    out.changesAfterSilent = window.changes.length;
    c.values.push('hacked');
    out.copy = c.values;
    c.clear();
    out.cleared = c.values;
    c.focus();
    out.focused = document.activeElement.classList.contains('chip-input__input');
    return out;
  });
  expect(r.add).toEqual(['x', 'y']);
  expect(r.removed).toBe(true);
  expect(r.missing).toBe(false);
  expect(r.afterSet).toEqual(['p', 'q']);
  expect(r.changesAfterSilent).toBe(2);
  expect(r.copy).toEqual(['p', 'q']);
  expect(r.cleared).toEqual([]);
  expect(r.focused).toBe(true);
  await expect(chips(page)).toHaveCount(0);
});

test('keyboard only: Tab reaches the input, Shift+Tab leaves it', async ({ page }) => {
  await page.goto('/?values=a');
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('Tab');
  await expect(input(page)).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(input(page)).not.toBeFocused();
});

test('destroy removes DOM and leaves no timers', async ({ page }) => {
  await page.goto('/?values=a,b');
  const leaked = await page.evaluate(async () => {
    const timers = new Set();
    const st = window.setTimeout, ct = window.clearTimeout;
    window.setTimeout = (f, ms, ...a) => { const id = st(() => { timers.delete(id); f(...a); }, ms); timers.add(id); return id; };
    window.clearTimeout = (id) => { timers.delete(id); ct(id); };
    window.chips.remove('a');
    window.chips.add('b');
    window.chips.destroy();
    await new Promise((r) => st(r, 400));
    return { timers: timers.size, root: document.querySelectorAll('.chip-input').length };
  });
  expect(leaked).toEqual({ timers: 0, root: 0 });
});

test('destroyed instance ignores later events', async ({ page }) => {
  await page.goto('/');
  const n = await page.evaluate(() => {
    const i = document.querySelector('.chip-input__input');
    window.chips.destroy();
    i.value = 'x,'; i.dispatchEvent(new Event('input', { bubbles: true }));
    i.dispatchEvent(new Event('blur'));
    return window.changes.length;
  });
  expect(n).toBe(0);
});

test('reduced motion: no swing, removal is immediate', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/?values=a');
  await input(page).click();
  await page.keyboard.type('b,');
  const anim = await page.locator('.chip-input__chip[data-value=b]').evaluate((e) => getComputedStyle(e).animationName);
  expect(anim).not.toBe('ci-drop');
  await page.getByRole('button', { name: 'Remove b' }).click();
  await expect(page.locator('.chip-input__chip[data-value=b]')).toHaveCount(0);
});

test('motion on by default: new tag swings, removed tag leaves', async ({ page }) => {
  await page.goto('/');
  await input(page).click();
  await page.keyboard.type('a,');
  expect(await page.locator('.chip-input__chip').first().evaluate((e) => getComputedStyle(e).animationName)).toBe('ci-drop');
  await page.getByRole('button', { name: 'Remove a' }).click();
  await expect(page.locator('.chip-input__chip.is-leaving')).toHaveCount(1);
  await expect(page.locator('.chip-input__chip')).toHaveCount(0);
});

for (const theme of ['light', 'dark']) {
  test(`theme ${theme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: theme === 'dark' ? 'light' : 'dark' });
    await page.goto(`/?theme=${theme}`);
    const bg = await page.locator('.chip-input__field').evaluate((e) => getComputedStyle(e).backgroundColor);
    expect(bg).toBe(theme === 'dark' ? 'rgb(31, 25, 21)' : 'rgb(255, 253, 249)');
  });
}

test('theming variables set on an ancestor apply', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => document.getElementById('chips').style.setProperty('--ci-bg', 'rgb(1, 2, 3)'));
  expect(await page.locator('.chip-input__field').evaluate((e) => getComputedStyle(e).backgroundColor)).toBe('rgb(1, 2, 3)');
});

test('320px width: no overflow with many long tags, remove target is at least 24px', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/?values=alpha,beta,gamma,delta,epsilon,zeta,eta,theta,a%20very%20long%20tag%20name%20that%20keeps%20going%20and%20going%20and%20going');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  const b = await page.locator('.chip-input__remove').first().boundingBox();
  expect(b.width).toBeGreaterThanOrEqual(24);
  expect(b.height).toBeGreaterThanOrEqual(24);
  const fs = await input(page).evaluate((e) => parseFloat(getComputedStyle(e).fontSize));
  expect(fs).toBeGreaterThanOrEqual(16);
});

test('axe: no violations (empty, with tags, suggestions open)', async ({ page }) => {
  await page.goto('/?sugg=1&values=a,b');
  await page.evaluate(axeSrc);
  const run = () => page.evaluate(async () => (await axe.run()).violations.map((v) => `${v.id}: ${v.nodes[0].html.slice(0, 90)}`));
  expect(await run()).toEqual([]);
  await input(page).click();
  await page.keyboard.type('de');
  await expect(page.getByRole('option').first()).toBeVisible();
  expect(await run()).toEqual([]);
  await page.evaluate(() => window.chips.clear());
  expect(await run()).toEqual([]);
});
