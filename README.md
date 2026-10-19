<div align="center">

<img src="assets/momo-demo.png" alt="Momo, a big-eared white pixel-art monkey, hopping across his stage" width="576">

# monkey-mate

**An emotionally aware companion for Claude Code.**

Momo is a small plush white monkey, all ears and big amber eyes, who lives in a side pane of your Claude Code session. He watches every
tool call, reacts to how the work is going, warns you before destructive commands, and summarises what
changed at the end of every turn.

[![CI](https://github.com/karammm/monkey-mate/actions/workflows/ci.yml/badge.svg)](https://github.com/karammm/monkey-mate/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Claude Code plugin](https://img.shields.io/badge/Claude%20Code-plugin-d97757.svg)](https://claude.com/claude-code)
![Platforms](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg)

[Installation](#installation) · [Features](#features) · [Commands](#commands) · [How it works](#how-it-works) · [Contributing](#contributing)

</div>

---

## Why

Long agentic coding sessions are a wall of tool calls. It is easy to miss that the same test has failed
three times, or that a `git reset --hard` just went by. Momo turns those signals into something you notice
at a glance, without blocking or slowing Claude down.

## Features

- **Animated pixel-art companion.** Momo is drawn in full color in the terminal and hops around his stage.
  How often and how high he jumps depends on his mood.
- **Seven moods.** A rule-based mood engine reacts to test results, build results, errors, risky commands and
  the tone of your prompts. It uses no extra tokens and never sends your code anywhere.
- **Destructive-command warnings.** `rm -rf`, `git push --force`, `git reset --hard`, `git clean -f`,
  `DROP TABLE`, `mkfs`, `dd`, and on Windows `Remove-Item -Recurse -Force`, `rd /s` and `del /s`.
- **Repeated-failure detection.** When the same error appears twice in a row, Momo tells you to step back and
  try a different approach.
- **Turn summaries.** At the end of every turn Momo reports the files created and edited, the commands run,
  the test results and any warnings.
- **Emotionally balanced.** Momo's mood drifts back toward calm every turn, and a clean turn halves any grudge.
- **Observe-only.** Momo never blocks, changes or delays a tool call.

<div align="center">
<img src="assets/momo-moods.png" alt="Momo's seven moods: happy, proud, calm, curious, worried, angry, sleepy" width="760">
</div>

| Mood | When |
| --- | --- |
| 😄 **Happy** | Tests pass, builds succeed, you say thanks |
| 😎 **Proud** | A long streak of successful work |
| 🙂 **Calm** | Nothing notable is happening |
| 🤔 **Curious** | You have just sent a new prompt |
| 😟 **Worried** | A command or test failed, or a destructive command ran |
| 😠 **Angry** | The same error happened twice in a row |
| 😴 **Sleepy** | Nothing has happened for 10 minutes |

## Installation

Requires Claude Code **2.1.303 or later**.

At the prompt of a Claude Code terminal session:

```text
/plugin install monkey-mate --marketplace karammm/monkey-mate
```

Answer `y` to add the marketplace, then choose a scope. Or from a shell:

```bash
claude plugin install monkey-mate --marketplace karammm/monkey-mate
```

In the Claude desktop app: click **+** next to the prompt box, then **Plugins** → **Add marketplace** with
`karammm/monkey-mate` → **Add plugin**.

## Commands

| Command | Description |
| --- | --- |
| `/momo` | Show Momo's mood and the list of commands |
| `/momo changes` | Summarise what changed in the last turn |
| `/momo recap` | Summarise the whole session |
| `/momo pet` | Cheer Momo up |
| `/momo quiet` | Stop warning toasts (the pane and status line still update) |
| `/momo loud` | Turn warning toasts back on |

## Display

| Where | What you see |
| --- | --- |
| Terminal, 110+ columns | A side pane with animated pixel-art Momo, his mood meter and a speech bubble |
| Terminal, narrower | A one-line strip above the prompt |
| Status line | Momo's current mood, always |
| Desktop app, VS Code | The pane with an ASCII Momo (pixel graphics are terminal-only) |

Pixel art uses true-color half-block characters. It looks best in a terminal with 24-bit color such as
iTerm2, Ghostty, kitty, WezTerm or Windows Terminal. Others show the nearest colors.

## How it works

monkey-mate is a Claude Code function-hook plugin written in TypeScript. It runs inside Claude Code, with no
shell scripts, background processes or network access.

```
tool calls ─┐
prompts ────┼─► signals.ts ─► mood.ts ───► ui.tsx  (pane, band, status line)
turn ends ──┘        │                       ▲
                     └──► ledger.ts ─────────┘   stage.ts + sprite.ts (animation)
```

| Module | Responsibility |
| --- | --- |
| [`hooks/register.tsx`](hooks/register.tsx) | Connects Claude Code events to the modules below |
| [`hooks/signals.ts`](hooks/signals.ts) | Classifies tool calls and prompts: tests, builds, errors, risky commands, tone |
| [`hooks/mood.ts`](hooks/mood.ts) | The mood engine: a score from -100 to +100 with decay, streaks and short flashes |
| [`hooks/ledger.ts`](hooks/ledger.ts) | Tracks changes per turn and per session |
| [`hooks/sprite.ts`](hooks/sprite.ts) | Momo's pixel art: 32×28 sprites per mood and pose, built from shapes |
| [`hooks/stage.ts`](hooks/stage.ts) | Jump physics and encoding pixels into terminal cells |
| [`hooks/ui.tsx`](hooks/ui.tsx) | The pane and the band |

Everything except `register.tsx` and `ui.tsx` is pure TypeScript with no Claude Code API calls, so it is easy
to test and to extend.

## Privacy

Momo keeps everything in memory for the current session, except the `/momo quiet` setting, which Claude Code
stores locally. Nothing is sent over the network and no model calls are made.

## Limitations

- Momo lives inside his pane. Claude Code plugins cannot draw over the conversation itself.
- The function-hook plugin API is in early access, so a future Claude Code release may need an update here.

## Contributing

Contributions are welcome: new phrases, risky-command patterns, poses and moods. See
[CONTRIBUTING.md](CONTRIBUTING.md).

```bash
git clone https://github.com/karammm/monkey-mate && cd monkey-mate
claude --plugin-dir .        # run Claude Code with Momo loaded; saving a file reloads him
claude plugin validate .     # check the manifest and hooks
claude plugin test .         # run the test suite
```

## Roadmap

- Optional sound effects
- Optional AI-written one-liners (off by default)
- Lifetime statistics across sessions

## License

[MIT](LICENSE) © karammm
