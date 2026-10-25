/** EAN-13: check digit and the real bar pattern, so printed labels would scan. */
const L = ['0001101', '0011001', '0010011', '0111101', '0100011', '0110001', '0101111', '0111011', '0110111', '0001011'];
const G = ['0100111', '0110011', '0011011', '0100001', '0011101', '0111001', '0000101', '0010001', '0001001', '0010111'];
const R = ['1110010', '1100110', '1101100', '1000010', '1011100', '1001110', '1010000', '1000100', '1001000', '1110100'];
const PARITY = ['LLLLLL', 'LLGLGG', 'LLGGLG', 'LLGGGL', 'LGLLGG', 'LGGLLG', 'LGGGLL', 'LGLGLG', 'LGLGGL', 'LGGLGL'];

export function checkDigit(base12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(base12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}
export const ean13 = (base12: string): string => base12.slice(0, 12) + checkDigit(base12);

/** Returns the 95-module bar string, e.g. "101…". */
export function eanBars(code: string): string {
  const d = code.split('').map(Number);
  const par = PARITY[d[0]];
  let out = '101';
  for (let i = 0; i < 6; i++) out += (par[i] === 'L' ? L : G)[d[i + 1]];
  out += '01010';
  for (let i = 0; i < 6; i++) out += R[d[i + 7]];
  return out + '101';
}
