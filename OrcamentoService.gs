function criarOrcamentoPendencias(payload) {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    var clean = normalizeOrcamentoPayload_(payload || {});
    if (!clean.valid) {
      return createErrorResponse_(clean.message);
    }

    var pendenciasData = getPendenciasParaOrcamento_(clean.pendenciaIds);
    if (!pendenciasData.success) {
      return createErrorResponse_(pendenciasData.message);
    }

    var rows = pendenciasData.rows;
    if (!rows.length) {
      return createErrorResponse_('Nenhuma pendencia valida foi selecionada para o orcamento.');
    }

    var pendenciasComOrcamento = rows.filter(function(entry) {
      return safeString_(entry.record.id_orcamento_ativo);
    });
    if (pendenciasComOrcamento.length) {
      return createErrorResponse_('As pendencias ' + pendenciasComOrcamento.map(function(entry) { return entry.record.id_pendencia; }).join(', ') + ' ja possuem um orcamento ativo.');
    }

    var orcamentoId = gerarId('ORC');
    var now = now_();
    var sheetPendencias = getSheet_(APP_CONFIG.SHEETS.PENDENCIAS);
    var itemSnapshots = rows.map(function(entry) {
      var record = entry.record;
      return {
        id_pendencia: record.id_pendencia,
        loja: record.loja || '-',
        setor: record.setor || '-',
        tipo: record.tipo || '-',
        prioridade: record.prioridade || '-',
        previsao_entrega: formatarData(record.previsao_entrega) || '-',
        descricao: sanitizeText_(record.descricao) || '-',
        responsavel: record.responsavel || 'Nao definido'
      };
    });

    var orcamentoRecord = {
      id_orcamento: orcamentoId,
      data_orcamento: parseDateInput_(clean.data_orcamento),
      prestador: clean.prestador,
      valor_total: clean.valor_total,
      quantidade_pendencias: rows.length,
      observacao: clean.observacao,
      status: 'Ativo',
      pdf_file_id: '',
      pdf_file_url: '',
      data_criacao: now,
      criado_por: getCurrentUserIdentifier_()
    };

    appendSheetRecord_(APP_CONFIG.SHEETS.ORCAMENTOS, orcamentoRecord);

    itemSnapshots.forEach(function(snapshot) {
      appendSheetRecord_(APP_CONFIG.SHEETS.ORCAMENTO_ITENS, {
        id_orcamento_item: gerarId('ORI'),
        id_orcamento: orcamentoId,
        id_pendencia: snapshot.id_pendencia,
        loja_snapshot: snapshot.loja,
        setor_snapshot: snapshot.setor,
        tipo_snapshot: snapshot.tipo,
        prioridade_snapshot: snapshot.prioridade,
        previsao_snapshot: snapshot.previsao_entrega,
        descricao_snapshot: snapshot.descricao,
        responsavel_snapshot: snapshot.responsavel,
        status_snapshot: 'Ativo',
        data_criacao: now
      });
    });

    rows.forEach(function(entry) {
      updateSheetRecordByRow_(APP_CONFIG.SHEETS.PENDENCIAS, entry.rowIndex, {
        executor: clean.prestador,
        id_orcamento_ativo: orcamentoId,
        prestador_orcamento_ativo: clean.prestador,
        valor_orcamento_ativo: clean.valor_total,
        data_orcamento_ativo: parseDateInput_(clean.data_orcamento),
        ultima_atualizacao: now,
        atualizado_por: getCurrentUserIdentifier_()
      });
    });

    var pdfPayload = null;
    var message = 'Orcamento registrado com sucesso.';
    try {
      pdfPayload = gerarPdfOrcamentoInterno_(orcamentoRecord, itemSnapshots);
      message = 'Orcamento registrado e PDF gerado com sucesso.';
      var orcamentoRowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.ORCAMENTOS, 'id_orcamento', orcamentoId);
      if (orcamentoRowIndex > -1) {
        updateSheetRecordByRow_(APP_CONFIG.SHEETS.ORCAMENTOS, orcamentoRowIndex, {
          pdf_file_id: pdfPayload.fileId,
          pdf_file_url: pdfPayload.url
        });
      }
    } catch (pdfError) {
      registrarLog('ALERTA', 'Orcamento salvo sem PDF.', orcamentoId + ' | ' + getErrorStack_(pdfError), getCurrentUserIdentifier_());
      message = 'Orcamento registrado com sucesso, mas o PDF nao foi gerado agora.';
    }

    SpreadsheetApp.flush();
    atualizarDashboardBase_();
    registrarLog('INFO', 'Orcamento criado com sucesso.', orcamentoId + ' | ' + clean.prestador, getCurrentUserIdentifier_());

    return createSuccessResponse_(message, {
      orcamento: serializeRecord_({
        id_orcamento: orcamentoId,
        data_orcamento: parseDateInput_(clean.data_orcamento),
        prestador: clean.prestador,
        valor_total: clean.valor_total,
        quantidade_pendencias: rows.length,
        observacao: clean.observacao,
        status: 'Ativo',
        pdf_file_id: pdfPayload ? pdfPayload.fileId : '',
        pdf_file_url: pdfPayload ? pdfPayload.url : '',
        data_criacao: now,
        criado_por: getCurrentUserIdentifier_()
      }),
      pdf: pdfPayload,
      pendencias: rows.map(function(entry) { return entry.record.id_pendencia; }),
      warning: pdfPayload ? '' : 'PDF nao gerado.'
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao criar orcamento das pendencias.', getErrorStack_(error), getCurrentUserIdentifier_());
    return createErrorResponse_('Nao foi possivel criar o orcamento.', error);
  } finally {
    lock.releaseLock();
  }
}

