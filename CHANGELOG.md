# Changelog

## 0.5.0

- Momo speaks: a cute pitched-up system voice for summaries, warnings, live steps and fun, with a talking mouth
- Push-to-talk on macOS (menu or ⌥M): what you say goes into Claude Code's prompt box
- Momo Desktop runs as Momo.app on macOS, with its own name, icon and permission descriptions

## 0.4.0

- Click Momo for a glass menu: tune and dance, music app play/pause, jokes, status, pet, nap, and Ask Claude (fills Claude Code's prompt box)
- Hovering tickles Momo; rubbing back and forth teases him
- Plain-words narration of each step and a one-line summary per turn
- Momo covers his eyes smoothly while you type and can sit beside where you type (macOS, with Accessibility permission)
- No more sunglasses: proud Momo has sparkly eyes

## 0.3.0

- Momo Desktop (desktop/): Momo roams the whole screen in a transparent, click-through window; drag him anywhere, click to pet
- The plugin sends Momo's mood and words to Momo Desktop when it runs; `/momo desktop` connects or explains how to start it
- Momo no longer shows in the strip above the prompt while his pane is open

## 0.2.0

- Momo is now a 3D plush: a white monkey with huge pink-lined ears, big glossy amber eyes, a curly tail, seven expressions and sunglasses when proud
- The 3D model (scripts/momo3d.ts) is rendered into shaded terminal sprites and README images by `bun scripts/bake.ts`
- Momo hops around the pane: jump height, distance and restlessness follow his mood, with a shadow and landing squash
- Momo reacts with a jump the moment something happens
- Professional README with an animated demo

## 0.1.0

- Momo in a side pane (band above the prompt on narrow terminals) and the status line
- Mood engine: happy, proud, calm, curious, worried, angry, sleepy; drifts back to calm
- Warnings for risky commands on macOS, Linux and Windows
- End-of-turn verdicts, `/momo changes`, `/momo recap`, `/momo pet`, `/momo quiet`
