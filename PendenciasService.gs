function validarDadosPendencia(dados, modo) {
  var errors = [];
  var sanitized = {
    loja: sanitizeText_(dados && dados.loja),
    setor: sanitizeText_(dados && dados.setor),
    tipo: normalizeLabel_(dados && dados.tipo),
    prioridade: normalizeLabel_(dados && dados.prioridade),
    descricao: sanitizeText_(dados && dados.descricao),
    observacao: sanitizeText_(dados && dados.observacao),
    solicitante: sanitizeText_(dados && dados.solicitante) || getCurrentUserIdentifier_(),
    responsavel: sanitizeText_(dados && dados.responsavel),
    executor: sanitizeText_(dados && dados.executor),
    data_inicio: dados && dados.data_inicio ? formatDateForInput_(parseDateInput_(dados.data_inicio)) : '',
    previsao_entrega: dados && dados.previsao_entrega ? formatDateForInput_(parseDateInput_(dados.previsao_entrega)) : '',
    status: normalizeLabel_(dados && dados.status),
    foto: dados && dados.foto ? dados.foto : null
  };

  if (modo === 'criacao' || Object.prototype.hasOwnProperty.call(dados || {}, 'loja')) {
    if (!sanitized.loja) {
      errors.push('Loja e obrigatoria.');
    }
  }
  if (modo === 'criacao' || Object.prototype.hasOwnProperty.call(dados || {}, 'setor')) {
    if (!sanitized.setor) {
      errors.push('Setor e obrigatorio.');
    }
  }
  if (modo === 'criacao' || Object.prototype.hasOwnProperty.call(dados || {}, 'descricao')) {
    if (!sanitized.descricao) {
      errors.push('Descricao e obrigatoria.');
    }
  }
  if (sanitized.status && !isStatusValido_(sanitized.status)) {
    errors.push('Status invalido.');
  }
  if (sanitized.prioridade && !isPrioridadeValida_(sanitized.prioridade)) {
    errors.push('Prioridade invalida.');
  }
  if (sanitized.tipo && !isTipoValido_(sanitized.tipo)) {
    errors.push('Tipo invalido.');
  }
  if (dados && dados.previsao_entrega && !parseDateInput_(dados.previsao_entrega)) {
    errors.push('Data de previsao invalida.');
  }
  if (dados && dados.data_inicio && !parseDateInput_(dados.data_inicio)) {
    errors.push('Data de inicio invalida.');
  }
  if (sanitized.foto && sanitized.foto.mimeType && APP_CONFIG.MIME_FOTOS_PERMITIDOS.indexOf(sanitized.foto.mimeType) === -1) {
    errors.push('Arquivo de foto invalido.');
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    sanitized: sanitized
  };
}

function criarPendencia(dados) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    var validation = validarDadosPendencia(dados, 'criacao');
    if (!validation.valid) {
      return createErrorResponse_(validation.errors.join(' '));
    }

    var clean = validation.sanitized;
    var now = now_();
    var idPendencia = gerarId('PEN');
    var statusInicial = getConfig('STATUS_PADRAO_NOVO_REGISTRO') || 'Aberto';
    var fotoInfo = null;

    if (clean.foto && clean.foto.base64) {
      var nomeArquivo = [
        idPendencia,
        sanitizeFileName_(clean.loja || 'SemLoja'),
        sanitizeFileName_(clean.setor || 'SemSetor'),
        Utilities.formatDate(now, getTimezone_(), 'yyyyMMdd')
      ].join('_');
      var fotoResult = salvarFotoBase64(clean.foto.base64, nomeArquivo, idPendencia);
      if (!fotoResult.success) {
        return fotoResult;
      }
      fotoInfo = fotoResult.data;
    }

    var record = {
      id_pendencia: idPendencia,
      data_abertura: parseDateInput_(formatDateForInput_(now)),
      hora_abertura: Utilities.formatDate(now, getTimezone_(), 'HH:mm:ss'),
      loja: clean.loja,
      setor: clean.setor,
      tipo: clean.tipo || 'Outro',
      prioridade: clean.prioridade || 'Media',
      descricao: clean.descricao,
      observacao: clean.observacao,
      solicitante: clean.solicitante,
      responsavel: clean.responsavel,
      executor: clean.executor,
      data_inicio: clean.data_inicio ? parseDateInput_(clean.data_inicio) : '',
      previsao_entrega: clean.previsao_entrega ? parseDateInput_(clean.previsao_entrega) : '',
      status: normalizeLabel_(statusInicial),
      data_conclusao: '',
      hora_conclusao: '',
      link_foto: fotoInfo ? fotoInfo.link_foto : '',
      id_arquivo_drive: fotoInfo ? fotoInfo.id_arquivo_drive : '',
      excluir_foto_em: '',
      foto_excluida: 'NAO',
      ultima_atualizacao: now,
      atualizado_por: getCurrentUserIdentifier_()
    };

    appendSheetRecord_(APP_CONFIG.SHEETS.PENDENCIAS, record);
    registrarHistoricoStatus(idPendencia, '', record.status, record.solicitante, clean.observacao || 'Registro criado.');
    atualizarDashboardBase_();
    SpreadsheetApp.flush();

    registrarLog('INFO', 'Pendencia criada com sucesso.', idPendencia, record.solicitante);
    return createSuccessResponse_('Pendencia criada com sucesso.', {
      id_pendencia: idPendencia,
      pendencia: buildPendenciaPayloadById_(idPendencia)
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao criar pendencia.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel criar a pendencia.', error);
  } finally {
    lock.releaseLock();
  }
}

