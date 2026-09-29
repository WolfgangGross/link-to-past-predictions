# A Link to Past Predictions

A tiny top-down adventure, in the spirit of *Zelda: A Link to the Past*, about one day in the life of Ada, an ML engineer at an ML Lab in Freiburg. On her nightstand she finds the **Phone of Priors**: it runs on **TabPFN-3.5** and can predict almost anything from the past. It cannot tell her what to do.

> Prediction doesn't remove judgment; it makes hidden judgment explicit.
> Every probability needs a threshold, and every threshold encodes someone's preferences.
> — after *Power and Prediction* (Agrawal, Gans & Goldfarb)

**Play: https://link-to-past-predictions.vercel.app** · about 10 minutes · keyboard (arrows/WASD, SPACE, TAB)

Built for the Prior Labs TabPFN-3.5 Hackathon, 2026.

## The day

Every scene follows the same loop: **old rule → prediction → your threshold → action → ripple**. The ripple lands on you and on other people. After each decision a Judgment Card answers the book's five questions: how bad is a miss, how bad is a false alarm, who bears it, who decides, and what relied on the old rule.

| Scene | Book example | What TabPFN-3.5 does, live |
|---|---|---|
| The umbrella | the umbrella rule | Classification on **3,469 real Freiburg mornings** (Open-Meteo, 2016–2025). "Today" is a held-out morning the model has never seen. |
| Sick Leo | COVID testing | Classification with a **free-text column**: what Leo *says*. "My tummy is grumpy" scores 85%, "mama, my tummy hurts" 31%, at the same temperature. |
| The school run | when to leave for the airport | Regression with **quantiles** over 20,000 past runs. You choose how often being late is OK. The gate café lives off parents who wait. Every parent's phone picks the same road. |
| The office | radiology | Omarchy + Claude write the training code in five minutes. The judgment is still yours. |
| GPU allocation | Flint's lead pipes | TabPFN as a **surrogate model** ranks 8 research proposals from 400 past experiments, titles included. Efficient, or one node per team? |
| Avocados | the AI bullwhip | A demand **forecast** for the canteen. Smarter local orders make the whole supply chain swing. |
| Mia's final | Michael Jordan playing injured | Small-data reinjury risk for the full game vs. the second half. Mia, the coach, Charles and you each have a line. |
| Bedtime | who has authority to choose? | The report: your day, **your hidden judgment**. Then: *"Shall I decide tomorrow for you?"* |

**The phone learns you.** Before each decision, TabPFN makes a **sealed guess** (rule or phone?) in context from your earlier judgments, including earlier days. It shows the SHA-256 commitment first and reveals the guess after you choose. Nothing is trained; your past is the context. On replay the phone remembers yesterday. If you let it, it re-applies yesterday's lines to a new day.

## How it works

- **Game:** Phaser 4 + TypeScript + Vite. Maps are ASCII layers with Kenney CC0 tiles (`game/src/world/maps/`). Scenes are story scripts (`game/src/story/`).
- **Predictions:** every prediction is a live TabPFN-3.5 REST call made by one Vercel function (`api/predict.ts`). The API key stays on the server. World datasets live server-side (`server/datasets/`); the browser only sends the rows it wants predicted, and they are validated against an allowlist. Each dataset is fitted once per instance, and identical requests reuse the real response, so repeat players cost no tokens. On a timeout, a 429 or an outage the phone shows **"No signal"** and the old rule applies.
- **Honest outcomes:** the world samples what happens from the phone's own predictive distribution. A 30% chance of rain comes true about 3 times in 10.
- **Datasets:** `data/*.py` (uv, stdlib only). Weather is real Open-Meteo history. Symptoms, traffic, experiments, avocados and reinjury are synthetic, each with a known generating process described in its builder.

```
npm install
cp .env.example .env            # add TABPFN_API_KEY
npm run dev                     # game + /api on http://localhost:5173
npm run build                   # type-check + production build
npx tsx scripts/playtest.ts     # headless playthrough with screenshots (system Chromium)
npx tsx scripts/playtest.ts http://localhost:5173/ shots --rule        # follow every old rule
npx tsx scripts/playtest.ts http://localhost:5173/ shots --autopilot   # ...and let the phone run day 2
```

Dev shortcut: `?map=street|office|field|evening` jumps straight to a map with a plausible morning.

## Credits

- *Power and Prediction: The Disruptive Economics of Artificial Intelligence*, by Ajay Agrawal, Joshua Gans and Avi Goldfarb: the examples and the rule → prediction → judgment pattern.
- [TabPFN-3.5](https://priorlabs.ai/tabpfn-3-5) by Prior Labs: every prediction in the game.
- Tiles and characters: [Kenney](https://kenney.nl) (CC0): Roguelike RPG Pack, Roguelike Indoors, RPG Urban Pack.
- Weather: [Open-Meteo](https://open-meteo.com) historical weather API (CC BY 4.0).
- Font: Press Start 2P by CodeMan38 (OFL).
- Built with [Claude Code](https://claude.com/claude-code).
