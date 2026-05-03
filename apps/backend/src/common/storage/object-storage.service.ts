import {
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
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";

type ObjectStorageDriverName = "local" | "s3";

export interface StoredObjectMetadata {
  fileName: string;
  mimeType: string;
  size: number;
}

export interface StoredObjectReadResult extends StoredObjectMetadata {
  stream: Readable;
}

export interface ObjectStorageFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

interface ObjectStorageDriver {
  save(storageKey: string, file: ObjectStorageFile): Promise<void>;
  read(storageKey: string, metadata: StoredObjectMetadata): Promise<StoredObjectReadResult>;
  delete(storageKey: string): Promise<void>;
}

export class ObjectStorageService {
  private readonly driver: ObjectStorageDriver;

  constructor(options: {
    namespace: string;
    driverEnvPrefix?: string;
    fallbackEnvPrefix?: string;
    defaultLocalDirectory: string;
  }) {
    const driverName = resolveDriverName(
      options.driverEnvPrefix,
      options.fallbackEnvPrefix,
      options.namespace
    );
    this.driver =
      driverName === "s3"
        ? new S3ObjectStorageDriver(options.driverEnvPrefix, options.fallbackEnvPrefix)
        : new LocalObjectStorageDriver(
            options.driverEnvPrefix,
            options.fallbackEnvPrefix,
            options.defaultLocalDirectory
          );
  }

  save(storageKey: string, file: ObjectStorageFile) {
    return this.driver.save(storageKey, file);
  }

  read(storageKey: string, metadata: StoredObjectMetadata) {
    return this.driver.read(storageKey, metadata);
  }

  async delete(storageKey?: string | null) {
    if (!storageKey) {
      return;
    }

    try {
      await this.driver.delete(storageKey);
    } catch {
      // Arquivo ausente no storage nao deve bloquear atualizacao de metadados.
    }
  }
}

class LocalObjectStorageDriver implements ObjectStorageDriver {
  private readonly baseDirectory: string;

  constructor(
    driverEnvPrefix: string | undefined,
    fallbackEnvPrefix: string | undefined,
    defaultLocalDirectory: string
  ) {
    this.baseDirectory = resolve(
      readEnv(driverEnvPrefix, "STORAGE_DIR") ??
        readEnv(fallbackEnvPrefix, "STORAGE_DIR") ??
        defaultLocalDirectory
    );
  }

  async save(storageKey: string, file: ObjectStorageFile) {
    const absolutePath = this.resolveStorageKey(storageKey);

    await mkdir(dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer);
  }

  async read(
    storageKey: string,
    metadata: StoredObjectMetadata
  ): Promise<StoredObjectReadResult> {
    const absolutePath = this.resolveStorageKey(storageKey);

    return {
      stream: createReadStream(absolutePath),
      ...metadata
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
      throw new InternalServerErrorException("Caminho de storage invalido.");
    }

    return absolutePath;
  }
}

class S3ObjectStorageDriver implements ObjectStorageDriver {
  private readonly bucket: string;
  private readonly client: S3Client;

  constructor(driverEnvPrefix?: string, fallbackEnvPrefix?: string) {
    this.bucket = requireStorageEnv(driverEnvPrefix, fallbackEnvPrefix, "S3_BUCKET");
    this.client = new S3Client({
      endpoint: requireStorageEnv(driverEnvPrefix, fallbackEnvPrefix, "S3_ENDPOINT"),
      region:
        readEnv(driverEnvPrefix, "S3_REGION") ??
        readEnv(fallbackEnvPrefix, "S3_REGION") ??
        "auto",
      credentials: {
        accessKeyId: requireStorageEnv(
          driverEnvPrefix,
          fallbackEnvPrefix,
          "S3_ACCESS_KEY_ID"
        ),
        secretAccessKey: requireStorageEnv(
          driverEnvPrefix,
          fallbackEnvPrefix,
          "S3_SECRET_ACCESS_KEY"
        )
      },
      forcePathStyle: parseBoolean(
        readEnv(driverEnvPrefix, "S3_FORCE_PATH_STYLE") ??
          readEnv(fallbackEnvPrefix, "S3_FORCE_PATH_STYLE")
      )
    });
  }

  async save(storageKey: string, file: ObjectStorageFile) {
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
      throw toStorageException(error, "Nao foi possivel salvar o arquivo.");
    }
  }

  async read(
    storageKey: string,
    metadata: StoredObjectMetadata
  ): Promise<StoredObjectReadResult> {
    try {
      const object = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: storageKey
        })
      );

      if (!object.Body) {
        throw new NotFoundException("Arquivo nao encontrado.");
      }

      return {
        stream: toReadable(object.Body),
        ...metadata
      };
    } catch (error) {
      throw toStorageException(error, "Nao foi possivel abrir o arquivo.");
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
}

function resolveDriverName(
  driverEnvPrefix: string | undefined,
  fallbackEnvPrefix: string | undefined,
  namespace: string
): ObjectStorageDriverName {
  const driver = (
    readEnv(driverEnvPrefix, "STORAGE_DRIVER") ??
    readEnv(fallbackEnvPrefix, "STORAGE_DRIVER") ??
    "local"
  )
    .trim()
    .toLowerCase();

  if (driver === "local" || driver === "s3") {
    return driver;
  }

  throw new InternalServerErrorException(
    `Storage de ${namespace} invalido. Use local ou s3.`
  );
}

function requireStorageEnv(
  driverEnvPrefix: string | undefined,
  fallbackEnvPrefix: string | undefined,
  suffix: string
) {
  const value = readEnv(driverEnvPrefix, suffix) ?? readEnv(fallbackEnvPrefix, suffix);

  if (!value) {
    throw new InternalServerErrorException(
      `Configuracao de storage ausente: ${driverEnvPrefix}_${suffix}.`
    );
  }

  return value;
}

function readEnv(prefix: string | undefined, suffix: string) {
  if (!prefix) {
    return undefined;
  }

  const value = process.env[`${prefix}_${suffix}`]?.trim();
  return value || undefined;
}

function parseBoolean(value?: string) {
  return ["1", "true", "yes", "sim"].includes(value?.trim().toLowerCase() ?? "");
}

function sanitizeMetadataValue(value: string) {
  return value.replace(/[^\w.\- ]+/g, "").slice(0, 120) || "arquivo";
}

function toReadable(body: unknown): Readable {
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

  throw new InternalServerErrorException("Resposta invalida do storage.");
}

function toStorageException(error: unknown, fallbackMessage: string) {
  if (error instanceof NotFoundException) {
    return error;
  }

  if (error instanceof NoSuchKey) {
    return new NotFoundException("Arquivo nao encontrado.");
  }

  if (
    error instanceof S3ServiceException &&
    (error.name === "NoSuchKey" || error.$metadata.httpStatusCode === 404)
  ) {
    return new NotFoundException("Arquivo nao encontrado.");
  }

  if (error instanceof InternalServerErrorException) {
    return error;
  }

  return new InternalServerErrorException(fallbackMessage);
}

export function buildDefaultStorageDirectory(name: string) {
  return join(process.cwd(), "storage", name);
}