function listarPendencias(filtros) {
  try {
    var items = getAllSheetData_(APP_CONFIG.SHEETS.PENDENCIAS).map(function(item) {
      item.status = normalizeLabel_(item.status);
      item.prioridade = normalizeLabel_(item.prioridade);
      item.tipo = normalizeLabel_(item.tipo);
      if (!item.solicitante || normalizeCompare_(item.solicitante) === 'usuario_nao_identificado') {
        item.solicitante = getCurrentUserIdentifier_();
      }
      item.data_abertura_label = formatarData(item.data_abertura);
      item.previsao_entrega_label = formatarData(item.previsao_entrega);
      item.data_conclusao_label = formatarData(item.data_conclusao);
      item.esta_vencida = isPendenciaVencida_(item);
      return item;
    });
    var filtered = applyPendenciasFilters_(items, filtros || {});
    return createSuccessResponse_('Pendencias carregadas.', filtered);
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar pendencias.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar as pendencias.', error);
  }
}

function applyPendenciasFilters_(items, filtros) {
  return items.filter(function(item) {
    var statusAtual = normalizeCompare_(item.status);
    if (filtros.apenasHistorico) {
      if (statusAtual !== 'concluido' && statusAtual !== 'cancelado') {
        return false;
      }
    } else if (!filtros.incluirFinalizadas) {
      if (statusAtual === 'concluido' || statusAtual === 'cancelado') {
        return false;
      }
    }
    if (filtros.loja && normalizeCompare_(item.loja) !== normalizeCompare_(filtros.loja)) {
      return false;
    }
    if (filtros.setor && normalizeCompare_(item.setor) !== normalizeCompare_(filtros.setor)) {
      return false;
    }
    if (filtros.status && normalizeCompare_(item.status) !== normalizeCompare_(filtros.status)) {
      return false;
    }
    if (filtros.responsavel && normalizeCompare_(item.responsavel) !== normalizeCompare_(filtros.responsavel)) {
      return false;
    }
    if (filtros.executor && normalizeCompare_(item.executor) !== normalizeCompare_(filtros.executor)) {
      return false;
    }
    if (filtros.prioridade && normalizeCompare_(item.prioridade) !== normalizeCompare_(filtros.prioridade)) {
      return false;
    }
    if (filtros.tipo && normalizeCompare_(item.tipo) !== normalizeCompare_(filtros.tipo)) {
      return false;
    }
    if (filtros.dataAberturaDe || filtros.dataAberturaAte) {
      var abertura = parseDateInput_(item.data_abertura);
      if (!dateWithinRange_(abertura, filtros.dataAberturaDe, filtros.dataAberturaAte)) {
        return false;
      }
    }
    if (filtros.previsaoEntregaDe || filtros.previsaoEntregaAte) {
      var previsao = parseDateInput_(item.previsao_entrega);
      if (!dateWithinRange_(previsao, filtros.previsaoEntregaDe, filtros.previsaoEntregaAte)) {
        return false;
      }
    }
    return true;
  }).sort(function(a, b) {
    return String(b.id_pendencia).localeCompare(String(a.id_pendencia));
  });
}

function dateWithinRange_(dateValue, fromValue, toValue) {
  if (!fromValue && !toValue) {
    return true;
  }
  if (!dateValue) {
    return false;
  }
  var date = parseDateInput_(dateValue);
  var from = fromValue ? parseDateInput_(fromValue) : null;
  var to = toValue ? parseDateInput_(toValue) : null;
  if (!date) {
    return false;
  }
  if (from && date < from) {
    return false;
  }
  if (to) {
    var inclusiveTo = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
    if (date > inclusiveTo) {
      return false;
    }
  }
  return true;
}

