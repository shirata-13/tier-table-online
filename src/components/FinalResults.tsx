import type { Player, RoomState } from '../types/game';
import { bestPairs, finalRanking } from '../gameResults';

interface FinalResultsProps {
  room: RoomState;
  players: Player[];
  isHost: boolean;
  busy: boolean;
  onPlayAgain: () => void;
}

export default function FinalResults({ room, players, isHost, busy, onPlayAgain }: FinalResultsProps) {
  const ranking = finalRanking(players, room.scores);
  const winners = ranking.filter(player => player.perfectCount > 0).sort((a, b) => b.perfectCount - a.perfectCount);
  const pairs = bestPairs(players, room.scores);
  return <section className="final-results" aria-labelledby="final-results-title">
    <h2 id="final-results-title" className="final-results-title">最終結果発表</h2>
    <div className="final-results-grid">
      <section className="result-card" aria-labelledby="perfect-award-title">
        <h3 id="perfect-award-title">ピタリ賞</h3>
        <span className="result-symbol" aria-hidden="true">🎯</span>
        <p className="result-description">100点の予想を達成！<br />1回につき＋10点</p>
        <ul className="award-list">
          {winners.map(player => <li key={player.id} className="award-name">
            <strong>{player.name}</strong>
            <span>{player.perfectCount}回達成 · ＋{player.bonus}点</span>
          </li>)}
        </ul>
        {!winners.length && <p className="result-description">今回は該当者なし。<br />次のゲームでチャレンジ！</p>}
      </section>
      <section className="result-card" aria-labelledby="best-pair-title">
        <h3 id="best-pair-title">ベスト相性</h3>
        <span className="result-symbol" aria-hidden="true">🤝</span>
        {pairs.map(pair => <div key={pair.first.id + ':' + pair.second.id} className="best-pair">
          <strong className="pair-name">{pair.first.name}</strong>
          <span className="pair-cross" aria-hidden="true">×</span>
          <strong className="pair-name">{pair.second.name}</strong>
          <p className="pair-rate">相性 {pair.average}%</p>
          <p className="result-description">{pair.first.name} → {pair.second.name}：{pair.firstScore}点<br />{pair.second.name} → {pair.first.name}：{pair.secondScore}点</p>
        </div>)}
        {!pairs.length && <p className="result-description">お互いの予想がそろった<br />ペアはありません。</p>}
        <p className="result-description">互いの予想得点の平均で選出<br />同点の場合は全ペアを表彰</p>
      </section>
      <section className="result-card ranking-card" aria-labelledby="ranking-title">
        <h3 id="ranking-title">最終ランキング</h3>
        <span className="result-symbol" aria-hidden="true">🏆</span>
        <ol className="final-ranking">
          {ranking.map(player => <li key={player.id} className="ranking-entry" data-rank={Math.min(player.rank, 3)}>
            <div className="ranking-main"><span className="ranking-place">{player.rank}位</span><strong className="ranking-name">{player.name}</strong><strong className="ranking-score">{player.total}<small>点</small></strong></div>
            <p className="ranking-detail">予想 {player.baseScore}点 ＋ ピタリ賞 {player.bonus}点</p>
          </li>)}
        </ol>
      </section>
    </div>
    <footer className="final-results-footer">
      <p>部屋コード：{room.code} · 次のゲームへの新規参加を受け付けています。</p>
      {isHost ? <button className="play-again-button" disabled={busy} onClick={onPlayAgain}>もう一度遊ぶ</button>
        : <p>ホストが待機室に戻すのを待っています。</p>}
    </footer>
  </section>;
}
