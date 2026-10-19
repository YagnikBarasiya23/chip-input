import { norm, keyOf, splitText, addMany, move, filterSuggestions, summary } from './logic.js';

let uid = 0;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const el = (tag, cls, attrs) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  return e;
};

export class ChipInput {
  constructor(target, options = {}) {
    if (!target) throw new TypeError('ChipInput: target element is required');
    this.target = target;
    this.opts = { label: 'Tags', placeholder: 'Add a tag…', delimiters: [','], allowDuplicates: false, ...options };
    this.variant = options.variant === 'stamp' ? 'stamp' : 'paper';
    this.max = Number.isFinite(options.max) && options.max > 0 ? Math.floor(options.max) : Infinity;
    this._values = [];
    this._chips = new Map();
    this._timers = new Set();
    this._off = [];
    this._id = `ci${++uid}`;
    this._composing = false;
    this._active = -1;
    this._sugg = [];
    this._build();
    const r = addMany([], options.values || [], this._rules());
    this._values = r.values;
    r.added.forEach((v) => this._addChip(v, false));
    this._initial = this._values.slice();
    this._sync();
  }

  get values() {
    return this._values.slice();
  }

  add(v) {
    const r = addMany(this._values, Array.isArray(v) ? v : [v], this._rules());
    this._values = r.values;
    r.added.forEach((x) => this._addChip(x, true));
    r.skipped.duplicate.forEach((x) => this._flash(x));
    this._sync();
    this._say(summary(r, this.max));
    if (r.errors.length) this.input.setAttribute('aria-invalid', 'true');
    if (r.added.length) this._emit('add', r.added);
    return r;
  }

  remove(v) {
    const i = this._values.findIndex((x) => keyOf(x) === keyOf(v));
    if (i < 0) return false;
    const [gone] = this._values.splice(i, 1);
    const li = this._chips.get(keyOf(gone));
    this._chips.delete(keyOf(gone));
    this._leave(li);
    this._sync();
    this._say(`Removed ${gone}.`);
    this._emit('remove', [gone]);
    return true;
  }

  clear() {
    this.setValues([]);
  }

  setValues(list, silent = false) {
    this._chips.forEach((li) => li.remove());
    this._chips.clear();
    const r = addMany([], list, this._rules());
    this._values = r.values;
    r.added.forEach((v) => this._addChip(v, false));
    this._sync();
    if (!silent) this._emit('set', r.added);
  }

  focus() {
    this.input.focus();
  }

  destroy() {
    this._timers.forEach(clearTimeout);
    this._timers.clear();
    this._off.forEach((fn) => fn());
    this._off = [];
    this.root.remove();
  }

  _rules() {
    return { max: this.max, allowDuplicates: this.opts.allowDuplicates, validate: this.opts.validate };
  }

  _emit(type, changed) {
    this.opts.onChange?.(this.values, { type, changed });
  }

  _say(t) {
    this.status.textContent = t;
  }

  _later(fn, ms) {
    const t = setTimeout(() => { this._timers.delete(t); fn(); }, ms);
    this._timers.add(t);
  }

  _build() {
    const o = this.opts;
    const id = this._id;
    const root = (this.root = el('div', `chip-input chip-input--${this.variant}`));
    const field = (this.field = el('div', 'chip-input__field'));
    const list = (this.list = el('ul', 'chip-input__chips', { 'aria-label': `${o.label}, added` }));
    const input = (this.input = el('input', 'chip-input__input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', spellcheck: 'false', enterkeyhint: 'enter', 'aria-label': o.label }));
    input.placeholder = o.placeholder;
    const status = (this.status = el('div', 'chip-input__status', { role: 'status', 'aria-live': 'polite' }));
    this.hidden = el('div', 'chip-input__hidden');
    field.append(list, input);
    root.append(field, this.hidden, status);
    if (o.suggestions) {
      input.setAttribute('role', 'combobox');
      input.setAttribute('aria-autocomplete', 'list');
      input.setAttribute('aria-expanded', 'false');
      input.setAttribute('aria-controls', `${id}-lb`);
      this.lb = el('ul', 'chip-input__list', { id: `${id}-lb`, role: 'listbox', 'aria-label': `${o.label} suggestions`, hidden: '' });
      root.appendChild(this.lb);
    }
    this.target.appendChild(root);