function buscarPendenciaPorId(id) {
  try {
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.PENDENCIAS, 'id_pendencia', id);
    if (rowIndex === -1) {
      return createErrorResponse_('Pendencia nao encontrada.');
    }
    var headers = APP_CONFIG.HEADERS[APP_CONFIG.SHEETS.PENDENCIAS];
    var values = getSheet_(APP_CONFIG.SHEETS.PENDENCIAS).getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    var pendencia = mapRowToObject_(APP_CONFIG.SHEETS.PENDENCIAS, values);
    pendencia.status = normalizeLabel_(pendencia.status);
    pendencia.prioridade = normalizeLabel_(pendencia.prioridade);
    pendencia.tipo = normalizeLabel_(pendencia.tipo);
    pendencia.historico = listarHistoricoPorPendencia_(id);
    pendencia.foto_preview = '';
    return createSuccessResponse_('Pendencia localizada.', pendencia);
  } catch (error) {
    registrarLog('ERRO', 'Falha ao buscar pendencia por ID.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel carregar a pendencia.', error);
  }
}

function atualizarPendencia(id, dados) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    var validation = validarDadosPendencia(dados, 'edicao');
    if (!validation.valid) {
      return createErrorResponse_(validation.errors.join(' '));
    }
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.PENDENCIAS, 'id_pendencia', id);
    if (rowIndex === -1) {
      return createErrorResponse_('Pendencia nao encontrada.');
    }

    var headers = APP_CONFIG.HEADERS[APP_CONFIG.SHEETS.PENDENCIAS];
    var currentValues = getSheet_(APP_CONFIG.SHEETS.PENDENCIAS).getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    var currentRecord = {};
    headers.forEach(function(header, index) {
      currentRecord[header] = currentValues[index];
    });
    var clean = validation.sanitized;
    var novoStatus = clean.status || normalizeLabel_(currentRecord.status);

    if (clean.foto && clean.foto.base64) {
      var nomeArquivo = [
        id,
        sanitizeFileName_(clean.loja || currentRecord.loja || 'SemLoja'),
        sanitizeFileName_(clean.setor || currentRecord.setor || 'SemSetor'),
        Utilities.formatDate(now_(), getTimezone_(), 'yyyyMMdd')
      ].join('_');
      var fotoResult = salvarFotoBase64(clean.foto.base64, nomeArquivo, id);
      if (!fotoResult.success) {
        return fotoResult;
      }
      currentRecord.link_foto = fotoResult.data.link_foto;
      currentRecord.id_arquivo_drive = fotoResult.data.id_arquivo_drive;
      currentRecord.foto_excluida = 'NAO';
    }

    var updatedData = {
      loja: clean.loja || currentRecord.loja,
      setor: clean.setor || currentRecord.setor,
      tipo: clean.tipo || currentRecord.tipo,
      prioridade: clean.prioridade || currentRecord.prioridade,
      descricao: clean.descricao || currentRecord.descricao,
      observacao: Object.prototype.hasOwnProperty.call(dados || {}, 'observacao') ? clean.observacao : currentRecord.observacao,
      solicitante: clean.solicitante || currentRecord.solicitante,
      responsavel: Object.prototype.hasOwnProperty.call(dados || {}, 'responsavel') ? clean.responsavel : currentRecord.responsavel,
      executor: Object.prototype.hasOwnProperty.call(dados || {}, 'executor') ? clean.executor : currentRecord.executor,
      data_inicio: Object.prototype.hasOwnProperty.call(dados || {}, 'data_inicio') ? (clean.data_inicio ? parseDateInput_(clean.data_inicio) : '') : currentRecord.data_inicio,
      previsao_entrega: Object.prototype.hasOwnProperty.call(dados || {}, 'previsao_entrega') ? (clean.previsao_entrega ? parseDateInput_(clean.previsao_entrega) : '') : currentRecord.previsao_entrega,
      status: novoStatus,
      link_foto: currentRecord.link_foto,
      id_arquivo_drive: currentRecord.id_arquivo_drive,
      foto_excluida: currentRecord.foto_excluida,
      ultima_atualizacao: now_(),
      atualizado_por: getCurrentUserIdentifier_()
    };

    applyStatusSideEffects_(currentRecord, updatedData, novoStatus);
    updateSheetRecordByRow_(APP_CONFIG.SHEETS.PENDENCIAS, rowIndex, updatedData);

    if (normalizeCompare_(currentRecord.status) !== normalizeCompare_(novoStatus)) {
      registrarHistoricoStatus(id, currentRecord.status, novoStatus, getCurrentUserIdentifier_(), clean.observacao || 'Status alterado pela edicao.');
    }

    atualizarDashboardBase_();
    SpreadsheetApp.flush();
    registrarLog('INFO', 'Pendencia atualizada.', id, getCurrentUserIdentifier_());
    return createSuccessResponse_('Pendencia atualizada com sucesso.', {
      id_pendencia: id,
      pendencia: buildPendenciaPayloadById_(id)
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao atualizar pendencia.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel atualizar a pendencia.', error);
  } finally {
    lock.releaseLock();
  }
}

