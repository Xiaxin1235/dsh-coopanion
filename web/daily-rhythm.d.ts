export const DEFAULT_DAILY_RHYTHM: false;
export type RhythmWord = 'look' | 'nod' | 'wave' | 'sit';
export interface RhythmState { enabled: boolean; period: 'day' | 'night' | null; lastAt: number | null; dueAt: number | null; lastWord: RhythmWord | null; active: { word: RhythmWord; endsAt: number } | null; blocked: boolean; }
export function initialRhythm(): RhythmState;
export function rhythmPeriod(hour: number): 'day' | 'night' | null;
export function stepRhythm(state: RhythmState, input: { enabled: boolean; now: number; hour: number; occupied?: Record<string, boolean>; words?: readonly string[] }, random?: () => number): { state: RhythmState; word?: RhythmWord; release?: RhythmWord | null };
