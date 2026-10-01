import test from 'node:test';
import assert from 'node:assert/strict';
import { disconnectedPlayers, removePlayers, DISCONNECT_GRACE_MS } from '../src/roomLifecycle.ts';
import { returnToLobby } from '../src/gameResults.ts';
const tier = { S: ['x'], A: [], B: [], C: [], D: [], POOL: [] };
function makeRoom(status = 'CREATING') {
  return { code: '1234', hostId: 'a', status, currentRoundIndex: 0, playerOrder: ['a', 'b', 'c'],
    players: { a: { id: 'a', name: 'A', hostTier: tier }, b: { id: 'b', name: 'B', hostTier: tier }, c: { id: 'c', name: 'C' } },
    guesses: {}, scores: {}, presence: { a: { online: true, changedAt: 1000 }, b: { online: true, changedAt: 1000 }, c: { online: false, changedAt: 1000 } } };
}
test('disconnect waits 30 seconds and reconnection cancels eligibility', () => {
  const room = makeRoom();
  assert.deepEqual(disconnectedPlayers(room, 1000 + DISCONNECT_GRACE_MS - 1), []);
  assert.deepEqual(disconnectedPlayers(room, 1000 + DISCONNECT_GRACE_MS), ['c']);
  room.presence.c.online = true;
  assert.deepEqual(disconnectedPlayers(room, 100000), []);
  delete room.presence.c;
  assert.deepEqual(disconnectedPlayers(room, 100000), []);
});
test('removing an unfinished creator advances completed survivors to guessing', () => {
  const room = makeRoom();
  const next = removePlayers(room, ['c']);
  assert.equal(next.status, 'GUESSING');
  assert.deepEqual(next.playerOrder, ['a', 'b']);
  assert.equal(next.players.c, undefined);
  assert.equal(next.presence.c, undefined);
  assert.ok(room.players.c);
});
test('remaining incomplete creators must still submit', () => {
  const room = makeRoom(); delete room.players.b.hostTier;
  assert.equal(removePlayers(room, ['c']).status, 'CREATING');
});
test('departing guesser no longer blocks answer reveal', () => {
  const room = makeRoom('GUESSING'); room.guesses = { a: { b: tier } };
  const next = removePlayers(room, ['c']);
  assert.equal(next.status, 'GUESSING');
  assert.equal(next.currentRoundIndex, 0);
  assert.ok(Object.keys(next.players).every(id => id === 'a' || next.guesses.a[id]));
});
test('departing current questioner skips to next question and transfers host', () => {
  const next = removePlayers(makeRoom('GUESSING'), ['a']);
  assert.equal(next.hostId, 'b');
  assert.equal(next.status, 'GUESSING');
  assert.equal(next.playerOrder[next.currentRoundIndex], 'b');
});
test('removing an earlier questioner preserves the current question', () => {
  const room = makeRoom('ROUND_RESULT'); room.currentRoundIndex = 1;
  const next = removePlayers(room, ['a']);
  assert.equal(next.status, 'ROUND_RESULT');
  assert.equal(next.playerOrder[next.currentRoundIndex], 'b');
});
test('departing final questioner ends the game instead of replaying prior rounds', () => {
  const room = makeRoom('GUESSING'); room.currentRoundIndex = 2;
  const next = removePlayers(room, ['c']);
  assert.equal(next.status, 'FINAL_RESULT');
  assert.ok(next.players[next.playerOrder[next.currentRoundIndex]]);
});
test('fewer than two survivors ends an active game', () => {
  for (const status of ['CREATING', 'GUESSING', 'ROUND_RESULT']) {
    const next = removePlayers(makeRoom(status), ['a', 'c']);
    assert.equal(next.status, 'FINAL_RESULT');
    assert.equal(next.hostId, 'b');
    assert.deepEqual(next.playerOrder, ['b']);
  }
});
test('lobby stays joinable and host transfers', () => {
  const next = removePlayers(makeRoom('LOBBY'), ['a', 'c']);
  assert.equal(next.status, 'LOBBY');
  assert.equal(next.hostId, 'b');
});
test('stale duplicate removals are a no-op', () => {
  const room = removePlayers(makeRoom(), ['c']);
  assert.equal(removePlayers(room, ['c']), room);
});
test('replay preserves connection tracking and clears departure message', () => {
  const room = removePlayers(makeRoom('FINAL_RESULT'), ['c']);
  const lobby = returnToLobby(room);
  assert.deepEqual(lobby.presence, room.presence);
  assert.equal(lobby.departureMessage, undefined);
  assert.equal(lobby.players.c, undefined);
});
