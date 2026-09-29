import type { MapDef } from "./MapDef";
import type { Story } from "./WorldScene";
import { evening, home } from "./maps/home";
import { field } from "./maps/field";
import { street } from "./maps/street";
import { office } from "./maps/office";
import { homeStory } from "../story/home";
import { streetStory } from "../story/street";
import { officeStory } from "../story/office";
import { fieldStory } from "../story/final";
import { eveningStory } from "../story/evening";

export const MAPS: Record<string, MapDef> = { home, street, office, field, evening };
export const STORIES: Record<string, Story> = {
  home: homeStory,
  street: streetStory,
  office: officeStory,
  field: fieldStory,
  evening: eveningStory,
};
