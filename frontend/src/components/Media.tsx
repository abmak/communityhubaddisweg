import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  Mic,
  Pause,
  Play,
  X,
} from "lucide-react";
import type { Media } from "../types";
import { mediaSrc } from "../lib/api";
import { cn, formatDuration } from "../lib/utils";

export function SafeImage({
  src,
  alt,
  className,
  onClick,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  onClick?: () => void;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [src]);

  if (!src || failed) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-brand-900 via-brand-700 to-emerald-500 text-white/60",
          className,
        )}
        role="img"
        aria-label={alt}
      >
        <ImageOff className="h-7 w-7" />
      </div>
    );
  }

  return (
    <img
      src={mediaSrc(src)}
      alt={alt}
      loading="lazy"
      onClick={onClick}
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  );
}

interface LightboxImage {
  url: string;
  alt?: string;
}

function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" && index < images.length - 1) onNavigate(index + 1);
      if (event.key === "ArrowLeft" && index > 0) onNavigate(index - 1);
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [index, images.length, onClose, onNavigate]);

  const image = images[index];
  if (!image) return null;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex flex-col bg-slate-950/95 animate-fade-in">
      <div className="flex items-center justify-between px-4 py-3 text-white/80 sm:px-6">
        <p className="text-xs font-medium tracking-wide">
          {index + 1} / {images.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 transition hover:bg-white/10 hover:text-white"
          aria-label="Close image"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-8 sm:px-16">
        {index > 0 && (
          <button
            type="button"
            onClick={() => onNavigate(index - 1)}
            className="absolute left-2 z-10 rounded-full bg-black/40 p-2.5 text-white/80 transition hover:bg-black/60 hover:text-white sm:left-5"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <img
          src={mediaSrc(image.url)}
          alt={image.alt ?? "Shared image"}
          className="max-h-full max-w-full rounded-lg object-contain shadow-2xl"
        />
        {index < images.length - 1 && (
          <button
            type="button"
            onClick={() => onNavigate(index + 1)}
            className="absolute right-2 z-10 rounded-full bg-black/40 p-2.5 text-white/80 transition hover:bg-black/60 hover:text-white sm:right-5"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ImageGrid({ media, className }: { media: Media[]; className?: string }) {
  const images = media.filter((item) => item.kind === "IMAGE");
  const [active, setActive] = useState<number | null>(null);

  if (images.length === 0) return null;

  const lightboxImages = images.map((image) => ({ url: image.url, alt: "Shared photo" }));

  return (
    <>
      <div
        className={cn(
          "grid gap-1.5 overflow-hidden rounded-xl",
          images.length === 1 ? "grid-cols-1" : "grid-cols-2",
          className,
        )}
      >
        {images.slice(0, 4).map((image, index) => {
          const isLastWithMore = index === 3 && images.length > 4;
          return (
            <button
              key={image.id}
              type="button"
              onClick={() => setActive(index)}
              className={cn(
                "group relative overflow-hidden bg-raised",
                images.length === 1 ? "aspect-[16/10]" : "aspect-square",
                images.length === 3 && index === 0 && "col-span-2 aspect-[16/9]",
              )}
              aria-label="Open image"
            >
              <SafeImage
                src={image.thumbnailUrl || image.url}
                alt="Post attachment"
                className="h-full w-full transition duration-300 group-hover:scale-[1.02]"
              />
              {isLastWithMore && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-semibold text-white">
                  +{images.length - 4}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {active !== null && (
        <Lightbox
          images={lightboxImages}
          index={active}
          onClose={() => setActive(null)}
          onNavigate={setActive}
        />
      )}
    </>
  );
}

const waveformHeights = [22, 38, 16, 44, 30, 52, 26, 40, 18, 48, 34, 24, 42, 20, 36, 50, 28, 44, 16, 32, 46, 24, 38, 30];

export function AudioPlayer({
  src,
  durationMs,
  compact,
}: {
  src: string;
  durationMs?: number | null;
  compact?: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState((durationMs ?? 0) / 1000);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  };

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border border-line bg-raised px-3 py-2.5",
        compact ? "max-w-full" : "max-w-md",
      )}
    >
      <button
        type="button"
        onClick={toggle}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-[2px]" aria-hidden="true">
        {waveformHeights.map((height, index) => {
          const active = (index / waveformHeights.length) * 100 <= progress;
          return (
            <span
              key={index}
              className={cn(
                "w-[3px] rounded-full transition-colors",
                active ? "bg-brand-600" : "bg-muted/30",
              )}
              style={{ height: `${Math.max(6, height * (compact ? 0.55 : 0.7))}px` }}
            />
          );
        })}
      </div>
      <div className="flex shrink-0 items-center gap-2 text-[11px] font-medium tabular-nums text-muted">
        <Mic className="h-3.5 w-3.5" />
        {formatDuration((progress > 0 ? current : duration) * 1000)}
      </div>
      <audio
        ref={audioRef}
        src={mediaSrc(src)}
        preload="metadata"
        onLoadedMetadata={(event) => {
          const value = event.currentTarget.duration;
          if (Number.isFinite(value)) setDuration(value);
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget;
          setCurrent(audio.currentTime);
          if (audio.duration) setProgress((audio.currentTime / audio.duration) * 100);
        }}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrent(0);
        }}
        onPause={() => setPlaying(false)}
      />
    </div>
  );
}

export function MediaAttachments({ media, compact }: { media: Media[]; compact?: boolean }) {
  const images = media.filter((item) => item.kind === "IMAGE");
  const audio = media.filter((item) => item.kind === "AUDIO");

  if (media.length === 0) return null;

  return (
    <div className="space-y-2">
      {images.length > 0 && <ImageGrid media={images} />}
      {audio.map((item) => (
        <AudioPlayer key={item.id} src={item.url} durationMs={item.durationMs} compact={compact} />
      ))}
    </div>
  );
}
