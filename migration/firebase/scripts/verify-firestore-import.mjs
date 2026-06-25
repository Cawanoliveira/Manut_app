import admin from "firebase-admin";
import { readJson, requireEnv } from "./shared.mjs";

async function countDocs(collectionRef) {
  const snapshot = await collectionRef.count().get();
  return snapshot.data().count || 0;
}

async function main() {
  const snapshotFile = requireEnv("IMPORT_SNAPSHOT_FILE");
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const snapshot = readJson(snapshotFile);
  const data = snapshot.data || {};

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId
  });

  const db = admin.firestore();

  const expected = {
    configs: (data.CONFIG || []).length,
    lojas: (data.LOJAS || []).length,
    setores: (data.SETORES || []).length,
    usuarios: (data.USUARIOS || []).length,
    prestadores: (data.PRESTADORES || []).length,
    pendencias: (data.PENDENCIAS || []).length,
    orcamentos: (data.ORCAMENTOS || []).length,
    logs_legacy: (data.LOGS || []).length
  };

  const actual = {
    configs: await countDocs(db.collection("configs")),
    lojas: await countDocs(db.collection("lojas")),
    setores: await countDocs(db.collection("setores")),
    usuarios: await countDocs(db.collection("usuarios")),
    prestadores: await countDocs(db.collection("prestadores")),
    pendencias: await countDocs(db.collection("pendencias")),
    orcamentos: await countDocs(db.collection("orcamentos")),
    logs_legacy: await countDocs(db.collection("logs_legacy"))
  };

  console.log("Comparacao de contagens:");
  console.log(JSON.stringify({ expected, actual }, null, 2));
}

main().catch((error) => {
  console.error("Falha ao verificar a importacao.");
  console.error(error);
  process.exitCode = 1;
});
