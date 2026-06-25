import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const migrationRoot = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(migrationRoot, ".env") });

export function getEnv(name, fallback = "") {
  const value = process.env[name];
  return value === undefined ? fallback : String(value).trim();
}

export function requireEnv(name) {
  const value = getEnv(name);
  if (!value) {
    throw new Error(`Variavel obrigatoria ausente: ${name}`);
  }
  return value;
}

export function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function writeJson(filePath, data) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

export function timestampTag() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "-",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
}

export function toBoolean(value, defaultValue = false) {
  const text = String(value === undefined || value === null ? "" : value).trim().toLowerCase();
  if (!text) {
    return defaultValue;
  }
  return ["1", "true", "sim", "yes", "y"].includes(text);
}

export function chunkArray(items, chunkSize) {
  const chunks = [];
  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }
  return chunks;
}

export function compactObject(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function safeDocId(value, fallbackPrefix = "legacy") {
  const raw = String(value === undefined || value === null ? "" : value).trim();
  if (raw) {
    return raw.replace(/\//g, "_");
  }
  return `${fallbackPrefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function normalizeText(value) {
  return String(value === undefined || value === null ? "" : value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

export function parseLegacyDate(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const text = String(value).trim();
  if (!text || text === "-") {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  const brDateTimeMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (brDateTimeMatch) {
    const day = Number(brDateTimeMatch[1]);
    const month = Number(brDateTimeMatch[2]) - 1;
    const year = Number(brDateTimeMatch[3]);
    const hours = Number(brDateTimeMatch[4] || 0);
    const minutes = Number(brDateTimeMatch[5] || 0);
    const seconds = Number(brDateTimeMatch[6] || 0);
    return new Date(year, month, day, hours, minutes, seconds);
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function dateToIso(value) {
  const parsed = parseLegacyDate(value);
  return parsed ? parsed.toISOString() : null;
}

export function parseCurrency(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  let text = String(value).trim();
  if (!text || text === "-") {
    return null;
  }
  text = text.replace(/[R$\s]/g, "");
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

