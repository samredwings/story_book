// One-shot: add Character adult fields, GenerationJob.userId, User back-relation
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'prisma/schema.prisma';
let s = readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
const lines = s.split(nl);

function insertAfter(anchor, block) {
  const idx = lines.findIndex((l) => l.trim() === anchor);
  if (idx === -1) throw new Error(`anchor not found: ${anchor}`);
  // guard against double-application
  const next = lines[idx + 1] ? lines[idx + 1].trim() : '';
  if (next === block[0].trim()) throw new Error(`already applied: ${anchor}`);
  lines.splice(idx + 1, 0, ...block);
  console.log(`inserted ${block.length} line(s) after "${anchor}"`);
}

// 1) Character: adult fields after `traits`
insertAfter('traits      String? // JSON array of traits', [
  '  sexualRole    String? // dominant|submissive|switch|slut|prey|predator|other',
  '  kinks         String? // JSON string array',
  '  bodyDetails   String?',
  '  voiceStyle    String?',
  '  limits        String? // JSON string array',
  '  preferredActs String? // JSON string array',
]);

// 2) User: back-relation for GenerationJob
insertAfter('videoCallSessions     VideoCallSession[]', [
  '  generationJobs        GenerationJob[]',
]);

// 3) GenerationJob: userId + relation + index
insertAfter('scenes  Scene[]', [
  '  userId String',
  '  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)',
]);
insertAfter('@@index([createdAt])', [
  '  @@index([userId])',
]);

writeFileSync(p, lines.join(nl), 'utf8');
console.log('schema.prisma patched OK');

