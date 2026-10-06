import test from 'node:test';
import assert from 'node:assert/strict';
import { bestPairs, returnToLobby, finalRanking } from '../src/gameResults.ts';
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

test('perfect guesses award 10 points each and change final ranking', () => {
  const scores = { a: { b: 99, c: 20 }, b: { a: 100, c: 20 }, c: { a: 80, b: 90 } };
  const result = finalRanking(players, scores);
  assert.deepEqual(result.map(p => p.id), ['a', 'b', 'c']);
  assert.equal(result[0].baseScore, 180);
  assert.equal(result[0].perfectCount, 1);
  assert.equal(result[0].bonus, 10);
  assert.equal(result[0].total, 190);
  assert.equal(result[1].total, 189);
  assert.deepEqual(finalRanking(players, scores), result);
});
test('multiple perfect guesses count individually; own round scores do not count', () => {
  const [result] = finalRanking([players[0]], { a: { a: 100 }, b: { a: 100 }, c: { a: 100 } });
  assert.equal(result.perfectCount, 2);
  assert.equal(result.bonus, 20);
  assert.equal(result.total, 220);
});
test('equal totals share a rank and missing guesses earn no bonus', () => {
  const result = finalRanking(players, { a: { b: 50 }, b: { a: 50 } });
  assert.deepEqual(result.map(p => p.rank), [1, 1, 3]);
  assert.equal(result[2].total, 0);
  assert.equal(result[2].perfectCount, 0);
});

test('perfect bonus depends on each question choice count: 5/6/7', () => {
  const participants = ['a', 'b', 'c', 'd'].map(id => ({ id, name: id }));
  const scores = { b: { a: 100 }, c: { a: 100 }, d: { a: 100 } };
  const [winner] = finalRanking(participants, scores, { b: 5, c: 6, d: 7 });
  assert.equal(winner.perfectCount, 3);
  assert.equal(winner.bonus, 120);
  assert.equal(winner.total, 420);
});
test('bonus uses host choices rather than guesser choices', () => {
  const participants = [{ id: 'a', name: 'A', items: ['1','2','3','4','5'] }, { id: 'b', name: 'B', items: ['1','2','3','4','5','6','7'] }];
  const [winner] = finalRanking(participants, { b: { a: 100 } });
  assert.equal(winner.bonus, 50);
});
test('departed questioner metadata preserves bonus and non-perfect earns none', () => {
  const [winner] = finalRanking([{ id: 'a', name: 'A' }], { b: { a: 100 }, c: { a: 99 } }, { b: 6, c: 7 });
  assert.equal(winner.bonus, 40);
  assert.equal(winner.perfectCount, 1);
  assert.equal(winner.total, 239);
});