function gerarPdfOrcamento(idOrcamento) {
  try {
    var orcamento = buscarOrcamentoById_(idOrcamento);
    if (!orcamento) {
      return createErrorResponse_('Orcamento nao encontrado.');
    }
    var items = listarItensOrcamento_(idOrcamento);
    if (!items.length) {
      return createErrorResponse_('Esse orcamento nao possui pendencias vinculadas.');
    }
    var pdfPayload = gerarPdfOrcamentoInterno_(orcamento, items);
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.ORCAMENTOS, 'id_orcamento', idOrcamento);
    if (rowIndex > -1) {
      updateSheetRecordByRow_(APP_CONFIG.SHEETS.ORCAMENTOS, rowIndex, {
        pdf_file_id: pdfPayload.fileId,
        pdf_file_url: pdfPayload.url
      });
    }
    return createSuccessResponse_('PDF do orcamento gerado com sucesso.', pdfPayload);
  } catch (error) {
    registrarLog('ERRO', 'Falha ao gerar PDF do orcamento.', getErrorStack_(error), getCurrentUserIdentifier_());
    return createErrorResponse_('Nao foi possivel gerar o PDF do orcamento.', error);
  }
}

function normalizeOrcamentoPayload_(payload) {
  var pendenciaIds = Array.isArray(payload.pendenciaIds) ? payload.pendenciaIds : [];
  var cleanIds = [];
  var seen = {};
  pendenciaIds.forEach(function(id) {
    var cleanId = safeString_(id);
    if (cleanId && !seen[cleanId]) {
      seen[cleanId] = true;
      cleanIds.push(cleanId);
    }
  });

  var prestador = sanitizeText_(payload.prestador);
  var dataOrcamento = payload.data_orcamento ? formatDateForInput_(parseDateInput_(payload.data_orcamento)) : formatDateForInput_(now_());
  var valorTotal = parseCurrencyValue_(payload.valor_total);
  var observacao = sanitizeText_(payload.observacao);

  if (!cleanIds.length) {
    return { valid: false, message: 'Selecione ao menos uma pendencia para o orcamento.' };
  }
  if (!prestador) {
    return { valid: false, message: 'Selecione o prestador do orcamento.' };
  }
  if (!dataOrcamento) {
    return { valid: false, message: 'Informe a data do orcamento.' };
  }
  if (!isFinite(valorTotal) || valorTotal <= 0) {
    return { valid: false, message: 'Informe um valor total valido para o orcamento.' };
  }

  return {
    valid: true,
    pendenciaIds: cleanIds,
    prestador: prestador,
    data_orcamento: dataOrcamento,
    valor_total: valorTotal,
    observacao: observacao
  };
}

