# Wordle Solver

A tiny static web page that helps you crack the daily [Wordle](https://www.nytimes.com/games/wordle). Enter the clues you've collected and it shows the probability of every letter in every position, plus the words that are still possible.

**Live site:** https://wbruck.github.io/Wordle-Solver/ _(after enabling GitHub Pages — see below)_

## How to use it

Feed the solver the three kinds of clue Wordle gives you:

1. **Right spot (green)** — type a letter into its numbered slot in the top row.
2. **In the word, wrong spot (yellow)** — tap that key **twice** on the on-screen keyboard (it turns yellow).
3. **Not in the word (grey)** — tap that key **once** (it turns grey).

As you go, the page updates live:

- **Probability by position** — for each of the five slots, the letters most likely to be there among the words still in play.
- **Best letters still unknown** — the untested letters that appear in the most remaining words, so you can pick a strong next guess.
- **Possible words** — the full list of remaining candidates (collapsed by default).

Your clues are saved in your browser (`localStorage`), so a refresh won't lose them. Hit **Reset all clues** to start a new puzzle.

## Run it locally

It's plain HTML/CSS/JS with no build step. Any static server works:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

(Opening `index.html` directly via `file://` works too.)

## Deploy to GitHub Pages

A workflow at `.github/workflows/pages.yml` deploys the site on every push to the repo's default branch. To turn it on, once:

1. Go to the repo's **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.

The next push (or a manual run from the **Actions** tab) publishes to the live URL above. The workflow's `branches:` list controls which branches deploy — add or change entries there if your default branch differs.

## How it works

- `words.js` bundles the **complete list of valid Wordle words — 14,855** (every word the game accepts as a guess, including NYT additions) — so nothing is fetched at runtime and no legal word is ever missing, which matters in hard mode.
- Candidates are filtered from that full list: a word survives if it matches every green position, contains every yellow letter, and contains no grey letter. Every remaining word is treated as equally likely.
- Per-position odds are the share of remaining words with each letter in that slot; the frequency panel is the share of remaining words containing each untested letter.

### Note on duplicate letters

Clues are taken at face value: a grey letter is treated as "not in the word." In real Wordle a letter can come back grey while a duplicate of it is green or yellow (you guessed too many copies). The solver guards against that contradiction — a letter marked both grey and green/yellow is not treated as absent — but for the cleanest results, only mark a letter grey when you know it isn't in the word at all.
