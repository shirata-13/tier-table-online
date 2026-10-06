import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../src/scoring.ts';
const board = (rank, items = ['x']) => ({ S: [], A: [], B: [], C: [], D: [], POOL: [], [rank]: items });
test('exact matches earn 100 and adjacent ranks earn 50', () => {
  for (const rank of ['S','A','B','C','D']) assert.equal(calculateScore(board(rank), board(rank), ['x']),100);
  for (const [a,b] of [['S','A'],['A','B'],['B','C'],['C','D']]) {
    assert.equal(calculateScore(board(a),board(b),['x']),50);
    assert.equal(calculateScore(board(b),board(a),['x']),50);
  }
});
test('two or more ranks away earn zero', () => {
  for (const [a,b] of [['S','B'],['S','C'],['S','D'],['A','C'],['A','D'],['B','D']]) {
    assert.equal(calculateScore(board(a),board(b),['x']),0);
    assert.equal(calculateScore(board(b),board(a),['x']),0);
  }
});
test('mixed predictions normalize to 100 and missing items earn nothing', () => {
  const answer=board('S',['x','y','z']);
  const guess={...board('S',['x']),A:['y'],B:['z']};
  assert.equal(calculateScore(answer,guess,['x','y','z']),50);
  assert.equal(calculateScore(board('S'),board('POOL'),['x']),0);
  assert.equal(calculateScore(board('POOL'),board('POOL'),['x']),0);
  assert.equal(calculateScore(answer,guess,[]),0);
});
test('rounding cannot turn an imperfect answer into a perfect award', () => {
  const items=Array.from({length:200},(_,i)=>String(i));
  assert.equal(calculateScore(board('S',items),{...board('S',items.slice(1)),A:[items[0]]},items),99);
});
