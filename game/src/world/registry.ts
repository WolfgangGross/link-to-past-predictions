import type { MapDef } from "./MapDef";
import type { Story } from "./WorldScene";
import { home } from "./maps/home";
import { homeStory } from "../story/home";

export const MAPS: Record<string, MapDef> = { home };
export const STORIES: Record<string, Story> = { home: homeStory };
