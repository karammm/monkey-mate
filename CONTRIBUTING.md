# Contributing to monkey-mate

1. Run Momo while you work on it: `claude --plugin-dir .` (saving a file reloads the mod).
2. Keep logic in the pure modules (`signals.ts`, `mood.ts`, `ledger.ts`, `art.ts`, `phrases.ts`): they never touch the Claude Code API, so they are easy to test and survive API changes.
3. Only `register.tsx` and `ui.tsx` talk to Claude Code. A function there that takes `$` must be a `function` declaration (the plugin validator follows `$` only into those).
4. Before a pull request: `claude plugin validate .` and `claude plugin test .` must pass.

Easy first contributions: new phrases in `hooks/phrases.ts`, new risky-command patterns in `hooks/signals.ts` (with a test), new poses or expressions in `hooks/sprite.ts` (every row 18 pixels, colors from `PALETTE`), new ASCII faces in `hooks/art.ts` (used outside the terminal).
