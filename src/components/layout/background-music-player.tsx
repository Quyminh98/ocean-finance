"use client";

import { useRef, useState } from "react";
import { Play, Pause } from "lucide-react";

/**
 * Play/Pause button for background music, in the Topbar's top-right slot
 * (user request 2026-08-19 — swapped places with the bell/avatar cluster
 * that used to live there; that cluster was later removed entirely).
 * Browsers block autoplay of audio with sound until a real user gesture
 * happens, so an explicit button (rather than "play on first click
 * anywhere") is both the simplest UX and the thing that satisfies that
 * restriction. Loops while playing; no localStorage persistence — a fresh
 * page load has no user gesture yet either, so "remembering" the choice
 * couldn't auto-resume playback anyway.
 */
export function BackgroundMusicPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      void audio.play();
    }
    setIsPlaying((prev) => !prev);
  }

  return (
    <>
      <audio ref={audioRef} src="/bgm.mp3" loop preload="none" />
      <button
        type="button"
        onClick={toggle}
        aria-label={isPlaying ? "Tắt nhạc nền" : "Bật nhạc nền"}
        className="flex size-8 items-center justify-center rounded-full text-outline transition-colors hover:bg-surface-container hover:text-primary"
      >
        {isPlaying ? <Pause className="size-4" strokeWidth={2} /> : <Play className="size-4" strokeWidth={2} />}
      </button>
    </>
  );
}
