# 🌌 ODYSSEY & TRISTRAM — Open-Source Engine Game Studio
**Star Wars: Knights of the Old Republic (`reone`) & Diablo 1 & 2 (`Freeablo`)**  
*AMD Hackathon Act 3 • Track 4: Create a New Kind of Experience*

> 📖 **AI Agent & Developer Documentation:**  
> Complete architecture, engine paths, and handoff instructions are in [**`AGENT_HANDOFF_DOCS.md`**](AGENT_HANDOFF_DOCS.md).

---

## 🎮 What is Odyssey & Tristram?

A dedicated open-source game studio and interactive engine player powered by:
1. **`reone`** ([seedhartha/reone](https://github.com/seedhartha/reone)): BioWare Odyssey Engine reimplementation for Star Wars: Knights of the Old Republic.
   - Connected directly to official retail KotOR assets (`chitin.key`, `dialog.tlk`, audio streams).
   - Real-time binary parser extracting 49,266 KotOR strings.
   - Authentic Darth Malak orchestral battle theme (`mus_bat_malak.wav`) and computer console sounds.
   - 3D Jedi Guardian (`Knight.glb`) with dual-core glowing plasma lightsabers, Force Push (`Q`), Force Lightning (`E`), and KotOR moral alignment banners (`[Light Side / Dark Side Points Gained]`).
2. **`Freeablo`** ([wheybags/freeablo](https://github.com/wheybags/freeablo)): Open-source dark fantasy ARPG engine for Diablo 1 & 2.
   - Native 64-bit Linux executable (`engines/freeablo/freeablo_v0.4/bin/freeablo`) with active configuration in `settings-user.ini`.
   - Authentic Diablo HUD with animated Life & Mana liquid globes.
   - 3D Barbarian (`Barbarian.glb`) with 2H Battleaxe Cleave, Fireball spell (`E`), and Cursed Shrines of Knowledge.

---

## 🖥️ Dual-Mode Playability: WebGL & Desktop

- **In-Browser WebGL Engine:** Instant zero-install play with rigged 3D models, skeletal animations, and real sound effects.
- **Native Desktop Engine Launcher:** Click **🚀 Launch Native Engine (Desktop)** to spawn the authentic downloaded `freeablo` binary or `reone` engine directly on your host machine!

---

## ⚙️ Direct Game Customizer (No AI Required)

Customize games and in-game decisions directly:
- **Visual Palette:** Customize lightsaber/flame accent color, space/catacombs sky, and volumetric fog.
- **Interactive Decisions / Surveys:** Configure questions and in-game options mapped 1-to-1 to the 4 in-game Star Map consoles or Cursed Shrines.
- **Instant Compilation:** Saves to the engine backend and immediately loads into the 3D viewport.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the engine studio server
node server.js
```

Open **`http://localhost:3000`** in your browser:
1. **🎮 Play Game:** Switch between Star Wars KotOR and Diablo 1 & 2.
2. **⚙️ Game Customizer:** Tweak colors and survey questions.
3. **🖥️ Desktop Engine Hub:** Inspect downloaded engine repositories, talk table strings, and launch native desktop executables.
4. **📊 Decisions & Analytics:** View real-time player choices and decision telemetry.