# VOIDSTRIKE — Neon Sector Defense

A top-down arcade space shooter. Hostile swarms are pouring through the rift —
hold the line, chain kills into combos, and break the Void Maw.

## How to play

Serve `game/` with any static file server and open `index.html` in a desktop
browser. No network, no build step, no install: every file the game loads lives
under `game/`.

## Controls

| Input | Action |
| --- | --- |
| WASD / Arrow keys | Fly |
| Mouse | Aim |
| Click / Space | Fire |
| P | Pause |
| R | Restart |
| M | Mute |
| Enter | Start / continue |

## Rules

- You have **3 lives**. Enemy fire and ramming cost one; a shield absorbs hits.
- Kills chained within 2.5 seconds raise a **combo multiplier up to x8**.
- Fallen enemies drop power-ups: **S** shield (3 hits), **W** spread shot,
  **R** rapid fire (12 s each), **+** an extra life.
- Waves escalate: drifters, stingers, weavers and bulwarks, with a **boss —
  the Void Maw — every 5 waves**.
- **Clear the wave 10 boss to win the sector.** Then endless mode keeps coming
  with the score still climbing. Lose all 3 lives and the run ends.

## The enemy

- **Drifter** — slow, wobbling, unarmed. Cannon fodder.
- **Stinger** — dives at you and fires aimed shots.
- **Weaver** — sweeps in sine waves and fires 3-shot spreads.
- **Bulwark** — armoured, hovers, fires aimed bursts.
- **Void Maw** — the boss: radial bullet bursts, aimed fans, and it summons
  minions.

All art is drawn in code, all sound is synthesized with WebAudio, and the
starfield is seeded — the game is fully original and fully offline.

## Screenshots

`screenshots/` holds four real renders of the game's own code: the title
screen, mid-action play, the boss fight, and the end screen. They were staged
with `?shot=start|play|boss|end&seed=20261116` (see `shots.json`); each scene
plays the real rules forward with an autopilot, so the frame is what a real
game looks like.

## License

MIT — see `LICENSE`.
