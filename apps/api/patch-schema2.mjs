// One-shot: restore VideoCallSession relation fields + second index
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'prisma/schema.prisma';
let s = readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
const lines = s.split(nl);

const commentIdx = lines.findIndex((l) => l.includes('Bangla Choti Knowledge Base'));
if (commentIdx === -1) throw new Error('comment marker not found');

// Find the closing brace that immediately precedes the comment block
let braceIdx = -1;
for (let i = commentIdx - 1; i >= 0; i--) {
  const t = lines[i].trim();
  if (t === '') continue;
  if (t !== '}') throw new Error(`expected } but got: ${t}`);
  braceIdx = i;
  break;
}
if (braceIdx === -1) throw new Error('no closing brace found');

const block = [
  '  user         User                 @relation(fields: [userId], references: [id], onDelete: Cascade)',
  '  conversation RoleplayConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)',
  '',
  '  @@index([userId, updatedAt])',
  '  @@index([conversationId, status])',
];
lines.splice(braceIdx, 0, ...block);
writeFileSync(p, lines.join(nl), 'utf8');
console.log(`Inserted relation block before line ${braceIdx + 1}`);

