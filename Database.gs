function setupSistema() {
  try {
    criarAbasNecessarias();
    criarCabecalhos();
    popularConfiguracoesIniciais_();
    popularSetoresIniciais_();
    popularDashboardBaseInicial_();
    aplicarValidacoesBasicas_();
    SpreadsheetApp.flush();
    registrarLog('INFO', 'Setup do sistema executado com sucesso.', '', getCurrentUserIdentifier_());
    return createSuccessResponse_('Sistema configurado com sucesso.');
  } catch (error) {
    registrarLog('ERRO', 'Falha ao executar setupSistema.', getErrorStack_(error));
    return createErrorResponse_('Falha ao configurar o sistema.', error);
  }
}

function criarAbasNecessarias() {
  var ss = getSpreadsheet_();
  Object.keys(APP_CONFIG.SHEETS).forEach(function(key) {
    var sheetName = APP_CONFIG.SHEETS[key];
    if (!ss.getSheetByName(sheetName)) {
      ss.insertSheet(sheetName);
    }
  });
}

function criarCabecalhos() {
  Object.keys(APP_CONFIG.HEADERS).forEach(function(sheetName) {
    var sheet = getSheet_(sheetName);
    var headers = APP_CONFIG.HEADERS[sheetName];
    if (!sheet) {
      return;
    }
    ensureRows_(sheet, 2);
    var currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    var needsUpdate = headers.some(function(header, index) {
      return currentHeaders[index] !== header;
    });
    if (needsUpdate) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#dbeafe');
      if (sheet.getMaxColumns() < headers.length) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
      }
      sheet.autoResizeColumns(1, headers.length);
    }
  });
}

function popularConfiguracoesIniciais_() {
  APP_CONFIG.DEFAULT_CONFIG.forEach(function(configRow) {
    if (findRowIndexByValue_(APP_CONFIG.SHEETS.CONFIG, 'chave', configRow[0]) === -1) {
      appendSheetRecord_(APP_CONFIG.SHEETS.CONFIG, {
        chave: configRow[0],
        valor: configRow[1],
        descricao: configRow[2]
      });
    }
  });
}

function popularSetoresIniciais_() {
  var inactiveNames = {
    'Administracao': true,
    'Frente de Loja': true,
    'Caixa': true,
    'Camara Fria': true,
    'Sopa': true
  };
  getAllSheetData_(APP_CONFIG.SHEETS.SETORES).forEach(function(item) {
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.SETORES, 'id_setor', item.id_setor);
    if (rowIndex === -1) {
      return;
    }
    if (inactiveNames[item.nome_setor]) {
      updateSheetRecordByRow_(APP_CONFIG.SHEETS.SETORES, rowIndex, {
        status: 'Inativo'
      });
    }
  });

  APP_CONFIG.DEFAULT_SETORES.forEach(function(setorNome) {
    upsertSheetRecordByKey_(APP_CONFIG.SHEETS.SETORES, 'nome_setor', {
      id_setor: gerarId('SET'),
      nome_setor: setorNome,
      status: 'Ativo',
      data_cadastro: parseDateInput_(formatDateForInput_(now_()))
    });
  });
}

function popularDashboardBaseInicial_() {
  APP_CONFIG.COLECAO_DASHBOARD.forEach(function(indicador) {
    upsertSheetRecordByKey_(APP_CONFIG.SHEETS.DASHBOARD_BASE, 'indicador', {
      indicador: indicador,
      valor: indicador.indexOf('Total por ') === 0 ? '{}' : '0',
      ultima_atualizacao: now_()
    });
  });
}

