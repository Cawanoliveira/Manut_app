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

## Pre-requisitos

1. Criar o projeto Firebase na conta Google `biggestao`.
2. Ativar:
   - Firebase Authentication
   - Cloud Firestore
   - Cloud Storage for Firebase
   - Firebase Hosting
   - Cloud Functions for Firebase
3. Colocar o projeto no plano Blaze.
4. Gerar uma credencial de acesso:
   - Recomendado: service account para a automacao
   - Alternativa: Application Default Credentials local

## Fluxo recomendado

1. Copiar `.env.example` para `.env`
2. Ajustar `FIREBASE_PROJECT_ID` e `FIREBASE_STORAGE_BUCKET`
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

