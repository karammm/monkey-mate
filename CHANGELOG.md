# Changelog

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
