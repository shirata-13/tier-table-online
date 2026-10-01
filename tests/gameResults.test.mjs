import test from 'node:test';
import assert from 'node:assert/strict';
import { bestPairs, returnToLobby } from '../src/gameResults.ts';
const players = ['a', 'b', 'c'].map(id => ({ id, name: id }));

test('replay retains the room and all participants, clearing game data each time', () => {
  const room = { code: '1234', hostId: 'a', status: 'FINAL_RESULT', currentRoundIndex: 1, playerOrder: ['a', 'b'], players: Object.fromEntries(players.map(p => [p.id, { ...p, topic: 'old', items: ['x'], hostTier: { S: ['x'] } }])), guesses: { a: {} }, scores: { a: { b: 100 } } };
  const lobby = returnToLobby(room);
  assert.equal(lobby.code, room.code);
  assert.equal(lobby.hostId, room.hostId);
  assert.equal(lobby.status, 'LOBBY');
  assert.equal(lobby.currentRoundIndex, 0);
  assert.deepEqual(Object.values(lobby.players), players);
  assert.equal(lobby.playerOrder, undefined);
  assert.deepEqual(lobby.guesses, {});
  assert.deepEqual(lobby.scores, {});
  assert.deepEqual(returnToLobby({ ...room, ...lobby, status: 'FINAL_RESULT' }), lobby);
  assert.equal(room.players.a.topic, 'old');
});
test('best pair uses both directions, rather than a single high score', () => {
  const winners = bestPairs(players, { a: { b: 100, c: 80 }, b: { a: 0, c: 50 }, c: { a: 80, b: 50 } });
  assert.equal(winners.length, 1);
  assert.equal(winners[0].first.id, 'a');
  assert.equal(winners[0].second.id, 'c');
  assert.equal(winners[0].average, 80);
});
test('all tied winners are returned, missing reciprocal scores are excluded', () => {
  assert.equal(bestPairs(players, { a: { b: 90, c: 90 }, b: { a: 90 }, c: { a: 90 } }).length, 2);
  assert.deepEqual(bestPairs(players, { a: { b: 100 } }), []);
  assert.deepEqual(bestPairs([], {}), []);
});
test('zero scores are valid and directions are preserved', () => {
  const [pair] = bestPairs(players.slice(0, 2), { a: { b: 0 }, b: { a: 20 } });
  assert.equal(pair.firstScore, 20);
  assert.equal(pair.secondScore, 0);
  assert.equal(pair.average, 10);
});
