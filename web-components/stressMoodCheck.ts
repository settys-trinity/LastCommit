// FARSIDE stress/mood mismatch check for the engine (TypeScript copy of ml/stress_feed.py check_mismatch).
// Use it in the app when a new mood check-in or stress_prob reading arrives.
// One more indicator for the rules engine: it NEVER sets a triage tier on its own.
// Thresholds are DESIGN_CHOICE values; keep them in sync with ml/stress_feed.py.

export type StressMoodResult =
  | "hidden_stress"
  | "low_mood_no_stress"
  | "consistent"
  | "uncertain"
  | "no_data";

export const WINDOW_COUNT = 5;   // last 5 windows, about 2 minutes
export const STRESSED_AT = 0.6;  // mean p_stress >= 0.6 -> stressed
export const CALM_AT = 0.4;      // mean p_stress <= 0.4 -> calm
export const MOOD_FINE_AT = 4;   // mood 4-5 -> "I'm fine"
export const MOOD_LOW_AT = 2;    // mood 1-2 -> "I feel bad"

export const STRESS_MOOD_MESSAGES: Record<StressMoodResult, string> = {
  hidden_stress:
    "Body signals show stress but self-reported mood is good. Self-report can miss strain: take a 5-minute break and re-check.",
  low_mood_no_stress:
    "Mood is low but body signals look calm. Consider a private behavioural-health check-in with the crew medical officer.",
  consistent: "Body signals and self-reported mood agree.",
  uncertain: "Stress signal is borderline; no comparison made.",
  no_data: "Not enough stress data or no mood check-in yet.",
};

export interface StressMoodCheck {
  result: StressMoodResult;
  flag: boolean;               // true -> show the flag on the brain & behaviour panel (amber)
  stressLevel: number | null;  // mean p_stress over the last WINDOW_COUNT windows
  mood: number | null;
  message: string;
}

/** mood: 1-5 or null. stressProbs: recent stress_prob reading values, oldest first. */
export function checkStressMood(mood: number | null, stressProbs: number[]): StressMoodCheck {
  const recent = stressProbs.slice(-WINDOW_COUNT);
  let result: StressMoodResult;
  let level: number | null = null;

  if (mood === null || recent.length < WINDOW_COUNT) {
    result = "no_data";
  } else {
    level = recent.reduce((a, b) => a + b, 0) / recent.length;
    if (level >= STRESSED_AT) result = mood >= MOOD_FINE_AT ? "hidden_stress" : "consistent";
    else if (level <= CALM_AT) result = mood <= MOOD_LOW_AT ? "low_mood_no_stress" : "consistent";
    else result = "uncertain";
  }

  return {
    result,
    flag: result === "hidden_stress" || result === "low_mood_no_stress",
    stressLevel: level === null ? null : Math.round(level * 1000) / 1000,
    mood,
    message: STRESS_MOOD_MESSAGES[result],
  };
}
