/**
 * The stored talk track, read as blocks for the sales page.
 *
 * The talk track is stored as plain lines and was printed as one pre-wrapped
 * paragraph, which on a phone ran the minute blocks, every finding and the
 * evidence-discipline note into one wall of text. Presentation only: the
 * stored string is never rewritten, so a brief generated before the findings
 * moved onto their own lines lays out too, and every word is kept.
 */
export interface TalkTrackBlock {
  kind: 'minute' | 'note' | 'paragraph';
  /** "MINUTE 5–11", for a minute block. */
  time: string | null;
  heading: string | null;
  body: string;
  /** Lines written as "• …" directly after this block — the findings. */
  items: string[];
}

const MINUTE_WITH_HEADING = /^(MINUTE \d+–\d+) — ([^:]{1,40}): (.*)$/;
const MINUTE = /^(MINUTE \d+–\d+) — (.*)$/;
const NOTE = /^EVIDENCE DISCIPLINE — (.*)$/;

export function talkTrackBlocks(text: string): TalkTrackBlock[] {
  const blocks: TalkTrackBlock[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const previous = blocks[blocks.length - 1];
    if (line.startsWith('• ') && previous) {
      previous.items.push(line.slice(2));
      continue;
    }
    const titled = line.match(MINUTE_WITH_HEADING);
    if (titled) {
      blocks.push({ kind: 'minute', time: titled[1], heading: titled[2], body: titled[3], items: [] });
      continue;
    }
    const minute = line.match(MINUTE);
    if (minute) {
      blocks.push({ kind: 'minute', time: minute[1], heading: null, body: minute[2], items: [] });
      continue;
    }
    const note = line.match(NOTE);
    if (note) {
      blocks.push({ kind: 'note', time: null, heading: 'Evidence discipline', body: note[1], items: [] });
      continue;
    }
    blocks.push({ kind: 'paragraph', time: null, heading: null, body: line, items: [] });
  }
  return blocks;
}
