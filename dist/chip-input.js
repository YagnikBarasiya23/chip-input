const p = (n) => String(n ?? "").replace(/\s+/g, " ").trim(), o = (n) => p(n).toLowerCase();
function m(n, t = [","]) {
  const e = t.map((i) => i.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("");
  return String(n ?? "").split(new RegExp(`[${e}\\r\\n]+`)).map(p).filter(Boolean);
}
function g(n, t, { max: e = 1 / 0, allowDuplicates: i = !1, validate: s } = {}) {
  const a = n.slice(), l = new Set(a.map(o)), d = [], r = { duplicate: [], invalid: [], max: [] }, _ = [];
  for (const h of t) {
    const u = p(h);
    if (u) {
      if (!i && l.has(o(u))) {
        r.duplicate.push(u);
        continue;
      }
      if (a.length >= e) {
        r.max.push(u);
        continue;
      }
      if (s) {
        const f = s(u, a.slice());
        if (f === !1 || typeof f == "string") {
          r.invalid.push(u), _.push(typeof f == "string" ? f : `${u} is not valid.`);
          continue;
        }
      }
      a.push(u), l.add(o(u)), d.push(u);
    }
  }
  return { values: a, added: d, skipped: r, errors: _ };
}
function y(n, t, e) {
  if (t < 0 || t >= n.length || e < 0 || e >= n.length || t === e) return n.slice();
  const i = n.slice(), [s] = i.splice(t, 1);
  return i.splice(e, 0, s), i;
}
function b(n, t, e, i = !1, s = 8) {
  const a = o(t), l = new Set(i ? [] : e.map(o)), d = n.map(p).filter((h) => h && !l.has(o(h))), r = d.filter((h) => o(h).startsWith(a)), _ = d.filter((h) => !o(h).startsWith(a) && o(h).includes(a));
  return [...r, ..._].slice(0, s);
}
function k(n, t) {
  const e = n.added.length, i = n.skipped.duplicate.length + n.skipped.invalid.length + n.skipped.max.length;
  return e === 1 && !i ? `Added ${n.added[0]}.` : e === 0 && n.skipped.duplicate.length === 1 && i === 1 ? `${n.skipped.duplicate[0]} is already added.` : e === 0 && n.errors.length === 1 && i === 1 ? n.errors[0] : e === 0 && n.skipped.max.length && i === n.skipped.max.length ? `Maximum of ${t} reached.` : e === 0 && !i ? "" : `Added ${e}${i ? `, skipped ${i}` : ""}${n.skipped.max.length ? `. Maximum of ${t} reached` : ""}.`;
}
let x = 0;
const v = () => matchMedia("(prefers-reduced-motion: reduce)").matches, c = (n, t, e) => {
  const i = document.createElement(n);
  t && (i.className = t);
  for (const s in e) i.setAttribute(s, e[s]);
  return i;
};
class w {
  constructor(t, e = {}) {
    if (!t) throw new TypeError("ChipInput: target element is required");
    this.target = t, this.opts = { label: "Tags", placeholder: "Add a tag…", delimiters: [","], allowDuplicates: !1, ...e }, this.max = Number.isFinite(e.max) && e.max > 0 ? Math.floor(e.max) : 1 / 0, this._values = [], this._chips = /* @__PURE__ */ new Map(), this._timers = /* @__PURE__ */ new Set(), this._off = [], this._id = `ci${++x}`, this._composing = !1, this._active = -1, this._sugg = [], this._build();
    const i = g([], e.values || [], this._rules());
    this._values = i.values, i.added.forEach((s) => this._addChip(s, !1)), this._initial = this._values.slice(), this._sync();
  }
  get values() {
    return this._values.slice();
  }
  add(t) {
    const e = g(this._values, Array.isArray(t) ? t : [t], this._rules());
    return this._values = e.values, e.added.forEach((i) => this._addChip(i, !0)), e.skipped.duplicate.forEach((i) => this._flash(i)), this._sync(), this._say(k(e, this.max)), e.errors.length && this.input.setAttribute("aria-invalid", "true"), e.added.length && this._emit("add", e.added), e;
  }
  remove(t) {
    const e = this._values.findIndex((a) => o(a) === o(t));
    if (e < 0) return !1;
    const [i] = this._values.splice(e, 1), s = this._chips.get(o(i));
    return this._chips.delete(o(i)), this._leave(s), this._sync(), this._say(`Removed ${i}.`), this._emit("remove", [i]), !0;
  }
  clear() {
    this.setValues([]);
  }
  setValues(t, e = !1) {
    this._chips.forEach((s) => s.remove()), this._chips.clear();
    const i = g([], t, this._rules());
    this._values = i.values, i.added.forEach((s) => this._addChip(s, !1)), this._sync(), e || this._emit("set", i.added);
  }
  focus() {
    this.input.focus();
  }
  destroy() {
    this._timers.forEach(clearTimeout), this._timers.clear(), this._off.forEach((t) => t()), this._off = [], this.root.remove();
  }
  _rules() {
    return { max: this.max, allowDuplicates: this.opts.allowDuplicates, validate: this.opts.validate };
  }
  _emit(t, e) {
    this.opts.onChange?.(this.values, { type: t, changed: e });
  }
  _say(t) {
    this.status.textContent = t;
  }
  _later(t, e) {
    const i = setTimeout(() => {
      this._timers.delete(i), t();
    }, e);
    this._timers.add(i);
  }
  _build() {
    const t = this.opts, e = this._id, i = this.root = c("div", "chip-input"), s = this.field = c("div", "chip-input__field"), a = this.list = c("ul", "chip-input__chips", { "aria-label": `${t.label}, added` }), l = this.input = c("input", "chip-input__input", { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false", enterkeyhint: "enter", "aria-label": t.label });
    l.placeholder = t.placeholder;
    const d = this.status = c("div", "chip-input__status", { role: "status", "aria-live": "polite" });
    this.hidden = c("div", "chip-input__hidden"), s.append(a, l), i.append(s, this.hidden, d), t.suggestions && (l.setAttribute("role", "combobox"), l.setAttribute("aria-autocomplete", "list"), l.setAttribute("aria-expanded", "false"), l.setAttribute("aria-controls", `${e}-lb`), this.lb = c("ul", "chip-input__list", { id: `${e}-lb`, role: "listbox", "aria-label": `${t.label} suggestions`, hidden: "" }), i.appendChild(this.lb)), this.target.appendChild(i);
    const r = (h, u, f) => {
      h.addEventListener(u, f), this._off.push(() => h.removeEventListener(u, f));
    };
    r(s, "mousedown", (h) => {
      (h.target === s || h.target === a) && (h.preventDefault(), l.focus());
    }), r(l, "keydown", (h) => this._inKey(h)), r(l, "input", () => this._onInput()), r(l, "paste", (h) => this._onPaste(h)), r(l, "compositionstart", () => {
      this._composing = !0;
    }), r(l, "compositionend", () => {
      this._composing = !1, this._suggest();
    }), r(l, "blur", () => {
      this._commitText(), this._closeSugg();
    }), r(a, "keydown", (h) => this._chipKey(h)), r(a, "click", (h) => {
      const u = h.target.closest(".chip-input__remove");
      u && (this.remove(u.parentNode.dataset.value), l.focus());
    }), this.lb && (r(this.lb, "mousedown", (h) => h.preventDefault()), r(this.lb, "click", (h) => {
      const u = h.target.closest("[role=option]");
      u && this._pick(u.dataset.value);
    }));
    const _ = this.target.closest("form");
    _ && r(_, "reset", () => this.setValues(this._initial));
  }
  _addChip(t, e) {
    const i = c("li", "chip-input__chip", { tabindex: "-1" });
    i.dataset.value = t;
    const s = c("span", "chip-input__label");
    s.textContent = t;
    const a = c("button", "chip-input__remove", { type: "button", tabindex: "-1", "aria-label": `Remove ${t}` });
    a.textContent = "×", i.append(c("span", "chip-input__hole", { "aria-hidden": "true" }), s, a), this._chips.set(o(t), i), this.list.appendChild(i), e && !v() && i.classList.add("is-new");
  }
  _leave(t) {
    if (t) {
      if (v()) return t.remove();
      t.classList.add("is-leaving"), this._later(() => t.remove(), 260);
    }
  }
  _flash(t) {
    const e = this._chips.get(o(t));
    e && (e.classList.remove("is-dup", "is-new"), e.offsetWidth, e.classList.add("is-dup"), this._later(() => e.classList.remove("is-dup"), 600));
  }
  _sync() {
    const t = this._values.length;
    this._values.forEach((e) => this.list.appendChild(this._chips.get(o(e)))), this.root.classList.toggle("is-full", t >= this.max), this.root.classList.toggle("is-nearly-full", this.max !== 1 / 0 && t < this.max && t >= Math.ceil(this.max * 0.8)), this.input.placeholder = t ? "" : this.opts.placeholder, this.opts.name && (this.hidden.textContent = "", this._values.forEach((e) => {
      const i = c("input", "", { type: "hidden", name: this.opts.name });
      i.value = e, this.hidden.appendChild(i);
    }));
  }
  _commitText() {
    const t = p(this.input.value);
    if (!t) {
      this.input.value = "";
      return;
    }
    const e = this.add(t);
    (e.added.length || e.skipped.duplicate.length) && (this.input.value = ""), this._closeSugg();
  }
  _onInput() {
    if (this.input.removeAttribute("aria-invalid"), this._composing) return;
    const t = this.opts.delimiters, e = this.input.value;
    if (t.some((i) => e.includes(i)) || /[\r\n]/.test(e)) {
      const i = e.split(new RegExp(`[${t.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("")}\\r\\n]`)), s = i.pop();
      this.add(i.filter((a) => p(a))), this.input.value = s;
    }
    this._suggest();
  }
  _onPaste(t) {
    const e = (t.clipboardData || window.clipboardData)?.getData("text") ?? "", i = this.opts.delimiters;
    !i.some((s) => e.includes(s)) && !/[\r\n]/.test(e) || (t.preventDefault(), this.add(m(e, i)), this._closeSugg());
  }
  _inKey(t) {
    if (t.isComposing || t.keyCode === 229 || this._composing) return;
    const e = this.input, i = this.lb && !this.lb.hidden;
    if (this.lb && (t.key === "ArrowDown" || t.key === "ArrowUp")) {
      t.preventDefault(), i ? this._setActive((this._active + (t.key === "ArrowDown" ? 1 : -1) + this._sugg.length) % this._sugg.length) : this._suggest(!0);
      return;
    }
    if (t.key === "Escape" && i) {
      t.preventDefault(), this._closeSugg();
      return;
    }
    if (t.key === "Enter") {
      if (i && this._active >= 0) {
        t.preventDefault(), this._pick(this._sugg[this._active]);
        return;
      }
      p(e.value) && (t.preventDefault(), this._commitText());
      return;
    }
    if (this.opts.delimiters.includes(t.key)) {
      t.preventDefault(), this._commitText();
      return;
    }
    const s = !e.value && e.selectionStart === 0;
    t.key === "Backspace" && s && this._values.length ? (t.preventDefault(), this._pullBack()) : t.key === "ArrowLeft" && s && this._values.length && (t.preventDefault(), this._chips.get(o(this._values[this._values.length - 1])).focus());
  }
  _pullBack() {
    const t = this._values.pop();
    this._chips.get(o(t))?.remove(), this._chips.delete(o(t)), this._sync(), this.input.value = t, this.input.setSelectionRange(t.length, t.length), this._say(`Editing ${t}.`), this._emit("remove", [t]);
  }
  _chipKey(t) {
    const e = t.target.closest(".chip-input__chip");
    if (!e || t.target !== e) return;
    const i = e.dataset.value, s = this._values.findIndex((l) => o(l) === o(i)), a = (l) => (l >= this._values.length ? this.input : this._chips.get(o(this._values[Math.max(0, l)]))).focus();
    if (t.altKey && (t.key === "ArrowLeft" || t.key === "ArrowRight")) {
      t.preventDefault();
      const l = s + (t.key === "ArrowLeft" ? -1 : 1);
      if (l < 0 || l >= this._values.length) return;
      this._values = y(this._values, s, l), this._sync(), e.focus(), this._say(`Moved ${i} to position ${l + 1} of ${this._values.length}.`), this._emit("reorder", [i]);
    } else t.key === "ArrowLeft" ? (t.preventDefault(), a(s - 1)) : t.key === "ArrowRight" ? (t.preventDefault(), a(s + 1)) : t.key === "Home" ? (t.preventDefault(), a(0)) : t.key === "End" ? (t.preventDefault(), this.input.focus()) : t.key === "Delete" || t.key === "Backspace" ? (t.preventDefault(), this.remove(i), a(Math.min(s, this._values.length))) : (t.key === "Enter" || t.key === "Escape") && (t.preventDefault(), this.input.focus());
  }
  _suggest(t) {
    if (!this.lb) return;
    const e = this.input.value;
    if (!t && !p(e)) return this._closeSugg();
    if (this._sugg = b(this.opts.suggestions, e, this._values, this.opts.allowDuplicates), !this._sugg.length) return this._closeSugg();
    this.lb.textContent = "", this._sugg.forEach((i, s) => {
      const a = c("li", "chip-input__option", { role: "option", id: `${this._id}-o${s}`, "aria-selected": "false" });
      a.dataset.value = i, a.textContent = i, this.lb.appendChild(a);
    }), this.lb.hidden = !1, this.input.setAttribute("aria-expanded", "true"), this._setActive(-1);
  }
  _setActive(t) {
    this._active = t, this.lb.querySelectorAll("[role=option]").forEach((e, i) => {
      e.setAttribute("aria-selected", String(i === t)), e.classList.toggle("is-active", i === t);
    }), t >= 0 ? this.input.setAttribute("aria-activedescendant", `${this._id}-o${t}`) : this.input.removeAttribute("aria-activedescendant");
  }
  _closeSugg() {
    this.lb && (this.lb.hidden = !0, this._active = -1, this.input.setAttribute("aria-expanded", "false"), this.input.removeAttribute("aria-activedescendant"));
  }
  _pick(t) {
    this.add(t), this.input.value = "", this._closeSugg(), this.input.focus();
  }
}
export {
  w as ChipInput,
  w as default
};
