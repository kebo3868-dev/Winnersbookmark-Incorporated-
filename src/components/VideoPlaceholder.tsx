import React, { useState } from 'react';

interface VideoPlaceholderProps {
  exerciseName: string;
  videoUrl: string;
  thumbnailUrl: string;
  durationSec: number;
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function VideoPlaceholder({
  exerciseName,
  videoUrl,
  thumbnailUrl,
  durationSec,
}: VideoPlaceholderProps) {
  const [tapped, setTapped] = useState(false);
  const isPlaceholder = videoUrl.startsWith('PLACEHOLDER_');

  if (tapped && !isPlaceholder) {
    return (
      <div className="relative w-full rounded-2xl overflow-hidden bg-ink-black" style={{ aspectRatio: '16/9' }}>
        <video
          src={videoUrl}
          controls
          autoPlay
          className="w-full h-full object-cover"
          poster={thumbnailUrl}
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full rounded-2xl overflow-hidden cursor-pointer group"
      style={{ aspectRatio: '16/9', background: 'linear-gradient(180deg, #0c1226 0%, #05060d 100%)' }}
      onClick={() => !isPlaceholder && setTapped(true)}
    >
      {/* Background pattern */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)',
        }}
      />

      {/* Gold border accent */}
      <div className="absolute inset-0 rounded-2xl border border-gold/20" />

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
        {/* Play button */}
        <div
          className={`w-16 h-16 rounded-full flex items-center justify-center transition-transform duration-200 ${
            !isPlaceholder ? 'group-hover:scale-110' : ''
          }`}
          style={{
            background: isPlaceholder
              ? 'rgba(212,175,55,0.15)'
              : 'linear-gradient(135deg, rgba(212,175,55,0.9) 0%, rgba(166,124,0,0.9) 100%)',
            boxShadow: isPlaceholder ? 'none' : '0 0 24px rgba(212,175,55,0.4)',
            border: '1px solid rgba(212,175,55,0.4)',
          }}
        >
          {isPlaceholder ? (
            <svg className="w-7 h-7 text-gold/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
            </svg>
          ) : (
            <svg className="w-7 h-7 text-ink-black ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>

        {/* Label */}
        <div className="text-center px-4">
          {isPlaceholder ? (
            <>
              <p className="text-xs font-semibold text-gold/70 uppercase tracking-widest mb-1">Demo Coming</p>
              <p className="text-xs text-ghost">
                {exerciseName} · {formatDuration(durationSec)}
              </p>
              <p className="text-[10px] text-ghost/50 mt-2 font-mono">
                Replace with approved demo URL
              </p>
            </>
          ) : (
            <>
              <p className="text-xs font-semibold text-gold uppercase tracking-widest mb-1">Watch Demo</p>
              <p className="text-xs text-chalk">{exerciseName} · {formatDuration(durationSec)}</p>
            </>
          )}
        </div>
      </div>

      {/* Duration badge */}
      <div className="absolute top-3 right-3 bg-ink-black/80 rounded-lg px-2 py-1 border border-ink-line">
        <span className="text-[11px] font-mono text-mist">{formatDuration(durationSec)}</span>
      </div>

      {/* Bottom label */}
      <div className="absolute bottom-3 left-3">
        <span className="chip text-[10px]">Exercise Demo</span>
      </div>
    </div>
  );
}
