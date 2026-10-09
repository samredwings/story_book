const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|prompts?)/i,
  /forget\s+(everything|all)/i,
  /you\s+are\s+now\s+/i,
  /system\s*:\s*/i,
  /<\s*\|?\s*system\s*\|?\s*>/i,
  /\[\s*INST\s*\]/i,
  /\bDAN\b.*\bmode\b/i,
  /disregard\s+(your|the)\s+(rules|guidelines)/i,
];

export function looksLikePromptInjection(input: string): boolean {
  if (typeof input !== "string") return false;
  if (input.length > 50_000) return true;
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    if (pattern.test(input)) return true;
  }
  return false;
}

export function sanitizeForLog(input: string, maxLen = 200): string {
  if (typeof input !== "string") return "[non-string]";
  return input.length > maxLen ? input.slice(0, maxLen) + "..." : input;
}