function parseCurrencyValue_(value) {
  if (typeof value === 'number') {
    return value;
  }
  var text = safeString_(value);
  if (!text) {
    return NaN;
  }
  text = text.replace(/[R$\s]/g, '');
  if (text.indexOf(',') > -1 && text.indexOf('.') > -1) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (text.indexOf(',') > -1) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else {
    text = text.replace(/,/g, '');
  }
  return Number(text);
}

function getPendenciasParaOrcamento_(ids) {
  var items = getAllSheetData_(APP_CONFIG.SHEETS.PENDENCIAS);
  var itemMap = {};
  items.forEach(function(item) {
    itemMap[safeString_(item.id_pendencia)] = item;
  });

  var rows = [];
  var faltantes = [];
  ids.forEach(function(id) {
    var item = itemMap[id];
    if (!item) {
      faltantes.push(id);
      return;
    }
    if (normalizeCompare_(item.status) === 'concluido' || normalizeCompare_(item.status) === 'cancelado') {
      faltantes.push(id);
      return;
    }
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.PENDENCIAS, 'id_pendencia', id);
    if (rowIndex === -1) {
      faltantes.push(id);
      return;
    }
    rows.push({
      rowIndex: rowIndex,
      record: item
    });
  });

  if (faltantes.length) {
    return createErrorResponse_('Nao foi possivel incluir as pendencias: ' + faltantes.join(', ') + '.');
  }

  return {
    success: true,
    rows: rows
  };
}

function buscarOrcamentoById_(idOrcamento) {
  var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.ORCAMENTOS, 'id_orcamento', idOrcamento);
  if (rowIndex === -1) {
    return null;
  }
  var headers = APP_CONFIG.HEADERS[APP_CONFIG.SHEETS.ORCAMENTOS];
  var values = getSheet_(APP_CONFIG.SHEETS.ORCAMENTOS).getRange(rowIndex, 1, 1, headers.length).getValues()[0];
  return mapRowToObject_(APP_CONFIG.SHEETS.ORCAMENTOS, values);
}

function listarItensOrcamento_(idOrcamento) {
  return getAllSheetData_(APP_CONFIG.SHEETS.ORCAMENTO_ITENS).filter(function(item) {
    return safeString_(item.id_orcamento) === safeString_(idOrcamento);
  }).sort(function(a, b) {
    return safeString_(a.id_pendencia).localeCompare(safeString_(b.id_pendencia), 'pt-BR');
  }).map(function(item) {
    return {
      id_pendencia: item.id_pendencia,
      loja: item.loja_snapshot || '-',
      setor: item.setor_snapshot || '-',
      tipo: item.tipo_snapshot || '-',
      prioridade: item.prioridade_snapshot || '-',
      previsao_entrega: item.previsao_snapshot || '-',
      descricao: item.descricao_snapshot || '-',
      responsavel: item.responsavel_snapshot || 'Nao definido'
    };
  });
}

function gerarPdfOrcamentoInterno_(orcamento, items) {
  var pdfData = buildOrcamentoPdfData_(orcamento, items);
  var html = montarHtmlOrcamentoPrestador_(pdfData);
  var pdfBlob = Utilities
    .newBlob(html, 'text/html', 'orcamento.html')
    .getAs(MimeType.PDF)
    .setName(buildOrcamentoFileName_(orcamento));
  var file = DriveApp.createFile(pdfBlob);
  ensureGeneratedFileSharing_(file);
  return {
    fileName: file.getName(),
    fileId: file.getId(),
    url: file.getUrl(),
    openUrl: file.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + file.getId()
  };
}

