# A Link to Past Predictions — Build Plan

A top-down pixel adventure (in the spirit of *Zelda: A Link to the Past*) about one day in the life of an ML engineer at Prior Labs. On her bedside table she finds a phone that turns out to be TabPFN-3.5. It can predict almost anything from the past: rain, traffic, fevers, demand, injuries, which experiments will work. It cannot tell her **what to do** with those predictions.

**Theme** (from the examples in the spec, taken from *Power and Prediction* by Agrawal, Gans & Goldfarb): prediction doesn't remove judgment; it makes hidden judgment explicit. Every probability needs a threshold, and every threshold encodes someone's preferences. Every scene plays out the book's pattern:

> **simple rule → prediction → threshold/judgment → tailored action → added coordination and accountability**

Submission: Prior Labs TabPFN-3.5 Hackathon (Sep–Oct 2026). Deployed on Vercel.

---

## 1. Decisions made

| Topic | Decision |
|---|---|
| TabPFN integration | **Fully live.** Every prediction is a real TabPFN-3.5 API call through a small server-side proxy. There are no precomputed predictions. |
| Token budget | **Cache + batch.** The first identical world request is computed live and its real response is reused. Player predictions are batched into one call per act, about 3 per playthrough (§4.5). |
| Scope | **6 days: build Sep 29 – Oct 5, submission deadline Oct 6.** **8 scenes, about 10 minutes of play**, covering the whole day, morning to evening. |
| Story structure | **One linear day, plus replay.** The finale offers to let the phone run tomorrow using your learned thresholds (see §2.5). |
| Art | **Kenney CC0 packs**: RPG Urban Pack, Roguelike Indoors, Tiny Town. 16×16 tiles. |
| Engine / stack | Phaser 3, Vite and TypeScript for the game. Vercel Functions in TypeScript for the proxy. uv + Python for dataset generation. |
| Hosting | Vercel, as required by the spec. The static game and the `/api` function live in one project. |
| Company | The protagonist works at **Prior Labs**, named in text only. **No logo** anywhere. |
| Submission | A **public git repo** + a **playable Vercel link** that is live from week 1 onwards + an optional gameplay video. |
| Cast | **Ada** (the protagonist, an ML engineer), **Sam** (her partner), **Mia** (8) and **Leo** (5). Names are easy to change in one file. |
| Attribution | *Power and Prediction* (Agrawal, Gans & Goldfarb) is credited in the README and in the in-game credits. Kenney and Open-Meteo are credited as well. |

---

## 2. Core mechanics

### 2.1 The phone (the magical artifact)
- You find it in the first scene next to the bed: *"It's dangerous to go alone! Take this."*
- Opened with `Tab`. It overlays a stylised phone UI with these tabs:
  - **Predict:** the current prediction, shown as a probability or a full distribution chart.
  - **Judge:** the threshold dial and the Judgment Card (§2.3).
  - **Messages:** the consequences arrive here. NPCs affected by your decisions text you, which lets us show effects across the whole system without building extra maps.
  - **Past:** the literal rows TabPFN sees for the current prediction. Nothing is trained; the rows *are* the model's context. This is the transparency showcase.
  - **Map.**

### 2.2 The decision loop (every major scene)
1. **Old rule.** An NPC or the protagonist states the cheap, reliable, crude default: "always carry umbrellas", "leave at 7:30", "any symptom means stay home". You can **always** choose to stick with the rule.
2. **Prediction.** The phone makes a live TabPFN call and shows a probability, or for regression a distribution with quantiles.
3. **Threshold.** You set the judgment, where possible **before** the number is shown ("At what chance of rain do we take umbrellas?"). Separating the two makes it obvious that the phone supplies the prediction and you supply the judgment.
4. **Tailored action.** It follows from the prediction and your threshold, or from the rule.
5. **Ripple.** Consequences land on you and on others, through Messages, NPC reactions and later scenes. Outcomes are sampled from the same data-generating process as the datasets, so a 30% prediction really does come true about 30% of the time.

### 2.3 The Judgment Card
Each decision fills in a card with the spec's five questions. Some answers are only revealed by the ripple:
- How bad is a false negative?
- How costly is a false positive?
- Who bears those costs?
- Who has the authority to choose?
- Which surrounding processes relied on the old rule?

