var APP_CONFIG = {
  SHEETS: {
    CONFIG: 'CONFIG',
    LOJAS: 'LOJAS',
    SETORES: 'SETORES',
    USUARIOS: 'USUARIOS',
    PRESTADORES: 'PRESTADORES',
    PENDENCIAS: 'PENDENCIAS',
    HISTORICO_STATUS: 'HISTORICO_STATUS',
    LOGS: 'LOGS',
    DASHBOARD_BASE: 'DASHBOARD_BASE'
  },
  HEADERS: {
    CONFIG: ['chave', 'valor', 'descricao'],
    LOJAS: ['id_loja', 'nome_loja', 'cidade', 'status', 'data_cadastro'],
    SETORES: ['id_setor', 'nome_setor', 'status', 'data_cadastro'],
    USUARIOS: ['id_usuario', 'nome', 'email', 'perfil', 'status', 'data_cadastro'],
    PRESTADORES: ['id_prestador', 'nome_prestador', 'status', 'data_cadastro'],
    PENDENCIAS: [
      'id_pendencia',
      'data_abertura',
      'hora_abertura',
      'loja',
      'setor',
      'tipo',
      'prioridade',
      'descricao',
      'observacao',
      'solicitante',
      'responsavel',
      'executor',
      'data_inicio',
      'previsao_entrega',
      'status',
      'data_conclusao',
      'hora_conclusao',
      'link_foto',
      'id_arquivo_drive',
      'excluir_foto_em',
      'foto_excluida',
      'ultima_atualizacao',
      'atualizado_por'
    ],
    HISTORICO_STATUS: ['id_historico', 'id_pendencia', 'data', 'hora', 'status_anterior', 'status_novo', 'usuario', 'observacao'],
    LOGS: ['id_log', 'data', 'hora', 'tipo', 'mensagem', 'detalhe', 'usuario'],
    DASHBOARD_BASE: ['indicador', 'valor', 'ultima_atualizacao']
  },
  STATUS_VALIDOS: ['Aberto', 'Em andamento', 'Aguardando', 'Concluido', 'Cancelado'],
  PRIORIDADES_VALIDAS: ['Baixa', 'Media', 'Alta', 'Critica'],
  TIPOS_VALIDOS: ['Melhoria', 'Manutencao', 'Limpeza', 'Organizacao', 'Seguranca', 'Outro'],
  PERFIS_VALIDOS: ['Admin', 'Gestor', 'Consulta'],
  STATUS_CONCLUIDOS: ['Concluido', 'Cancelado'],
  COLECAO_DASHBOARD: [
    'Total de pendencias',
    'Pendencias abertas',
    'Pendencias em andamento',
    'Pendencias concluidas',
    'Pendencias vencidas',
    'Pendencias criticas',
    'Total por loja',
    'Total por setor',
    'Total por responsavel'
  ],
  DEFAULT_CONFIG: [
    ['DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO', '30', 'Quantidade de dias apos conclusao para excluir fotos'],
    ['STATUS_PADRAO_NOVO_REGISTRO', 'Aberto', 'Status inicial de novas pendencias'],
    ['PERMITIR_EXCLUSAO_FOTO_AUTOMATICA', 'SIM', 'Define se fotos serao excluidas automaticamente'],
    ['VERSAO_SISTEMA', '1.0', 'Versao inicial do sistema']
  ],
  DEFAULT_SETORES: [
    'Acougue',
    'Padaria',
    'Frios',
    'Hortifruti',
    'Mercearia',
    'Frente de Caixa',
    'Deposito',
    'Gerencia',
    'Area Externa',
    'Manutencao',
    'Outros'
  ],
  DEFAULT_USERS: [],
  MIME_FOTOS_PERMITIDOS: ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
};

function getSpreadsheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Nenhuma planilha ativa encontrada. Vincule o Apps Script a planilha do sistema.');
  }
  return ss;
}

function getSheet_(sheetName) {
  return getSpreadsheet_().getSheetByName(sheetName);
}

function getTimezone_() {
  return Session.getScriptTimeZone() || 'America/Sao_Paulo';
}

function now_() {
  return new Date();
}

function gerarId(prefixo) {
  var base = Utilities.formatDate(now_(), getTimezone_(), 'yyyyMMddHHmmss');
  var suffix = Math.floor(Math.random() * 9000) + 1000;
  return (prefixo || 'ID') + '-' + base + '-' + suffix;
}

function getCurrentUserIdentifier_() {
  var email = Session.getActiveUser().getEmail();
  return email || 'usuario_nao_identificado';
}

function createSuccessResponse_(message, data) {
  return {
    success: true,
    message: message || 'OK',
    data: data === undefined ? null : data
  };
}

function createErrorResponse_(message, error) {
  return {
    success: false,
    message: message || 'Erro inesperado.',
    error: error ? (error.message || String(error)) : null
  };
}

function getErrorStack_(error) {
  if (!error) {
    return '';
  }
  return error.stack || error.message || String(error);
}

function safeString_(value) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function normalizeCompare_(value) {
  return safeString_(value).toLowerCase();
}

function sanitizeText_(value) {
  return safeString_(value).replace(/\s+/g, ' ').trim();
}

