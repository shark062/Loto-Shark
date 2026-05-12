/**
 * Realistic lottery ball colour palette — matched to official Caixa physical balls.
 * Colour by LAST DIGIT of the number.
 * NO neon, NO fluorescent, NO glow — physical plastic only.
 */

export interface BallColor {
  light: string; // highlight fade-to colour (upper-left transition)
  base:  string; // main body colour (centre)
  dark:  string; // shadow-side colour (lower-right)
  text:  string; // label colour — #1A1A1A for light balls, #FFFFFF for dark
}

export const BALL_PALETTE: Record<number, BallColor> = {
  0: { light: '#F8F8F8', base: '#D4D4D4', dark: '#989898', text: '#1A1A1A' }, // White
  1: { light: '#E84040', base: '#BE0000', dark: '#780000', text: '#FFFFFF' }, // Red
  2: { light: '#FFE030', base: '#E8B800', dark: '#A07400', text: '#1A1A1A' }, // Yellow
  3: { light: '#2CC02C', base: '#147014', dark: '#074007', text: '#FFFFFF' }, // Green
  4: { light: '#A86030', base: '#6E3010', dark: '#3E1606', text: '#FFFFFF' }, // Brown
  5: { light: '#3A88E8', base: '#0F52C0', dark: '#082E80', text: '#FFFFFF' }, // Blue
  6: { light: '#F040A8', base: '#C00878', dark: '#840050', text: '#FFFFFF' }, // Pink
  7: { light: '#484848', base: '#181818', dark: '#060606', text: '#FFFFFF' }, // Black
  8: { light: '#BBBBBB', base: '#787878', dark: '#424242', text: '#FFFFFF' }, // Gray
  9: { light: '#FF9020', base: '#D85800', dark: '#963000', text: '#FFFFFF' }, // Orange
} as const;

export function getBallColors(number: number): BallColor {
  return BALL_PALETTE[number % 10];
}
