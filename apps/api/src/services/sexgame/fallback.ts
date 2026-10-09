import type {
  GamePhase,
  SexGameSession,
} from "./types";

function getCharacterName(
  session: SexGameSession,
): string {
  return (
    session.characterName?.trim() ||
    "your partner"
  );
}

export function getFallbackDescription(
  session: SexGameSession,
): string {
  const name =
    getCharacterName(session);
  switch (session.phase) {
    case "FOREPLAY":
      return (
        `The air is already thick with the smell of sex. ` +
        `${name} is pressed hard against you, grinding a dripping cunt against your cock while ` +
        `hot breath and filthy whispers fill the space between your mouths.`
      );
    case "BUILD_UP":
      return (
        `Your cock is rock-hard and leaking. ` +
        `${name} is on her knees, spit running down her chin as she works your shaft, ` +
        `eyes locked on yours while she deepthroats every inch like a starving whore.`
      );
    case "ACT":
      return (
        `You’re balls-deep inside ${name}’s tight, soaking cunt. ` +
        `Every thrust makes wet, filthy sounds as her juices drip down your cock and balls, ` +
        `her moans turning into broken, desperate gasps.`
      );
    case "INTENSE_ACT":
      return (
        `${name} is getting fucked stupid. ` +
        `Her pussy is stretched wide around your thick cock, cream coating your shaft with every brutal stroke ` +
        `as she begs you to ruin her harder.`
      );
    case "CLIMAX":
      return (
        `You slam in to the hilt and flood ${name}’s cunt with thick, hot cum. ` +
        `Her pussy clamps down and milks every drop while she cums hard, squirting around your pulsing cock.`
      );
    case "AFTERCARE":
      return (
        `Your spent cock is still buried inside ${name}’s messy, cum-filled hole. ` +
        `Thick white cream slowly leaks out around your shaft as she whimpers and holds you close, ` +
        `both of you sticky, sweaty, and completely used.`
      );
    default:
      return (
        `You’re still deep inside ${name}, her cunt twitching around your cock ` +
        `while cum and pussy juice drip between your bodies.`
      );
  }
}

export function getFallbackOpening(
  session: SexGameSession,
): string {
  const name =
    getCharacterName(session);
  return (
    `The second the door closes, ${name} is already on you. ` +
    `She drops to her knees, yanks your cock out, and takes it straight down her throat, ` +
    `choking and gagging as thick spit runs down her chin and onto her tits.`
  );
}

export function getFallbackForPhase(
  phase: GamePhase,
): string {
  switch (phase) {
    case "FOREPLAY":
      return (
        "She’s already dripping. Fingers buried in her cunt, " +
        "she’s rubbing her swollen clit while staring at your cock like she needs it inside her right now."
      );
    case "BUILD_UP":
      return (
        "Your cock is soaked with her spit. " +
        "She’s deepthroating you so hard her eyes are watering, taking every inch until her nose is pressed against your stomach."
      );
    case "ACT":
      return (
        "You’re fucking her hard and deep. " +
        "Her tight, wet cunt is stretched around your cock, making filthy wet sounds with every thrust as she moans like a whore."
      );
    case "INTENSE_ACT":
      return (
        "She’s getting destroyed. " +
        "Her pussy is a creaming mess, juices spraying every time you slam into her cervix while she begs for more."
      );
    case "CLIMAX":
      return (
        "You bury your cock to the hilt and unload thick ropes of cum deep inside her. " +
        "Her cunt spasms and milks you dry while she cums hard, squirting all over your balls."
      );
    case "AFTERCARE":
      return (
        "Your cock is still twitching inside her cum-filled pussy. " +
        "Thick white cream leaks out around your shaft as she lies there, used, messy, and completely satisfied."
      );
  }
}