function normalizeLabel_(value) {
  var text = safeString_(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) {
    return '';
  }
  return text
    .split(' ')
    .map(function(part) {
      return part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '';
    })
    .join(' ');
}

function stripAccents_(value) {
  return safeString_(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function formatarData(dateValue) {
  if (!dateValue) {
    return '';
  }
  var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) {
    return '';
  }
  return Utilities.formatDate(date, getTimezone_(), 'dd/MM/yyyy');
}

function formatDateForInput_(dateValue) {
  if (!dateValue) {
    return '';
  }
  var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) {
    return '';
  }
  return Utilities.formatDate(date, getTimezone_(), 'yyyy-MM-dd');
}

function formatDateTime_(dateValue) {
  if (!dateValue) {
    return '';
  }
  var date = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (isNaN(date.getTime())) {
    return '';
  }
  return Utilities.formatDate(date, getTimezone_(), 'dd/MM/yyyy HH:mm:ss');
}

function parseDateInput_(dateValue) {
  if (!dateValue) {
    return null;
  }
  if (dateValue instanceof Date) {
    return dateValue;
  }
  var text = safeString_(dateValue);
  if (!text) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    var parts = text.split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  var parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function getHeaderIndexMap_(sheetName) {
  var headers = APP_CONFIG.HEADERS[sheetName];
  if (!headers) {
    throw new Error('Cabecalhos nao configurados para a aba ' + sheetName);
  }
  return headers.reduce(function(map, header, index) {
    map[header] = index;
    return map;
  }, {});
}

function mapRowToObject_(sheetName, rowValues) {
  var headers = APP_CONFIG.HEADERS[sheetName];
  var record = {};
  headers.forEach(function(header, index) {
    record[header] = rowValues[index];
  });
  return serializeRecord_(record);
}

function serializeRecord_(record) {
  var cloned = {};
  Object.keys(record || {}).forEach(function(key) {
    var value = record[key];
    if (value instanceof Date) {
      if (key === 'ultima_atualizacao') {
        cloned[key] = formatDateTime_(value);
      } else if (key.indexOf('data') === 0 || key.indexOf('_em') > -1) {
        cloned[key] = formatDateForInput_(value);
      } else {
        cloned[key] = formatDateTime_(value);
      }
    } else {
      cloned[key] = value;
    }
  });
  return cloned;
}

function getAllSheetData_(sheetName) {
  var sheet = getSheet_(sheetName);
  if (!sheet) {
    return [];
  }
  var lastRow = sheet.getLastRow();
  var lastColumn = APP_CONFIG.HEADERS[sheetName].length;
  if (lastRow < 2) {
    return [];
  }
  var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  return values.map(function(row) {
    return mapRowToObject_(sheetName, row);
  });
}

function findRowIndexByValue_(sheetName, columnName, value) {
  var sheet = getSheet_(sheetName);
  if (!sheet) {
    return -1;
  }
  var headers = getHeaderIndexMap_(sheetName);
  var columnIndex = headers[columnName];
  if (columnIndex === undefined) {
    return -1;
  }
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return -1;
  }
  var values = sheet.getRange(2, columnIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < values.length; i += 1) {
    if (safeString_(values[i][0]) === safeString_(value)) {
      return i + 2;
    }
  }
  return -1;
}

function ensureRows_(sheet, minimumRows) {
  if (sheet.getMaxRows() < minimumRows) {
    sheet.insertRowsAfter(sheet.getMaxRows(), minimumRows - sheet.getMaxRows());
  }
}

function getDisplayStatus_(statusValue) {
  return normalizeLabel_(statusValue);
}

function getDisplayPriority_(priorityValue) {
  return normalizeLabel_(priorityValue);
}

function getDisplayTipo_(tipoValue) {
  return normalizeLabel_(tipoValue);
}

function isStatusValido_(statusValue) {
  return APP_CONFIG.STATUS_VALIDOS.indexOf(stripAccents_(normalizeLabel_(statusValue))) > -1;
}

function isPrioridadeValida_(priorityValue) {
  return APP_CONFIG.PRIORIDADES_VALIDAS.indexOf(stripAccents_(normalizeLabel_(priorityValue))) > -1;
}

function isTipoValido_(tipoValue) {
  return APP_CONFIG.TIPOS_VALIDOS.indexOf(stripAccents_(normalizeLabel_(tipoValue))) > -1;
}

function registrarLog(tipo, mensagem, detalhe, usuario) {
  try {
    var ss = getSpreadsheet_();
    var sheet = ss.getSheetByName(APP_CONFIG.SHEETS.LOGS);
    if (!sheet) {
      Logger.log(tipo + ': ' + mensagem + ' | ' + (detalhe || ''));
      return;
    }
    var now = now_();
    sheet.appendRow([
      gerarId('LOG'),
      parseDateInput_(formatDateForInput_(now)),
      Utilities.formatDate(now, getTimezone_(), 'HH:mm:ss'),
      normalizeLabel_(tipo || 'INFO').toUpperCase(),
      safeString_(mensagem),
      safeString_(detalhe),
      safeString_(usuario || getCurrentUserIdentifier_())
    ]);
  } catch (error) {
    Logger.log('Falha ao registrar log: ' + getErrorStack_(error));
  }
}
