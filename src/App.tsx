import { useState, useEffect } from 'react';
import { ref, onValue, update, runTransaction, set, onDisconnect, serverTimestamp, type DataSnapshot } from 'firebase/database';
import { db, waitForFirebaseConnection } from './firebase/config';
import type { RoomState, Player, TierMap, TierRank } from './types/game';
import TierBoard from './components/TierBoard';
import { bestPairs, returnToLobby } from './gameResults';
import { disconnectedPlayers, removePlayers } from './roomLifecycle';

// ランダム配布用のお題プール
const DEFAULT_TOPICS = [
  { title: "おすすめのお菓子", items: ["ポテトチップス", "じゃがりこ", "きのこの山", "たけのこの里", "アルフォート", "ブラックサンダー"] },
  { title: "プレイした神ゲーム", items: ["ゼルダの伝説", "マリオカート", "スマブラ", "モンスターハンター", "ドラゴンクエスト", "ファイナルファンタジー"] },
  { title: "休日の過ごし方", items: ["二度寝・昼寝", "YouTube・動画鑑賞", "ゲーム没頭", "ショッピング", "外食・カフェ", "部屋の掃除"] },
  { title: "好きなお寿司のネタ", items: ["サーモン", "マグロ（赤身）", "中トロ", "いくら", "ねぎとろ", "えび"] },
  { title: "ラーメンのジャンル", items: ["家系豚骨しょうゆ", "濃厚とんこつ", "あっさり醤油", "コク旨味噌", "塩ラーメン", "つけ麺"] },
  { title: "欲しい特殊能力", items: ["瞬間移動", "時間停止", "読心術", "空を飛ぶ", "透明化", "予知能力"] },
  { title: "朝ごはんに食べたいもの", items: ["焼き鮭", "目玉焼き", "納豆ごはん", "トースト", "パンケーキ", "お茶漬け"] },
  { title: "コンビニでつい買うもの", items: ["肉まん", "からあげ", "新作のお菓子", "カフェラテ", "おにぎり", "アイス"] },
  { title: "気分転換の方法", items: ["散歩", "昼寝", "音楽を聴く", "甘いものを食べる", "運動する", "友達と話す"] },
  { title: "好きな給食メニュー", items: ["カレーライス", "揚げパン", "ソフト麺", "わかめごはん", "冷凍みかん", "鶏のから揚げ"] },
  { title: "ペットにしたい動物", items: ["犬", "猫", "うさぎ", "ハムスター", "インコ", "カメ"] },
  { title: "旅行で行きたい場所", items: ["沖縄", "北海道", "京都", "東京", "海外のビーチ", "温泉地"] },
  { title: "好きな映画のジャンル", items: ["アクション", "コメディ", "恋愛", "ミステリー", "SF", "アニメ"] },
  { title: "無人島に持っていきたいもの", items: ["ナイフ", "ライター", "テント", "釣り竿", "浄水器", "寝袋"] },
  { title: "休日に見たい動画", items: ["ゲーム実況", "料理動画", "旅行Vlog", "動物動画", "音楽ライブ", "コメディ動画"] },
  { title: "住むならどんな場所", items: ["都会の中心", "海の近く", "山の中", "駅の近く", "自然豊かな田舎", "海外の街"] },
];

