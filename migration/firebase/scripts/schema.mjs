export const LEGACY_APPS_SCRIPT_ID = "1Y3Ot0W4vdSL0wKzPzyWAfZ8FrdG9MRuWuCmbOkoI3XEMUwuSO6SGTu4A";
export const LEGACY_SPREADSHEET_ID = "1Sv_p0Cy3jXUEfRkXtdm-p7PZQncY30AH6Mbl06M57Qk";

export const LEGACY_SHEETS = {
  CONFIG: ["chave", "valor", "descricao"],
  LOJAS: ["id_loja", "nome_loja", "cidade", "status", "data_cadastro"],
  SETORES: ["id_setor", "nome_setor", "status", "data_cadastro"],
  USUARIOS: ["id_usuario", "nome", "email", "perfil", "status", "data_cadastro"],
  PRESTADORES: ["id_prestador", "nome_prestador", "status", "data_cadastro"],
  PENDENCIAS: [
    "id_pendencia",
    "data_abertura",
    "hora_abertura",
    "loja",
    "setor",
    "tipo",
    "prioridade",
    "descricao",
    "observacao",
    "solicitante",
    "responsavel",
    "executor",
    "data_inicio",
    "previsao_entrega",
    "status",
    "data_conclusao",
    "hora_conclusao",
    "link_foto",
    "id_arquivo_drive",
    "excluir_foto_em",
    "foto_excluida",
    "id_orcamento_ativo",
    "prestador_orcamento_ativo",
    "valor_orcamento_ativo",
    "data_orcamento_ativo",
    "ultima_atualizacao",
    "atualizado_por"
  ],
  ORCAMENTOS: [
    "id_orcamento",
    "data_orcamento",
    "prestador",
    "valor_total",
    "quantidade_pendencias",
    "observacao",
    "status",
    "pdf_file_id",
    "pdf_file_url",
    "data_criacao",
    "criado_por"
  ],
  ORCAMENTO_ITENS: [
    "id_orcamento_item",
    "id_orcamento",
    "id_pendencia",
    "loja_snapshot",
    "setor_snapshot",
    "tipo_snapshot",
    "prioridade_snapshot",
    "previsao_snapshot",
    "valor_snapshot",
    "descricao_snapshot",
    "responsavel_snapshot",
    "status_snapshot",
    "data_criacao"
  ],
  HISTORICO_STATUS: ["id_historico", "id_pendencia", "data", "hora", "status_anterior", "status_novo", "usuario", "observacao"],
  LOGS: ["id_log", "data", "hora", "tipo", "mensagem", "detalhe", "usuario"],
  DASHBOARD_BASE: ["indicador", "valor", "ultima_atualizacao"]
};

export const FIRESTORE_TARGETS = {
  CONFIG: { collection: "configs", idField: "chave" },
  LOJAS: { collection: "lojas", idField: "id_loja" },
  SETORES: { collection: "setores", idField: "id_setor" },
  USUARIOS: { collection: "usuarios", idField: "id_usuario" },
  PRESTADORES: { collection: "prestadores", idField: "id_prestador" },
  PENDENCIAS: { collection: "pendencias", idField: "id_pendencia" },
  ORCAMENTOS: { collection: "orcamentos", idField: "id_orcamento" },
  LOGS: { collection: "logs_legacy", idField: "id_log" }
};

export const DATE_ONLY_FIELDS = new Set([
  "data_cadastro",
  "data_abertura",
  "data_inicio",
  "previsao_entrega",
  "data_conclusao",
  "excluir_foto_em",
  "data_orcamento",
  "data_orcamento_ativo",
  "data_criacao",
  "data"
]);

export const DATETIME_FIELDS = new Set([
  "ultima_atualizacao"
]);

export const TIME_ONLY_FIELDS = new Set([
  "hora_abertura",
  "hora_conclusao",
  "hora"
]);

