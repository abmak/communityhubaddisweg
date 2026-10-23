import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { env } from "../config/env";
import { logger } from "./logger";

export const uploadDir = path.resolve(process.cwd(), env.UPLOAD_DIR);

export async function ensureUploadDir(): Promise<void> {
  await fs.mkdir(uploadDir, { recursive: true });
}

/** URLs are stored relative so the app can move between hosts unchanged. */
export function mediaUrl(filename: string): string {
  return `/uploads/${filename}`;
}

function absolutePathFor(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  const filename = path.basename(url);
  if (!filename) return null;
  return path.join(uploadDir, filename);
}

export interface ImageProcessingResult {
  width: number | null;
  height: number | null;
  thumbnailUrl: string | null;
}

export async function processImage(file: Express.Multer.File): Promise<ImageProcessingResult> {
  try {
    const metadata = await sharp(file.path).metadata();
    const thumbName = `${path.parse(file.filename).name}-thumb.webp`;

    await sharp(file.path)
      .rotate()
      .resize({ width: 800, height: 800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(uploadDir, thumbName));

    return {
      width: metadata.width ?? null,
      height: metadata.height ?? null,
      thumbnailUrl: mediaUrl(thumbName),
    };
  } catch (error) {
    logger.warn({ err: error, file: file.filename }, "Image processing failed; serving original");
    return { width: null, height: null, thumbnailUrl: null };
  }
}

export async function removeUploads(urls: Array<string | null | undefined>): Promise<void> {
  await Promise.all(
    urls.map(async (url) => {
      if (!url) return;
      const filePath = absolutePathFor(url);
      if (!filePath) return;
      try {
        await fs.unlink(filePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ENOENT") {
          logger.warn({ err: error, url }, "Could not remove upload");
        }
      }
    }),
  );
}