function buildOrcamentoPdfData_(orcamento, items) {
  return {
    idOrcamento: safeString_(orcamento.id_orcamento),
    prestador: safeString_(orcamento.prestador) || '-',
    dataOrcamento: formatarData(orcamento.data_orcamento) || '-',
    quantidadePendencias: String((items || []).length),
    valorTotal: formatCurrencyBr_(orcamento.valor_total),
    observacao: safeString_(orcamento.observacao) || '',
    logoUrl: buildCronogramaLogoDataUrl_(),
    itens: (items || []).map(function(item) {
      return {
        id: safeString_(item.id_pendencia) || '-',
        loja: safeString_(item.loja) || '-',
        setor: safeString_(item.setor) || '-',
        tipo: safeString_(item.tipo) || '-',
        prioridade: safeString_(item.prioridade) || '-',
        previsao: safeString_(item.previsao_entrega) || '-',
        descricao: safeString_(item.descricao) || '-'
      };
    })
  };
}

function buildOrcamentoFileName_(orcamento) {
  return sanitizeFileName_([
    'Orcamento',
    safeString_(orcamento.prestador) || 'Sem prestador',
    safeString_(orcamento.id_orcamento) || Utilities.formatDate(now_(), getTimezone_(), 'yyyyMMdd-HHmmss')
  ].join(' - ')) + '.pdf';
}

