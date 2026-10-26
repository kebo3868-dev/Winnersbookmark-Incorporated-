/**
 * The sales talk track, laid out for a phone.
 *
 * It is stored as one string of lines and was printed as one pre-wrapped
 * paragraph: at 390px the minute blocks, every finding and the discipline
 * note ran together into a single wall of text a rep could not find their
 * place in mid-call. The page now reads it as blocks. Stored briefs are never
 * rewritten, so the parser must lay out the old single-line format too, and
 * must never drop a word of either.
 */
import { describe, expect, it } from 'vitest';
import { talkTrackBlocks } from '@/lib/reports/talkTrack';

const NEW_FORMAT = [
  'MINUTE 0–2 — Frame: "I audited Leverock\'s."',
  'MINUTE 2–5 — Score: walk through the Rescue Score (84/100).',
  'MINUTE 5–11 — Top findings: show the top 2 findings with their evidence. Say only what the evidence supports:',
  '• "The online ordering button opens a phone call" — the page markup is verified; a tap test on a phone has not been done',
  '• "Phone demand is unmeasured" — not confirmed — needs the owner\'s records or a manual check',
  'EVIDENCE DISCIPLINE — None of these 2 findings is confirmed end to end. Present each as an observation.',
  'MINUTE 11–16 — Verify: ask the top discovery questions.',
  'MINUTE 16–20 — Next step: recommend AI DISCOVERY AUDIT.',
].join('\n');

/** As stored before this change: findings inline, separated by semicolons. */
const OLD_FORMAT = [
  'MINUTE 0–2 — Frame: "I audited Leverock\'s."',
  'MINUTE 5–11 — Top findings: Say only what the evidence supports — "A" — strongly indicated, not yet confirmed: ask about it, do not assert it; "B" — not confirmed.',
  'EVIDENCE DISCIPLINE — the strongest claim this brief supports overall is: not confirmed.',
  'MINUTE 16–20 — Next step: book the follow-up.',
].join('\n');

const words = (s: string) => s.toLowerCase().replace(/[•—–:"]/g, ' ').split(/\s+/).filter(Boolean);
const flatten = (blocks: ReturnType<typeof talkTrackBlocks>) =>
  blocks.flatMap((b) => [b.time ?? '', b.heading ?? '', b.body, ...b.items]).join(' ');

describe('talkTrackBlocks', () => {
  it('splits the minute blocks, with their time and heading apart from the body', () => {
    const blocks = talkTrackBlocks(NEW_FORMAT);
    expect(blocks.map((b) => b.time)).toEqual(['MINUTE 0–2', 'MINUTE 2–5', 'MINUTE 5–11', null, 'MINUTE 11–16', 'MINUTE 16–20']);
    expect(blocks[1].heading).toBe('Score');
    expect(blocks[1].body).toBe('walk through the Rescue Score (84/100).');
  });

  it('puts each finding under its block as a list item', () => {
    const findings = talkTrackBlocks(NEW_FORMAT)[2];
    expect(findings.items).toHaveLength(2);
    expect(findings.items[0]).toMatch(/^"The online ordering button opens a phone call" — the page markup is verified/);
  });

  it('marks the evidence-discipline line as a note, not a minute block', () => {
    const note = talkTrackBlocks(NEW_FORMAT)[3];
    expect(note.kind).toBe('note');
    expect(note.heading).toBe('Evidence discipline');
    expect(note.body).toMatch(/^None of these 2 findings is confirmed end to end/);
  });

  it('lays out a brief stored in the old format without changing it', () => {
    const blocks = talkTrackBlocks(OLD_FORMAT);
    expect(blocks.map((b) => b.kind)).toEqual(['minute', 'minute', 'note', 'minute']);
    expect(blocks[1].body).toContain('"A" — strongly indicated, not yet confirmed: ask about it, do not assert it; "B"');
  });

  it('never drops a word, in either format', () => {
    for (const text of [NEW_FORMAT, OLD_FORMAT]) expect(words(flatten(talkTrackBlocks(text)))).toEqual(words(text));
  });

  it('keeps an unrecognised line as its own paragraph rather than losing it', () => {
    expect(talkTrackBlocks('A line with no minute marker.')).toEqual([
      { kind: 'paragraph', time: null, heading: null, body: 'A line with no minute marker.', items: [] },
    ]);
  });
});
