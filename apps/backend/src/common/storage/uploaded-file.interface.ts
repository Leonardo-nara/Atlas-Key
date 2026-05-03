export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface StreamResponse {
  setHeader(name: string, value: string): void;
}