function alterarStatusPendencia(id, novoStatus, observacao) {
  return atualizarPendencia(id, {
    status: novoStatus,
    observacao: observacao
  });
}

function concluirPendencia(id, observacao) {
  return atualizarPendencia(id, {
    status: 'Concluido',
    observacao: observacao
  });
}

function excluirPendencia(id, observacao) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.PENDENCIAS, 'id_pendencia', id);
    if (rowIndex === -1) {
      return createErrorResponse_('Pendencia nao encontrada.');
    }

    var sheet = getSheet_(APP_CONFIG.SHEETS.PENDENCIAS);
    var headers = APP_CONFIG.HEADERS[APP_CONFIG.SHEETS.PENDENCIAS];
    var values = sheet.getRange(rowIndex, 1, 1, headers.length).getValues()[0];
    var record = {};
    headers.forEach(function(header, index) {
      record[header] = values[index];
    });

    if (record.id_arquivo_drive) {
      try {
        DriveApp.getFileById(record.id_arquivo_drive).setTrashed(true);
      } catch (fileError) {
        registrarLog('ALERTA', 'Falha ao mover foto de pendencia excluida para lixeira.', id + ' | ' + getErrorStack_(fileError), getCurrentUserIdentifier_());
      }
    }

    registrarHistoricoStatus(id, record.status, 'Excluido', getCurrentUserIdentifier_(), observacao || 'Pendencia excluida manualmente.');
    sheet.deleteRow(rowIndex);
    atualizarDashboardBase_();
    SpreadsheetApp.flush();
    registrarLog('INFO', 'Pendencia excluida com sucesso.', id, getCurrentUserIdentifier_());
    return createSuccessResponse_('Pendencia excluida com sucesso.', {
      id_pendencia: id
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao excluir pendencia.', getErrorStack_(error), getCurrentUserIdentifier_());
    return createErrorResponse_('Nao foi possivel excluir a pendencia.', error);
  } finally {
    lock.releaseLock();
  }
}

function applyStatusSideEffects_(currentRecord, updatedData, novoStatus) {
  if (normalizeCompare_(novoStatus) === 'concluido') {
    var now = now_();
    var dias = Number(getConfig('DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO') || '10');
    var dataExclusao = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dias);
    updatedData.data_conclusao = parseDateInput_(formatDateForInput_(now));
    updatedData.hora_conclusao = Utilities.formatDate(now, getTimezone_(), 'HH:mm:ss');
    updatedData.excluir_foto_em = dataExclusao;
  } else if (normalizeCompare_(currentRecord.status) === 'concluido') {
    updatedData.data_conclusao = '';
    updatedData.hora_conclusao = '';
    updatedData.excluir_foto_em = '';
  }
}

function buildPendenciaPayloadById_(id) {
  var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.PENDENCIAS, 'id_pendencia', id);
  if (rowIndex === -1) {
    return null;
  }
  var headers = APP_CONFIG.HEADERS[APP_CONFIG.SHEETS.PENDENCIAS];
  var values = getSheet_(APP_CONFIG.SHEETS.PENDENCIAS).getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  var pendencia = mapRowToObject_(APP_CONFIG.SHEETS.PENDENCIAS, values);
  pendencia.status = normalizeLabel_(pendencia.status);
  pendencia.prioridade = normalizeLabel_(pendencia.prioridade);
  pendencia.tipo = normalizeLabel_(pendencia.tipo);
  if (!pendencia.solicitante || normalizeCompare_(pendencia.solicitante) === 'usuario_nao_identificado') {
    pendencia.solicitante = getCurrentUserIdentifier_();
  }
  pendencia.data_abertura_label = formatarData(pendencia.data_abertura);
  pendencia.previsao_entrega_label = formatarData(pendencia.previsao_entrega);
  pendencia.data_conclusao_label = formatarData(pendencia.data_conclusao);
  pendencia.esta_vencida = isPendenciaVencida_(pendencia);
  pendencia.historico = listarHistoricoPorPendencia_(id);
  pendencia.foto_preview = '';
  return pendencia;
}