export function App() {
  const [myPlayerId] = useState<string>(() => 'p_' + crypto.randomUUID());
  const [myName, setMyName] = useState<string>('');
  const [inputRoomCode, setInputRoomCode] = useState<string>('');
  const [roomCode, setRoomCode] = useState<string>('');
  const [room, setRoom] = useState<RoomState | null>(null);

  // 一時入力用（Tier作成・予想入力用）
  const [currentBoardState, setCurrentBoardState] = useState<TierMap | null>(null);

  // Firebase Realtime Database 監視
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [serverOffset, setServerOffset] = useState(0);
  const perform = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      await waitForFirebaseConnection();
      await action();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '通信に失敗しました。';
      setError(/permission.?denied/i.test(message)
        ? 'Firebaseの読み書きが拒否されました。Realtime Databaseのルールと認証設定を確認してください。'
        : message);
    }
    finally { setBusy(false); }
  };
  useEffect(() => {
    if (!roomCode) return;

    const roomRef = ref(db, `rooms/${roomCode}`);
    const unsubscribe = onValue(roomRef, (snapshot) => {
      const data = snapshot.val();
      if (data && !data.players?.[myPlayerId]) {
        setRoom(null); setRoomCode(''); setCurrentBoardState(null); setError('部屋から退出しました。次のゲームの待機室で再参加できます。');
      } else if (data) {
        setRoom({ ...data, guesses: data.guesses ?? {}, scores: data.scores ?? {} });
      } else { setRoom(null); setRoomCode(''); setError('部屋が見つかりません。'); }
    }, cause => { setError(cause.message); setRoomCode(''); setRoom(null); });
    return () => unsubscribe();
  }, [roomCode, myPlayerId]);

  useEffect(() => {
    if (!roomCode) return;
    let active = true;
    const presenceRef = ref(db, `rooms/${roomCode}/presence/${myPlayerId}`);
    const stopOffset = onValue(ref(db, '.info/serverTimeOffset'), snapshot => setServerOffset(snapshot.val() ?? 0));
    const stopConnection = onValue(ref(db, '.info/connected'), snapshot => {
      const online = snapshot.val() === true;
      setConnected(online);
      if (!online) return;
      // Register the server-side disconnect action before marking this client online.
      void (async () => {
        await onDisconnect(presenceRef).set({ online: false, changedAt: serverTimestamp() });
        if (active) await set(presenceRef, { online: true, changedAt: serverTimestamp() });
      })().catch(cause => { if (active) setError('接続状態の登録に失敗しました：' + (cause instanceof Error ? cause.message : String(cause))); });
    });
    return () => { active = false; stopConnection(); stopOffset(); };
  }, [roomCode, myPlayerId]);

  useEffect(() => {
    if (!roomCode || !room?.players[myPlayerId] || !connected || room.presence?.[myPlayerId]?.online !== true) return;
    let running = false;
    const checkDepartures = async () => {
      if (running || !disconnectedPlayers(room, Date.now() + serverOffset).length) return;
      running = true;
      try {
        await runTransaction(ref(db, `rooms/${roomCode}`), (value: RoomState | null) => {
          if (!value?.players[myPlayerId] || value.presence?.[myPlayerId]?.online !== true) return;
          const ids = disconnectedPlayers(value, Date.now() + serverOffset);
          if (!ids.length) return;
          return removePlayers(value, ids);
        }, { applyLocally: false });
      } catch (cause) {
        setError('退出処理に失敗しました：' + (cause instanceof Error ? cause.message : String(cause)));
      } finally { running = false; }
    };
    void checkDepartures();
    const timer = setInterval(() => void checkDepartures(), 2000);
    return () => clearInterval(timer);
  }, [roomCode, room, myPlayerId, connected, serverOffset]);

  const removeParticipant = async (id: string) => {
    const result = await runTransaction(ref(db, `rooms/${roomCode}`), (value: RoomState | null) => {
      if (!value?.players[id] || value.hostId !== myPlayerId || id === myPlayerId) return;
      return removePlayers(value, [id]);
    }, { applyLocally: false });
    if (!result.committed) throw new Error('参加者の状態が変わりました。');
  };

  // 1. 部屋作成 (ホスト)
  const createRoom = async () => {
    if (!myName.trim()) { alert('名前を入力してください！'); return; }

    const newCode = Math.floor(1000 + Math.random() * 9000).toString();
    const newPlayer: Player = { id: myPlayerId, name: myName.trim() };

    const initialRoomState: RoomState = {
      code: newCode,
      hostId: myPlayerId,
      status: 'LOBBY',
      currentRoundIndex: 0,
      players: { [myPlayerId]: newPlayer },
      guesses: {},
      scores: {},
    };

    const result = await runTransaction(ref(db, `rooms/${newCode}`), value => value === null ? initialRoomState : undefined, { applyLocally: false });
    if (!result.committed) throw new Error('部屋の状態または入力を確認してください。');
    setRoomCode(newCode);
  };

  // 2. 部屋参加 (ゲスト)
  const joinRoom = async () => {
    if (!myName.trim()) { alert('名前を入力してください！'); return; }
    if (!inputRoomCode.trim()) { alert('部屋コードを入力してください！'); return; }

    const newPlayer: Player = { id: myPlayerId, name: myName.trim() };
    const code = inputRoomCode.trim();
    if (!/^\d{4}$/.test(code)) throw new Error('部屋コードは4桁の数字で入力してください。');
    const roomRef = ref(db, `rooms/${code}`);
    // Keep the room subscribed until the transaction completes. get() alone
    // can release its cache before the transaction reads its initial value.
    let stopWatching: () => void = () => {};
    try {
      const existing = await new Promise<DataSnapshot>((resolve, reject) => {
        stopWatching = onValue(roomRef, resolve, reject);
      });
      if (!existing.exists()) throw new Error('部屋が見つかりません。コードを確認してください。');
      if (!['LOBBY', 'FINAL_RESULT'].includes(existing.val().status)) throw new Error('この部屋はすでにゲームが始まっています。');
      const result = await runTransaction(roomRef, (value: RoomState | null) => {
        if (!value?.players || !['LOBBY', 'FINAL_RESULT'].includes(value.status)) return;
        return { ...value, players: { ...value.players, [myPlayerId]: newPlayer } };
      }, { applyLocally: false });
      if (!result.committed) {
        const latest: RoomState | null = result.snapshot.val();
        throw new Error(latest?.status && !['LOBBY', 'FINAL_RESULT'].includes(latest.status)
          ? '入室中にゲームが開始されました。'
          : '部屋が削除されたか、参加者情報が無効です。');
      }
    } finally {
      stopWatching();
    }
    setRoomCode(code);
  };

  // 3. ホストがゲームを開始（ランダムお題を配布）
  const startGame = async () => {
    if (!room) return;
    if (room.hostId !== myPlayerId || room.status !== 'LOBBY') return;
    const topics = [...DEFAULT_TOPICS];
    for (let i = topics.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [topics[i], topics[j]] = [topics[j], topics[i]];
    }
    const result = await runTransaction(ref(db, `rooms/${roomCode}`), (value: RoomState | null) => {
      if (!value?.players || value.status !== 'LOBBY' || value.hostId !== myPlayerId) return;
      const ids = Object.keys(value.players);
      if (ids.length < 2) return;
      const players = { ...value.players };
      ids.forEach((id, index) => {
        const topic = topics[index % topics.length];
        players[id] = { ...players[id], topic: topic.title, items: topic.items };
      });
      return { ...value, players, playerOrder: ids, status: 'CREATING' };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('待機中の部屋に2人以上参加している必要があります。');
  };

  const isComplete = (items: string[]) => {
    if (!currentBoardState || !items.length || (currentBoardState.POOL ?? []).length) return false;
    const placed = (['S', 'A', 'B', 'C', 'D'] as TierRank[]).flatMap(rank => currentBoardState[rank] ?? []);
    return placed.length === items.length && new Set(placed).size === items.length && items.every(item => placed.includes(item));
  };

  // 4. 自分の本気Tier（正解）を確定
  const submitHostTier = async () => {
    if (!currentBoardState || !room) return;
    if (!isComplete(room.players[myPlayerId]?.items ?? [])) {
      alert('すべての要素をTier (S〜D) に配置してください！');
      return;
    }

    await runTransaction(ref(db, `rooms/${roomCode}`), (value: RoomState | null) => {
      if (!value?.players[myPlayerId] || value.status !== 'CREATING' || value.players[myPlayerId].hostTier) return;
      const players = { ...value.players, [myPlayerId]: { ...value.players[myPlayerId], hostTier: currentBoardState } };
      return { ...value, players, status: Object.values(players).every(p => p.hostTier) ? 'GUESSING' : 'CREATING', currentRoundIndex: 0 };
    }, { applyLocally: false });
  };

  // 5. 自分の予想Tierを確定
  const submitGuessTier = async () => {
    if (!currentBoardState || !room) return;
    if ((currentBoardState.POOL ?? []).length > 0) {
      alert('すべての要素を予想Tierに配置してください！');
      return;
    }

    const playersList = (room.playerOrder ?? Object.keys(room.players)).map(id => room.players[id]);
    const currentHost = playersList[room.currentRoundIndex];

    if (room.status !== 'GUESSING' || !currentHost?.hostTier || !currentHost.items || currentHost.id === myPlayerId) return;
    // スコア計算
    const score = calculateScore(currentHost.hostTier!, currentBoardState, currentHost.items!);

    const updates: Record<string, unknown> = {};
    updates[`rooms/${roomCode}/guesses/${currentHost.id}/${myPlayerId}`] = currentBoardState;
    updates[`rooms/${roomCode}/scores/${currentHost.id}/${myPlayerId}`] = score;

    await update(ref(db), updates);
  };

  // 6. 親が結果をオープンする（ターン結果表示）
  const openRoundResult = async () => {
    const result = await runTransaction(ref(db, `rooms/${roomCode}`), (value: RoomState | null) => {
      const hostId = value?.playerOrder?.[value.currentRoundIndex];
      if (!value || !hostId || hostId !== myPlayerId || value.status !== 'GUESSING' || !Object.keys(value.players).every(id => id === hostId || value.guesses?.[hostId]?.[id])) return;
      return { ...value, status: 'ROUND_RESULT' };
    }, { applyLocally: false });
    if (!result.committed) throw new Error('部屋の状態または入力を確認してください。');
  };

  // 7. 次のラウンド（親の交代）へ進む
  const nextRound = async () => {
    if (!room) return;
    await runTransaction(ref(db, `rooms/${roomCode}`), (value: RoomState | null) => {
      if (!value || value.hostId !== myPlayerId || value.status !== 'ROUND_RESULT' || value.currentRoundIndex !== room.currentRoundIndex) return;
      const next = value.currentRoundIndex + 1;
      const finished = next >= (value.playerOrder ?? Object.keys(value.players)).length;
      return { ...value, status: finished ? 'FINAL_RESULT' : 'GUESSING', currentRoundIndex: finished ? value.currentRoundIndex : next };
    }, { applyLocally: false });
  };

  const playAgain = async () => {
    const result = await runTransaction(ref(db, `rooms/${roomCode}`), (value: RoomState | null) => {
      if (!value || value.hostId !== myPlayerId || value.status !== 'FINAL_RESULT') return;
      return returnToLobby(value);
    }, { applyLocally: false });
    if (!result.committed) throw new Error('ホストが最終結果画面から再開してください。');
    setCurrentBoardState(null);
  };

  // 得点計算アルゴリズム（距離ベース + ピタリ100点満点）
  const calculateScore = (answerTier: TierMap, guessTier: TierMap, items: string[]) => {
    if (!items.length) return 0;
    const tierValues: Record<TierRank, number> = { S: 4, A: 3, B: 2, C: 1, D: 0, POOL: 0 };
    let totalDiff = 0;
    const maxDiff = items.length * 4;

    items.forEach(item => {
      const ansRank = (Object.keys(answerTier) as TierRank[]).find(k => k !== 'POOL' && answerTier[k]?.includes(item)) || 'C';
      const guessRank = (Object.keys(guessTier) as TierRank[]).find(k => k !== 'POOL' && guessTier[k]?.includes(item)) || 'C';
      totalDiff += Math.abs(tierValues[ansRank] - tierValues[guessRank]);
    });

    return Math.round(((maxDiff - totalDiff) / maxDiff) * 100);
  };

  if (!room) {
    return (
      <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', color: '#fff' }}>
        {error && <p role="alert" className="error">{error}</p>}
      <h1 style={{ color: '#38bdf8', textAlign: 'center' }}>みんなでTier表</h1>
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', marginTop: '24px' }}>
          <h2>オンライン入室</h2>
          <label style={{ fontSize: '0.9rem', color: '#94a3b8' }}>あなたの名前</label>
          <input
            type="text"
            placeholder="例: たろう"
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            style={{ width: '100%', padding: '10px', margin: '8px 0 16px 0', borderRadius: '6px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
          />
          <div style={{ display: 'flex', gap: '12px' }}>
            <button disabled={busy} onClick={() => void perform(createRoom)} style={{ flex: 1, padding: '12px', backgroundColor: '#38bdf8', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
              {busy ? '接続・処理中…' : '部屋を作成 (ホスト)'}
            </button>
            <div style={{ flex: 1, display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="部屋コード"
                value={inputRoomCode}
                onChange={(e) => setInputRoomCode(e.target.value)}
                style={{ flex: 1, padding: '10px', borderRadius: '6px', background: '#0f172a', color: '#fff', border: '1px solid #334155' }}
              />
              <button disabled={busy} onClick={() => void perform(joinRoom)} style={{ padding: '12px', backgroundColor: '#475569', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                参加
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const playersList = (room.playerOrder ?? Object.keys(room.players || {})).map(id => room.players[id]).filter(Boolean);
  const myData = room.players[myPlayerId];
  const isHost = room.hostId === myPlayerId;
  const winningPairs = bestPairs(playersList, room.scores);
  const currentHost = playersList[room.currentRoundIndex];
  if (!currentHost || !myData) return <p role="alert">参加者情報が不正です。再読み込みしてください。</p>;

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', color: '#fff' }}>
      {error && <p role="alert" className="error">{error}</p>}
      <h1 style={{ color: '#38bdf8', textAlign: 'center' }}>みんなでTier表</h1>

      <section aria-label="参加者の接続状況" style={{ background: '#1e293b', padding: '16px', borderRadius: '8px' }}>
        <h3>参加者</h3>
        <p>接続が切れてから30秒後に退出扱いになります。ホストは退出した参加者を手動で外すこともできます。</p>
        {Object.values(room.players).map(player => <div key={player.id} style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
          <span>{player.name}{player.id === room.hostId ? '（ホスト）' : ''}：{room.presence?.[player.id]?.online === false ? '再接続待ち' : room.presence?.[player.id]?.online ? '接続中' : '接続状況不明'}</span>
          {isHost && player.id !== myPlayerId && <button disabled={busy} onClick={() => {
            if (window.confirm(player.name + ' さんを部屋から外しますか？')) void perform(() => removeParticipant(player.id));
          }}>退出した参加者を外す</button>}
        </div>)}
      </section>

      {/* --- Phase 0: ロビー待機室 --- */}
      {room.status === 'LOBBY' && (
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', marginTop: '16px' }}>
          <h2>待機室 (部屋コード: <span style={{ color: '#38bdf8' }}>{room.code}</span>)</h2>
          <h3 style={{ marginTop: '16px' }}>参加者一覧 ({playersList.length}人):</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: '12px 0' }}>
            {playersList.map((p) => (
              <li key={p.id} style={{ padding: '10px', background: '#0f172a', borderRadius: '6px', marginBottom: '8px', border: '1px solid #334155' }}>
                {p.name} {p.id === myPlayerId ? '(あなた)' : ''} {p.id === room.hostId ? '👑 ホスト' : ''}
              </li>
            ))}
          </ul>
          {isHost ? (
            <button disabled={busy} onClick={() => void perform(startGame)} style={{ width: '100%', padding: '14px', backgroundColor: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '1.1rem', cursor: 'pointer' }}>
              ゲームを開始する (お題を自動配布)
            </button>
          ) : (
            <p style={{ color: '#94a3b8', textAlign: 'center' }}>ホストがゲームを開始するのを待っています...</p>
          )}
        </div>
      )}

      {/* --- Phase 1: 全員一斉Tier作成 --- */}
      {room.status === 'CREATING' && (
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', marginTop: '16px' }}>
          <h2>自分の本気Tierを作成</h2>
          <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', margin: '12px 0', border: '1px solid #334155' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>あなたのお題:</div>
            <h3 style={{ color: '#38bdf8' }}>{myData?.topic}</h3>
          </div>

          {myData?.hostTier ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#22c55e', fontWeight: 'bold' }}>
              ✓ あなたのTier表は送信済みです。他のプレイヤーの入力完了を待っています...
            </div>
          ) : (
            <>
              <TierBoard
                key={`creating-${myPlayerId}`}
                initialState={{ S: [], A: [], B: [], C: [], D: [], POOL: [...(myData?.items || [])] }}
                onStateChange={setCurrentBoardState}
              />
              <button disabled={busy} onClick={() => void perform(submitHostTier)} style={{ width: '100%', padding: '12px', backgroundColor: '#22c55e', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '16px', cursor: 'pointer' }}>
                この正解Tier表を確定する
              </button>
            </>
          )}
        </div>
      )}

      {/* --- Phase 2: 予想入力フェーズ --- */}
      {room.status === 'GUESSING' && (
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', marginTop: '16px' }}>
          <h2>{currentHost.name} さんの感性を予想！</h2>
          <div style={{ background: '#0f172a', padding: '12px', borderRadius: '8px', margin: '12px 0', border: '1px solid #334155' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>テーマ:</div>
            <h3 style={{ color: '#38bdf8' }}>{currentHost.topic}</h3>
          </div>

          {currentHost.id === myPlayerId ? (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <p style={{ color: '#38bdf8', fontWeight: 'bold', fontSize: '1.2rem' }}>あなたは「親（出題者）」です！</p>
              <p style={{ color: '#94a3b8', marginTop: '8px' }}>みんながあなたのTier表を予想しています...</p>
              <section aria-label="自分のTier表" style={{ textAlign: 'left', marginTop: '20px', padding: '16px', background: '#0f172a', borderRadius: '8px' }}>
                <h3>あなたが作ったTier表</h3>
                {(['S', 'A', 'B', 'C', 'D'] as TierRank[]).map(rank => <p key={rank} style={{ margin: '8px 0' }}><strong>{rank}:</strong> {(myData.hostTier?.[rank] ?? []).join('、') || 'なし'}</p>)}
              </section>
              {(
                <button disabled={busy} onClick={() => void perform(openRoundResult)} style={{ marginTop: '24px', padding: '12px 24px', backgroundColor: '#eab308', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                  全員の入力完了後に正解オープン！
                </button>
              )}
            </div>
          ) : room.guesses[currentHost.id]?.[myPlayerId] ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: '#22c55e', fontWeight: 'bold' }}>
              ✓ 予想を確定しました。全員の完了を待っています...
            </div>
          ) : (
            <>
              <TierBoard
                key={`guessing-${currentHost.id}`}
                initialState={{ S: [], A: [], B: [], C: [], D: [], POOL: [...(currentHost.items || [])] }}
                onStateChange={setCurrentBoardState}
              />
              <button disabled={busy} onClick={() => void perform(submitGuessTier)} style={{ width: '100%', padding: '12px', backgroundColor: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '16px', cursor: 'pointer' }}>
                予想を確定する
              </button>
            </>
          )}
        </div>
      )}

      {/* --- Phase 3: ターン結果（正解 vs 予想の対比） --- */}
      {room.status === 'ROUND_RESULT' && (
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', marginTop: '16px' }}>
          <h2>【正解発表】{currentHost.name} さんのTier表</h2>
          {(['S', 'A', 'B', 'C', 'D'] as TierRank[]).map(rank => <p key={rank}>{rank}: {(currentHost.hostTier?.[rank] ?? []).join('、') || 'なし'}</p>)}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginTop: '20px' }}>
            {playersList.filter(p => p.id !== currentHost.id).map(guesser => {
              const guessTier = room.guesses[currentHost.id]?.[guesser.id];
              const score = room.scores[currentHost.id]?.[guesser.id] || 0;
              const isPitari = score === 100;

              return (
                <div key={guesser.id} style={{ background: '#0f172a', padding: '16px', borderRadius: '8px', border: isPitari ? '2px solid #eab308' : '1px solid #334155' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <strong>{guesser.name} の予想</strong>
                    <span style={{ color: isPitari ? '#eab308' : '#38bdf8', fontWeight: 'bold' }}>
                      {score}点 {isPitari ? '🎯 ピタリ賞!' : ''}
                    </span>
                  </div>
                  {(['S', 'A', 'B', 'C', 'D'] as TierRank[]).map(rank => (
                    <div key={rank} style={{ display: 'flex', gap: '6px', margin: '4px 0', alignItems: 'center' }}>
                      <span style={{ width: '24px', fontWeight: 'bold', color: '#94a3b8' }}>{rank}:</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {(guessTier?.[rank] || []).map(item => {
                          const isCorrect = currentHost.hostTier?.[rank]?.includes(item);
                          return (
                            <span key={item} style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              background: isCorrect ? '#14532d' : '#334155',
                              border: isCorrect ? '1px solid #22c55e' : '1px solid #475569',
                              color: '#fff'
                            }}>
                              {item} {isCorrect ? '✓' : ''}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>

          {isHost && (
            <button disabled={busy} onClick={() => void perform(nextRound)} style={{ width: '100%', padding: '12px', backgroundColor: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '24px', cursor: 'pointer' }}>
              次のターンへ進む ➔
            </button>
          )}
        </div>
      )}

      {/* --- Phase 4: 総合結果発表 --- */}
      {room.status === 'FINAL_RESULT' && (
        <div style={{ backgroundColor: '#1e293b', padding: '24px', borderRadius: '12px', marginTop: '16px', textAlign: 'center' }}>
          <h2 style={{ color: '#38bdf8', fontSize: '2rem' }}>🏆 最終結果発表 🏆</h2>
          <p style={{ color: '#94a3b8', margin: '12px 0' }}>全員のプレイが終了しました！</p>

          <ol>{playersList.map(player => ({ ...player, total: Object.values(room.scores).reduce((sum, scores) => sum + (scores[player.id] ?? 0), 0) })).sort((a, b) => b.total - a.total).map(player => <li key={player.id}>{player.name}: {player.total}点</li>)}</ol>
          <section aria-label="相性がよかったペア" style={{ padding: '16px', background: '#0f172a', borderRadius: '8px' }}>
            <h3>🤝 一番相性がよかったペア</h3>
            <p>お互いを予想した得点の平均で比較します。同点は全ペアを表示します。</p>
            {winningPairs.length ? winningPairs.map(pair => <div key={pair.first.id + ':' + pair.second.id} style={{ marginTop: '16px' }}>
              <strong>{pair.first.name} ＆ {pair.second.name}：相性 {pair.average}点 / 100点</strong>
              <p>{pair.first.name} → {pair.second.name}：{pair.firstScore}点</p>
              <p>{pair.second.name} → {pair.first.name}：{pair.secondScore}点</p>
            </div>) : <p>お互いの予想がそろったペアはありません。</p>}
          </section>
          <p style={{ marginTop: '16px' }}>部屋コード：{room.code} — 次のゲームへの新規参加を受け付けています。</p>
          {isHost ? <button disabled={busy} onClick={() => void perform(playAgain)} style={{ padding: '12px 24px', backgroundColor: '#38bdf8', color: '#000', border: 'none', borderRadius: '8px', fontWeight: 'bold', marginTop: '20px', cursor: 'pointer' }}>
            もう一度あそぶ（待機室へ）
          </button> : <p style={{ marginTop: '20px' }}>ホストが待機室に戻すのを待っています。</p>}
        </div>
      )}
    </div>
  );
}

export default App;