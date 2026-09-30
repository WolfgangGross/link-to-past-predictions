// School street: the ripples of the morning land here — rain, the school run, the gate cafe, the nurse.

import type { Story } from "../world/WorldScene";
import type { Line } from "../ui/Dialogue";
import type { Mood } from "../ui/portraits";
import { state } from "../state";
import { rainOutcome, willItRain } from "./umbrella";
import { CARD as SCHOOL_RUN_CARD, SCHOOL_STARTS, clock } from "./schoolRun";

export const streetStory: Story = {
  async onEnter({ ui, world }) {
    const run = state.schoolRun!;
    ui.setClock(clock(run.arrive));
    world.setWeather(await willItRain(), state.umbrellas ?? true);
    const raining = await willItRain();
    const drenched = raining && !state.umbrellas;
    const weather: Mood = drenched ? (state.leoHome ? "wet" : "wetSad") : state.umbrellas ? "umbrella" : "neutral";
    const lines: Line[] = (await rainOutcome()).map((text) => ({ text, mood: weather }));
    if (run.herd) {
      lines.push(
        {
          text: `The ${run.route === "car_main_road" ? "main road" : "old town"} is gridlocked. Every parent's phone recommended it this morning.`,
          mood: "surprised",
        },
        { text: "The phone learned from mornings when nobody had the phone.", mood: "suspicious" },
      );
    }
    if (run.late) lines.push({ text: `${clock(run.arrive)}. Late. Mia sprints for the gate.`, mood: "panic" });
    else if (SCHOOL_STARTS - run.arrive >= 8) lines.push(`${clock(run.arrive)}. ${SCHOOL_STARTS - run.arrive} minutes early. Plenty of time for a coffee at the gate cafe.`);
    else lines.push(`${clock(run.arrive)}. Just in time.`);
    await ui.dialogue.say(lines);
    if (state.judgments.find((j) => j.scene === "school_run")?.choice === "prediction") await ui.card.show(SCHOOL_RUN_CARD);
  },
  interact: {
    async cafe({ ui }) {
      const early = SCHOOL_STARTS - state.schoolRun!.arrive >= 8;
      await ui.dialogue.say(
        early
          ? ['Uwe (gate cafe): "Morning! The usual? You early birds keep me in business."', "You buy a coffee. It is excellent."]
          : [
              'Uwe (gate cafe): "Quiet again. Nobody waits at the gate anymore. Their phones tell them the exact minute to leave."',
              'Uwe: "Forty croissants, baked for nothing. The rule kept my cafe alive. The prediction doesn\'t know that."',
            ],
        early ? "neutral" : "guilty",
      );
      if (!early && !state.messages.some((m) => m.from === "Uwe")) state.messages.push({ from: "Uwe", text: "Croissants half price. Tell your friends." });
    },
    async nurse({ ui }) {
      if (state.leoHome) {
        await ui.dialogue.say('Nurse Brandt: "No Leo today? Three of his class are sniffling already."');
        return;
      }
      await ui.dialogue.say([
        'Nurse Brandt: "School rule: 38.0 °C and they go home. Leo is 37.5. In he goes."',
        "Her line isn't yours or Charles's. It's one number for four hundred children.",
      ], "uneasy");
    },
    async mia({ ui }) {
      await ui.dialogue.say([
        'Mia: "Don\'t forget, my final is at 4:30!"',
        'Mia: "Coach says my ankle is fine. The physio will check it before the game."',
      ]);
    },
    async worker({ ui }) {
      await ui.dialogue.say([
        'Worker: "The city\'s new model says there are lead pipes under this street. 80% sure, it says."',
        'Worker: "So we dig here first. Lovely for the pipes. The old town is less thrilled about the traffic."',
      ], "suspicious");
    },
    gate: ({ ui }) => ui.dialogue.say("The school gate. Mia's class is lining up."),
    async tram({ ui, world }) {
      await ui.dialogue.say("Your bike, for the ride to the office. Time to spin up the experiments.");
      world.goto("office");
    },
  },
};
