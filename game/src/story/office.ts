// The office: boot Omarchy, spin up Claude, split the GPUs, sort out the avocados. Then off to Mia's final.

import type { Story } from "../world/WorldScene";
import { state } from "../state";
import { allocateGpus, prefetchRanking, PROPOSALS } from "./gpu";
import { avocados, prefetchForecast } from "./avocado";
import { currentSky } from "./umbrella";

/** Morning ripples that arrive as messages once you're at work. */
function morningMessages(): void {
  if (state.leoHome) {
    state.messages.push(
      state.leoContagious
        ? { from: "Charles", text: "Leo is at 38.4 now. Good call keeping him home." }
        : { from: "Charles", text: "Leo is bouncing on the sofa. Pretty sure he's fine. My big meeting is gone though." },
    );
  } else if (state.leoContagious) {
    state.messages.push({ from: "School", text: "Four children in class 1b went home with a cold today." });
  }
}

export const officeStory: Story = {
  sky: currentSky,
  async onEnter({ ui }) {
    ui.setClock("08:55");
    morningMessages();
    // Both live predictions start now; the player will reach them a minute or two later.
    prefetchRanking();
    prefetchForecast();
    await ui.dialogue.say([
      "Posterior Labs, Freiburg. Your desk is the one in the corner.",
      state.messages.length ? "Your phone buzzes. (TAB to read messages.)" : "Quiet phone. So far.",
    ]);
  },
  interact: {
    async adaDesk({ ui }) {
      if (state.bootDone) return ui.dialogue.say("Claude has the eight runs set up. They're waiting for GPUs.");
      await ui.terminal.play([
        { text: "Omarchy (Arch Linux) - tty1", color: "dim" },
        { text: "ada@posteriorlabs ~ $ cd tabpfn && claude", typed: true, color: "green" },
        { text: "* Claude Code", color: "orange" },
        { text: "> Read the eight proposals in proposals/ and set up their runs.", typed: true },
        { text: "Reading proposals/*.md ...", color: "dim" },
        { text: "Wrote train_chunked_attention.py  +214 lines", color: "fg" },
        { text: "Wrote configs/ablations/*.yaml  (14 files)", color: "fg" },
        { text: "Wrote eval/tabarena_harness.py  +96 lines", color: "fg" },
        { text: "Tests: 38 passed", color: "green" },
        { text: "8 runs ready. We have 4 GPU nodes. Which ones should go?", color: "orange", pause: 600 },
        { text: "# train_chunked_attention.py", win: "right", color: "dim" },
        { text: "def chunked_row_attention(x, chunk=65_536):", win: "right", color: "blue" },
        { text: "    # attend within chunks,", win: "right", color: "dim" },
        { text: "    # then across chunk summaries", win: "right", color: "dim" },
        { text: "    ...", win: "right" },
        { text: "# scale: 10K -> 1M rows,", win: "right", color: "dim" },
        { text: "# no structural assumptions", win: "right", color: "dim" },
      ]);
      state.bootDone = true;
      await ui.dialogue.say([
        "Claude wrote in five minutes what used to take you a week.",
        'Jonas (over the monitor): "Great, so now we can run three times as many experiments!"',
        "Three times as many results to review, explain and defend. The code got cheap. The judgment didn't.",
        "Petra has the GPU budget. Meeting room.",
      ]);
    },
    async petra({ ui }) {
      if (!state.bootDone) return ui.dialogue.say('Petra: "Morning! Boot up first, the proposals are in the repo."');
      await allocateGpus(ui);
    },
    async tomas({ ui }) {
      const left = state.gpu && !state.gpu.funded.some((id) => PROPOSALS.find((p) => p.id === id)?.team === "efficiency");
      await ui.dialogue.say(
        left
          ? 'Tomas: "No node for efficiency. Fine. I\'ll make everyone else\'s runs 30% faster. For free, apparently."'
          : 'Tomas: "Distillation isn\'t exciting. But a small model that runs everywhere beats a huge one that never leaves the lab."',
      );
    },
    jonas: ({ ui }) => ui.dialogue.say('Jonas: "Chunked attention gets us to a million rows. I can feel it. The prior can too."'),
    rosa: ({ ui }) => avocados(ui),
    whiteboard: ({ ui }) => ui.dialogue.say('The whiteboard: "10K -> 1M rows. Text + tables. Fast enough to ship, not just to publish."'),
    async exit({ ui, world }) {
      if (!state.gpu) return ui.dialogue.say("Petra is waiting in the meeting room with the GPU budget.");
      if (!state.avocados) return ui.dialogue.say("Rosa waves from the canteen. She needs next week's avocado order.");
      await ui.dialogue.say(["15:00. The runs are cooking.", "16:15. Time to go. Mia's final starts at 16:30."]);
      world.goto("field");
    },
  },
};
