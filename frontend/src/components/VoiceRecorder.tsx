import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, RotateCcw, Send, Square, Trash2 } from "lucide-react";
import type { Media } from "../types";
import { apiError, uploadMedia } from "../lib/api";
import { formatDuration } from "../lib/utils";
import { AudioPlayer } from "./Media";

type RecorderStatus = "idle" | "recording" | "recorded" | "uploading" | "error";

const MAX_SECONDS = 120;

function supportedMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function VoiceRecorder({
  onUploaded,
  onCancel,
  compact,
}: {
  onUploaded: (media: Media) => void;
  onCancel?: () => void;
  compact?: boolean;
}) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [seconds, setSeconds] = useState(0);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const blobRef = useRef<Blob | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  };

  const clearTimer = () => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
  };

  function stopRecording() {
    if (recorderRef.current && recorderRef.current.state === "recording") {
      recorderRef.current.stop();
    }
    clearTimer();
    stopTracks();
  }

  const reset = () => {
    clearTimer();
    stopTracks();
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    blobRef.current = null;
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setSeconds(0);
    setProgress(0);
    setError(null);
    setStatus("idle");
  };

  useEffect(() => {
    return () => {
      clearTimer();
      stopTracks();
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.onstop = null;
        recorderRef.current.stop();
      }
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const start = async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setStatus("error");
      setError("Voice recording is not supported in this browser. Try Chrome, Edge or Firefox.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = supportedMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: mimeType || recorder.mimeType || "audio/webm",
        });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        setPreviewUrl(url);
        setStatus("recorded");
      };

      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setStatus("recording");
      clearTimer();
      timerRef.current = window.setInterval(() => {
        setSeconds((value) => {
          if (value + 1 >= MAX_SECONDS) {
            stopRecording();
            return MAX_SECONDS;
          }
          return value + 1;
        });
      }, 1000);
    } catch {
      stopTracks();
      setStatus("error");
      setError("Microphone access was denied. Allow the microphone in your browser settings and try again.");
    }
  };

  const upload = async () => {
    if (!blobRef.current) return;
    setStatus("uploading");
    setProgress(0);
    setError(null);
    try {
      const media = await uploadMedia(blobRef.current, {
        durationMs: seconds * 1000,
        filename: `voice-${Date.now()}.webm`,
        onProgress: setProgress,
      });
      onUploaded(media);
      reset();
    } catch (err) {
      setStatus("recorded");
      setError(apiError(err, "The voice message could not be uploaded."));
    }
  };

  if (status === "recording") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 dark:border-rose-500/30 dark:bg-rose-500/10">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
        </span>
        <span className="text-sm font-semibold tabular-nums text-rose-700 dark:text-rose-300">
          {formatDuration(seconds * 1000)}
        </span>
        <span className="flex-1 text-xs text-rose-600/80 dark:text-rose-300/80">
          Recording… up to 2 minutes
        </span>
        <button type="button" onClick={stopRecording} className="btn-danger btn-sm">
          <Square className="h-3.5 w-3.5 fill-current" /> Stop
        </button>
      </div>
    );
  }

  if (status === "recorded" || status === "uploading") {
    return (
      <div className="space-y-2 rounded-xl border border-line bg-raised p-3">
        <div className="flex items-center gap-2">
          {previewUrl && <AudioPlayer src={previewUrl} durationMs={seconds * 1000} compact />}
        </div>
        {status === "uploading" && (
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-brand-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={reset}
            disabled={status === "uploading"}
          >
            <RotateCcw className="h-3.5 w-3.5" /> Retake
          </button>
          <button
            type="button"
            className="btn-primary btn-sm"
            onClick={upload}
            disabled={status === "uploading"}
          >
            {status === "uploading" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
            {status === "uploading" ? `${progress}%` : "Attach recording"}
          </button>
          {onCancel && (
            <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
              <Trash2 className="h-3.5 w-3.5" /> Cancel
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={start}
          className={compact ? "btn-ghost btn-sm" : "btn-secondary btn-sm"}
          aria-label="Record a voice message"
        >
          <Mic className="h-4 w-4" /> {compact ? "Voice" : "Record voice"}
        </button>
        {onCancel && (
          <button type="button" className="btn-ghost btn-sm" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
      {error && <p className="mt-2 max-w-sm text-xs leading-5 text-rose-600">{error}</p>}
    </div>
  );
}