### 2.4 The phone learns your judgment (in-context learning on *you*)
- Each threshold you set and each action you take is logged as a row: scene, stakes (who bears the costs), whether the cost falls on you or on others, time pressure, the threshold you set, and the action.
- Before each decision, the phone makes a **sealed** prediction of the threshold you will pick (regression) or the action you will take (classification). It shows only a commitment such as `🔒 3fa9…` (SHA-256 of the prediction + a nonce) and reveals it after you decide.
- Context: a small persona prior (about 30 rows, tuned in playtesting) plus your rows from today and from replays. The phone visibly gets better at predicting you. That is the **Link to Past Predictions**: your past is its training set.

### 2.5 Finale and end-of-day report
- **"Your hidden judgment, made explicit":** the phone reads back your implied preferences. For example: *"You accept a 20% risk of being late, but only 5% risk of Leo infecting classmates. You valued Mia's wish over a 15% reinjury risk. You chose fair over efficient when colleagues were watching."*
- Stats: its accuracy at predicting your judgments, a calibration plot of its world predictions against what happened, and the Judgment Journal (all cards).
- **The last choice:** *"I've learned your thresholds. Shall I make tomorrow's decisions for you?"* This asks directly: who has the authority to choose? Sam weighs in: *"Your thresholds, or ours?"*
  - **Accept:** replay the day on autopilot. The phone decides with *your* thresholds and you can override. The world shifts slightly, and some ripples land differently.
  - **Decline:** replay manually. The phone now predicts you from yesterday's rows.
- A **"How the phone works"** page explains in-context learning in 4 panels, using your real rows.
- Replay data persists in `localStorage`, with a "wipe memory" option.

### 2.6 Latency design (needed because every call is live)
- **Prefetch:** a prediction is requested when its scene becomes *reachable* (you enter the room or approach the NPC), not when the dialog opens. It is re-requested if a newer decision was logged in the meantime.
- Waiting is part of the world: a "thinking" animation on the phone, with dialogs waiting up to about 8 s.
- **Failure handling** (still fully live, never faked): on timeout, 429 or 5xx, the phone shows *"No signal. Guess we're back to the old rule."* The old rule applies automatically, which is itself on theme. The report records the decision as "unpredicted". The proxy retries once with backoff.

---

## 3. The day: scenes, TabPFN tasks and examples from the book

The game clock runs 06:30 → 21:00. Target is about 10 min of play. **IN** means the scene is in the 6-day build. **CUT** means dropped when the deadline moved to Oct 6; **MERGED** means folded into another scene. The 8 IN scenes are 1, 2, 4, 6, 7, 8, 11 and 13.

