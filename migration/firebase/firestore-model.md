# Modelo de Dados Firebase

## Colecoes principais

### `configs/{chave}`

Campos principais:
- `chave`
- `valor`
- `descricao`
- `_import`

### `lojas/{id_loja}`

Campos principais:
- `id_loja`
- `nome_loja`
- `cidade`
- `status`
- `data_cadastro`
- `data_cadastro_ts`

### `setores/{id_setor}`

Campos principais:
- `id_setor`
- `nome_setor`
- `status`
- `data_cadastro`
- `data_cadastro_ts`

### `usuarios/{id_usuario}`

Campos principais:
- `id_usuario`
- `nome`
- `email`
- `perfil`
- `status`
- `data_cadastro`
- `data_cadastro_ts`

### `prestadores/{id_prestador}`

Campos principais:
- `id_prestador`
- `nome_prestador`
- `status`
- `data_cadastro`
- `data_cadastro_ts`

### `pendencias/{id_pendencia}`

Campos principais:
- Todos os campos atuais da aba `PENDENCIAS`
- Campos auxiliares:
  - `data_abertura_ts`
  - `data_inicio_ts`
  - `previsao_entrega_ts`
  - `data_conclusao_ts`
  - `status_normalized`
  - `prioridade_normalized`
  - `tipo_normalized`
  - `_assetRefs`
  - `_import`

Subcolecao:
- `pendencias/{id_pendencia}/historico/{id_historico}`

### `orcamentos/{id_orcamento}`

Campos principais:
- Todos os campos atuais da aba `ORCAMENTOS`
- Campos auxiliares:
  - `data_orcamento_ts`
  - `data_criacao_ts`
  - `_assetRefs`
  - `_import`

Subcolecao:
- `orcamentos/{id_orcamento}/itens/{id_orcamento_item}`

### `migration_runs/{run_id}`

Campos principais:
- `run_id`
- `snapshot_file`
- `imported_at`
- `counts`
- `project_id`
- `notes`

## Arquivos

### Fotos de pendencias

Destino sugerido:

`legacy/pendencias/{id_pendencia}/foto/{drive_file_id}-{nome}`

### PDFs de orcamentos

Destino sugerido:

`legacy/orcamentos/{id_orcamento}/pdf/{drive_file_id}-{nome}`

## Campos mantidos para compatibilidade

Para reduzir risco na migracao de frontend, o importador preserva os nomes legados sempre que possivel.

Exemplos:
- `previsao_entrega`
- `id_arquivo_drive`
- `id_orcamento_ativo`
- `pdf_file_id`
- `pdf_file_url`

## Observacoes de modelagem

- `DASHBOARD_BASE` nao deve ser tratada como fonte de verdade no Firebase.
- Os dashboards devem ser derivados das pendencias e orcamentos.
- `LOGS` pode ser importada opcionalmente, mas a observabilidade principal deve migrar para Cloud Logging.

