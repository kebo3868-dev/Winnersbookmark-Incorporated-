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
 * The longest address kept on one line. Addresses are printed only in
 * full-width blocks — a finding card's "What we know", the evidence appendix
 * and the cover — and the narrowest of those, the card body at 9.5pt, is about
 * 480pt wide. 80 characters of a typical address measure about 425pt, which
 * leaves room for wide letters. A shorter limit split addresses that fit and
 * lengthened the appendix for nothing.
 */
export const MAX_ADDRESS_LINE = 80;

const LONG_ADDRESS = /(?:https?:\/\/|www\.)[^\s]+/gi;

/** Break any address longer than `max` onto lines after its own separators. */
export function wrapLongAddresses(text: string, max = MAX_ADDRESS_LINE): string {
  return text.replace(LONG_ADDRESS, (address) => {
    if (address.length <= max) return address;
    const lines: string[] = [];
    let line = '';
    for (const part of address.split(/(?<=[/?&=._-])/)) {
      if (line && (line + part).length > max) {
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
export function wrapAddressesDeep<T>(value: T, max = MAX_ADDRESS_LINE): T {
  if (typeof value === 'string') return wrapLongAddresses(value, max) as T;
  if (Array.isArray(value)) return value.map((item) => wrapAddressesDeep(item, max)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, wrapAddressesDeep(item, max)])) as T;
  }
  return value;
}
