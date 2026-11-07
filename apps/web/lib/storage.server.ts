import "server-only";
import { createReadStream } from "node:fs";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Readable } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

/**
 * Where uploaded bytes live. The local disk works for one machine. Set
 * UNSTUCK_S3_BUCKET (with credentials, and UNSTUCK_S3_ENDPOINT for R2, MinIO
 * or another S3-compatible service) so several machines share one store.
 * Quarantined files go under a separate prefix that is never served.
 */
export type Area = "files" | "quarantine";
export interface Stored {
  stream: ReadableStream;
  size: number;
}
interface Storage {
  put(area: Area, id: string, bytes: Buffer, mime: string): Promise<void>;
  get(
    area: Area,
    id: string,
    range?: { start: number; end: number },
  ): Promise<Stored>;
  size(area: Area, id: string): Promise<number>;
  remove(area: Area, id: string): Promise<void>;
}

const dataDir = () =>
  resolve(
    process.env.UNSTUCK_DATA_DIR ||
      join(/* turbopackIgnore: true */ process.cwd(), ".data"),
  );
const disk: Storage = {
  async put(area, id, bytes) {
    await mkdir(join(dataDir(), area), { recursive: true });
    await writeFile(join(dataDir(), area, id), bytes);
  },
  async get(area, id, range) {
    const path = join(dataDir(), area, id);
    const size = (await stat(path)).size;
    const stream = createReadStream(path, range ?? {});
    return { stream: Readable.toWeb(stream) as ReadableStream, size };
  },
  async size(area, id) {
    return (await stat(join(dataDir(), area, id))).size;
  },
  async remove(area, id) {
    await rm(join(dataDir(), area, id), { force: true });
  },
};

function s3(): Storage {
  const bucket = process.env.UNSTUCK_S3_BUCKET!;
  const client = new S3Client({
    region: process.env.UNSTUCK_S3_REGION || "auto",
    endpoint: process.env.UNSTUCK_S3_ENDPOINT || undefined,
    forcePathStyle: process.env.UNSTUCK_S3_FORCE_PATH_STYLE === "true",
    credentials:
      process.env.UNSTUCK_S3_ACCESS_KEY_ID &&
      process.env.UNSTUCK_S3_SECRET_ACCESS_KEY
        ? {
            accessKeyId: process.env.UNSTUCK_S3_ACCESS_KEY_ID,
            secretAccessKey: process.env.UNSTUCK_S3_SECRET_ACCESS_KEY,
          }
        : undefined,
  });
  const key = (area: Area, id: string) => `${area}/${id}`;
  return {
    async put(area, id, bytes, mime) {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key(area, id),
          Body: bytes,
          ContentType: mime,
        }),
      );
    },
    async get(area, id, range) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key(area, id),
          Range: range ? `bytes=${range.start}-${range.end}` : undefined,
        }),
      );
      const total = result.ContentRange
        ? Number(result.ContentRange.split("/")[1])
        : Number(result.ContentLength ?? 0);
      return { stream: result.Body!.transformToWebStream(), size: total };
    },
    async size(area, id) {
      const result = await client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key(area, id),
          Range: "bytes=0-0",
        }),
      );
      result.Body?.transformToWebStream()
        .cancel()
        .catch(() => undefined);
      return result.ContentRange
        ? Number(result.ContentRange.split("/")[1])
        : Number(result.ContentLength ?? 0);
    },
    async remove(area, id) {
      await client.send(
        new DeleteObjectCommand({ Bucket: bucket, Key: key(area, id) }),
      );
    },
  };
}
const shared = globalThis as typeof globalThis & {
  __unstuckStorage?: { bucket: string; storage: Storage };
};
export function storage(): Storage {
  const bucket = process.env.UNSTUCK_S3_BUCKET ?? "";
  if (!bucket) return disk;
  if (shared.__unstuckStorage?.bucket !== bucket)
    shared.__unstuckStorage = { bucket, storage: s3() };
  return shared.__unstuckStorage.storage;
}
