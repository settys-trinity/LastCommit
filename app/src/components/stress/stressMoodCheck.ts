// Stress/mood mismatch check. Owner: Nandini. Same rules and results as ml/stress_feed.py.
// A flag on the stress panel only: it never changes the triage tier (plan decision D13).
// Thresholds are DESIGN_CHOICE.

export type StressMoodResult =
  | "hidden_stress"
  | "low_mood_no_stress"
  | "consistent"
  | "uncertain"
  | "no_data";

export const WINDOW_COUNT = 5;   // last 5 windows, about 2 minutes (windows slide 15 s)
export const STRESSED_AT = 0.6;  // mean stress_prob >= 0.6 -> stressed
export const CALM_AT = 0.4;      // mean stress_prob <= 0.4 -> calm
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
  flag: boolean;               // true -> amber MISMATCH on the stress panel
  stressLevel: number | null;  // mean stress_prob over the last WINDOW_COUNT windows
  mood: number | null;
  message: string;
}

/** mood: 1-5 or null. stressProbs: recent stress_prob values, oldest first. */
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
