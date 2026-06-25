# Migracao para Firebase

Esta pasta concentra a fase segura da migracao do sistema atual, hoje baseado em Google Sheets, Apps Script e Drive, para Firebase.

## Objetivo

Criar uma copia funcional do sistema em Firebase sem tocar na base oficial atual ate o momento da virada.

## Escopo desta fase

1. Exportar os dados atuais da planilha para um snapshot em JSON.
2. Importar esse snapshot para Cloud Firestore.
3. Espelhar fotos e PDFs do Drive para Cloud Storage for Firebase.
4. Validar a consistencia da copia antes de qualquer troca de ambiente.

## Estrutura

- `scripts/export-legacy-snapshot.mjs`
  Exporta as abas do sistema e um inventario dos arquivos do Drive associados.
- `scripts/import-firestore.mjs`
  Importa o snapshot legado para as colecoes do Firestore.
- `scripts/mirror-drive-assets-to-storage.mjs`
  Copia fotos e PDFs do Drive legado para o bucket do Firebase.
- `scripts/verify-firestore-import.mjs`
  Compara contagens e amostras entre o snapshot e o Firebase.
- `scripts/schema.mjs`
  Centraliza o mapeamento entre as abas legadas e as colecoes do Firebase.

## Ambiente atual

- Projeto `dev` criado: `big-compra-firebase-dev`
- App web criado: `BIG Compra Web Dev`
- Firestore criado em `southamerica-east1`
- Service account criada: `manut-migration-runner@big-compra-firebase-dev.iam.gserviceaccount.com`
- Bucket de Storage ainda depende de billing ativo no projeto para ser criado fisicamente

## Pre-requisitos restantes

1. Ativar billing Blaze no projeto `big-compra-firebase-dev`.
2. Compartilhar a planilha oficial e os arquivos legados do Drive com a service account:
   - `manut-migration-runner@big-compra-firebase-dev.iam.gserviceaccount.com`
3. Opcional depois: criar tambem o projeto `prod`.

## Fluxo recomendado

1. Copiar `.env.example` para `.env`
2. Ajustar `FIREBASE_PROJECT_ID` e `FIREBASE_STORAGE_BUCKET` se mudar de ambiente
3. Instalar dependencias:

```bash
npm install
```

4. Exportar o snapshot legado:

```bash
npm run legacy:export
```

5. Importar para o Firestore:

```bash
npm run firebase:import
```

6. Espelhar os arquivos do Drive para o Storage:

```bash
npm run firebase:mirror-assets
```

7. Verificar o resultado:

```bash
npm run firebase:verify
```

## Importante

- O sistema atual continua sendo a fonte oficial ate a virada.
- O snapshot exportado e a primeira linha de rollback.
- A virada final deve acontecer apenas apos validacao funcional da copia Firebase.
- O espelhamento de anexos fica bloqueado ate o projeto ter billing ativo e bucket criado.
