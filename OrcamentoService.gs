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
    var itemSnapshots = rows.map(function(entry) {
      var record = entry.record;
      return {
        id_pendencia: record.id_pendencia,
        loja: record.loja || '-',
        setor: record.setor || '-',
        tipo: record.tipo || '-',
        prioridade: record.prioridade || '-',
        previsao_entrega: formatarData(record.previsao_entrega) || '-',
        valor: clean.valorPorPendencia[record.id_pendencia],
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
        valor_snapshot: snapshot.valor,
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
        valor_orcamento_ativo: clean.valorPorPendencia[entry.record.id_pendencia],
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
  var itens = Array.isArray(payload.itens) ? payload.itens : [];
  var cleanIds = [];
  var seen = {};
  var valorPorPendencia = {};
  var itensComValor = 0;

  itens.forEach(function(item) {
    var cleanId = safeString_(item && item.id_pendencia);
    if (cleanId && !seen[cleanId]) {
      seen[cleanId] = true;
      cleanIds.push(cleanId);
      var rawValor = safeString_(item && item.valor);
      if (!rawValor) {
        valorPorPendencia[cleanId] = '';
        return;
      }
      var parsedValor = parseCurrencyValue_(rawValor);
      valorPorPendencia[cleanId] = parsedValor;
      if (isFinite(parsedValor) && parsedValor >= 0) {
        itensComValor += 1;
      }
    }
  });

  pendenciaIds.forEach(function(id) {
    var cleanId = safeString_(id);
    if (cleanId && !seen[cleanId]) {
      seen[cleanId] = true;
      cleanIds.push(cleanId);
    }
  });

  var prestador = sanitizeText_(payload.prestador);
  var dataOrcamento = payload.data_orcamento ? formatDateForInput_(parseDateInput_(payload.data_orcamento)) : formatDateForInput_(now_());
  var valorTotalManualRaw = safeString_(payload.valor_total);
  var valorTotalManual = valorTotalManualRaw ? parseCurrencyValue_(valorTotalManualRaw) : NaN;
  var observacao = sanitizeText_(payload.observacao);
  var somaServicos = cleanIds.reduce(function(total, id) {
    var valor = valorPorPendencia[id];
    return total + (isFinite(valor) ? valor : 0);
  }, 0);
  var valorTotal = isFinite(valorTotalManual) ? valorTotalManual : somaServicos;

  if (!cleanIds.length) {
    return { valid: false, message: 'Selecione ao menos uma pendencia para o orcamento.' };
  }
  if (!prestador) {
    return { valid: false, message: 'Selecione o prestador do orcamento.' };
  }
  if (!dataOrcamento) {
    return { valid: false, message: 'Informe a data do orcamento.' };
  }
  var itensInvalidos = cleanIds.filter(function(id) {
    return safeString_(valorPorPendencia[id]) && (!isFinite(valorPorPendencia[id]) || valorPorPendencia[id] < 0);
  });
  if (itensInvalidos.length) {
    return { valid: false, message: 'Informe um valor valido para cada servico selecionado.' };
  }
  if (valorTotalManualRaw && (!isFinite(valorTotalManual) || valorTotalManual < 0)) {
    return { valid: false, message: 'Informe um valor total valido para o orcamento.' };
  }
  if (!isFinite(valorTotal) || valorTotal < 0) {
    return { valid: false, message: 'Nao foi possivel calcular o valor total do orcamento.' };
  }

  return {
    valid: true,
    pendenciaIds: cleanIds,
    prestador: prestador,
    data_orcamento: dataOrcamento,
    valor_total: valorTotal,
    soma_servicos: somaServicos,
    valor_total_manual_informado: !!valorTotalManualRaw,
    itens_com_valor: itensComValor,
    valorPorPendencia: valorPorPendencia,
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
      valor: item.valor_snapshot,
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
    itens: (items || []).map(function(item, index) {
      return {
        ordem: index + 1,
        id: safeString_(item.id_pendencia) || '-',
        loja: safeString_(item.loja) || '-',
        setor: safeString_(item.setor) || '-',
        tipo: safeString_(item.tipo) || '-',
        prioridade: safeString_(item.prioridade) || '-',
        previsao: safeString_(item.previsao_entrega) || '-',
        valor: isFinite(Number(item.valor)) ? formatCurrencyBr_(item.valor) : '-',
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

function padNumber_(value, size) {
  var text = safeString_(value || '0');
  while (text.length < size) {
    text = '0' + text;
  }
  return text;
}

function montarHtmlOrcamentoPrestador_(dados) {
  var totalItens = (dados.itens || []).length;
  var grupos = (dados.itens || []).map(function(item, index) {
    var toneClass = index % 2 === 0 ? 'tone-soft' : 'tone-light';
    return '<tbody class="item-group ' + toneClass + '">' +
      '<tr class="item-main-row">' +
        '<td><div class="item-number">Servico ' + padNumber_(item.ordem, 2) + '</div><div>' + escapeHtml_(item.loja) + '</div></td>' +
        '<td>' + escapeHtml_(item.setor) + '</td>' +
        '<td>' + escapeHtml_(item.tipo) + '</td>' +
        '<td>' + escapeHtml_(item.prioridade) + '</td>' +
        '<td>' + escapeHtml_(item.previsao) + '</td>' +
        '<td class="valor-cell">' + escapeHtml_(item.valor) + '</td>' +
      '</tr>' +
      '<tr class="item-desc-row">' +
        '<td colspan="6">' +
          '<div class="descricao-label">Descricao do servico</div>' +
          '<div class="descricao-value">' + escapeHtml_(item.descricao) + '</div>' +
        '</td>' +
      '</tr>' +
      (index < totalItens - 1
        ? '<tr class="item-spacer-row"><td colspan="6"></td></tr>'
        : '') +
    '</tbody>';
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
    '.meta-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0 14px;}' +
    '.meta-card{border:1px solid var(--line);border-top:4px solid var(--orange);border-radius:14px;background:#fff;padding:10px 12px;min-height:74px;}' +
    '.meta-label{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:6px;}' +
    '.meta-value{font-size:17px;font-weight:700;color:var(--dark);line-height:1.25;word-break:break-word;}' +
    '.intro{margin:0 0 14px;font-size:12px;line-height:1.5;color:#374151;}' +
    '.table-wrap{border:1px solid var(--line);border-radius:16px;overflow:hidden;}' +
    'table{width:100%;border-collapse:collapse;table-layout:fixed;}' +
    'thead{display:table-header-group;}' +
    'thead th{background:#111;color:#fff;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:10px 8px;text-align:center;border-right:1px solid #2f3640;}' +
    'thead th:last-child{border-right:none;}' +
    'tbody.item-group{break-inside:avoid;page-break-inside:avoid;}' +
    'tbody.item-group td{border-top:1px solid var(--line);border-right:1px solid var(--line);padding:9px 8px;font-size:11px;line-height:1.35;vertical-align:top;text-align:center;word-break:break-word;background:#fff;}' +
    'tbody.item-group td:last-child{border-right:none;}' +
    'tbody.item-group:first-of-type .item-main-row td{border-top:none;}' +
    'tbody.item-group.tone-soft td{background:#f3f4f6;}' +
    'tbody.item-group.tone-soft .item-desc-row td{background:#eef0f3;}' +
    'tbody.item-group.tone-light td{background:#fff;}' +
    '.item-main-row td{font-weight:700;color:var(--dark);}' +
    '.item-desc-row td{padding:10px 12px 16px;text-align:left;border-top:none;}' +
    '.item-spacer-row td{height:12px;padding:0;border:none;background:#fff !important;}' +
    '.item-number{display:inline-flex;align-items:center;justify-content:center;min-width:72px;margin:0 auto 6px;padding:3px 8px;border-radius:999px;background:rgba(17,24,39,.08);color:#374151;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.05em;}' +
    '.descricao-label{font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;}' +
    '.descricao-value{font-size:12px;line-height:1.55;color:#111;white-space:pre-wrap;}' +
    '.valor-cell{white-space:nowrap;}' +
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
      '<div class="meta-card"><div class="meta-label">Prestador</div><div class="meta-value">' + escapeHtml_(dados.prestador) + '</div></div>' +
      '<div class="meta-card"><div class="meta-label">Data</div><div class="meta-value">' + escapeHtml_(dados.dataOrcamento) + '</div></div>' +
      '<div class="meta-card"><div class="meta-label">Pendencias</div><div class="meta-value">' + escapeHtml_(dados.quantidadePendencias) + '</div></div>' +
    '</div>' +
    '<p class="intro">Cada servico abaixo traz seu valor individual, e o total consolidado permanece destacado no fechamento do documento.</p>' +
    '<div class="table-wrap"><table><thead><tr>' +
      '<th style="width:18%;">Loja</th>' +
      '<th style="width:16%;">Setor</th>' +
      '<th style="width:16%;">Tipo</th>' +
      '<th style="width:15%;">Prioridade</th>' +
      '<th style="width:17%;">Previsao</th>' +
      '<th style="width:18%;">Valor</th>' +
    '</tr></thead>' + grupos + '</table></div>' +
    '<div class="notes"><div class="notes-label">Observacao do Orcamento</div><div class="notes-value">' + escapeHtml_(dados.observacao || '-') + '</div></div>' +
    '<div class="total-box"><div class="total-label">Valor total do orcamento</div><div class="total-value">' + escapeHtml_(dados.valorTotal) + '</div></div>' +
    '<div class="footer-note">Emitido em ' + escapeHtml_(formatarData(now_())) + '</div>' +
    '</body></html>';
}