| # | Time | Place | Scene (old rule → prediction → judgment → ripple) | Book example | TabPFN task | Status |
|---|---|---|---|---|---|---|
| 1 | 06:30 | Bedroom | Wake up and find the phone. Clouds outside the window. **Rule:** always pack umbrellas. **Predict:** chance of rain on the school run. **Judge:** set the dial ("take umbrellas if P ≥ __"). **Ripple:** wet kids, or Leo losing the umbrella, resolved later on the street. *Tutorial for the loop.* | Umbrella | Classification on **real** hourly weather history (Open-Meteo) || IN |
| 2 | 07:00 | Kids' room | Leo is sniffly: *"my head is hot and my tummy is grumpy"*. **Rule:** any symptom means he stays home, and you miss your big experiment day. **Predict:** P(contagious) from what he said, his temperature and the days since symptoms started. **Judge:** your threshold for sending him to school. **Sam** has a more cautious threshold, and if Leo stays home, one of you loses the day. The prediction doesn't settle the disagreement; it makes it explicit. **Ripple:** the school nurse applies *her* threshold, other parents text, and your manager's sick-day policy comes up. | COVID testing | **Text column** + numeric features → classification || IN |
| 3 | 07:20 | Kitchen | Breakfast. The doorbell rings: parcels the phone ordered overnight because it was 70% sure you'd need them. **Judge:** set the auto-order threshold. **Ripple:** a pile of returns grows in the hallway all day, and the courier jokes about the new business model. | Amazon ship-then-shop | Classification over household purchase history || CUT |
| 4 | 07:45 | Street | School run. **Rule:** leave at 7:30, always 20 min early. **Predict:** commute-time *distribution* per route. **Judge:** what probability of being late is acceptable (typical time vs. worst case)? **Ripple:** the Parents' Café at the school gate, which lives off parents waiting around, is suddenly empty. Every parent's phone picked Route A, so Route A jams. There are roadworks on Route B: the city now digs where the model predicts lead pipes. | Airport timing (+ Flint hint) | **Regression, full distribution/quantiles** on a large traffic dataset (100K–1M rows) || IN |
| 5 | 08:10 | School gate | Drop-off. The nurse resolves scene 2. The teacher reminds you about **Mia's football final** this afternoon, and her ankle is still sore. The umbrella outcome resolves. | — | — (ripples) || MERGED into 4 |
| 6 | 09:00 | Office | Boot the Linux box (Omarchy / Hyprland tiling boot cutscene) and spin up Claude, which writes the training code in seconds. **Ripple:** the manager now wants 3× the experiments, and you have more to review, explain and coordinate. Automating one prediction didn't make the job simpler; it moved the work around. | Radiology | — (world-building) || IN |
| 7 | 09:30 | Office | **GPU allocation** (centrepiece). Colleagues propose experiments: scaling from 10K to 1M samples, text+tabular multimodal, efficient inference, time series. The phone ranks them by predicted gain from past runs. **Judge:** allocate by the ranking (efficient) or spread across teams (visibly fair)? Colleagues lobby and the manager may override. **Ripple:** at 15:00 the hit rate shows what each allocation bought, and who gained or lost influence. | Flint lead pipes | **Regression as a surrogate model** on synthetic scaling-law runs, plus ranking || IN |
| 8 | 12:00 | Canteen | The chef always orders 40 avocados, and you help her switch to a forecast. **Ripple:** waste drops, then the distributor calls, and then the farmer. The phone charts how order swings grow at each step up the chain. A better local decision makes the overall system worse. | AI bullwhip | **Time-series forecasting** (TabPFN-3.5 temporal) || IN |
| 9 | 13:00 | Office | A letter from your insurer: its model says your kitchen pipe is likely to leak. The choices are a higher premium, a sensor that shares your data, a paid plumber, or doing nothing. **Ripple:** resolves at home in the evening. | Home insurance | Classification (anomaly-style features from sensor readings) || CUT |
| 10 | 15:00 | Office | Runs finish: predicted vs. actual, the calibration reveal, the paper deadline, and a "Reviewer 2" NPC. | (Flint payoff) | Calibration || MERGED into 13 |
| 11 | 16:30 | Sports field | **Mia's final.** The physio estimates the reinjury risk. Mia wants to play, the coach wants to win, you want her healthy, and Sam, calling in on video, sides with Mia. **Judge:** whose preferences set the threshold? The phone shows the decision tree. The prediction can't supply the answer. | Michael Jordan | Classification (small data) || IN |
| 12 | 18:30 | Home | Family dinner with Sam. The returns pile and the leak resolve, and you catch up on Messages. | — | — (ripples) || CUT |
| 13 | 20:30 | Home | **Finale:** your hidden judgment made explicit, and "Shall I decide tomorrow for you?" (§2.5). | "Who has authority to choose?" | Player model || IN |

Heart-attack triage is left out because it is too heavy for the tone. Its lesson about false negatives vs. false positives is covered by scenes 2 and 11.

### TabPFN-3.5 capabilities covered

| Capability | Where |
|---|---|
| In-context learning on tiny data, no training | Player model (every decision), replay improvement, scene 11 |
| Classification probabilities | 1, 2, 3, 9, 11 |
| Regression with full predictive distributions / quantiles | 4, 7, and your predicted threshold |
| Text columns | 2 |
| Time series / forecasting | 8 (and 1, with temporal weather features) |
| Scale (100K–1M training rows) | 4 (city traffic), 7 (the in-world research story is scaling 10K → 1M) |
| Honest uncertainty / calibration | 10, report |

---

## 4. Architecture

```
Browser (Phaser game)                         Vercel
┌─────────────────────────────┐   POST /api/predict   ┌──────────────────────────────┐
│ World scenes (maps, NPCs)   │ ────────────────────▶ │ predict.ts (Node function)   │
│ Story engine (scene data)   │                       │  • schema + size validation  │
│ Phone UI overlay            │ ◀──────────────────── │  • dataset allowlist         │
│ PredictionService           │   {prediction, meta}  │  • per-IP rate limit         │
│  • prefetch / stale check   │                       │  • fitted-id cache           │
│  • seal (SHA-256 commit)    │                       │  • TabPFN REST client        │
│ JudgmentLog (localStorage)  │                       └──────────────┬───────────────┘
└─────────────────────────────┘                                      │ Bearer TABPFN_API_KEY
                                                                     ▼
                                                         api.priorlabs.ai /tabpfn/*
```

