import type { Player } from '../types/game';

interface SubmissionProgressProps {
  players: Player[];
  submitted: string[];
  label: string;
}

export default function SubmissionProgress({ players, submitted, label }: SubmissionProgressProps) {
  const completed = new Set(submitted);
  const count = players.filter(player => completed.has(player.id)).length;
  const allDone = players.length > 0 && count === players.length;
  return <section className="submission-progress" aria-label={label + 'の提出状況'}>
    <p role="status" aria-live="polite" className="submission-summary">
      {label}：{count} / {players.length}人
      {allDone && <strong> ✓ 全員そろいました！</strong>}
    </p>
    <ul className="submission-list">
      {players.map(player => <li key={player.id} className={completed.has(player.id) ? 'submission-done' : 'submission-waiting'}>
        <span>{player.name}</span><strong>{completed.has(player.id) ? '✓ 提出済み' : '入力中…'}</strong>
      </li>)}
    </ul>
  </section>;
}
