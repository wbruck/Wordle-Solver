"use strict";

/*
 * Wordle Solver
 * -------------
 * The user distills what they've learned into three kinds of clue:
 *   - greens[i]  : a letter known to sit in position i (correct spot)
 *   - "present"  : a letter known to be in the word, spot unknown (yellow)
 *   - "absent"   : a letter known not to be in the word (grey)
 * We filter the complete list of valid Wordle words to those still consistent
 * with every clue, then report the per-position letter odds and overall letter
 * frequency. Using the full accepted-guess list (not just answers) means no
 * legal word is ever missing — which matters most in hard mode.
 *
 * WORDS comes from words.js, loaded before this script.
 */

const STORAGE_KEY = "wordle-solver-state";
const KB_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];
const MAX_POS_LETTERS = 6;   // rows shown under each position tile
const MAX_FREQ_LETTERS = 12; // bars shown in the overall-frequency panel
const MAX_WORDS_SHOWN = 60;  // chips shown in the possible-words list

// --- State ------------------------------------------------------------------

let greens = [null, null, null, null, null];
// letter -> "absent" | "present". Green letters are derived from `greens`.
let keyStates = {};

function greenLetterSet() {
  return new Set(greens.filter(Boolean));
}

function lettersInState(state) {
  return Object.keys(keyStates).filter((l) => keyStates[l] === state);
}

// --- Core computation -------------------------------------------------------

/** Valid words still consistent with every clue entered so far. */
function computeRemaining() {
  const present = lettersInState("present");
  const absent = lettersInState("absent");
  const greenSet = greenLetterSet();

  return WORDS.filter((w) => {
    for (let i = 0; i < 5; i++) {
      if (greens[i] && w[i] !== greens[i]) return false;
    }
    for (const l of present) {
      if (!w.includes(l)) return false;
    }
    for (const l of absent) {
      // A letter that's also green/present is not truly "absent" (duplicate
      // letters): skip it here so contradictory input can't wipe every word.
      if (greenSet.has(l)) continue;
      if (w.includes(l)) return false;
    }
    return true;
  });
}

/** For each position, letters ranked by how often they appear there. */
function positionProbabilities(words) {
  const counts = [new Map(), new Map(), new Map(), new Map(), new Map()];
  for (const w of words) {
    for (let i = 0; i < 5; i++) {
      counts[i].set(w[i], (counts[i].get(w[i]) || 0) + 1);
    }
  }
  const n = words.length || 1;
  return counts.map((m) =>
    [...m.entries()]
      .map(([letter, count]) => ({ letter, count, p: count / n }))
      .sort((a, b) => b.p - a.p)
  );
}

/** Share of remaining words containing each still-untested letter. */
function letterFrequency(words) {
  const known = new Set([...greens.filter(Boolean), ...Object.keys(keyStates)]);
  const counts = new Map();
  for (const w of words) {
    for (const l of new Set(w)) counts.set(l, (counts.get(l) || 0) + 1);
  }
  const n = words.length || 1;
  return [...counts.entries()]
    .filter(([letter]) => !known.has(letter))
    .map(([letter, count]) => ({ letter, count, p: count / n }))
    .sort((a, b) => b.p - a.p);
}

// --- Rendering --------------------------------------------------------------

const el = {
  greenRow: document.getElementById("greenRow"),
  keyboard: document.getElementById("keyboard"),
  count: document.getElementById("count"),
  positions: document.getElementById("positions"),
  freq: document.getElementById("freq"),
  wordsSummary: document.getElementById("wordsSummary"),
  wordList: document.getElementById("wordList"),
  resetBtn: document.getElementById("resetBtn"),
};

const pct = (p) => (p * 100 < 1 ? (p * 100).toFixed(1) : Math.round(p * 100)) + "%";

function buildGreenRow() {
  el.greenRow.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "text";
    input.maxLength = 1;
    input.autocapitalize = "characters";
    input.setAttribute("aria-label", `Correct letter in position ${i + 1}`);
    input.dataset.index = String(i);
    input.addEventListener("input", onGreenInput);
    input.addEventListener("keydown", onGreenKeydown);
    el.greenRow.appendChild(input);
  }
}

function buildKeyboard() {
  el.keyboard.innerHTML = "";
  for (const row of KB_ROWS) {
    const rowEl = document.createElement("div");
    rowEl.className = "kb-row";
    for (const letter of row) {
      const key = document.createElement("button");
      key.type = "button";
      key.className = "key";
      key.textContent = letter;
      key.dataset.letter = letter;
      key.addEventListener("click", () => cycleKey(letter));
      rowEl.appendChild(key);
    }
    el.keyboard.appendChild(rowEl);
  }
}

function renderInputs() {
  const greenSet = greenLetterSet();
  // Green tiles
  el.greenRow.querySelectorAll("input").forEach((input, i) => {
    input.value = greens[i] ? greens[i].toUpperCase() : "";
    input.classList.toggle("filled", Boolean(greens[i]));
  });
  // Keyboard states (green wins visually and is locked)
  el.keyboard.querySelectorAll(".key").forEach((key) => {
    const l = key.dataset.letter;
    key.classList.remove("state-absent", "state-present", "state-correct");
    if (greenSet.has(l)) key.classList.add("state-correct");
    else if (keyStates[l] === "absent") key.classList.add("state-absent");
    else if (keyStates[l] === "present") key.classList.add("state-present");
  });
}

