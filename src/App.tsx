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
  { title: "好きな丼もの", items: ["牛丼", "親子丼", "天丼", "海鮮丼", "カツ丼", "麻婆丼"] },
  { title: "好きなパン", items: ["メロンパン", "クロワッサン", "カレーパン", "あんぱん", "食パン", "塩パン"] },
  { title: "好きなアイス", items: ["バニラ", "チョコ", "抹茶", "ストロベリー", "ソーダ", "クッキー＆クリーム"] },
  { title: "好きな飲み物", items: ["緑茶", "紅茶", "コーヒー", "炭酸飲料", "ミルク", "スポーツドリンク"] },
  { title: "好きな果物", items: ["いちご", "りんご", "みかん", "ぶどう", "桃", "メロン"] },
  { title: "好きな野菜", items: ["トマト", "じゃがいも", "とうもろこし", "アボカド", "きゅうり", "ブロッコリー"] },
  { title: "好きな肉料理", items: ["ハンバーグ", "焼肉", "とんかつ", "生姜焼き", "ローストビーフ", "焼き鳥"] },
  { title: "好きな麺料理", items: ["うどん", "そば", "パスタ", "焼きそば", "冷やし中華", "フォー"] },
  { title: "好きな和食", items: ["天ぷら", "肉じゃが", "お好み焼き", "茶碗蒸し", "すき焼き", "焼き魚"] },
  { title: "好きな洋食", items: ["オムライス", "グラタン", "ビーフシチュー", "ドリア", "エビフライ", "ナポリタン"] },
  { title: "好きな中華料理", items: ["餃子", "チャーハン", "麻婆豆腐", "酢豚", "小籠包", "青椒肉絲"] },
  { title: "好きなスープ", items: ["味噌汁", "コーンスープ", "豚汁", "ミネストローネ", "クラムチャウダー", "わかめスープ"] },
  { title: "好きなファストフード", items: ["フライドポテト", "チキンナゲット", "ハンバーガー", "ホットドッグ", "タコス", "チキンサンド"] },
  { title: "好きなデザート", items: ["ショートケーキ", "プリン", "シュークリーム", "たい焼き", "杏仁豆腐", "わらび餅"] },
  { title: "好きな駄菓子", items: ["うまい棒", "ベビースター", "麩菓子", "ラムネ菓子", "よっちゃんイカ", "きなこ棒"] },
  { title: "好きなピザのトッピング", items: ["マルゲリータ", "ペパロニ", "照り焼きチキン", "シーフード", "クアトロフォルマッジ", "もちと明太子"] },
  { title: "お弁当に入っているとうれしいおかず", items: ["卵焼き", "ウインナー", "ミートボール", "きんぴらごぼう", "エビフライ", "ブロッコリー"] },
  { title: "居酒屋で頼みたい料理", items: ["枝豆", "だし巻き卵", "軟骨のから揚げ", "刺身盛り合わせ", "焼き鳥", "ポテトサラダ"] },
  { title: "好きなご当地グルメ", items: ["たこ焼き", "ジンギスカン", "きしめん", "讃岐うどん", "沖縄そば", "牛タン焼き"] },
  { title: "行ってみたい国", items: ["イタリア", "フランス", "韓国", "台湾", "オーストラリア", "アイスランド"] },
  { title: "国内旅行で行きたい都道府県", items: ["青森県", "石川県", "長野県", "広島県", "鹿児島県", "香川県"] },
  { title: "旅行の移動手段", items: ["新幹線", "飛行機", "寝台列車", "フェリー", "レンタカー", "夜行バス"] },
  { title: "旅先でやりたいこと", items: ["名所めぐり", "食べ歩き", "温泉に入る", "自然の中を歩く", "買い物", "写真を撮る"] },
  { title: "泊まりたい宿", items: ["温泉旅館", "高級ホテル", "キャンプ場", "古民家宿", "海辺のコテージ", "寝台列車"] },
  { title: "海でやりたいこと", items: ["泳ぐ", "砂浜で遊ぶ", "シュノーケリング", "サーフィン", "釣り", "夕日を見る"] },
  { title: "山でやりたいこと", items: ["登山", "キャンプ", "山菜採り", "星空観察", "川遊び", "ロープウェイに乗る"] },
  { title: "遊園地で乗りたいもの", items: ["ジェットコースター", "観覧車", "メリーゴーラウンド", "急流すべり", "コーヒーカップ", "お化け屋敷"] },
  { title: "水族館で見たい生き物", items: ["イルカ", "クラゲ", "ペンギン", "ジンベエザメ", "ラッコ", "チンアナゴ"] },
  { title: "動物園で会いたい動物", items: ["パンダ", "ライオン", "キリン", "レッサーパンダ", "ゾウ", "カピバラ"] },
  { title: "好きな季節のイベント", items: ["お花見", "夏祭り", "花火大会", "ハロウィン", "クリスマス", "雪まつり"] },
  { title: "春に楽しみたいこと", items: ["お花見", "いちご狩り", "ピクニック", "新しい服を買う", "散歩", "新生活"] },
  { title: "夏に楽しみたいこと", items: ["海水浴", "花火", "夏祭り", "かき氷", "キャンプ", "ビアガーデン"] },
  { title: "秋に楽しみたいこと", items: ["紅葉狩り", "焼き芋", "栗ごはん", "ハイキング", "読書", "ぶどう狩り"] },
  { title: "冬に楽しみたいこと", items: ["スキー", "スノーボード", "鍋料理", "こたつで過ごす", "イルミネーション", "雪だるま作り"] },
  { title: "雨の日の過ごし方", items: ["映画を見る", "本を読む", "料理をする", "ゲームをする", "部屋を片付ける", "喫茶店に行く"] },
  { title: "休日の朝にしたいこと", items: ["ゆっくり寝る", "朝風呂に入る", "散歩する", "パン屋に行く", "朝食を作る", "早起きして出かける"] },
  { title: "朝に飲みたいもの", items: ["水", "牛乳", "カフェオレ", "緑茶", "オレンジジュース", "スムージー"] },
  { title: "寝る前にやること", items: ["読書", "ストレッチ", "動画を見る", "日記を書く", "音楽を聴く", "明日の準備"] },
  { title: "リラックスできる場所", items: ["自分の部屋", "温泉", "図書館", "公園", "海辺", "喫茶店"] },
  { title: "誕生日の過ごし方", items: ["家族と食事", "友達とパーティー", "旅行", "好きな店で外食", "家でのんびり", "自分にプレゼント"] },
  { title: "友達と遊ぶなら", items: ["カラオケ", "ボウリング", "映画館", "ゲームセンター", "食べ歩き", "スポーツ"] },
  { title: "家で楽しむ趣味", items: ["料理", "プラモデル", "読書", "家庭菜園", "編み物", "楽器演奏"] },
  { title: "外で楽しむ趣味", items: ["写真撮影", "釣り", "サイクリング", "ランニング", "バードウォッチング", "キャンプ"] },
  { title: "身につけたいスキル", items: ["英会話", "料理", "プログラミング", "写真撮影", "イラスト", "プレゼンテーション"] },
  { title: "学んでみたい言語", items: ["英語", "韓国語", "フランス語", "スペイン語", "中国語", "イタリア語"] },
  { title: "使ってみたい楽器", items: ["ピアノ", "ギター", "ドラム", "サックス", "バイオリン", "和太鼓"] },
  { title: "習ってみたいスポーツ", items: ["テニス", "ボクシング", "弓道", "ダンス", "水泳", "フェンシング"] },
  { title: "観戦したいスポーツ", items: ["サッカー", "野球", "バスケットボール", "バレーボール", "ラグビー", "フィギュアスケート"] },
  { title: "理想の部屋に置きたいもの", items: ["大きな本棚", "プロジェクター", "観葉植物", "大きなソファ", "作業デスク", "ハンモック"] },
  { title: "休日に読みたい本のジャンル", items: ["ミステリー", "ファンタジー", "エッセイ", "歴史小説", "恋愛小説", "旅行記"] },
  { title: "好きな漫画のジャンル", items: ["スポーツ", "バトル", "日常", "ラブコメ", "冒険", "医療"] },
  { title: "好きなアニメのジャンル", items: ["ロボット", "異世界", "学園", "スポーツ", "日常系", "サスペンス"] },
  { title: "好きな音楽ジャンル", items: ["ロック", "ポップス", "ジャズ", "クラシック", "ヒップホップ", "ボーカロイド"] },
  { title: "作業中に聴きたい音", items: ["歌詞のない音楽", "雨音", "カフェの環境音", "ラジオ", "好きな曲", "無音"] },
  { title: "カラオケで歌いたい曲", items: ["定番の盛り上がる曲", "最新のヒット曲", "アニメソング", "懐かしい曲", "バラード", "デュエット曲"] },
  { title: "好きなボードゲーム", items: ["人生ゲーム", "カタン", "オセロ", "将棋", "ブロックス", "カルカソンヌ"] },
  { title: "好きなカードゲーム", items: ["トランプ", "UNO", "花札", "百人一首", "ポーカー", "神経衰弱"] },
  { title: "好きなゲームジャンル", items: ["RPG", "パズル", "格闘", "レース", "シミュレーション", "リズムゲーム"] },
  { title: "好きなキャラクターのタイプ", items: ["頼れるリーダー", "天才肌", "ムードメーカー", "クールな相棒", "努力家", "癒やし系"] },
  { title: "物語で見たい舞台", items: ["魔法学校", "宇宙船", "近未来の都市", "小さな港町", "無人島", "古代文明"] },
  { title: "好きな動画企画", items: ["大食い", "検証", "ドッキリ", "旅企画", "料理対決", "クイズ"] },
  { title: "好きなテレビ番組", items: ["クイズ番組", "料理番組", "旅番組", "音楽番組", "動物番組", "お笑い番組"] },
  { title: "お気に入りの文房具", items: ["万年筆", "シャープペンシル", "色鉛筆", "付箋", "ノート", "マスキングテープ"] },
  { title: "欲しい家電", items: ["ロボット掃除機", "大画面テレビ", "食洗機", "高性能炊飯器", "ホームベーカリー", "プロジェクター"] },
  { title: "欲しい家具", items: ["大きなソファ", "広いベッド", "本棚", "昇降デスク", "ダイニングテーブル", "リクライニングチェア"] },
  { title: "欲しい調理器具", items: ["圧力鍋", "ホームベーカリー", "エアフライヤー", "高性能ミキサー", "燻製器", "大きな鉄板"] },
  { title: "便利だと思う発明", items: ["自動で片付く部屋", "瞬間移動装置", "翻訳イヤホン", "全自動の洗濯物たたみ機", "天気を変える装置", "どこでもドア"] },
  { title: "外出時に持ち歩きたいもの", items: ["モバイルバッテリー", "折りたたみ傘", "イヤホン", "エコバッグ", "水筒", "文庫本"] },
  { title: "好きな乗り物", items: ["新幹線", "自転車", "飛行機", "船", "オープンカー", "路面電車"] },
  { title: "一度乗ってみたい乗り物", items: ["熱気球", "水上飛行機", "豪華客船", "蒸気機関車", "潜水艇", "犬ぞり"] },
  { title: "落ち着く音", items: ["雨の音", "波の音", "焚き火の音", "鳥のさえずり", "風鈴の音", "川のせせらぎ"] },
  { title: "好きな色", items: ["赤", "青", "緑", "黄色", "白", "黒"] },
  { title: "好きな花", items: ["桜", "ひまわり", "チューリップ", "バラ", "あじさい", "ラベンダー"] },
  { title: "子どもの頃に好きだった遊び", items: ["かくれんぼ", "鬼ごっこ", "ドッジボール", "なわとび", "缶けり", "砂遊び"] },
  { title: "学校で好きだった教科", items: ["国語", "数学", "理科", "社会", "音楽", "体育"] },
  { title: "学校で楽しみだった行事", items: ["運動会", "文化祭", "修学旅行", "遠足", "合唱コンクール", "卒業式"] },
  { title: "やってみたい職業", items: ["パティシエ", "宇宙飛行士", "漫画家", "動物園の飼育員", "考古学者", "ゲームクリエイター"] },
  { title: "理想の仕事環境", items: ["自宅で一人", "自然の中", "活気のあるオフィス", "少人数のチーム", "世界中を移動", "好きな店を経営"] },
  { title: "休日の自分へのごほうび", items: ["好きなものを食べる", "新しい服を買う", "マッサージに行く", "好きなだけ寝る", "日帰り旅行", "ゲームを楽しむ"] },
  { title: "一日だけなれるなら", items: ["人気俳優", "プロスポーツ選手", "世界的なシェフ", "大富豪", "宇宙飛行士", "好きな動物"] },
  { title: "タイムスリップするなら", items: ["恐竜の時代", "江戸時代", "平安時代", "子どもの頃", "100年後の未来", "文明の始まり"] },
  { title: "無料でもらえるとうれしいもの", items: ["一生分のお米", "高級ホテル宿泊券", "最新のゲーム機", "世界一周旅行券", "好きな店の食事券", "最新のスマートフォン"] },
  { title: "一つだけ願いがかなうなら", items: ["どこへでも行ける", "時間を止められる", "動物と話せる", "病気を治せる", "何語でも話せる", "空を自由に飛べる"] },
  { title: "部屋に飾りたいもの", items: ["お気に入りのポスター", "風景写真", "観葉植物", "壁掛け時計", "好きなキャラクターのフィギュア", "絵画"] },
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