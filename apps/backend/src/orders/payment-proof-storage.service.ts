import {
  BadRequestException,
  Injectable,
  InternalServerErrorException
} from "@nestjs/common";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";

export const PAYMENT_PROOF_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf"
]);

const EXTENSIONS_BY_MIME_TYPE: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf"
};

export interface UploadedPaymentProofFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StoredPaymentProofFile {
  storageKey: string;
  originalFileName: string;
  mimeType: string;
  size: number;
}

export interface PaymentProofFileReadResult {
  stream: ReturnType<typeof createReadStream>;
  fileName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class PaymentProofStorageService {
  private readonly baseDirectory = resolve(
    process.env.PAYMENT_PROOF_STORAGE_DIR ??
      join(process.cwd(), "storage", "payment-proofs")
  );

  async saveProofFile(
    orderId: string,
    file: UploadedPaymentProofFile
  ): Promise<StoredPaymentProofFile> {
    this.validateUpload(file);

    const detectedMimeType = this.detectMimeType(file.buffer);

    if (!detectedMimeType || detectedMimeType !== file.mimetype) {
      throw new BadRequestException(
        "Arquivo invalido. Envie JPG, PNG, WEBP ou PDF valido."
      );
    }

    const originalFileName = this.sanitizeFileName(file.originalname);
    const storageKey = `${orderId}/${randomUUID()}${EXTENSIONS_BY_MIME_TYPE[detectedMimeType]}`;
    const absolutePath = this.resolveStorageKey(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);

    return {
      storageKey,
      originalFileName,
      mimeType: detectedMimeType,
      size: file.size
    };
  }

  getProofFile(
    storageKey: string,
    metadata: {
      fileName: string;
      mimeType: string;
      size: number;
    }
  ): PaymentProofFileReadResult {
    const absolutePath = this.resolveStorageKey(storageKey);

    return {
      stream: createReadStream(absolutePath),
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      size: metadata.size
    };
  }

  async deleteProofFile(storageKey?: string | null) {
    if (!storageKey) {
      return;
    }

    try {
      await unlink(this.resolveStorageKey(storageKey));
    } catch {
      // A ausencia do arquivo antigo nao deve impedir a atualizacao do comprovante.
    }
  }

  private validateUpload(file?: UploadedPaymentProofFile) {
    if (!file) {
      throw new BadRequestException("Anexe um comprovante em JPG, PNG, WEBP ou PDF.");
    }

    if (!file.buffer?.length) {
      throw new BadRequestException("Arquivo de comprovante vazio.");
    }

    if (file.size > PAYMENT_PROOF_MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException("Comprovante maior que 5 MB.");
    }

    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        "Tipo de arquivo nao permitido. Envie JPG, PNG, WEBP ou PDF."
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

    if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
      return "application/pdf";
    }

    return null;
  }

  private sanitizeFileName(fileName: string) {
    const safeBaseName = basename(fileName || "comprovante")
      .replace(/[^\w.\- ]+/g, "")
      .trim();
    const extension = extname(safeBaseName);
    const nameWithoutExtension = safeBaseName.slice(
      0,
      safeBaseName.length - extension.length
    );
    const truncatedName = (nameWithoutExtension || "comprovante").slice(0, 80);

    return `${truncatedName}${extension}`.trim();
  }

  private resolveStorageKey(storageKey: string) {
    const absolutePath = resolve(this.baseDirectory, storageKey);

    if (
      !absolutePath.startsWith(`${this.baseDirectory}${sep}`) &&
      absolutePath !== this.baseDirectory
    ) {
      throw new InternalServerErrorException("Caminho de comprovante invalido.");
    }

    return absolutePath;
  }
}
