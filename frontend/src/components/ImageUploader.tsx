import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import type { Media } from "../types";
import { api, apiError, mediaSrc, uploadMedia } from "../lib/api";
import { useUI } from "../store/ui";
import { cn } from "../lib/utils";

const MAX_BYTES = 25 * 1024 * 1024;

export function ImageUploader({
  media,
  onChange,
  max = 4,
  label = "Add photos",
}: {
  media: Media[];
  onChange: (media: Media[]) => void;
  max?: number;
  label?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const pushToast = useUI((state) => state.pushToast);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remaining = max - media.length;
    if (remaining <= 0) {
      pushToast(`You can attach up to ${max} photos.`, { tone: "error" });
      return;
    }

    const selected = Array.from(files).slice(0, remaining);
    setUploading(true);
    setProgress(0);

    const uploaded: Media[] = [];
    for (const file of selected) {
      if (!file.type.startsWith("image/")) {
        pushToast(`${file.name} is not an image.`, { tone: "error" });
        continue;
      }
      if (file.size > MAX_BYTES) {
        pushToast(`${file.name} is larger than 25 MB.`, { tone: "error" });
        continue;
      }
      try {
        const result = await uploadMedia(file, { onProgress: setProgress });
        uploaded.push(result);
      } catch (error) {
        pushToast(apiError(error, `Could not upload ${file.name}`), { tone: "error" });
      }
    }

    if (uploaded.length > 0) onChange([...media, ...uploaded]);
    setUploading(false);
    setProgress(0);
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (item: Media) => {
    onChange(media.filter((existing) => existing.id !== item.id));
    try {
      await api.delete(`/api/media/${item.id}`);
    } catch {
      // The attachment is already detached in the UI; orphan cleanup is harmless.
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {media.map((item) => (
          <div
            key={item.id}
            className="group relative h-20 w-20 overflow-hidden rounded-xl border border-line bg-raised"
          >
            <img
              src={mediaSrc(item.thumbnailUrl || item.url)}
              alt="Attachment preview"
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => remove(item)}
              className="absolute right-1 top-1 rounded-full bg-slate-950/70 p-1 text-white transition hover:bg-rose-600"
              aria-label="Remove attachment"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {media.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className={cn(
              "flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line bg-raised/60 text-[10px] font-medium text-muted transition hover:border-brand-400 hover:text-brand-700",
              uploading && "cursor-wait",
            )}
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
            {uploading ? `${progress}%` : label}
          </button>
        )}
      </div>
      {uploading && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-raised">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-200"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
        multiple
        className="hidden"
        onChange={(event) => void handleFiles(event.target.files)}
      />
    </div>
  );
}
