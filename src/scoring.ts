import type { TierMap } from './types/game';

const RANKS = ['S', 'A', 'B', 'C', 'D'] as const;

export function calculateScore(answer: TierMap, guess: TierMap, items: string[]): number {
  if (!items.length) return 0;
  let points = 0;
  for (const item of items) {
    const answerIndex = RANKS.findIndex(rank => answer[rank]?.includes(item));
    const guessIndex = RANKS.findIndex(rank => guess[rank]?.includes(item));
    if (answerIndex < 0 || guessIndex < 0) continue;
    const distance = Math.abs(answerIndex - guessIndex);
    if (distance === 0) points += 2;
    else if (distance === 1) points += 1;
  }
  const maximum = items.length * 2;
  // Reserve 100 points for entirely exact guesses, even with large topics.
  return points === maximum ? 100 : Math.min(99, Math.round(points / maximum * 100));
}