function renderCount(words) {
  el.count.classList.remove("none", "solved");
  if (words.length === 0) {
    el.count.classList.add("none");
    el.count.textContent = "No words match these clues — double-check your grey letters.";
  } else if (words.length === 1) {
    el.count.classList.add("solved");
    el.count.innerHTML = `🎉 The answer is <strong>${words[0].toUpperCase()}</strong>`;
  } else {
    el.count.innerHTML = `<strong>${words.length}</strong> possible words remain`;
  }
}

function renderPositions(words) {
  const probs = positionProbabilities(words);
  el.positions.innerHTML = "";
  for (let i = 0; i < 5; i++) {
    const card = document.createElement("div");
    card.className = "pos-card";

    const tile = document.createElement("div");
    tile.className = "pos-tile";
    if (greens[i]) {
      tile.classList.add("locked");
      tile.textContent = greens[i].toUpperCase();
    } else {
      tile.textContent = "?";
    }
    card.appendChild(tile);

    const rows = document.createElement("div");
    rows.className = "pos-rows";
    const list = probs[i];
    if (words.length === 0 || list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "pos-empty";
      empty.textContent = "—";
      rows.appendChild(empty);
    } else {
      const max = list[0].p || 1;
      for (const item of list.slice(0, MAX_POS_LETTERS)) {
        rows.appendChild(posLine(item, max));
      }
    }
    card.appendChild(rows);
    el.positions.appendChild(card);
  }
}

function posLine(item, max) {
  const line = document.createElement("div");
  line.className = "pos-line";
  const bar = document.createElement("div");
  bar.className = "pos-bar";
  const fill = document.createElement("span");
  fill.style.width = (item.p / max) * 100 + "%"; // relative to top letter for readability
  bar.appendChild(fill);
  const label = document.createElement("div");
  label.className = "pos-line-label";
  label.innerHTML = `<b>${item.letter}</b><span>${pct(item.p)}</span>`;
  line.appendChild(bar);
  line.appendChild(label);
  return line;
}

function renderFrequency(words) {
  const freq = letterFrequency(words);
  el.freq.innerHTML = "";
  if (words.length === 0 || freq.length === 0) {
    const empty = document.createElement("div");
    empty.className = "freq-empty";
    empty.textContent = words.length === 0
      ? "Nothing to rank."
      : "Every remaining letter is already accounted for.";
    el.freq.appendChild(empty);
    return;
  }
  const max = freq[0].p || 1;
  for (const item of freq.slice(0, MAX_FREQ_LETTERS)) {
    const row = document.createElement("div");
    row.className = "freq-row";
    row.innerHTML =
      `<span class="freq-letter">${item.letter}</span>` +
      `<span class="freq-track"><span class="freq-fill" style="width:${(item.p / max) * 100}%"></span></span>` +
      `<span class="freq-val">${pct(item.p)}</span>`;
    el.freq.appendChild(row);
  }
}

function renderWords(words) {
  el.wordsSummary.textContent =
    words.length === 0 ? "No possible words" : `Possible words (${words.length})`;
  el.wordList.innerHTML = "";
  words.slice(0, MAX_WORDS_SHOWN).forEach((w) => {
    const span = document.createElement("span");
    span.textContent = w;
    el.wordList.appendChild(span);
  });
  if (words.length > MAX_WORDS_SHOWN) {
    const more = document.createElement("span");
    more.className = "more";
    more.textContent = `+ ${words.length - MAX_WORDS_SHOWN} more`;
    el.wordList.appendChild(more);
  }
}

function render() {
  const words = computeRemaining();
  renderInputs();
  renderCount(words);
  renderPositions(words);
  renderFrequency(words);
  renderWords(words);
}

// --- Event handlers ---------------------------------------------------------

function onGreenInput(e) {
  const i = Number(e.target.dataset.index);
  const ch = (e.target.value || "").toLowerCase().replace(/[^a-z]/g, "").slice(-1);
  greens[i] = ch || null;
  if (ch && keyStates[ch]) delete keyStates[ch]; // green overrides a grey/yellow mark
  save();
  render();
  if (ch && i < 4) el.greenRow.querySelectorAll("input")[i + 1].focus();
}

function onGreenKeydown(e) {
  const i = Number(e.target.dataset.index);
  if (e.key === "Backspace" && !e.target.value && i > 0) {
    el.greenRow.querySelectorAll("input")[i - 1].focus();
  } else if (e.key === "ArrowLeft" && i > 0) {
    el.greenRow.querySelectorAll("input")[i - 1].focus();
  } else if (e.key === "ArrowRight" && i < 4) {
    el.greenRow.querySelectorAll("input")[i + 1].focus();
  }
}

function cycleKey(letter) {
  if (greenLetterSet().has(letter)) return; // locked: this letter is a confirmed green
  const s = keyStates[letter];
  if (!s) keyStates[letter] = "absent";
  else if (s === "absent") keyStates[letter] = "present";
  else delete keyStates[letter];
  save();
  render();
}

function reset() {
  greens = [null, null, null, null, null];
  keyStates = {};
  save();
  render();
}

// --- Persistence ------------------------------------------------------------

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ greens, keyStates }));
  } catch (_) { /* storage may be unavailable; ignore */ }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (Array.isArray(data.greens) && data.greens.length === 5) {
      greens = data.greens.map((g) => (typeof g === "string" && /^[a-z]$/.test(g) ? g : null));
    }
    if (data.keyStates && typeof data.keyStates === "object") {
      for (const [l, s] of Object.entries(data.keyStates)) {
        if (/^[a-z]$/.test(l) && (s === "absent" || s === "present")) keyStates[l] = s;
      }
    }
  } catch (_) { /* corrupt state; start fresh */ }
}

// --- Init -------------------------------------------------------------------

buildGreenRow();
buildKeyboard();
load();
el.resetBtn.addEventListener("click", reset);
render();