### 4.1 Proxy (`/api/predict`)
- The key lives only in a Vercel env var and never reaches the client bundle.
- **Two request kinds:**
  - `{dataset: "traffic", test: [...], output: "quantiles", quantiles: [...]}`: a static, allowlisted dataset. The first request fits and caches the `fitted_train_set_id`, and later requests only predict. Uploads and standard fits cost no tokens; predictions do.
  - `{dataset: "player", train: [...], test: [...]}`: the player model. The client sends rows, but the server enforces a fixed column schema, ≤ 500 rows and ≤ 5 test rows, and re-fits on every call.
- REST flow per the docs: `prepare_train_set_upload` → PUT to a signed URL → `fit` (`v3.5_default` or `v3.5-fast_default`) → `prepare_test_set_upload` → PUT → `predict`.
- Protection: a per-IP limit of about 20 predictions/min. The key allows 60 predictions/min and 1,500/hr. **The binding constraint is the token budget, not the rate limit** (§4.5).
- The same handler runs in local dev behind the Vite dev server, so dev and prod use the same code path.

### 4.2 Game
- Phaser 3 scenes: `Boot`, `Title`, `World` (one per map area), `PhoneUI` (overlay), `Dialogue` (overlay), `Report`.
- **Story engine:** scenes are data (TypeScript objects) holding triggers, dialogue, the old rule, a prediction spec (dataset, output type), a threshold spec, how outcomes are sampled, ripple messages and Judgment Card entries. The engine code stays small and the story stays editable.
- **Maps:** authored as ASCII layouts in code and converted to Tiled JSON by a script. Claude can author them, and you can still open and edit them in Tiled. Areas: home (4 rooms), street, school gate, sports field, office (desks, meeting room, canteen).
- Movement: 4/8-direction arcade physics, collision layer, and door warps. Input: keyboard and gamepad. Touch is a stretch goal.
- Audio: ZzFX for sound effects and a CC0 chiptune loop per area.

### 4.3 Repo layout
```
/game            Vite + Phaser + TS
  src/scenes/    Boot, Title, World, PhoneUI, Dialogue, Report
  src/story/     scene data (one file per day scene)
  src/engine/    story engine, triggers, game clock, outcome sampling
  src/predict/   PredictionService, JudgmentLog, seal
  public/assets/ Kenney tiles, generated maps (.tmj), audio
/api             predict.ts (Vercel function)
/server          TabPFN REST client, dataset registry, rate limit
/data            uv project: seeded generators + Open-Meteo fetch → CSVs
/tools           ASCII → Tiled map converter
PLAN.md, README.md, vercel.json
```

### 4.4 Datasets (seeded, committed)
| Dataset | Rows | Scene |
|---|---|---|
| `weather`: real hourly history (Open-Meteo, CC BY 4.0), with a "rain in the next 2 h" label | ~10K | 1 |
| `kid_symptoms`: symptom text (templated), temperature, days since onset, season → contagious | ~500 | 2 |
| `purchases`: household purchase history → needed this week | ~1K | 3 |
| `traffic`: route, weather, departure time, school day, roadworks → minutes (heavy-tailed) | 100K–1M | 4 |
| `scaling_runs`: N samples, width, depth, lr, variant, modality → gain (noisy power law) | ~500 | 7, 10 |
| `canteen_demand`: daily demand with weekday, weather, menu and events | ~2 years daily | 8 |
| `pipe_leaks`: house age, material, humidity-sensor features → leak within 6 months | ~2K | 9 |
| `reinjury`: age, days since sprain, swelling, planned minutes → reinjury | ~200 | 11 |
| `persona_judgments`: the persona prior for the player model | ~30 | all |

Outcomes in the game world are sampled from the same generators, so the phone is calibrated and the game is honest about it.

### 4.5 Measured API performance (spike, 2026-09-29, `npm run spike`)

| Request shape | Wall time | Breakdown |
|---|---|---|
| Player model, 40 rows, cold fit + predict (`v3.5`) | **5.7 s** | fit 3.8 s, predict 1.2 s, uploads ~0.7 s |
| Same, 41 rows, `v3.5-fast` | 5.4 s | Fast doesn't shorten the fit step |
| Re-predict on an existing fit (static dataset) | **1.5 s** | predict 1.2 s |
| Traffic regression, 2K rows, `fit_with_cache`, quantiles | 9.7 s | fit 6.8 s (paid once per server instance) |
| Traffic, cached re-predict | **1.2 s** | predict 0.9 s |
| Text column (symptoms), 150 rows, fit + predict | 5.5 s | "my head is hot…" at 37.9 °C → 99.9% contagious |