function registrarHistoricoStatus(idPendencia, statusAnterior, statusNovo, usuario, observacao) {
  try {
    var now = now_();
    appendSheetRecord_(APP_CONFIG.SHEETS.HISTORICO_STATUS, {
      id_historico: gerarId('HIS'),
      id_pendencia: idPendencia,
      data: parseDateInput_(formatDateForInput_(now)),
      hora: Utilities.formatDate(now, getTimezone_(), 'HH:mm:ss'),
      status_anterior: normalizeLabel_(statusAnterior),
      status_novo: normalizeLabel_(statusNovo),
      usuario: usuario || getCurrentUserIdentifier_(),
      observacao: sanitizeText_(observacao)
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao registrar historico de status.', getErrorStack_(error));
  }
}

function listarHistoricoPorPendencia_(idPendencia) {
  return getAllSheetData_(APP_CONFIG.SHEETS.HISTORICO_STATUS)
    .filter(function(item) {
      return safeString_(item.id_pendencia) === safeString_(idPendencia);
    })
    .map(function(item) {
      item.data_label = formatarData(item.data);
      return item;
    })
    .sort(function(a, b) {
      var chaveA = (a.data || '') + ' ' + (a.hora || '');
      var chaveB = (b.data || '') + ' ' + (b.hora || '');
      return String(chaveB).localeCompare(String(chaveA));
    });
}

function isPendenciaVencida_(item) {
  var previsao = parseDateInput_(item.previsao_entrega);
  if (!previsao) {
    return false;
  }
  var status = normalizeCompare_(item.status);
  if (status === 'concluido' || status === 'cancelado') {
    return false;
  }
  var hoje = parseDateInput_(formatDateForInput_(now_()));
  return previsao < hoje;
}

function getDashboardData() {
  try {
    var metrics = montarMetricasDashboard_();
    atualizarDashboardBase_(metrics);
    return createSuccessResponse_('Dashboard carregado.', metrics);
  } catch (error) {
    registrarLog('ERRO', 'Falha ao carregar dashboard.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel carregar o dashboard.', error);
  }
}

function atualizarDashboardBase_(metrics) {
  var data = metrics || montarMetricasDashboard_();
  if (!data) {
    return;
  }
  var now = now_();
  var rows = [
    ['Total de pendencias', String(data.total), now],
    ['Pendencias abertas', String(data.abertas), now],
    ['Pendencias em andamento', String(data.emAndamento), now],
    ['Pendencias concluidas', String(data.concluidas), now],
    ['Pendencias vencidas', String(data.vencidas), now],
    ['Pendencias criticas', String(data.criticas), now],
    ['Total por loja', JSON.stringify(data.porLoja), now],
    ['Total por setor', JSON.stringify(data.porSetor), now],
    ['Total por responsavel', JSON.stringify(data.porResponsavel), now]
  ];
  rows.forEach(function(row) {
    upsertSheetRecordByKey_(APP_CONFIG.SHEETS.DASHBOARD_BASE, 'indicador', {
      indicador: row[0],
      valor: row[1],
      ultima_atualizacao: row[2]
    });
  });
}

function montarMetricasDashboard_() {
  var pendencias = listarPendencias({ incluirFinalizadas: true }).data || [];
  var metrics = {
    total: pendencias.length,
    abertas: 0,
    emAndamento: 0,
    concluidas: 0,
    vencidas: 0,
    criticas: 0,
    porLoja: {},
    porSetor: {},
    porResponsavel: {}
  };

  pendencias.forEach(function(item) {
    var status = normalizeCompare_(item.status);
    var prioridade = normalizeCompare_(item.prioridade);
    var possuiExecutor = !!safeString_(item.executor);
    metrics.porLoja[item.loja || 'Sem loja'] = (metrics.porLoja[item.loja || 'Sem loja'] || 0) + 1;
    metrics.porSetor[item.setor || 'Sem setor'] = (metrics.porSetor[item.setor || 'Sem setor'] || 0) + 1;
    metrics.porResponsavel[item.responsavel || 'Nao definido'] = (metrics.porResponsavel[item.responsavel || 'Nao definido'] || 0) + 1;

    if (status !== 'concluido' && status !== 'cancelado' && !possuiExecutor) {
      metrics.abertas += 1;
    }
    if (status !== 'concluido' && status !== 'cancelado' && possuiExecutor) {
      metrics.emAndamento += 1;
    }
    if (status === 'concluido') {
      metrics.concluidas += 1;
    }
    if (prioridade === 'critica') {
      metrics.criticas += 1;
    }
    if (item.esta_vencida) {
      metrics.vencidas += 1;
    }
  });

  return metrics;
}
