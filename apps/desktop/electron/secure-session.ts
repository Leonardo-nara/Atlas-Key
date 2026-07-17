import { app, ipcMain, safeStorage } from "electron";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

const SESSION_FILE_NAME = "mototake-secure-session.bin";
const MAX_TOKEN_LENGTH = 8_192;

function getSessionFilePath() {
  return path.join(app.getPath("userData"), SESSION_FILE_NAME);
}

function isValidToken(value: unknown) {
  return (
    typeof value === "string" &&
    value.length > 10 &&
    value.length <= MAX_TOKEN_LENGTH
  );
}

function parseTokens(value: unknown): StoredTokens | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<StoredTokens>;
  const { accessToken, refreshToken } = candidate;

  if (
    typeof accessToken !== "string" ||
    typeof refreshToken !== "string" ||
    !isValidToken(accessToken) ||
    !isValidToken(refreshToken)
  ) {
    return null;
  }

  return {
    accessToken,
    refreshToken
  };
}

async function readStoredTokens() {
  if (!safeStorage.isEncryptionAvailable()) {
    return null;
  }

  try {
    const encrypted = await readFile(getSessionFilePath(), "utf8");
    const decrypted = safeStorage.decryptString(Buffer.from(encrypted, "base64"));
    return parseTokens(JSON.parse(decrypted));
  } catch {
    return null;
  }
}

async function writeStoredTokens(tokens: StoredTokens) {
  if (!safeStorage.isEncryptionAvailable()) {
    return false;
  }

  const validTokens = parseTokens(tokens);

  if (!validTokens) {
    return false;
  }

  const encrypted = safeStorage.encryptString(JSON.stringify(validTokens));
  const sessionFile = getSessionFilePath();
  await mkdir(path.dirname(sessionFile), { recursive: true });
  await writeFile(sessionFile, encrypted.toString("base64"), "utf8");
  return true;
}

async function clearStoredTokens() {
  await rm(getSessionFilePath(), { force: true });
  return true;
}

export function registerSecureSessionIpc() {
  ipcMain.handle("secure-session:get", () => readStoredTokens());
  ipcMain.handle("secure-session:set", (_event, tokens: StoredTokens) =>
    writeStoredTokens(tokens)
  );
  ipcMain.handle("secure-session:clear", () => clearStoredTokens());
}
