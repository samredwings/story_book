import type {
  GamePhase,
  SexGameChoice,
} from "./types";

const CHOICES: Record<
  GamePhase,
  readonly SexGameChoice[]
> = {
  FOREPLAY: [
    {
      id: 1,
      text: "Press your bodies together and grind your dripping cunt against his hardening cock while you suck on his tongue",
      intensity: 3,
      staminaCost: 3,
      arousalGain: 5,
    },
    {
      id: 2,
      text: "Drop to your knees, spit on his thick shaft and stroke it while you bury your face in his balls and inhale the scent of his cock",
      intensity: 5,
      staminaCost: 5,
      arousalGain: 8,
    },
    {
      id: 3,
      text: "Spread your legs wide, shove two fingers deep into your soaking pussy and finger-fuck yourself while he watches, then force those wet fingers into his mouth",
      intensity: 7,
      staminaCost: 6,
      arousalGain: 10,
    },
    {
      id: 4,
      text: "Climb on top of him, grind your swollen clit hard against the head of his cock until it’s shiny with your juices, then slap his face with your wet cunt",
      intensity: 9,
      staminaCost: 7,
      arousalGain: 14,
    },
  ],
  BUILD_UP: [
    {
      id: 1,
      text: "Wrap your lips around the head of his cock and suck hard while you play with his balls, letting thick strings of spit drip down his shaft",
      intensity: 4,
      staminaCost: 5,
      arousalGain: 8,
    },
    {
      id: 2,
      text: "Bend over, reach back and spread your ass cheeks so he can spit on your tight hole and push the tip of his cock against your dripping cunt",
      intensity: 6,
      staminaCost: 7,
      arousalGain: 11,
    },
    {
      id: 3,
      text: "Sit on his face and grind your dripping pussy all over his mouth while you deepthroat his cock, choking and gagging on every inch",
      intensity: 8,
      staminaCost: 9,
      arousalGain: 14,
    },
    {
      id: 4,
      text: "Force his cock all the way down your throat until your nose is pressed against his stomach, hold it there while you drool and choke, then pull off and slap the spit-covered shaft against your face",
      intensity: 10,
      staminaCost: 12,
      arousalGain: 18,
    },
  ],
  ACT: [
    {
      id: 1,
      text: "Slide his thick cock slowly into your tight, dripping cunt and fuck yourself on it with long, deep strokes while you moan like a whore",
      intensity: 6,
      staminaCost: 8,
      arousalGain: 10,
    },
    {
      id: 2,
      text: "Get on all fours, arch your back hard and take every inch of his cock balls-deep while he pounds your soaked pussy from behind",
      intensity: 7,
      staminaCost: 10,
      arousalGain: 13,
    },
    {
      id: 3,
      text: "Flip onto your back, pull your knees to your chest and make him jackhammer your cunt until your juices are spraying and your eyes roll back",
      intensity: 8,
      staminaCost: 12,
      arousalGain: 15,
    },
    {
      id: 4,
      text: "Ride him reverse cowgirl, slamming your ass down so hard his balls slap against your clit with every thrust while you cream all over his cock",
      intensity: 10,
      staminaCost: 15,
      arousalGain: 19,
    },
  ],
  INTENSE_ACT: [
    {
      id: 1,
      text: "Keep his cock buried to the hilt inside your stretched, dripping cunt and grind in tight circles so every ridge scrapes your g-spot",
      intensity: 7,
      staminaCost: 12,
      arousalGain: 12,
    },
    {
      id: 2,
      text: "Tell him to choke you while he fucks you harder, slamming into your cervix until you’re sobbing and squirting around his cock",
      intensity: 8,
      staminaCost: 13,
      arousalGain: 15,
    },
    {
      id: 3,
      text: "Spread your legs as wide as they’ll go and take the most brutal, deep strokes while you beg him to ruin your tight little hole",
      intensity: 9,
      staminaCost: 15,
      arousalGain: 18,
    },
    {
      id: 4,
      text: "Let him pound you without mercy until your pussy is a swollen, creaming mess, then pull out and force his cock down your throat so you can taste yourself",
      intensity: 10,
      staminaCost: 18,
      arousalGain: 22,
    },
  ],
  CLIMAX: [
    {
      id: 1,
      text: "Let him bury his cock as deep as it will go and pump load after thick load of cum straight into your spasming cunt",
      intensity: 8,
      staminaCost: 0,
      arousalGain: 0,
    },
    {
      id: 2,
      text: "Pull out at the last second and paint your face, tits and open mouth with thick ropes of hot cum while you stick your tongue out like a greedy slut",
      intensity: 7,
      staminaCost: 0,
      arousalGain: 0,
    },
    {
      id: 3,
      text: "Clamp your pussy down hard around his pulsing cock and milk every drop of cum out of him while you cum hard, squirting all over his balls",
      intensity: 6,
      staminaCost: 0,
      arousalGain: 0,
    },
  ],
  AFTERCARE: [
    {
      id: 1,
      text: "Keep his softening, cum-covered cock in your mouth and gently suck the last drops out while you hold him close",
      intensity: 2,
      staminaCost: 0,
      arousalGain: -5,
    },
    {
      id: 2,
      text: "Let his cum slowly leak out of your used, swollen cunt onto the sheets while you both catch your breath",
      intensity: 1,
      staminaCost: 0,
      arousalGain: -5,
    },
    {
      id: 3,
      text: "Lick the mixture of cum and pussy juice off his cock and balls until he’s clean, then rest your head on his chest",
      intensity: 1,
      staminaCost: 0,
      arousalGain: -5,
    },
    {
      id: 4,
      text: "Whisper filthy things about how well he just fucked you while you slowly stroke his spent cock and feel his cum still dripping from your hole",
      intensity: 3,
      staminaCost: 0,
      arousalGain: -3,
    },
  ],
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Fixed low-stamina fallback logic:
 * 1. Prefer choices the player can actually afford (intensity + stamina).
 * 2. If none, fall back to the cheapest intensity-compatible choice
 *    (so the service can still reject with a clear "Not enough stamina").
 * 3. Absolute last resort: first choice of the phase.
 */
export function generateChoicesForPhase(
  phase: GamePhase,
  stamina: number,
  intensity: number,
): SexGameChoice[] {
  const phaseChoices = CHOICES[phase] ?? [];
  const safeStamina = clamp(stamina, 0, 100);
  const safeIntensity = clamp(intensity, 1, 10);

  // 1. Ideal: affordable + intensity-compatible
  const available = phaseChoices.filter(
    (choice) =>
      choice.intensity <= safeIntensity &&
      choice.staminaCost <= safeStamina,
  );

  if (available.length > 0) {
    return available.map((c) => ({ ...c }));
  }

  // 2. Fallback: intensity-compatible, sorted by lowest stamina cost first
  const intensityCompatible = phaseChoices
    .filter((choice) => choice.intensity <= safeIntensity)
    .sort(
      (a, b) =>
        a.staminaCost - b.staminaCost || a.intensity - b.intensity,
    );

  if (intensityCompatible.length > 0) {
    // Still return only the cheapest one so the service can reject cleanly
    return [{ ...intensityCompatible[0] }];
  }

  // 3. Absolute last resort
  return phaseChoices.length > 0 ? [{ ...phaseChoices[0] }] : [];
}
