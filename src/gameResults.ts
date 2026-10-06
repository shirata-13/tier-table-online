import type { Player, RoomState } from './types/game';

export function returnToLobby(room: RoomState): RoomState {
  const players = Object.fromEntries(Object.values(room.players).map(player => [player.id, { id: player.id, name: player.name }]));
  return { ...(room.presence ? { presence: room.presence } : {}), code: room.code, hostId: room.hostId, status: 'LOBBY', currentRoundIndex: 0, players, guesses: {}, scores: {} };
}

export function bestPairs(players: Player[], scores: RoomState['scores']) {
  const pairs: { first: Player; second: Player; firstScore: number; secondScore: number; average: number }[] = [];
  players.forEach((first, index) => {
    players.slice(index + 1).forEach(second => {
      const firstScore = scores[second.id]?.[first.id];
      const secondScore = scores[first.id]?.[second.id];
      if (typeof firstScore !== 'number' || typeof secondScore !== 'number') return;
      pairs.push({ first, second, firstScore, secondScore, average: (firstScore + secondScore) / 2 });
    });
  });
  const maximum = Math.max(...pairs.map(pair => pair.average));
  return pairs.filter(pair => pair.average === maximum);
}

export function finalRanking(players: Player[], scores: RoomState['scores'], itemCounts: Record<string, number> = {}) {
  const results = players.map(player => {
    const guesses = Object.entries(scores).filter(([hostId, round]) => hostId !== player.id && typeof round[player.id] === 'number');
    const baseScore = guesses.reduce((sum, [, round]) => sum + round[player.id], 0);
    const perfectGuesses = guesses.filter(([, round]) => round[player.id] === 100);
    const perfectCount = perfectGuesses.length;
    const bonus = perfectGuesses.reduce((sum, [hostId]) => {
      const count = itemCounts[hostId] ?? players.find(host => host.id === hostId)?.items?.length;
      const award = count === 5 ? 30 : count === 6 ? 40 : count === 7 ? 50 : 10;
      return sum + award;
    }, 0);
    return { ...player, baseScore, perfectCount, bonus, total: baseScore + bonus };
  }).sort((a, b) => b.total - a.total);
  return results.map(player => ({ ...player,
    rank: results.findIndex(other => other.total === player.total) + 1 }));
}