    const on = (t, ev, fn) => { t.addEventListener(ev, fn); this._off.push(() => t.removeEventListener(ev, fn)); };
    on(field, 'mousedown', (e) => { if (e.target === field || e.target === list) { e.preventDefault(); input.focus(); } });
    on(input, 'keydown', (e) => this._inKey(e));
    on(input, 'input', () => this._onInput());
    on(input, 'paste', (e) => this._onPaste(e));
    on(input, 'compositionstart', () => { this._composing = true; });
    on(input, 'compositionend', () => { this._composing = false; this._suggest(); });
    on(input, 'blur', () => { this._commitText(); this._closeSugg(); });
    on(list, 'keydown', (e) => this._chipKey(e));
    on(list, 'click', (e) => {
      const b = e.target.closest('.chip-input__remove');
      if (b) { this.remove(b.parentNode.dataset.value); input.focus(); }
    });
    if (this.lb) {
      on(this.lb, 'mousedown', (e) => e.preventDefault());
      on(this.lb, 'click', (e) => { const li = e.target.closest('[role=option]'); if (li) this._pick(li.dataset.value); });
    }
    const form = this.target.closest('form');
    if (form) on(form, 'reset', () => this.setValues(this._initial));
  }

  _addChip(v, animate) {
    const li = el('li', 'chip-input__chip', { tabindex: '-1' });
    li.dataset.value = v;
    const label = el('span', 'chip-input__label');
    label.textContent = v;
    const btn = el('button', 'chip-input__remove', { type: 'button', tabindex: '-1', 'aria-label': `Remove ${v}` });
    btn.textContent = '×';
    li.append(el('span', 'chip-input__hole', { 'aria-hidden': 'true' }), label, btn);
    this._chips.set(keyOf(v), li);
    this.list.appendChild(li);
    if (animate && !reduced()) li.classList.add('is-new');
  }

  _leave(li) {
    if (!li) return;
    if (reduced()) return li.remove();
    li.classList.add('is-leaving');
    this._later(() => li.remove(), this.variant === 'stamp' ? 360 : 260);
  }

  _flash(v) {
    const li = this._chips.get(keyOf(v));
    if (!li) return;
    li.classList.remove('is-dup', 'is-new');
    void li.offsetWidth;
    li.classList.add('is-dup');
    this._later(() => li.classList.remove('is-dup'), 600);
  }

  _sync() {
    const n = this._values.length;
    this._values.forEach((v) => this.list.appendChild(this._chips.get(keyOf(v))));
    this.root.classList.toggle('is-full', n >= this.max);
    this.root.classList.toggle('is-nearly-full', this.max !== Infinity && n < this.max && n >= Math.ceil(this.max * 0.8));
    this.input.placeholder = n ? '' : this.opts.placeholder;
    if (this.opts.name) {
      this.hidden.textContent = '';
      this._values.forEach((v) => { const h = el('input', '', { type: 'hidden', name: this.opts.name }); h.value = v; this.hidden.appendChild(h); });
    }
  }

  _commitText() {
    const t = norm(this.input.value);
    if (!t) { this.input.value = ''; return; }
    const r = this.add(t);
    if (r.added.length || r.skipped.duplicate.length) this.input.value = '';
    this._closeSugg();
  }

  _onInput() {
    this.input.removeAttribute('aria-invalid');
    if (this._composing) return;
    const d = this.opts.delimiters;
    const v = this.input.value;
    if (d.some((c) => v.includes(c)) || /[\r\n]/.test(v)) {
      const parts = v.split(new RegExp(`[${d.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('')}\\r\\n]`));
      const rest = parts.pop();
      this.add(parts.filter((p) => norm(p)));
      this.input.value = rest;
    }
    this._suggest();
  }

  _onPaste(e) {
    const text = (e.clipboardData || window.clipboardData)?.getData('text') ?? '';
    const d = this.opts.delimiters;
    if (!d.some((c) => text.includes(c)) && !/[\r\n]/.test(text)) return;
    e.preventDefault();
    this.add(splitText(text, d));
    this._closeSugg();
  }

  _inKey(e) {
    if (e.isComposing || e.keyCode === 229 || this._composing) return;
    const input = this.input;
    const open = this.lb && !this.lb.hidden;
    if (this.lb && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      if (!open) this._suggest(true);
      else this._setActive((this._active + (e.key === 'ArrowDown' ? 1 : -1) + this._sugg.length) % this._sugg.length);
      return;
    }
    if (e.key === 'Escape' && open) { e.preventDefault(); this._closeSugg(); return; }
    if (e.key === 'Enter') {
      if (open && this._active >= 0) { e.preventDefault(); this._pick(this._sugg[this._active]); return; }
      if (norm(input.value)) { e.preventDefault(); this._commitText(); }
      return;
    }
    if (this.opts.delimiters.includes(e.key)) { e.preventDefault(); this._commitText(); return; }
    const atStart = !input.value && input.selectionStart === 0;
    if (e.key === 'Backspace' && atStart && this._values.length) {
      e.preventDefault();
      this._pullBack();
    } else if (e.key === 'ArrowLeft' && atStart && this._values.length) {
      e.preventDefault();
      this._chips.get(keyOf(this._values[this._values.length - 1])).focus();
    }
  }

  _pullBack() {
    const last = this._values.pop();
    this._chips.get(keyOf(last))?.remove();
    this._chips.delete(keyOf(last));
    this._sync();
    this.input.value = last;
    this.input.setSelectionRange(last.length, last.length);
    this._say(`Editing ${last}.`);
    this._emit('remove', [last]);
  }

  _chipKey(e) {
    const li = e.target.closest('.chip-input__chip');
    if (!li || e.target !== li) return;
    const v = li.dataset.value;
    const i = this._values.findIndex((x) => keyOf(x) === keyOf(v));
    const go = (j) => (j >= this._values.length ? this.input : this._chips.get(keyOf(this._values[Math.max(0, j)]))).focus();
    if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const to = i + (e.key === 'ArrowLeft' ? -1 : 1);
      if (to < 0 || to >= this._values.length) return;
      this._values = move(this._values, i, to);
      this._sync();
      li.focus();
      this._say(`Moved ${v} to position ${to + 1} of ${this._values.length}.`);
      this._emit('reorder', [v]);
    } else if (e.key === 'ArrowLeft') { e.preventDefault(); go(i - 1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(i + 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); this.input.focus(); }
    else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      this.remove(v);
      go(Math.min(i, this._values.length));
    } else if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); this.input.focus(); }
  }

  _suggest(force) {
    if (!this.lb) return;
    const q = this.input.value;
    if (!force && !norm(q)) return this._closeSugg();
    this._sugg = filterSuggestions(this.opts.suggestions, q, this._values, this.opts.allowDuplicates);
    if (!this._sugg.length) return this._closeSugg();
    this.lb.textContent = '';
    this._sugg.forEach((s, i) => {
      const o = el('li', 'chip-input__option', { role: 'option', id: `${this._id}-o${i}`, 'aria-selected': 'false' });
      o.dataset.value = s;
      o.textContent = s;
      this.lb.appendChild(o);
    });
    this.lb.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    this._setActive(-1);
  }

  _setActive(i) {
    this._active = i;
    this.lb.querySelectorAll('[role=option]').forEach((o, j) => {
      o.setAttribute('aria-selected', String(j === i));
      o.classList.toggle('is-active', j === i);
    });
    if (i >= 0) this.input.setAttribute('aria-activedescendant', `${this._id}-o${i}`);
    else this.input.removeAttribute('aria-activedescendant');
  }

  _closeSugg() {
    if (!this.lb) return;
    this.lb.hidden = true;
    this._active = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }

  _pick(v) {
    this.add(v);
    this.input.value = '';
    this._closeSugg();
    this.input.focus();
  }
}

export default ChipInput;
