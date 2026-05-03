import { BadRequestException, Injectable } from "@nestjs/common";
import { basename, extname } from "node:path";
import { randomUUID } from "node:crypto";

import {
  buildDefaultStorageDirectory,
  ObjectStorageService,
  type ObjectStorageFile,
  type StoredObjectMetadata
} from "./object-storage.service";

export const IMAGE_MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp"
]);

const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp"
};

export interface StoredImageFile {
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class ImageStorageService {
  private readonly storage = new ObjectStorageService({
    namespace: "imagens",
    driverEnvPrefix: "IMAGE",
    fallbackEnvPrefix: "PAYMENT_PROOF",
    defaultLocalDirectory: buildDefaultStorageDirectory("images")
  });

  async saveImage(scope: string, file: ObjectStorageFile): Promise<StoredImageFile> {
    this.validateUpload(file);

    const detectedMimeType = this.detectMimeType(file.buffer);

    if (!detectedMimeType || detectedMimeType !== file.mimetype) {
      throw new BadRequestException(
        "Imagem invalida. Envie uma imagem JPG, PNG ou WEBP valida."
      );
    }

    const originalFileName = this.sanitizeFileName(file.originalname);
    const storageKey = `${scope}/${randomUUID()}${EXTENSIONS_BY_MIME_TYPE[detectedMimeType]}`;

    await this.storage.save(storageKey, file);

    return {
      storageKey,
      originalFileName,
      mimeType: detectedMimeType,
      size: file.size
    };
  }

  readImage(storageKey: string, metadata: StoredObjectMetadata) {
    return this.storage.read(storageKey, metadata);
  }

  deleteImage(storageKey?: string | null) {
    return this.storage.delete(storageKey);
  }

  private validateUpload(file?: ObjectStorageFile) {
    if (!file) {
      throw new BadRequestException("Anexe uma imagem em JPG, PNG ou WEBP.");
    }

    if (!file.buffer?.length) {
      throw new BadRequestException("Imagem vazia.");
    }

    if (file.size > IMAGE_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("Imagem maior que 3 MB.");
    }

    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        "Tipo de imagem nao permitido. Envie JPG, PNG ou WEBP."
      );
    }
  }

  private detectMimeType(buffer: Buffer) {
    if (
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff
    ) {
      return "image/jpeg";
    }

    if (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return "image/png";
    }

    if (
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP"
    ) {
      return "image/webp";
    }

    return null;
  }

  private sanitizeFileName(fileName: string) {
    const safeBaseName = basename(fileName || "imagem")
      .replace(/[^\w.\- ]+/g, "")
      .trim();
    const extension = extname(safeBaseName);
    const nameWithoutExtension = safeBaseName.slice(
      0,
      safeBaseName.length - extension.length
    );
    const truncatedName = (nameWithoutExtension || "imagem").slice(0, 80);

    return `${truncatedName}${extension}`.trim();
  }
}