function aplicarValidacoesBasicas_() {
  var pendenciasSheet = getSheet_(APP_CONFIG.SHEETS.PENDENCIAS);
  if (!pendenciasSheet) {
    return;
  }
  var map = getHeaderIndexMap_(APP_CONFIG.SHEETS.PENDENCIAS);
  var startRow = 2;
  var numRows = Math.max(1000, pendenciasSheet.getMaxRows() - 1);
  var responsavelRange = pendenciasSheet.getRange(startRow, map.responsavel + 1, numRows, 1);
  var executorRange = pendenciasSheet.getRange(startRow, map.executor + 1, numRows, 1);
  var tipoRange = pendenciasSheet.getRange(startRow, map.tipo + 1, numRows, 1);
  var prioridadeRange = pendenciasSheet.getRange(startRow, map.prioridade + 1, numRows, 1);
  var statusRange = pendenciasSheet.getRange(startRow, map.status + 1, numRows, 1);
  var lojasSheet = getSheet_(APP_CONFIG.SHEETS.LOJAS);
  var setoresSheet = getSheet_(APP_CONFIG.SHEETS.SETORES);
  var usuariosSheet = getSheet_(APP_CONFIG.SHEETS.USUARIOS);
  var prestadoresSheet = getSheet_(APP_CONFIG.SHEETS.PRESTADORES);
  var lojaValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(lojasSheet.getRange('B2:B'), true)
    .setAllowInvalid(true)
    .build();
  var setorValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(setoresSheet.getRange('B2:B'), true)
    .setAllowInvalid(true)
    .build();
  var responsavelValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(usuariosSheet.getRange('B2:B'), true)
    .setAllowInvalid(true)
    .build();
  var executorValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(prestadoresSheet.getRange('B2:B'), true)
    .setAllowInvalid(true)
    .build();
  var tipos = getManagedOptionValues_('tipo');
  var prioridades = getManagedOptionValues_('prioridade');
  var statusList = getManagedOptionValues_('status');
  var tipoValidation = SpreadsheetApp.newDataValidation().requireValueInList(tipos.length ? tipos : APP_CONFIG.TIPOS_VALIDOS.map(normalizeLabel_), true).build();
  var prioridadeValidation = SpreadsheetApp.newDataValidation().requireValueInList(prioridades.length ? prioridades : APP_CONFIG.PRIORIDADES_VALIDAS.map(normalizeLabel_), true).build();
  var statusValidation = SpreadsheetApp.newDataValidation().requireValueInList(statusList.length ? statusList : APP_CONFIG.STATUS_VALIDOS.map(normalizeLabel_), true).build();

  pendenciasSheet.getRange(startRow, map.loja + 1, numRows, 1).setDataValidation(lojaValidation);
  pendenciasSheet.getRange(startRow, map.setor + 1, numRows, 1).setDataValidation(setorValidation);
  responsavelRange.setDataValidation(responsavelValidation);
  executorRange.setDataValidation(executorValidation);
  tipoRange.setDataValidation(tipoValidation);
  prioridadeRange.setDataValidation(prioridadeValidation);
  statusRange.setDataValidation(statusValidation);
}

function upsertSheetRecordByKey_(sheetName, keyColumn, data) {
  var sheet = getSheet_(sheetName);
  var headers = APP_CONFIG.HEADERS[sheetName];
  var indexMap = getHeaderIndexMap_(sheetName);
  var rowIndex = findRowIndexByValue_(sheetName, keyColumn, data[keyColumn]);
  var rowValues = headers.map(function(header) {
    return data[header] !== undefined ? data[header] : '';
  });
  if (rowIndex > -1) {
    sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
    return rowIndex;
  }
  sheet.appendRow(rowValues);
  return sheet.getLastRow();
}

function appendSheetRecord_(sheetName, data) {
  var sheet = getSheet_(sheetName);
  var headers = APP_CONFIG.HEADERS[sheetName];
  var rowValues = headers.map(function(header) {
    return data[header] !== undefined ? data[header] : '';
  });
  sheet.appendRow(rowValues);
  return sheet.getLastRow();
}

function updateSheetRecordByRow_(sheetName, rowIndex, data) {
  var sheet = getSheet_(sheetName);
  var headers = APP_CONFIG.HEADERS[sheetName];
  var existing = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var updated = headers.map(function(header, idx) {
    return data[header] !== undefined ? data[header] : existing[idx];
  });
  sheet.getRange(rowIndex, 1, 1, headers.length).setValues([updated]);
}

function listarLojas() {
  try {
    return createSuccessResponse_('Lojas carregadas.', getAllSheetData_(APP_CONFIG.SHEETS.LOJAS).filter(function(loja) {
      return normalizeCompare_(loja.status || 'Ativo') !== 'inativo';
    }));
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar lojas.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar as lojas.', error);
  }
}

function listarSetores() {
  try {
    return createSuccessResponse_('Setores carregados.', getAllSheetData_(APP_CONFIG.SHEETS.SETORES).filter(function(setor) {
      return normalizeCompare_(setor.status || 'Ativo') !== 'inativo';
    }));
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar setores.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar os setores.', error);
  }
}

function listarUsuarios() {
  try {
    return createSuccessResponse_('Usuarios carregados.', getAllSheetData_(APP_CONFIG.SHEETS.USUARIOS).filter(function(usuario) {
      return normalizeCompare_(usuario.status || 'Ativo') !== 'inativo';
    }));
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar usuarios.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar os usuarios.', error);
  }
}

function listarPrestadores() {
  try {
    return createSuccessResponse_('Prestadores carregados.', getAllSheetData_(APP_CONFIG.SHEETS.PRESTADORES).filter(function(prestador) {
      return normalizeCompare_(prestador.status || 'Ativo') !== 'inativo';
    }));
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar prestadores.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar os prestadores.', error);
  }
}

function listarPrestadoresTodos() {
  try {
    return createSuccessResponse_('Prestadores administrativos carregados.', getAllSheetData_(APP_CONFIG.SHEETS.PRESTADORES));
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar todos os prestadores.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar os prestadores administrativos.', error);
  }
}
