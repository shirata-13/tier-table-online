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
