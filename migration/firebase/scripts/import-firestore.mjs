import admin from "firebase-admin";
import { FIRESTORE_TARGETS, DATE_ONLY_FIELDS, DATETIME_FIELDS } from "./schema.mjs";
import { chunkArray, compactObject, dateToIso, getEnv, normalizeText, parseCurrency, readJson, requireEnv, safeDocId } from "./shared.mjs";

function buildImportMeta() {
  return {
    imported_at: new Date().toISOString(),
    source: "legacy-sheet"
  };
}

function withAuxiliaryFields(record) {
  const output = { ...record };
  for (const [key, value] of Object.entries(record)) {
    if (DATE_ONLY_FIELDS.has(key) || DATETIME_FIELDS.has(key) || key.includes("previsao")) {
      const iso = dateToIso(value);
      if (iso) {
        output[`${key}_iso`] = iso;
      }
    }
    if (key.includes("valor")) {
      const parsed = parseCurrency(value);
      if (parsed !== null) {
        output[`${key}_number`] = parsed;
      }
    }
  }
  if (record.status) {
    output.status_normalized = normalizeText(record.status);
  }
  if (record.prioridade) {
    output.prioridade_normalized = normalizeText(record.prioridade);
  }
  if (record.tipo) {
    output.tipo_normalized = normalizeText(record.tipo);
  }
  output._import = buildImportMeta();
  return output;
}

async function commitSetMany(db, operations, mergeMode) {
  const chunks = chunkArray(operations, 400);
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const operation of chunk) {
      batch.set(operation.ref, operation.data, { merge: mergeMode });
    }
    await batch.commit();
  }
}

async function importTopLevelCollection(db, rows, config, summary, include = true) {
  if (!include || !config || !rows) {
    return;
  }
  const operations = rows.map((row) => {
    const docId = safeDocId(row[config.idField], config.collection);
    return {
      ref: db.collection(config.collection).doc(docId),
      data: withAuxiliaryFields(row)
    };
  });
  await commitSetMany(db, operations, true);
  summary[config.collection] = operations.length;
}

async function importHistorico(db, rows, summary) {
  const operations = (rows || []).map((row) => {
    const pendenciaId = safeDocId(row.id_pendencia, "pendencia");
    const historicoId = safeDocId(row.id_historico, "historico");
    return {
      ref: db.collection("pendencias").doc(pendenciaId).collection("historico").doc(historicoId),
      data: withAuxiliaryFields(row)
    };
  });
  await commitSetMany(db, operations, true);
  summary["pendencias.historico"] = operations.length;
}

async function importOrcamentoItens(db, rows, summary) {
  const operations = (rows || []).map((row) => {
    const orcamentoId = safeDocId(row.id_orcamento, "orcamento");
    const itemId = safeDocId(row.id_orcamento_item, "item");
    return {
      ref: db.collection("orcamentos").doc(orcamentoId).collection("itens").doc(itemId),
      data: withAuxiliaryFields(row)
    };
  });
  await commitSetMany(db, operations, true);
  summary["orcamentos.itens"] = operations.length;
}

async function registerRun(db, snapshotFile, summary, projectId) {
  const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await db.collection("migration_runs").doc(runId).set({
    run_id: runId,
    snapshot_file: snapshotFile,
    imported_at: new Date().toISOString(),
    project_id: projectId,
    counts: summary
  });
}

async function main() {
  const snapshotFile = requireEnv("IMPORT_SNAPSHOT_FILE");
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const includeLogs = getEnv("IMPORT_INCLUDE_LOGS", "false") === "true";

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId
  });

  const db = admin.firestore();
  const snapshot = readJson(snapshotFile);
  const data = snapshot.data || {};
  const summary = {};

  await importTopLevelCollection(db, data.CONFIG, FIRESTORE_TARGETS.CONFIG, summary);
  await importTopLevelCollection(db, data.LOJAS, FIRESTORE_TARGETS.LOJAS, summary);
  await importTopLevelCollection(db, data.SETORES, FIRESTORE_TARGETS.SETORES, summary);
  await importTopLevelCollection(db, data.USUARIOS, FIRESTORE_TARGETS.USUARIOS, summary);
  await importTopLevelCollection(db, data.PRESTADORES, FIRESTORE_TARGETS.PRESTADORES, summary);
  await importTopLevelCollection(db, data.PENDENCIAS, FIRESTORE_TARGETS.PENDENCIAS, summary);
  await importTopLevelCollection(db, data.ORCAMENTOS, FIRESTORE_TARGETS.ORCAMENTOS, summary);
  await importHistorico(db, data.HISTORICO_STATUS, summary);
  await importOrcamentoItens(db, data.ORCAMENTO_ITENS, summary);
  await importTopLevelCollection(db, data.LOGS, FIRESTORE_TARGETS.LOGS, summary, includeLogs);

  await registerRun(db, snapshotFile, compactObject(summary), projectId);

  console.log("Importacao para Firestore concluida.");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error("Falha ao importar dados para o Firestore.");
  console.error(error);
  process.exitCode = 1;
});

