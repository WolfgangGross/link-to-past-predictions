// School street: the ripples of the morning land here — rain, the school run, the gate cafe, the nurse.

import type { Story } from "../world/WorldScene";
import { state } from "../state";
import { rainOutcome } from "./umbrella";
import { CARD as SCHOOL_RUN_CARD, SCHOOL_STARTS, clock } from "./schoolRun";

export const streetStory: Story = {
  async onEnter({ ui }) {
    const run = state.schoolRun!;
    ui.setClock(clock(run.arrive));
    const lines = [...(await rainOutcome())];
    if (run.herd) {
      lines.push(
        `The ${run.route === "car_main_road" ? "main road" : "old town"} is gridlocked. Every parent's phone recommended it this morning.`,
        "The phone learned from mornings when nobody had the phone.",
      );
    }
    if (run.late) lines.push(`${clock(run.arrive)}. Late. Mia sprints for the gate.`);
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
        "Her line isn't yours or Sam's. It's one number for four hundred children.",
      ]);
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
      ]);
    },
    gate: ({ ui }) => ui.dialogue.say("The school gate. Mia's class is lining up."),
    async tram({ ui }) {
      await ui.dialogue.say([
        "The tram to the office. Time to spin up the experiments.",
        "To be continued: the office, the GPU budget, the avocados, and Mia's big final.",
        "Thanks for playing this early build!",
      ]);
      window.location.reload();
    },
  },
};
