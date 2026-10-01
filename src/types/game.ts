export type TierRank = 'S' | 'A' | 'B' | 'C' | 'D' | 'POOL';

export type TierMap = Record<TierRank, string[]>;

export interface Player {
  id: string;
  name: string;
  topic?: string;
  items?: string[];
  hostTier?: TierMap;
}

export interface RoomState {
  code: string;
  hostId: string;
  playerOrder?: string[];
  status: 'LOBBY' | 'CREATING' | 'GUESSING' | 'ROUND_RESULT' | 'FINAL_RESULT';
  currentRoundIndex: number;
  players: Record<string, Player>;
  guesses: Record<string, Record<string, TierMap>>; // [hostId][guesserId] -> TierMap
  scores: Record<string, Record<string, number>>;   // [hostId][guesserId] -> score
}