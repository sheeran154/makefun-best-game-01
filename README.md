# VOIDSTRIKE — Neon Sector Defense

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/sheeran154/makefun-best-game-01/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/sheeran154/makefun-best-game-01/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

A top-down arcade space shooter, built for the
[best-game-01 bounty on make.fun](https://make.fun/bounty/best-game-01).
You are **NOVA-7, Keeper of the Last Star** — a dying beacon at the middle
of the field, the last light in the sector. Hostile swarms are pouring
through the rift to snuff it out: hold the line, draft upgrades between
waves, chain kills into combos, and break the Void Maw before the light dies.

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
| Shift / Right-click | Dash (brief invulnerability + afterimages) |
| B / Q | Bomb (clears bullets, hurts everything on screen) |
| 1 / 2 / 3 or click | Pick an upgrade card after a wave |
| P | Pause |
| R | Restart |
| M | Mute |
| Enter | Start / continue |

## Rules

- You have **3 lives**. Enemy fire and ramming cost one; a shield absorbs hits.
- The **Last Star beacon has 12 hull**. It mends +2 after every cleared wave.
- Kills chained within 2.5 seconds raise a **combo multiplier up to x8**.
- Fallen enemies drop power-ups: **S** shield (3 hits), **W** spread shot,
  **R** rapid fire (12 s each), **+** an extra life, **B** a bomb restock.
- Waves escalate: drifters, stingers, weavers, slicers, bulwarks and carriers,
  with a **boss — the Void Maw — every 5 waves**.
- **Clear the wave 10 boss to win the sector.** Then endless mode keeps coming
  with the score still climbing. Lose all 3 lives **or let the beacon fall**
  and the run ends.

## Defend the Last Star

The beacon burns at the middle of the field, ringed in gold — the whole run
is about keeping it lit. Every **3rd wave is a siege wave** (and so is every
boss wave): the swarm stops hunting you and comes for the beacon instead.
Besieging enemies wear an **ember-red ring** so you can spot the threat at a
glance, and the beacon's hull bar sits under the wave counter in the HUD.

- A besieger that rams the beacon takes 3 damage — and costs the beacon
  **1 hull**. At 0 hull the beacon goes dark and the run ends, even with
  lives to spare.
- Kills made within 260 px of the beacon earn a **Guardian bonus: +100 score
  times your combo** — defending the objective pays better than farming the
  edges. Guardian kills are tallied on the victory screen.
- Waves carry sector names in their banners — wave 3 is a siege in
  *The Long Night*, the wave-10 boss comes for *The Dawn*.

## The upgrade draft

After every cleared wave (except the winning one) the action pauses and three
upgrade cards are dealt. Pick one with **1 / 2 / 3** or by clicking it — the
pick is free, and every upgrade stacks when it shows up again.

| Upgrade | Effect |
| --- | --- |
| ▲ Heavy Rounds | +1 bullet damage |
| ≫ Overclock | Fire 12% faster |
| » Ion Thrusters | +12% flight speed |
| ✳ Split Shot | +1 projectile per volley |
| ⇢ Piercing Rounds | Shots pierce +1 enemy |
| ⬡ Aegis Plating | +1 shield, recharges one hit each wave |
| ◎ Tractor Web | Power-ups fly to you |
| ✸ Bomb Rack | +2 bombs, +1 max stock |
| × Combo Extender | +1s combo window |
| ♥ Reinforced Hull | +1 max life, heal 1 now |

Your drafted build is shown in the HUD and on the victory screen.

## Dash & bomb

- **Dash** (Shift or right-click, 2.5 s cooldown): a burst of speed in your
  move direction — or toward your aim when standing still — with brief
  invulnerability and ghost afterimages. Dash through a bullet wall to live.
- **Bomb** (B or Q): one stock to start, restocked by the Bomb Rack upgrade
  and rare B drops. Wipes every enemy bullet off the screen and deals 6
  damage to everything flying, boss included.

## The enemy

- **Drifter** — slow, wobbling, unarmed. Cannon fodder.
- **Stinger** — dives at you and fires aimed shots.
- **Weaver** — sweeps in sine waves and fires 3-shot spreads.
- **Slicer** — fast zigzag, then a telegraphed charge straight at you.
- **Bulwark** — armoured, hovers, fires aimed bursts.
- **Carrier** — slow freighter that lobs aimed shots and **splits into three
  fast drones** when destroyed.
- **Elites** (from wave 4) — gold-trimmed, 3x hull, 2x score, and they always
  drop a power-up.
- **Void Maw** — the boss: radial bullet bursts, aimed fans, minion summons —
  and under half health it enters **phase 2**: faster, with a spiral bullet
  barrage and elite summons.

All art is drawn in code, all sound is synthesized with WebAudio, and the
starfield is seeded — the game is fully original and fully offline.

## Screenshots

`screenshots/` holds four real renders of the game's own code: the title
screen with the mission briefing, a siege wave with the beacon under attack,
the phase-2 boss fight around the beacon, and the victory screen —
"THE LAST STAR ENDURES" — with the drafted build. They were staged with
`?shot=start|play|boss|end&seed=20261116` (see `shots.json`); each scene
plays the real rules forward with an autopilot, so the frame is what a real
game looks like.

## License

MIT — see `LICENSE`.
