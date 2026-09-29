import type { MapDef } from "./MapDef";
import type { Story } from "./WorldScene";
import { home } from "./maps/home";
import { street } from "./maps/street";
import { homeStory } from "../story/home";
import { streetStory } from "../story/street";

export const MAPS: Record<string, MapDef> = { home, street };
export const STORIES: Record<string, Story> = { home: homeStory, street: streetStory };
