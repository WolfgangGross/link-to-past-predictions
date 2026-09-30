// Ada's close-ups, shown in the dialogue box. One file per mood in assets/ada/.

export const MOODS = [
  "neutral", "morning", "thinking", "suspicious", "sceptical", "panic", "success", "umbrella", "endOfDay",
  "worried", "uneasy", "guilty", "surprised", "amused", "focused", "wet", "wetSad",
] as const;

export type Mood = (typeof MOODS)[number];

export const portraitKey = (mood: Mood) => `ada-${mood}`;
export const portraitUrl = (mood: Mood) => `assets/ada/${mood}.png`;