**What this means:**
- Predictions on world datasets (fit once and cache the id, ~1.3 s) are fast enough to request when needed.
- The player model has to re-fit every time a new decision is logged (~5.5 s), so **prefetch is mandatory**: request it as soon as the previous decision is logged, while the player walks to the next one.
- Output format: `quantiles` comes back quantile-major (`prediction[q][row]`), and `probas` has its classes sorted alphabetically.

**Token budget (the real constraint).** Every TabPFN-3.5 prediction costs **at least 10,000 tokens**. Every shape above costs exactly that minimum, except training sets of 100K+ rows: 100K rows cost 13K tokens, and 1M rows cost 245K tokens cached or 980K uncached. **Traffic stays at ≤ 100K rows.** Default budgets are **5M tokens a day and 20M a month** (≈ 500 and 2,000 predictions), shared between development and players.

| Strategy | Predictions / playthrough | Playthroughs / day | / month |
|---|---|---|---|
| Naive: every world scene + every player decision | ~17 | ~29 | ~117 |
| + cache identical world requests on the server | ~8 | ~60 | ~250 |
| + batch player predictions per act (3 calls, several test rows each) | ~3 | ~165 | ~660 |

---

## 5. Milestones (Sep 29 → Oct 5, deadline Oct 6)

The play link is live from day 1, and every push to `main` redeploys it.

| Day | Date | Goal |
|---|---|---|
| 1 | Tue Sep 29 | ✅ API spike, REST client, proxy, real weather data, Phaser skeleton, **scene 1 (umbrella) live on Vercel** |
| 2 | Wed Sep 30 | Kenney art + tilemaps, player sprite, Judgment Card, Messages, JudgmentLog. Home map (bedroom, kids' room, kitchen). **Scene 2 (sick Leo, text column).** |
| 3 | Thu Oct 1 | Street/school map. Traffic dataset. **Scene 4 (school run + café, quantiles).** Umbrella and nurse outcomes resolve at the gate. |
| 4 | Fri Oct 2 | Office map. **Scene 6 (Omarchy boot + Claude)**, **scene 7 (GPU allocation, surrogate model)**, **scene 8 (avocado bullwhip, forecasting).** |
| 5 | Sat Oct 3 | Sports field. **Scene 11 (Mia's final).** Batched player model. **Scene 13 (finale):** hidden-judgment report, calibration, replay. |
| 6 | Sun Oct 4 | Polish: audio (ZzFX), title/credits, pacing to ~10 min, full playtests, token-budget check, bug fixes. |
| 7 | Mon Oct 5 | README with play link, credits (*Power and Prediction*, Kenney, Open-Meteo), optional gameplay video, submission. Oct 6 is the buffer. |

**Testing:** `scripts/playtest.ts` drives a headless system Chromium through the build and screenshots it. It grows into the P1 smoke test. The type check and build run on every change.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Live latency (6 REST round trips) feels slow | Prefetch, cached fitted ids for static datasets, `v3.5-fast`, and waiting shown in the world. Measured in week 1. |
| **Token budget runs out** (a 10K minimum per prediction; 5M/day, 20M/month shared with development) | Cache identical world requests, batch player predictions, and cap live playthroughs per visitor per day. Join the hackathon platform for credits and ask Prior Labs for higher limits. Automated tests use recorded API responses so they burn no tokens. See §4.5. |
| API outage during judging (no fallback, by choice) | "No signal" falls back to the old rule, so the game stays playable and on theme. Record the gameplay video early. |
| The theme reads as a lecture | Each lesson lands through a ripple (a text from the café owner, the farmer calling), not through narration. Keep dialogue short and funny. |
| Key leak | The key exists only server-side, requests use an allowlist and schema checks, and nothing arbitrary is forwarded. |
| Kenney art looks generic | A consistent palette, a recoloured protagonist, and the phone UI as the visual centrepiece. |
| 6 days is tight for 8 scenes | Scenes are data on top of one shared engine. The world is playable at the end of every day, and scene 8 is the first to cut if we slip. |

---

## 7. Open questions

None right now.
