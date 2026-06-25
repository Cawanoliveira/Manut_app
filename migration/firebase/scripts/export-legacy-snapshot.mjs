import path from "node:path";
import { google } from "googleapis";
import { LEGACY_APPS_SCRIPT_ID, LEGACY_SHEETS, LEGACY_SPREADSHEET_ID } from "./schema.mjs";
import { ensureDir, getEnv, timestampTag, toBoolean, writeJson } from "./shared.mjs";

function columnLetter(columnIndex) {
  let value = columnIndex;
  let result = "";
  while (value > 0) {
    const modulo = (value - 1) % 26;
    result = String.fromCharCode(65 + modulo) + result;
    value = Math.floor((value - modulo) / 26);
  }
  return result;
}

function mapRows(headers, rows) {
  return rows
    .filter((row) => row.some((cell) => String(cell === undefined || cell === null ? "" : cell).trim() !== ""))
    .map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        record[header] = row[index] ?? "";
      });
      return record;
    });
}

async function readSheet(sheetsApi, spreadsheetId, sheetName, headers) {
  const range = `${sheetName}!A2:${columnLetter(headers.length)}`;
  const response = await sheetsApi.spreadsheets.values.get({
    spreadsheetId,
    range,
    majorDimension: "ROWS"
  });
  return mapRows(headers, response.data.values || []);
}

async function describeDriveFile(driveApi, fileId, context) {
  try {
    const response = await driveApi.files.get({
      fileId,
      fields: "id,name,mimeType,size,md5Checksum,createdTime,modifiedTime,webViewLink,webContentLink,trashed"
    });
    return {
      ...response.data,
      context
    };
  } catch (error) {
    return {
      id: fileId,
      context,
      error: error.message || String(error)
    };
  }
}

async function buildAssetInventory(driveApi, data) {
  const assets = [];
  const seen = new Set();

  for (const pendencia of data.PENDENCIAS || []) {
    const fileId = String(pendencia.id_arquivo_drive || "").trim();
    if (!fileId || seen.has(fileId)) {
      continue;
    }
    seen.add(fileId);
    assets.push(await describeDriveFile(driveApi, fileId, {
      type: "pendencia_foto",
      id_pendencia: pendencia.id_pendencia
    }));
  }

  for (const orcamento of data.ORCAMENTOS || []) {
    const fileId = String(orcamento.pdf_file_id || "").trim();
    if (!fileId || seen.has(fileId)) {
      continue;
    }
    seen.add(fileId);
    assets.push(await describeDriveFile(driveApi, fileId, {
      type: "orcamento_pdf",
      id_orcamento: orcamento.id_orcamento
    }));
  }

  return assets;
}

async function main() {
  const spreadsheetId = getEnv("LEGACY_SPREADSHEET_ID", LEGACY_SPREADSHEET_ID);
  const includeLogs = toBoolean(getEnv("EXPORT_INCLUDE_LOGS", "false"));
  const includeDriveMetadata = toBoolean(getEnv("EXPORT_INCLUDE_DRIVE_METADATA", "true"));
  const outputFile = path.resolve(process.cwd(), getEnv("EXPORT_OUTPUT_FILE", `./output/legacy-snapshot-${timestampTag()}.json`));

  const auth = new google.auth.GoogleAuth({
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  });
  const client = await auth.getClient();
  const sheetsApi = google.sheets({ version: "v4", auth: client });
  const driveApi = google.drive({ version: "v3", auth: client });

  const data = {};
  for (const [sheetName, headers] of Object.entries(LEGACY_SHEETS)) {
    if (!includeLogs && sheetName === "LOGS") {
      continue;
    }
    data[sheetName] = await readSheet(sheetsApi, spreadsheetId, sheetName, headers);
  }

  const snapshot = {
    metadata: {
      exported_at: new Date().toISOString(),
      source: {
        spreadsheet_id: spreadsheetId,
        apps_script_id: getEnv("LEGACY_APPS_SCRIPT_ID", LEGACY_APPS_SCRIPT_ID)
      },
      counts: Object.fromEntries(Object.entries(data).map(([sheetName, rows]) => [sheetName, rows.length]))
    },
    data
  };

  if (includeDriveMetadata) {
    snapshot.assets = await buildAssetInventory(driveApi, data);
    snapshot.metadata.asset_count = snapshot.assets.length;
  }

  ensureDir(path.dirname(outputFile));
  writeJson(outputFile, snapshot);

  console.log(`Snapshot exportado com sucesso em: ${outputFile}`);
  console.log(JSON.stringify(snapshot.metadata, null, 2));
}

main().catch((error) => {
  console.error("Falha ao exportar o snapshot legado.");
  console.error(error);
  process.exitCode = 1;
});

