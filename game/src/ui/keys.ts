import type * as Phaser from "phaser";

export const CONFIRM = ["Space", "Enter", "KeyZ", "KeyE"];
export const UP = ["ArrowUp", "KeyW"];
export const DOWN = ["ArrowDown", "KeyS"];
export const LEFT = ["ArrowLeft", "KeyA"];
export const RIGHT = ["ArrowRight", "KeyD"];

/** Resolves with the `code` of the next matching key press. */
export function nextKey(scene: Phaser.Scene, codes: string[]): Promise<string> {
  return new Promise((resolve) => {
    const keyboard = scene.input.keyboard!;
    const handler = (event: KeyboardEvent) => {
      if (event.repeat || !codes.includes(event.code)) return;
      keyboard.off("keydown", handler);
      resolve(event.code);
    };
    keyboard.on("keydown", handler);
  });
}