function montarHtmlOrcamentoPrestador_(dados) {
  var linhas = (dados.itens || []).map(function(item) {
    return '<tr>' +
      '<td>' + escapeHtml_(item.id) + '</td>' +
      '<td>' + escapeHtml_(item.loja) + '</td>' +
      '<td>' + escapeHtml_(item.setor) + '</td>' +
      '<td>' + escapeHtml_(item.tipo) + '</td>' +
      '<td>' + escapeHtml_(item.prioridade) + '</td>' +
      '<td>' + escapeHtml_(item.previsao) + '</td>' +
      '<td class="descricao-cell">' + escapeHtml_(item.descricao) + '</td>' +
    '</tr>';
  }).join('');

  var logoHtml = dados.logoUrl
    ? '<img class="logo" src="' + escapeHtml_(dados.logoUrl) + '" alt="Logo">'
    : '<div class="logo-fallback">b</div>';

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '@page{size:A4 portrait;margin:16mm 12mm 16mm 12mm;}' +
    'html,body{margin:0;padding:0;background:#fff;color:#111;font-family:Calibri,Arial,Helvetica,sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;}' +
    '*{box-sizing:border-box;}' +
    ':root{--orange:#ef7200;--dark:#111827;--line:#d9d9d9;--muted:#6b7280;--soft:#fff7ef;}' +
    '.header{background:var(--orange);height:62px;position:relative;border-radius:16px 16px 0 0;}' +
    '.header-title{position:absolute;left:104px;top:14px;font-size:25px;line-height:30px;color:#fff;font-weight:700;}' +
    '.logo{position:absolute;left:22px;top:14px;width:56px;height:56px;object-fit:contain;}' +
    '.logo-fallback{position:absolute;left:22px;top:14px;width:56px;height:56px;border-radius:50%;background:#000;color:#fff;font:700 36px/56px Arial,sans-serif;text-align:center;}' +
    '.subtitle{background:#111;height:38px;color:#fff;padding:8px 22px 0 104px;font-size:16px;line-height:22px;border-radius:0 0 16px 16px;}' +
    '.meta-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0 14px;}' +
    '.meta-card{border:1px solid var(--line);border-top:4px solid var(--orange);border-radius:14px;background:#fff;padding:10px 12px;min-height:74px;}' +
    '.meta-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;}' +
    '.meta-value{font-size:17px;font-weight:700;color:var(--dark);line-height:1.25;word-break:break-word;}' +
    '.intro{margin:0 0 14px;font-size:12px;line-height:1.5;color:#374151;}' +
    '.table-wrap{border:1px solid var(--line);border-radius:16px;overflow:hidden;}' +
    'table{width:100%;border-collapse:collapse;table-layout:fixed;}' +
    'thead th{background:#111;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:10px 8px;text-align:center;border-right:1px solid #2f3640;}' +
    'thead th:last-child{border-right:none;}' +
    'tbody td{border-top:1px solid var(--line);border-right:1px solid var(--line);padding:9px 8px;font-size:11px;line-height:1.35;vertical-align:top;text-align:center;word-break:break-word;}' +
    'tbody td:last-child{border-right:none;}' +
    'tbody tr:nth-child(odd){background:#fff;}' +
    'tbody tr:nth-child(even){background:var(--soft);}' +
    '.descricao-cell{text-align:left;}' +
    '.notes{margin-top:14px;border:1px solid var(--line);border-radius:14px;padding:12px 14px;background:#fff;}' +
    '.notes-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;}' +
    '.notes-value{font-size:12px;line-height:1.55;color:#111;min-height:18px;white-space:pre-wrap;}' +
    '.total-box{margin-top:14px;border:2px solid var(--orange);border-radius:16px;padding:14px 16px;background:#fff7ef;display:flex;justify-content:space-between;align-items:center;gap:12px;}' +
    '.total-label{font-size:13px;font-weight:700;color:#9a3412;text-transform:uppercase;letter-spacing:.04em;}' +
    '.total-value{font-size:26px;font-weight:800;color:#111827;}' +
    '.footer-note{margin-top:8px;font-size:11px;color:#6b7280;text-align:right;}' +
    '</style></head><body>' +
    '<div class="header">' + logoHtml + '<div class="header-title">Relatorio de Orcamento do Prestador</div></div>' +
    '<div class="subtitle">Documento consolidado das pendencias selecionadas para o prestador</div>' +
    '<div class="meta-grid">' +
      '<div class="meta-card"><div class="meta-label">Orcamento</div><div class="meta-value">' + escapeHtml_(dados.idOrcamento) + '</div></div>' +
      '<div class="meta-card"><div class="meta-label">Prestador</div><div class="meta-value">' + escapeHtml_(dados.prestador) + '</div></div>' +
      '<div class="meta-card"><div class="meta-label">Data</div><div class="meta-value">' + escapeHtml_(dados.dataOrcamento) + '</div></div>' +
      '<div class="meta-card"><div class="meta-label">Pendencias</div><div class="meta-value">' + escapeHtml_(dados.quantidadePendencias) + '</div></div>' +
    '</div>' +
    '<p class="intro">Valor total referente ao conjunto completo das pendencias listadas abaixo.</p>' +
    '<div class="table-wrap"><table><thead><tr>' +
      '<th style="width:12%;">ID</th>' +
      '<th style="width:14%;">Loja</th>' +
      '<th style="width:13%;">Setor</th>' +
      '<th style="width:11%;">Tipo</th>' +
      '<th style="width:11%;">Prioridade</th>' +
      '<th style="width:13%;">Previsao</th>' +
      '<th style="width:26%;">Descricao</th>' +
    '</tr></thead><tbody>' + linhas + '</tbody></table></div>' +
    '<div class="notes"><div class="notes-label">Observacao do Orcamento</div><div class="notes-value">' + escapeHtml_(dados.observacao || '-') + '</div></div>' +
    '<div class="total-box"><div class="total-label">Valor total do orcamento</div><div class="total-value">' + escapeHtml_(dados.valorTotal) + '</div></div>' +
    '<div class="footer-note">Emitido em ' + escapeHtml_(formatarData(now_())) + '</div>' +
    '</body></html>';
}
