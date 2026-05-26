export const BACKGROUND_PRESETS: Record<string, string> = {
  street_night: 'radial-gradient(120% 80% at 50% 35%, #161821 0%, #000 78%)',
  room_warm:    'radial-gradient(120% 80% at 50% 35%, #2a1a14 0%, #000 78%)',
  park_day:     'radial-gradient(120% 80% at 50% 35%, #1d2a1a 0%, #000 78%)',
};

export const CHARACTER_PRESETS: Record<string, { colors: [string, string]; label: string }> = {
  elys: { colors: ['#ffd5e5', '#c98aab'], label: 'E' },
};

export function resolveBackground(ref: { kind: 'preset' | 'url'; value: string }): string {
  if (ref.kind === 'url') return `url(${JSON.stringify(ref.value)}) center/cover no-repeat`;
  return BACKGROUND_PRESETS[ref.value] ?? '#000';
}
