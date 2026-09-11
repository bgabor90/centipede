/**
 * Wave color palette, sourced from the Centipede rev4 disassembly
 * documentation (https://6502disassembly.com/va-centipede/graphics.html).
 *
 * The original hardware encodes each color as a 4-bit %DBGR value (Dark
 * flag, Blue, Green, Red) and cycles a 3-role palette — body/mushroom,
 * legs/gun, eyes/text — across 14 waves before repeating. This is a
 * verified fact from the source documentation, not an approximation: the
 * exact DBGR byte for each role on each wave is transcribed below. The
 * hex RGB values themselves are this project's own reasonable rendering
 * of each named DBGR color (arcade CRT color reproduction varies by
 * cabinet, and the doc gives named colors, not calibrated RGB), not an
 * extracted/verified color value.
 */

// %DBGR -> named color, per the disassembly's decode table.
export const DBGR_COLORS: Record<string, string> = {
  '0x00': '#d8b888', // beige
  '0x01': '#33cc88', // greenish cyan
  '0x02': '#cc3366', // reddish magenta
  '0x03': '#2a2a99', // dark blue
  '0x04': '#ff8822', // orange
  '0x05': '#227733', // dark green
  '0x06': '#dd2222', // red
  '0x07': '#000000', // black
  '0x08': '#ffffff', // white
  '0x09': '#22ccee', // cyan
  '0x0a': '#dd22cc', // magenta
  '0x0b': '#3355ff', // blue
  '0x0c': '#ffdd22', // yellow
  '0x0d': '#33dd44', // green
  '0x0e': '#ff3333', // red (bright/dark-flag variant of $06)
  '0x0f': '#000000', // black
};

export interface WavePalette {
  body: string; // "Body/Mushroom" role
  legs: string; // "Legs/Gun" role
  eyes: string; // "Eyes/Mushroom-O/Text" role
}

// Wave 1-14 DBGR triples [body, legs, eyes], transcribed from the
// disassembly's documented color-assignment table (address $267a).
// Wave 15 repeats wave 1, and so on (14-wave cycle).
const WAVE_TABLE_DBGR: Array<[string, string, string]> = [
  ['0x0d', '0x00', '0x0e'], // wave 1
  ['0x02', '0x04', '0x01'], // wave 2
  ['0x0e', '0x01', '0x0c'], // wave 3
  ['0x04', '0x01', '0x0b'], // wave 4
  ['0x01', '0x0c', '0x0a'], // wave 5
  ['0x09', '0x0b', '0x04'], // wave 6
  ['0x0c', '0x0d', '0x0a'], // wave 7
  ['0x09', '0x0c', '0x0e'], // wave 8
  ['0x0a', '0x0e', '0x01'], // wave 9
  ['0x0b', '0x01', '0x04'], // wave 10
  ['0x01', '0x00', '0x06'], // wave 11
  ['0x0d', '0x0e', '0x0a'], // wave 12
  ['0x0e', '0x0c', '0x0b'], // wave 13
  ['0x00', '0x0d', '0x02'], // wave 14
];

const WAVE_PALETTES: WavePalette[] = WAVE_TABLE_DBGR.map(([body, legs, eyes]) => ({
  body: DBGR_COLORS[body],
  legs: DBGR_COLORS[legs],
  eyes: DBGR_COLORS[eyes],
}));

/** 1-indexed wave number -> palette, cycling every 14 waves per the source. */
export function getWavePalette(waveNumber: number): WavePalette {
  const idx = (Math.max(1, waveNumber) - 1) % WAVE_PALETTES.length;
  return WAVE_PALETTES[idx];
}
