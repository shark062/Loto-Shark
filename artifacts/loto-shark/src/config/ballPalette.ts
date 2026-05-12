export interface BallColor {
  base:  string;
  light: string;
  mid:   string;
  dark:  string;
  edge:  string;
  text:  string;
}

export const BALL_PALETTE: Record<number, BallColor> = {
  0: { base: '#CECECE', light: '#F6F6F6', mid: '#C0C0C0', dark: '#888888', edge: '#707070', text: '#1A1A1A' },
  1: { base: '#C80000', light: '#FF3030', mid: '#B00000', dark: '#7A0000', edge: '#600000', text: '#FFFFFF' },
  2: { base: '#F5CC00', light: '#FFE840', mid: '#DDB800', dark: '#A88400', edge: '#8A6C00', text: '#1A1A1A' },
  3: { base: '#157A15', light: '#1EB81E', mid: '#0F6A0F', dark: '#084808', edge: '#053505', text: '#FFFFFF' },
  4: { base: '#7A3210', light: '#B0581C', mid: '#6A2808', dark: '#421606', edge: '#300E04', text: '#FFFFFF' },
  5: { base: '#1A6ED4', light: '#3A96FF', mid: '#1560BB', dark: '#0A408A', edge: '#082E66', text: '#FFFFFF' },
  6: { base: '#D83890', light: '#FF66C0', mid: '#C02878', dark: '#8A1058', edge: '#680840', text: '#FFFFFF' },
  7: { base: '#1C1C1C', light: '#545454', mid: '#161616', dark: '#080808', edge: '#000000', text: '#FFFFFF' },
  8: { base: '#868686', light: '#C4C4C4', mid: '#747474', dark: '#4A4A4A', edge: '#363636', text: '#FFFFFF' },
  9: { base: '#F07000', light: '#FFA030', mid: '#D85C00', dark: '#AA3A00', edge: '#882C00', text: '#FFFFFF' },
} as const;

export function getBallColors(number: number): BallColor {
  return BALL_PALETTE[number % 10];
}
