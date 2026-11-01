/**
 * LINE BREAKING FOR WORDS A READER COPIES.
 *
 * The PDF layout engine hyphenates every word and prints a hyphen wherever it
 * breaks one. For prose that is ordinary typesetting. For a web address it
 * changes the address: "https://tmt.spotapps.co/ordering-menu/" was printed as
 * "…/order-" and "ing-menu/", and a reader copying it gets a URL that does not
 * exist. Two rules keep addresses intact:
 *
 *   1. `pdfHyphenation` never splits an address inside a word, so the engine
 *      moves a whole address to the next line instead.
 *   2. `wrapLongAddresses` handles an address too long for any line, which
 *      rule 1 alone would push past the page edge: it breaks the address onto
 *      separate lines after its own separators (/ ? & = . _ -), with a line
 *      break and no inserted character.
 *
 * The engine cannot break without printing a hyphen, and a zero-width break
 * character prints as a stray glyph in the standard PDF fonts, so the line
 * break is the only mark that adds nothing to the address.
 */

/** A word that is, or is part of, a web or email address. */
const ADDRESS_WORD = /:\/\/|^\(?www\.|^[^\s@]+@[^\s@]+\.[a-z]|[/?&=]/i;

/** True for a word the PDF must not hyphenate. */
export function isAddressWord(word: string): boolean {
  return ADDRESS_WORD.test(word);
}

/**
 * Registered with the PDF renderer. Prose keeps the built-in hyphenation; an
 * address is never split inside a word.
 */
export function pdfHyphenation(word: string, builtin?: (word: string) => string[]): string[] {
  if (isAddressWord(word)) return [word];
  return builtin ? builtin(word) : [word];
}

/**
 * The widest address kept on one line, in ems of Helvetica. Addresses are
 * printed only in full-width blocks — a finding card's "What we know", the
 * evidence appendix and the cover — and the narrowest of those, the card body
 * at 9.5pt, is about 480pt wide. 44em is 418pt there: a typical address of
 * about 80 characters fits, and a narrower limit split addresses that fit and
 * lengthened the appendix for nothing.
 *
 * Measured in width, not characters, because a run of "w" is three times as
 * wide as a run of "i" and a character count lets the wide one overflow.
 */
export const MAX_ADDRESS_EM = 44;

/**
 * Helvetica advance widths, rounded UP into four bands so the estimate never
 * undershoots: narrow punctuation and thin letters, ordinary letters and
 * digits, capitals, and the widest glyphs.
 */
function glyphEm(ch: string): number {
  if (/[iljtfr.,/:;'!|-]/.test(ch)) return 0.34;
  if (/[mwMW@%]/.test(ch)) return 1.02;
  if (/[A-Z&]/.test(ch)) return 0.78;
  return 0.56;
}

/** Estimated printed width of `text` in ems of Helvetica. */
export function addressEm(text: string): number {
  let em = 0;
  for (const ch of text) em += glyphEm(ch);
  return em;
}

/** A segment wider than a line, cut into pieces that each fit. */
function cutToWidth(segment: string, max: number): string[] {
  const pieces: string[] = [];
  let piece = '';
  for (const ch of segment) {
    if (piece && addressEm(piece + ch) > max) {
      pieces.push(piece);
      piece = ch;
    } else {
      piece += ch;
    }
  }
  if (piece) pieces.push(piece);
  return pieces;
}

const LONG_ADDRESS = /(?:https?:\/\/|www\.)[^\s]+/gi;

/**
 * Break any address wider than `max` ems onto lines, after its own separators
 * where it has them. A segment with no separator that is itself wider than a
 * line is cut at the width limit — still with a line break and no inserted
 * character — so no line of an address can run past the text area.
 */
export function wrapLongAddresses(text: string, max = MAX_ADDRESS_EM): string {
  return text.replace(LONG_ADDRESS, (address) => {
    if (addressEm(address) <= max) return address;
    const parts = address.split(/(?<=[/?&=._-])/).flatMap((part) => (addressEm(part) > max ? cutToWidth(part, max) : [part]));
    const lines: string[] = [];
    let line = '';
    for (const part of parts) {
      if (line && addressEm(line + part) > max) {
        lines.push(line);
        line = part;
      } else {
        line += part;
      }
    }
    if (line) lines.push(line);
    return lines.join('\n');
  });
}

/** `wrapLongAddresses` applied to every string in a value — the whole report DTO before layout. */
export function wrapAddressesDeep<T>(value: T, max = MAX_ADDRESS_EM): T {
  if (typeof value === 'string') return wrapLongAddresses(value, max) as T;
  if (Array.isArray(value)) return value.map((item) => wrapAddressesDeep(item, max)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrapAddressesDeep(item, max)])) as T;
  }
  return value;
}
