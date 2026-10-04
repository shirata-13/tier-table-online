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
  const container = useRef<HTMLElement>(null);
  const icon = useRef<HTMLButtonElement>(null);
  const wantsPlayback = useRef(true);
  const [volume, setVolume] = useState(savedVolume);
  const [playing, setPlaying] = useState(false);
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (audio.current) { audio.current.volume = volume; audio.current.muted = volume === 0; }
    try { localStorage.setItem(VOLUME_KEY, String(volume)); } catch { /* Storage may be unavailable. */ }
  }, [volume]);

  const start = () => {
    const player = audio.current;
    if (!player) return;
    setError('');
    void player.play().then(() => setBlocked(false)).catch(cause => {
      if (cause instanceof Error && cause.name === 'NotAllowedError') setBlocked(true);
      else if (!(cause instanceof Error && cause.name === 'AbortError')) setError('BGMを再生できません。再生ボタンでお試しください。');
    });
  };

  useEffect(() => {
    const player = audio.current;
    if (!player) return;
    let active = true;
    const attempt = () => {
      if (!wantsPlayback.current || !player.paused) return;
      void player.play().then(() => { if (active) setBlocked(false); }).catch(cause => {
        if (!active) return;
        if (cause instanceof Error && cause.name === 'NotAllowedError') setBlocked(true);
        else if (!(cause instanceof Error && cause.name === 'AbortError')) setError('BGMを再生できません。再生ボタンでお試しください。');
      });
    };
    const gesture = (event: Event) => {
      if (event.target instanceof Node && container.current?.contains(event.target)) return;
      attempt();
    };
    attempt();
    document.addEventListener('pointerdown', gesture);
    document.addEventListener('keydown', gesture);
    return () => { active = false; document.removeEventListener('pointerdown', gesture); document.removeEventListener('keydown', gesture); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); icon.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [open]);

  const silent = !playing || volume === 0;
  const toggleSound = () => {
    if (!silent) { wantsPlayback.current = false; audio.current?.pause(); setBlocked(false); }
    else {
      wantsPlayback.current = true;
      if (volume === 0) { setVolume(0.3); if (audio.current) { audio.current.volume = 0.3; audio.current.muted = false; } }
      start();
    }
  };

  return <section ref={container} className="bgm-player" aria-label="BGM設定">
    <audio ref={audio} src={import.meta.env.BASE_URL + 'audio/bgm.mp3'} loop preload="auto"
      onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
      onError={() => { setPlaying(false); setError('BGMを読み込めません。通信を確認してください。'); }} />
    <button ref={icon} type="button" className="bgm-icon" aria-label="BGMの音量設定" aria-expanded={open} aria-controls="bgm-panel"
      onClick={() => { setOpen(value => !value); if (wantsPlayback.current && audio.current?.paused) start(); }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M11 5 6 9H3v6h3l5 4Z" />
        {silent ? <path d="m16 9 5 6m0-6-5 6" /> : <><path d="M15 8a6 6 0 0 1 0 8" /><path d="M18 5a10 10 0 0 1 0 14" /></>}
      </svg>
    </button>
    {open && <div id="bgm-panel" className="bgm-panel">
      <div className="bgm-panel-heading"><strong>♫ BGM</strong><button type="button" className="bgm-sound-toggle" onClick={toggleSound}>{silent ? '再生' : '消音'}</button></div>
      <div className="bgm-controls">
        <label htmlFor="bgm-volume">音量</label>
        <input id="bgm-volume" type="range" min="0" max="100" step="1" value={Math.round(volume * 100)}
          onChange={event => setVolume(Number(event.target.value) / 100)} aria-valuetext={Math.round(volume * 100) + '%'} />
        <output htmlFor="bgm-volume">{Math.round(volume * 100)}%</output>
      </div>
      {blocked && <p className="bgm-note">画面をクリックするとBGMが始まります。</p>}
      {error && <p role="alert" className="bgm-error">{error}</p>}
    </div>}
  </section>;
}
