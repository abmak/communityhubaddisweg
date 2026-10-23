import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { env } from "../config/env";
import { prisma } from "../lib/prisma";
import { asyncHandler } from "../lib/async-handler";
import { ApiError } from "../lib/errors";
import { requireAuth } from "../middleware/auth";
import { uploadLimiter } from "../lib/rate-limit";
import { mediaUrl, processImage, removeUploads, uploadDir } from "../lib/storage";

export const mediaRouter = Router();

const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/avif": ".avif",
};

const AUDIO_TYPES: Record<string, string> = {
  "audio/webm": ".webm",
  "audio/ogg": ".ogg",
  "audio/mpeg": ".mp3",
  "audio/mp4": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/wav": ".wav",
  "audio/x-wav": ".wav",
  "audio/aac": ".aac",
};

// Ensure the upload directory exists before the first request arrives.
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const extension =
      IMAGE_TYPES[file.mimetype] ?? AUDIO_TYPES[file.mimetype] ?? path.extname(file.originalname);
    cb(null, `${randomUUID()}${extension.slice(0, 10)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_TYPES[file.mimetype] || AUDIO_TYPES[file.mimetype]) {
      cb(null, true);
      return;
    }
    cb(ApiError.badRequest("Only JPEG, PNG, WebP, GIF, AVIF images or common audio files are allowed."));
  },
});

const durationSchema = z.coerce.number().int().min(0).max(15 * 60 * 1000).optional();

mediaRouter.post(
  "/",
  requireAuth,
  uploadLimiter,
  upload.single("file"),
  asyncHandler(async (req, res) => {
    if (!req.file) throw ApiError.badRequest("Choose a file to upload.");

    const isImage = Boolean(IMAGE_TYPES[req.file.mimetype]);
    const isAudio = Boolean(AUDIO_TYPES[req.file.mimetype]);
    if (!isImage && !isAudio) {
      await removeUploads([mediaUrl(req.file.filename)]);
      throw ApiError.badRequest("Unsupported file type.");
    }

    const image = isImage ? await processImage(req.file) : { width: null, height: null, thumbnailUrl: null };
    const parsedDuration = durationSchema.safeParse(req.body?.durationMs);

    const media = await prisma.media.create({
      data: {
        ownerId: req.userId!,
        kind: isImage ? "IMAGE" : "AUDIO",
        url: mediaUrl(req.file.filename),
        thumbnailUrl: image.thumbnailUrl,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        width: image.width,
        height: image.height,
        durationMs: isAudio && parsedDuration.success ? parsedDuration.data ?? null : null,
      },
    });

    res.status(201).json({ media });
  }),
);

mediaRouter.delete(
  "/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const media = await prisma.media.findUnique({ where: { id: String(req.params.id) } });
    if (!media) throw ApiError.notFound("That upload no longer exists.");
    if (media.ownerId !== req.userId) throw ApiError.forbidden();
    if (media.postId || media.messageId) {
      throw ApiError.badRequest("Remove this attachment from the post or message first.");
    }

    await prisma.media.delete({ where: { id: media.id } });
    await removeUploads([media.url, media.thumbnailUrl]);
    res.status(204).end();
  }),
);
