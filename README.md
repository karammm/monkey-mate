# monkey-mate 🐒

**Momo** is a cute little white monkey who lives next to your Claude Code session.
Momo watches what Claude does, cheers when tests go green, gets worried before risky commands,
grumbles when the same error shows up twice, and calms down again: an emotionally balanced coding buddy.

```
    .-"""""-.
 .-/         \-.     Momo 😄 happy
( (|  ^   ^  |) )    mood ██████░░░░ +24
 '-\  \___/  /-'    ╭─────────────────────────────╮
    '-.___.-'       │ Tests are green! 🎉          │
     /|   |\        ╰─────────────────────────────╯
      |___|
```

## What Momo does

| Momo sees | Momo feels |
| --- | --- |
| tests pass, builds succeed, steady edits | 😄 happy → 😎 proud on a long streak |
| a new prompt | 🤔 curious |
| `rm -rf`, `git push --force`, `git reset --hard`, `DROP TABLE`, `Remove-Item -Recurse -Force`... | 😟 worried + a warning toast |
| a failing test or command | 😟 worried |
| **the same error twice** | 😠 angry: "Try a different approach!" |
| you typing "wrong", "again", "still broken" | 😟 concerned, suggests slowing down |
| "thanks", "perfect" | 😄 happy |
| nothing for 10 minutes | 😴 sleepy |

Momo's mood is a score from -100 to +100 that drifts back toward calm every turn, and a clean turn
halves any grudge. Momo **only watches and warns. Momo never blocks or changes what Claude does.**

At the end of every turn Momo tells you whether it went well and **shows what changed**:
files created and edited, commands run, test results and warnings.

## Commands

| Command | What it does |
| --- | --- |
| `/momo` | Momo's mood and help |
| `/momo changes` | what changed in the last turn |
| `/momo recap` | the whole session so far |
| `/momo pet` | make Momo happy |
| `/momo quiet` / `/momo loud` | turn warning toasts off / on |

Momo sits in a side pane on wide terminals (110+ columns) and in a one-line band above the prompt on narrow ones.
The status line always shows Momo's mood.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install monkey-mate --marketplace karammm/monkey-mate
```

Answer `y` to add the marketplace, then choose a scope. From a shell:

```
claude plugin install monkey-mate --marketplace karammm/monkey-mate
```

In the desktop app: click + next to the prompt box, then Plugins, Add marketplace with `karammm/monkey-mate`, then Add plugin.

Works on macOS, Linux and Windows: Momo runs inside Claude Code, with no shell scripts.
Needs a Claude Code build with function-hook plugins (2.1.303 or newer). That plugin API is early access, so a future release may need an update here.

## Develop

```
git clone https://github.com/karammm/monkey-mate && cd monkey-mate
claude --plugin-dir .          # run Claude Code with Momo loaded; saves hot-reload
claude plugin validate .       # check the manifest and hooks
claude plugin test .           # run the tests
```

| File | What it is |
| --- | --- |
| `hooks/register.tsx` | wires Claude Code events to Momo |
| `hooks/signals.ts` | turns tool calls and prompts into signals (tests, errors, risky commands...) |
| `hooks/mood.ts` | the emotional engine |
| `hooks/ledger.ts` | what-changed tracking |
| `hooks/art.ts`, `hooks/phrases.ts` | Momo's faces and words |
| `hooks/ui.tsx` | the pane and the band |

See [CONTRIBUTING.md](CONTRIBUTING.md). New faces, phrases and risky-command patterns are very welcome.

## License

MIT
