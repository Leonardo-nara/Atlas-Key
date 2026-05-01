import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException
} from "@nestjs/common";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException
} from "@aws-sdk/client-s3";
import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";

export const PAYMENT_PROOF_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type PaymentProofStorageDriverName = "local" | "s3";

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
  stream: Readable;
  fileName: string;
  mimeType: string;
  size: number;
}

interface PaymentProofStorageDriver {
  save(storageKey: string, file: UploadedPaymentProofFile): Promise<void>;
  read(storageKey: string, metadata: PaymentProofFileMetadata): Promise<PaymentProofFileReadResult>;
  delete(storageKey: string): Promise<void>;
}

interface PaymentProofFileMetadata {
  fileName: string;
  mimeType: string;
  size: number;
}

@Injectable()
export class PaymentProofStorageService {
  private readonly driver: PaymentProofStorageDriver;

  constructor() {
    const driverName = this.resolveDriverName();
    this.driver =
      driverName === "s3"
        ? new S3PaymentProofStorageDriver()
        : new LocalPaymentProofStorageDriver();
  }

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

    await this.driver.save(storageKey, file);

    return {
      storageKey,
      originalFileName,
      mimeType: detectedMimeType,
      size: file.size
    };
  }

  getProofFile(storageKey: string, metadata: PaymentProofFileMetadata) {
    return this.driver.read(storageKey, metadata);
  }

  async deleteProofFile(storageKey?: string | null) {
    if (!storageKey) {
      return;
    }

    try {
      await this.driver.delete(storageKey);
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

  private resolveDriverName(): PaymentProofStorageDriverName {
    const driver = process.env.PAYMENT_PROOF_STORAGE_DRIVER?.trim().toLowerCase();

    if (!driver || driver === "local") {
      return "local";
    }

    if (driver === "s3") {
      return "s3";
    }

    throw new InternalServerErrorException(
      "Storage de comprovantes invalido. Use local ou s3."
    );
  }
}

class LocalPaymentProofStorageDriver implements PaymentProofStorageDriver {
  private readonly baseDirectory = resolve(
    process.env.PAYMENT_PROOF_STORAGE_DIR ??
      join(process.cwd(), "storage", "payment-proofs")
  );

  async save(storageKey: string, file: UploadedPaymentProofFile) {
    const absolutePath = this.resolveStorageKey(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);
  }

  async read(
    storageKey: string,
    metadata: PaymentProofFileMetadata
  ): Promise<PaymentProofFileReadResult> {
    const absolutePath = this.resolveStorageKey(storageKey);

    return {
      stream: createReadStream(absolutePath),
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      size: metadata.size
    };
  }

  async delete(storageKey: string) {
    await unlink(this.resolveStorageKey(storageKey));
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

class S3PaymentProofStorageDriver implements PaymentProofStorageDriver {
  private readonly bucket = requireEnv("PAYMENT_PROOF_S3_BUCKET");
  private readonly client = new S3Client({
    endpoint: requireEnv("PAYMENT_PROOF_S3_ENDPOINT"),
    region: process.env.PAYMENT_PROOF_S3_REGION?.trim() || "auto",
    credentials: {
      accessKeyId: requireEnv("PAYMENT_PROOF_S3_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("PAYMENT_PROOF_S3_SECRET_ACCESS_KEY")
    },
    forcePathStyle: parseBoolean(process.env.PAYMENT_PROOF_S3_FORCE_PATH_STYLE)
  });

  async save(storageKey: string, file: UploadedPaymentProofFile) {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: storageKey,
          Body: file.buffer,
          ContentType: file.mimetype,
          ContentLength: file.size,
          Metadata: {
            originalName: sanitizeMetadataValue(file.originalname)
          }
        })
      );
    } catch (error) {
      throw this.toStorageException(error, "Nao foi possivel salvar o comprovante.");
    }
  }

  async read(
    storageKey: string,
    metadata: PaymentProofFileMetadata
  ): Promise<PaymentProofFileReadResult> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey
        })
      );

      if (!object.Body) {
        throw new NotFoundException("Arquivo de comprovante nao encontrado.");
      }

      return {
        stream: this.toReadable(object.Body),
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        size: metadata.size
      };
    } catch (error) {
      throw this.toStorageException(error, "Nao foi possivel abrir o comprovante.");
    }
  }

  async delete(storageKey: string) {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: storageKey
      })
    );
  }

  private toReadable(body: unknown): Readable {
    if (body instanceof Readable) {
      return body;
    }

    if (
      body &&
      typeof body === "object" &&
      "transformToWebStream" in body &&
      typeof body.transformToWebStream === "function"
    ) {
      return Readable.fromWeb(body.transformToWebStream());
    }

    throw new InternalServerErrorException(
      "Resposta invalida do storage de comprovantes."
    );
  }

  private toStorageException(error: unknown, fallbackMessage: string) {
    if (error instanceof NotFoundException) {
      return error;
    }

    if (error instanceof NoSuchKey) {
      return new NotFoundException("Arquivo de comprovante nao encontrado.");
    }

    if (
      error instanceof S3ServiceException &&
      (error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
    ) {
      return new NotFoundException("Arquivo de comprovante nao encontrado.");
    }

    if (error instanceof InternalServerErrorException) {
      return error;
    }

    return new InternalServerErrorException(fallbackMessage);
  }
}

function requireEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new InternalServerErrorException(
      `Configuracao de storage ausente: ${name}.`
    );
  }

  return value;
}

function parseBoolean(value?: string) {
  return ["1", "true", "yes", "sim"].includes(value?.trim().toLowerCase() ?? "");
}

function sanitizeMetadataValue(value: string) {
  return value.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "comprovante";
}
