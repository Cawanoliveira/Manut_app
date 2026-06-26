import admin from "firebase-admin";
import fs from "node:fs";
import process from "node:process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const projectId = process.env.FIREBASE_PROJECT_ID;
const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS;
const targetEmail = (process.argv[2] || process.env.FIREBASE_ALLOWLIST_EMAIL || "").trim();
const displayName = (process.argv[3] || process.env.FIREBASE_ALLOWLIST_NAME || "Administrador").trim();

if (!projectId) {
  throw new Error("FIREBASE_PROJECT_ID nao configurado.");
}

if (!serviceAccountPath) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH nao configurado.");
}

if (!targetEmail) {
  throw new Error("Informe o email permitido como primeiro argumento.");
}

const serviceAccount = JSON.parse(fs.readFileSync(path.resolve(serviceAccountPath), "utf8"));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId
  });
}

const db = admin.firestore();
const normalizedEmail = targetEmail;
const now = new Date().toISOString();

await db.collection("auth_allowlist").doc(normalizedEmail).set({
  email: normalizedEmail,
  nome: displayName,
  role: "admin",
  status: "Ativo",
  created_at: now,
  updated_at: now,
  source: "migration-script"
}, { merge: true });

console.log(`Allowlist atualizada para ${normalizedEmail}.`);
