# Helix audio license record

Every sound in Vanguard is **original Helix synthesis** generated at runtime by the Web Audio mixer (`client/src/audio/audio.ts`).

| Asset class | Source | License |
|---|---|---|
| Weapon fire / reload / dry / ADS / swap | Oscillator + shared noise buffer | Original, commercial use |
| Impacts (metal, concrete, wood, glass, dirt, sand, stone, water) | Oscillator / noise | Original, commercial use |
| Explosions | Noise burst + sub sine | Original, commercial use |
| Footsteps by surface + gait | Oscillator | Original, commercial use |
| Character (jump, land, pain, heal, revive) | Oscillator | Original, commercial use |
| Callouts | Formant-like tones + subtitle text | Original, commercial use |
| Environment / weather beds | Low drones + filtered noise | Original, commercial use |
| Music states (menu → final → victory/defeat) | Chord beds, original voicing | Original, commercial use |
| UI (hover, press, found, error, reward) | Short triangles | Original, commercial use |

No third-party sample packs. No recreation of copyrighted game audio.

Voice chat, when enabled later, will use browser capture + Opus/WebRTC. It is **not** sent on the game snapshot. Mute / block / report stay on the social authority.
