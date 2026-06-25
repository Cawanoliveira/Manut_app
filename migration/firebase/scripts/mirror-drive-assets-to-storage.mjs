import fs from "node:fs";
import path from "node:path";
import admin from "firebase-admin";
import { google } from "googleapis";
import { getEnv, readJson, requireEnv, timestampTag, toBoolean, writeJson } from "./shared.mjs";

function buildDestinationPath(asset) {
  const name = String(asset.name || asset.id || "arquivo").replace(/[^\w.-]+/g, "_");
  if (asset.context?.type === "pendencia_foto") {
    return `legacy/pendencias/${asset.context.id_pendencia}/foto/${asset.id}-${name}`;
  }
  if (asset.context?.type === "orcamento_pdf") {
    return `legacy/orcamentos/${asset.context.id_orcamento}/pdf/${asset.id}-${name}`;
  }
  return `legacy/outros/${asset.id}-${name}`;
}

async function downloadDriveFile(driveApi, fileId) {
  const response = await driveApi.files.get(
    { fileId, alt: "media" },
    { responseType: "arraybuffer" }
  );
  return Buffer.from(response.data);
}

async function main() {
  const snapshotFile = requireEnv("ASSET_MIRROR_SNAPSHOT_FILE");
  const projectId = requireEnv("FIREBASE_PROJECT_ID");
  const bucketName = requireEnv("FIREBASE_STORAGE_BUCKET");
  const dryRun = toBoolean(getEnv("ASSET_MIRROR_DRY_RUN", "true"));
  const overwrite = toBoolean(getEnv("ASSET_MIRROR_OVERWRITE", "false"));

  const snapshot = readJson(snapshotFile);
  const assets = Array.isArray(snapshot.assets) ? snapshot.assets.filter((asset) => asset && asset.id && !asset.error) : [];

  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId,
    storageBucket: bucketName
  });

  const bucket = admin.storage().bucket(bucketName);
  const auth = new google.auth.GoogleAuth({
    scopes: ["https://www.googleapis.com/auth/drive.readonly"]
  });
  const client = await auth.getClient();
  const driveApi = google.drive({ version: "v3", auth: client });

  const manifest = [];
  for (const asset of assets) {
    const destinationPath = buildDestinationPath(asset);
    if (dryRun) {
      manifest.push({
        drive_file_id: asset.id,
        destination_path: destinationPath,
        mode: "dry-run"
      });
      continue;
    }

    const targetFile = bucket.file(destinationPath);
    const [exists] = await targetFile.exists();
    if (exists && !overwrite) {
      manifest.push({
        drive_file_id: asset.id,
        destination_path: destinationPath,
        skipped: "exists"
      });
      continue;
    }

    const buffer = await downloadDriveFile(driveApi, asset.id);
    await targetFile.save(buffer, {
      resumable: false,
      contentType: asset.mimeType || "application/octet-stream",
      metadata: {
        metadata: {
          legacyDriveFileId: asset.id,
          legacySourceType: asset.context?.type || "unknown"
        }
      }
    });

    manifest.push({
      drive_file_id: asset.id,
      destination_path: destinationPath,
      size: buffer.length,
      uploaded: true
    });
  }

  const manifestFile = path.resolve(process.cwd(), `./output/storage-mirror-manifest-${timestampTag()}.json`);
  writeJson(manifestFile, {
    generated_at: new Date().toISOString(),
    dry_run: dryRun,
    overwrite,
    total_assets: assets.length,
    items: manifest
  });

  console.log(`Espelhamento concluido. Manifesto salvo em: ${manifestFile}`);
}

main().catch((error) => {
  console.error("Falha ao espelhar arquivos do Drive para o Storage.");
  console.error(error);
  process.exitCode = 1;
});

