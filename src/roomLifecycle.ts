import type { RoomState } from './types/game';

export const DISCONNECT_GRACE_MS = 30000;

export function disconnectedPlayers(room: RoomState, now: number): string[] {
  return Object.keys(room.players ?? {}).filter(id => {
    const presence = room.presence?.[id];
    return presence?.online === false && Number.isFinite(presence.changedAt) && now - presence.changedAt >= DISCONNECT_GRACE_MS;
  });
}

export function removePlayers(room: RoomState, ids: string[]): RoomState {
  const removed = new Set(ids);
  const players = Object.fromEntries(Object.entries(room.players).filter(([id]) => !removed.has(id)));
  const remaining = Object.keys(players);
  if (remaining.length === Object.keys(room.players).length) return room;
  const oldOrder = room.playerOrder ?? Object.keys(room.players);
  const oldHost = oldOrder[room.currentRoundIndex];
  const order = oldOrder.filter(id => players[id]);
  const presence = Object.fromEntries(Object.entries(room.presence ?? {}).filter(([id]) => players[id]));
  const next: RoomState = { ...room, players, presence, playerOrder: order,
    hostId: players[room.hostId] ? room.hostId : remaining[0] ?? '',
    departureMessage: ids.filter(id => room.players[id]).map(id => room.players[id].name).join('、') + ' さんが退出しました。' };
  if (room.status === 'LOBBY' || room.status === 'FINAL_RESULT') {
    next.currentRoundIndex = Math.max(0, order.indexOf(oldHost));
    return next;
  }
  if (remaining.length < 2) {
    next.status = 'FINAL_RESULT';
    next.currentRoundIndex = 0;
    next.departureMessage += '参加者が2人未満になったため、ゲームを終了しました。';
    return next;
  }
  if (room.status === 'CREATING') {
    next.currentRoundIndex = 0;
    if (remaining.every(id => players[id].hostTier)) next.status = 'GUESSING';
    return next;
  }
  if (players[oldHost]) {
    next.currentRoundIndex = order.indexOf(oldHost);
  } else {
    const nextHost = oldOrder.slice(room.currentRoundIndex + 1).find(id => players[id]);
    next.status = nextHost ? 'GUESSING' : 'FINAL_RESULT';
    next.currentRoundIndex = nextHost ? order.indexOf(nextHost) : Math.max(0, order.length - 1);
  }
  return next;
}
