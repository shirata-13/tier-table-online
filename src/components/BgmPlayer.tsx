import { useEffect, useRef, useState } from 'react';

const VOLUME_KEY = 'tier-table-bgm-volume';

function savedVolume() {
  try {
    const stored = localStorage.getItem(VOLUME_KEY);
    const value = stored === null ? 0.3 : Number(stored);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.3;
  } catch { return 0.3; }
}

export default function BgmPlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [volume, setVolume] = useState(savedVolume);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (audio.current) { audio.current.volume = volume; audio.current.muted = volume === 0; }
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* Storage may be unavailable. */ }
  }, [volume]);

  const toggle = async () => {
    const player = audio.current;
    if (!player || loading) return;
    if (!player.paused) { player.pause(); return; }
    setError(''); setLoading(true);
    player.volume = volume;
    player.muted = volume === 0;
    try { await player.play(); }
    catch { setError('BGMを再生できませんでした。通信を確認して、もう一度お試しください。'); }
    finally { setLoading(false); }
  };

  return <section className="bgm-player" aria-label="BGM設定">
    <audio ref={audio} src={import.meta.env.BASE_URL + 'audio/bgm.mp3'} loop preload="none"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setPlaying(false); setLoading(false); setError('BGMを読み込めませんでした。通信を確認してください。'); }} />
    <div className="bgm-controls">
      <strong>♫ BGM</strong>
      <button type="button" disabled={loading} onClick={() => void toggle()} aria-label={playing ? 'BGMを一時停止' : 'BGMを再生'}>
        {loading ? '読み込み中…' : playing ? '一時停止' : '再生'}
      </button>
      <label htmlFor="bgm-volume">音量</label>
      <input id="bgm-volume" type="range" min="0" max="100" step="1" value={Math.round(volume * 100)}
        onChange={event => setVolume(Number(event.target.value) / 100)} aria-valuetext={Math.round(volume * 100) + '%'} />
      <output htmlFor="bgm-volume">{Math.round(volume * 100)}%</output>
    </div>
    {error && <p role="alert" className="bgm-error">{error}</p>}
  </section>;
}
