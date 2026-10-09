// One-shot: re-close the VideoCallSession model block in schema.prisma
import { readFileSync, writeFileSync } from 'node:fs';

const p = 'prisma/schema.prisma';
let s = readFileSync(p, 'utf8');

const nl = s.includes('\r\n') ? '\r\n' : '\n';
const lines = s.split(nl);

// Locate the comment line that marks the ChotiCorpus section
const commentIdx = lines.findIndex((l) => l.includes('Bangla Choti Knowledge Base'));
if (commentIdx === -1) throw new Error('comment marker not found');

// Walk backwards from the comment to the last field line of VideoCallSession
let fieldIdx = -1;
for (let i = commentIdx - 1; i >= 0; i--) {
  const t = lines[i].trim();
  if (t === '') continue;
  if (t.startsWith('}')) throw new Error('block already closed before comment');
  fieldIdx = i;
  break;
}
if (fieldIdx === -1) throw new Error('no field line found before comment');

lines.splice(fieldIdx + 1, 0, '}');
writeFileSync(p, lines.join(nl), 'utf8');
console.log(`Inserted closing brace after line ${fieldIdx + 1} (1-based ${fieldIdx + 1 + 1})`);

