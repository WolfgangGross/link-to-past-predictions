// Home: wake up, find the phone, the umbrella call, then out the door.

import type { Story } from "../world/WorldScene";
import { state } from "../state";
import { lookOutOfWindow, pickUpPhone, rainOutcome } from "./umbrella";
import { talkToLeo } from "./leo";

export const homeStory: Story = {
  async onEnter({ ui }) {
    ui.setClock("06:30");
    await ui.dialogue.say(["06:30. The alarm. Again.", "Two kids, one paper deadline, zero coffee. Let's go."]);
  },
  interact: {
    async nightstand({ ui }) {
      if (state.hasPhone) return ui.dialogue.say("Just a nightstand now. And a glass of water.");
      await pickUpPhone(ui);
    },
    window: ({ ui }) => lookOutOfWindow(ui),
    wardrobe: ({ ui }) => ui.dialogue.say("Clothes for a long day. You're already dressed. Mostly."),
    desk: ({ ui }) => ui.dialogue.say("The home laptop. The real work happens at the office."),
    fridge: ({ ui }) => ui.dialogue.say("Milk, cheese, one sad avocado."),
    sam: ({ ui }) => ui.dialogue.say(['Sam: "Coffee is brewing. Leo says he feels hot. Can you check on him?"']),
    mia: ({ ui }) => ui.dialogue.say(['Mia: "Is it going to rain? I have my football final today!"']),
    leo: ({ ui }) => talkToLeo(ui),
    async door({ ui }) {
      if (!state.hasPhone) return ui.dialogue.say("Wait. Something on the nightstand is glowing.");
      if (state.umbrellas === undefined) return ui.dialogue.say("Umbrellas or not? Better check the sky from the window first.");
      if (state.leoHome === undefined) return ui.dialogue.say("Leo is still in bed. Better check on him first.");
      await ui.dialogue.say([
        state.leoHome ? "8:00. Out the door with Mia. Leo waves from the window." : "8:00. Out the door with Mia and Leo...",
        ...(await rainOutcome()),
        "To be continued: the school run, the office, and Mia's big final.",
        "Thanks for playing this early build!",
      ]);
      window.location.reload();
    },
  },
};
