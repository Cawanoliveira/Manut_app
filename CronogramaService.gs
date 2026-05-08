var CRONOGRAMA_PDF_LOGO_BASE64 = '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';

function gerarCronogramaPdf(filtros) {
  var pdfFile = null;
  try {
    var cleanFilters = normalizeCronogramaFilters_(filtros || {});
    if (!cleanFilters.executor) {
      return createErrorResponse_('Selecione um executor/prestador para gerar o cronograma.');
    }

    var items = getCronogramaItems_(cleanFilters);
    if (!items.length) {
      return createErrorResponse_('Nenhuma pendencia ativa encontrada para os filtros informados.');
    }

    var pdfData = buildCronogramaPdfData_(cleanFilters, items);
    var html = montarHtmlCronogramaPrestador_(pdfData);
    var pdfBlob = Utilities
      .newBlob(html, 'text/html', 'cronograma.html')
      .getAs(MimeType.PDF)
      .setName(buildCronogramaFileName_(cleanFilters, false));
    pdfFile = DriveApp.createFile(pdfBlob);
    ensureGeneratedFileSharing_(pdfFile);
    return createSuccessResponse_('PDF do cronograma gerado com sucesso.', {
      fileName: pdfFile.getName(),
      fileId: pdfFile.getId(),
      url: pdfFile.getUrl(),
      openUrl: pdfFile.getUrl(),
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + pdfFile.getId(),
      total: items.length
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao gerar PDF do cronograma.', getErrorStack_(error), getCurrentUserIdentifier_());
    return createErrorResponse_('Nao foi possivel gerar o PDF do cronograma. Detalhe: ' + safeString_(error && error.message), error);
  }
}

function gerarCronogramaExcel(filtros) {
  var tempSpreadsheet = null;
  var xlsxFile = null;
  try {
    var cleanFilters = normalizeCronogramaFilters_(filtros || {});
    if (!cleanFilters.executor) {
      return createErrorResponse_('Selecione um executor/prestador para gerar o cronograma.');
    }

    var items = getCronogramaItems_(cleanFilters);
    if (!items.length) {
      return createErrorResponse_('Nenhuma pendencia ativa encontrada para os filtros informados.');
    }

    tempSpreadsheet = SpreadsheetApp.create(buildCronogramaSpreadsheetName_(cleanFilters));
    buildCronogramaSpreadsheet_(tempSpreadsheet, cleanFilters, items);
    SpreadsheetApp.flush();
    Utilities.sleep(1500);

    var xlsxBlob = exportSpreadsheetAsXlsx_(tempSpreadsheet.getId(), buildCronogramaExcelFileName_(cleanFilters));
    xlsxFile = DriveApp.createFile(xlsxBlob);
    ensureGeneratedFileSharing_(xlsxFile);
    return createSuccessResponse_('Excel do cronograma gerado com sucesso.', {
      fileName: xlsxFile.getName(),
      fileId: xlsxFile.getId(),
      url: xlsxFile.getUrl(),
      openUrl: xlsxFile.getUrl(),
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + xlsxFile.getId() + '&confirm=t',
      total: items.length,
      format: 'xlsx'
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao gerar Excel do cronograma.', getErrorStack_(error), getCurrentUserIdentifier_());
    return createErrorResponse_('Nao foi possivel gerar o Excel do cronograma. Detalhe: ' + safeString_(error && error.message), error);
  } finally {
    if (tempSpreadsheet) {
      try {
        DriveApp.getFileById(tempSpreadsheet.getId()).setTrashed(true);
      } catch (cleanupError) {
        registrarLog('ALERTA', 'Falha ao limpar planilha temporaria do cronograma.', getErrorStack_(cleanupError), getCurrentUserIdentifier_());
      }
    }
  }
}

function normalizeCronogramaFilters_(filtros) {
  return {
    executor: sanitizeText_(filtros.executor),
    loja: sanitizeText_(filtros.loja),
    setor: sanitizeText_(filtros.setor),
    status: normalizeLabel_(filtros.status),
    dataAberturaDe: normalizeCronogramaDateFilter_(filtros.dataAberturaDe),
    dataAberturaAte: normalizeCronogramaDateFilter_(filtros.dataAberturaAte),
    previsaoEntregaDe: normalizeCronogramaDateFilter_(filtros.previsaoEntregaDe),
    previsaoEntregaAte: normalizeCronogramaDateFilter_(filtros.previsaoEntregaAte)
  };
}

function normalizeCronogramaDateFilter_(value) {
  var parsed = parseDateInput_(value);
  return parsed ? formatDateForInput_(parsed) : '';
}

function getCronogramaItems_(filtros) {
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
    item.status_cronograma = getCronogramaStatusServer_(item);
    return item;
  });

  var filtered = applyPendenciasFilters_(items, {
    executor: filtros.executor,
    loja: filtros.loja,
    setor: filtros.setor,
    dataAberturaDe: filtros.dataAberturaDe,
    dataAberturaAte: filtros.dataAberturaAte,
    previsaoEntregaDe: filtros.previsaoEntregaDe,
    previsaoEntregaAte: filtros.previsaoEntregaAte,
    incluirFinalizadas: true
  });

  filtered = filtered.filter(function(item) {
    if (normalizeCompare_(item.status) === 'cancelado') {
      return false;
    }
    if (filtros.status && normalizeCompare_(item.status_cronograma) !== normalizeCompare_(filtros.status)) {
      return false;
    }
    return true;
  });

  return filtered.sort(compareCronogramaItems_);
}

function getCronogramaStatusServer_(item) {
  if (!item) {
    return '';
  }
  if (normalizeCompare_(item.status) === 'concluido') {
    return 'Concluido';
  }
  if (isPendenciaVencida_(item)) {
    return 'Vencido';
  }
  if (safeString_(item.executor)) {
    return 'Em andamento';
  }
  return 'Aberto';
}

function compareCronogramaItems_(a, b) {
  var previsaoA = parseDateInput_(a.previsao_entrega);
  var previsaoB = parseDateInput_(b.previsao_entrega);
  var timeA = previsaoA ? previsaoA.getTime() : Number.MAX_SAFE_INTEGER;
  var timeB = previsaoB ? previsaoB.getTime() : Number.MAX_SAFE_INTEGER;
  if (timeA !== timeB) {
    return timeA - timeB;
  }

  var lojaCompare = safeString_(a.loja).localeCompare(safeString_(b.loja), 'pt-BR');
  if (lojaCompare !== 0) {
    return lojaCompare;
  }

  var setorCompare = safeString_(a.setor).localeCompare(safeString_(b.setor), 'pt-BR');
  if (setorCompare !== 0) {
    return setorCompare;
  }

  return safeString_(a.id_pendencia).localeCompare(safeString_(b.id_pendencia), 'pt-BR');
}

function buildCronogramaFileName_(filtros, docName) {
  var base = [
    docName ? 'Cronograma Temporario' : 'Cronograma',
    filtros.executor || 'Executor',
    Utilities.formatDate(now_(), getTimezone_(), 'yyyyMMdd-HHmmss')
  ].join(' - ');
  return sanitizeFileName_(base) + (docName ? '' : '.pdf');
}

function buildCronogramaSpreadsheetName_(filtros) {
  return sanitizeFileName_(['Cronograma Planilha', filtros.executor || 'Executor', Utilities.formatDate(now_(), getTimezone_(), 'yyyyMMdd-HHmmss')].join(' - '));
}

function buildCronogramaExcelFileName_(filtros) {
  return sanitizeFileName_(['Cronograma', filtros.executor || 'Executor', Utilities.formatDate(now_(), getTimezone_(), 'yyyyMMdd-HHmmss')].join(' - ')) + '.xlsx';
}

function buildCronogramaPdfData_(filtros, items) {
  var summary = buildCronogramaStatusSummaryMap_(items);
  return {
    prestador: filtros.executor || '-',
    dataEmissao: formatarData(now_()),
    horaEmissao: Utilities.formatDate(now_(), getTimezone_(), 'HH:mm:ss'),
    emAndamento: String(summary.emAndamento),
    concluidos: String(summary.concluidos),
    vencidos: String(summary.vencidos),
    totalRegistros: String(summary.total),
    logoUrl: buildCronogramaLogoDataUrl_(),
    pendencias: (items || []).map(function(item) {
      return {
        local: safeString_(item.loja) || '-',
        setor: safeString_(item.setor) || '-',
        status: safeString_(item.status_cronograma) || '-',
        previsao: safeString_(item.previsao_entrega_label || formatarData(item.previsao_entrega)) || '-',
        descricao: sanitizeText_(item.descricao) || '-',
        observacao: sanitizeText_(item.observacao) || '-'
      };
    })
  };
}

function buildCronogramaLogoDataUrl_() {
  return CRONOGRAMA_PDF_LOGO_BASE64
    ? 'data:image/png;base64,' + CRONOGRAMA_PDF_LOGO_BASE64
    : '';
}

function buildCronogramaStatusSummaryMap_(items) {
  var total = (items || []).length;
  var emAndamento = 0;
  var concluidos = 0;
  var vencidos = 0;
  (items || []).forEach(function(item) {
    var status = normalizeCompare_(item.status_cronograma || '');
    if (status === 'em andamento') {
      emAndamento += 1;
    } else if (status === 'concluido') {
      concluidos += 1;
    } else if (status === 'vencido') {
      vencidos += 1;
    }
  });
  return {
    total: total,
    emAndamento: emAndamento,
    concluidos: concluidos,
    vencidos: vencidos
  };
}

function chunkCronogramaItems_(items, size) {
  var result = [];
  var list = items || [];
  var chunkSize = size || 2;
  for (var i = 0; i < list.length; i += chunkSize) {
    result.push(list.slice(i, i + chunkSize));
  }
  return result.length ? result : [[]];
}

function montarHtmlCronogramaPrestador_(dados) {
  var pages = chunkCronogramaItems_(dados.pendencias || [], 2).map(function(group, index, allPages) {
    return montarPaginaCronogramaPrestador_(dados, group, index === allPages.length - 1);
  }).join('');

  return '<!DOCTYPE html><html><head><meta charset="UTF-8"><style>' +
    '@page{size:A4 landscape;margin:0;}' +
    'html,body{margin:0;padding:0;background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:Calibri,Arial,Helvetica,sans-serif;}' +
    '*{box-sizing:border-box;}' +
    '.page{position:relative;width:1123px;height:794px;overflow:hidden;background:#fff;page-break-after:always;}' +
    '.page.last{page-break-after:auto;}' +
    '.content{position:absolute;left:38px;right:38px;top:0;bottom:0;}' +
    '.top-orange{position:absolute;left:0;top:0;width:100%;height:58px;background:#ef7200;}' +
    '.main-title{position:absolute;left:126px;top:10px;font-size:28px;line-height:34px;color:#fff;font-weight:700;}' +
    '.logo{position:absolute;left:26px;top:18px;width:72px;height:72px;object-fit:contain;z-index:5;}' +
    '.logo-fallback{background:#000;color:#fff;border-radius:50%;font-family:Arial Black,Arial,sans-serif;font-size:58px;line-height:72px;text-align:center;}' +
    '.subtitle-bar{position:absolute;left:0;top:58px;width:100%;height:44px;background:#000;}' +
    '.subtitle{position:absolute;left:126px;top:66px;color:#fff;font-size:20px;line-height:28px;font-weight:400;}' +
    '.meta-wrap{position:absolute;left:38px;right:38px;top:122px;display:grid;grid-template-columns:1fr 1fr;gap:14px;}' +
    '.meta-card{border:1.5px solid #ef7200;background:#fff;}' +
    '.meta-label{height:28px;background:#f8e6d8;color:#000;font-size:14px;font-weight:700;text-align:center;line-height:28px;letter-spacing:.3px;}' +
    '.meta-value{height:46px;background:#fff;color:#000;font-size:28px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
    '.section-title{position:absolute;left:38px;top:222px;color:#000;font-size:28px;font-weight:700;line-height:34px;}' +
    '.blocks{position:absolute;left:38px;right:38px;top:274px;bottom:118px;display:grid;grid-template-columns:1fr 1fr;gap:18px;}' +
    '.block{border:1.5px solid #ef7200;background:#fff;display:grid;grid-template-rows:40px 74px 28px 1fr 28px 1fr;min-height:0;}' +
    '.block.empty{border-style:dashed;opacity:.35;}' +
    '.grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;}' +
    '.head{height:40px;background:#1d1d1d;border-bottom:1.5px solid #ef7200;}' +
    '.head div{color:#fff;font-size:15px;font-weight:700;text-align:center;line-height:40px;border-right:1.5px solid #ef7200;}' +
    '.head div:last-child{border-right:none;}' +
    '.values{height:74px;background:#fff;border-bottom:1.5px solid #ef7200;}' +
    '.values div{color:#000;font-size:18px;font-weight:700;text-align:center;display:flex;align-items:center;justify-content:center;border-right:1.5px solid #ef7200;padding:8px 6px;}' +
    '.values div:last-child{border-right:none;}' +
    '.text-label{height:28px;background:#fff;color:#000;font-size:14px;font-weight:700;padding:6px 10px;border-bottom:1px solid #e8d0c0;}' +
    '.text-box{background:#fff;color:#000;font-size:16px;line-height:1.3;padding:8px 10px;white-space:pre-wrap;overflow:hidden;border-bottom:1.5px solid #ef7200;}' +
    '.text-box.obs{border-bottom:none;}.text-box.desc{border-bottom:1px solid #e8d0c0;}' +
    '.summary{position:absolute;left:38px;right:38px;bottom:24px;height:86px;display:grid;grid-template-columns:1.3fr 1fr 1fr 1fr 1fr;border:1.5px solid #ef7200;background:#fff;}' +
    '.summary-title{grid-row:span 2;background:#ef7200;color:#000;font-size:22px;font-weight:800;display:flex;align-items:center;justify-content:center;border-right:1.5px solid #ef7200;}' +
    '.summary-label{height:34px;background:#000;color:#fff;border-right:1px solid #ef7200;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
    '.summary-label:last-of-type{border-right:none;}' +
    '.summary-value{height:50px;background:#fff;color:#000;border-right:1px solid #ef7200;font-size:20px;font-weight:700;display:flex;align-items:center;justify-content:center;}' +
    '.summary-value:last-child{border-right:none;}' +
    '</style></head><body>' + pages + '</body></html>';
}

function montarPaginaCronogramaPrestador_(dados, pendencias, includeSummary) {
  var logoHtml = dados.logoUrl
    ? '<img class="logo" src="' + escapeHtml_(dados.logoUrl) + '">'
    : '<div class="logo logo-fallback">b</div>';
  var first = pendencias[0] || createCronogramaBlankItem_();
  var second = pendencias[1] || createCronogramaBlankItem_();
  var summaryHtml = includeSummary ? (
    '<div class="summary">' +
      '<div class="summary-title">RESUMO</div>' +
      '<div class="summary-label">Em andamento</div>' +
      '<div class="summary-label">Concluidos</div>' +
      '<div class="summary-label">Vencidos</div>' +
      '<div class="summary-label">Total Registros</div>' +
      '<div class="summary-value">' + escapeHtml_(dados.emAndamento) + '</div>' +
      '<div class="summary-value">' + escapeHtml_(dados.concluidos) + '</div>' +
      '<div class="summary-value">' + escapeHtml_(dados.vencidos) + '</div>' +
      '<div class="summary-value">' + escapeHtml_(dados.totalRegistros) + '</div>' +
    '</div>'
  ) : '';

  return '<div class="page' + (includeSummary ? ' last' : '') + '">' +
    '<div class="top-orange"><div class="main-title">Cronograma do Prestador</div></div>' +
    logoHtml +
    '<div class="subtitle-bar"></div>' +
    '<div class="subtitle">Relatorio de pendencias por prestador de servico</div>' +
    '<div class="meta-wrap"><div class="meta-card"><div class="meta-label">PRESTADOR</div><div class="meta-value">' + escapeHtml_(dados.prestador) + '</div></div><div class="meta-card"><div class="meta-label">DATA DE EMISSAO</div><div class="meta-value">' + escapeHtml_(dados.dataEmissao) + '</div></div></div>' +
    '<div class="section-title">CRONOGRAMA DE PENDENCIAS</div>' +
    '<div class="blocks">' +
      montarBlocoCronogramaPrestador_(first, first.local || first.setor || first.descricao || first.observacao ? '' : 'empty') +
      montarBlocoCronogramaPrestador_(second, second.local || second.setor || second.descricao || second.observacao ? '' : 'empty') +
    '</div>' +
    summaryHtml +
  '</div>';
}

function montarBlocoCronogramaPrestador_(item, extraClass) {
  return '<div class="block ' + (extraClass || '') + '">' +
    '<div class="grid head"><div>LOCAL</div><div>SETOR</div><div>STATUS</div><div>PREVISAO</div></div>' +
    '<div class="grid values"><div>' + escapeHtml_(item.local) + '</div><div>' + escapeHtml_(item.setor) + '</div><div>' + escapeHtml_(item.status) + '</div><div>' + escapeHtml_(item.previsao) + '</div></div>' +
    '<div class="text-label">Descricao:</div>' +
    '<div class="text-box desc">' + nl2brHtml_(item.descricao) + '</div>' +
    '<div class="text-label">Observacao:</div>' +
    '<div class="text-box obs">' + nl2brHtml_(item.observacao) + '</div>' +
  '</div>';
}

function createCronogramaBlankItem_() {
  return {
    local: '',
    setor: '',
    status: '',
    previsao: '',
    descricao: '',
    observacao: ''
  };
}

function nl2brHtml_(value) {
  return escapeHtml_(value || '').replace(/\r?\n/g, '<br>');
}

function escapeHtml_(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function ensureGeneratedFileSharing_(file) {
  if (!file) {
    return;
  }
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (error) {
    registrarLog('ALERTA', 'Falha ao liberar compartilhamento do arquivo gerado.', safeString_(file.getId()) + ' | ' + getErrorStack_(error), getCurrentUserIdentifier_());
  }
}

function buildCronogramaDocument_(body, filtros, items) {
  buildCronogramaHeader_(body, filtros, items);
  body.appendParagraph('Emitido em ' + formatarData(now_()) + ' as ' + Utilities.formatDate(now_(), getTimezone_(), 'HH:mm:ss')).setFontSize(8).setForegroundColor('#666666');
  body.appendParagraph(buildCronogramaResumoFiltros_(filtros, items.length)).setFontSize(7).setForegroundColor('#666666');
  body.appendParagraph('');
  body.appendParagraph('CRONOGRAMA DE PENDENCIAS').setHeading(DocumentApp.ParagraphHeading.HEADING2).setForegroundColor('#E8720C');

  items.forEach(function(item) {
    appendCronogramaPendenciaCard_(body, filtros, item);
  });

  body.appendParagraph('');
  appendCronogramaSummaryBar_(body, items);
}

function buildCronogramaHeader_(body, filtros, items) {
  var table = body.appendTable([['', '']]);
  var row = table.getRow(0);
  var logoCell = row.getCell(0);
  var textCell = row.getCell(1);

  styleCronogramaHeaderTable_(table);
  logoCell.setBackgroundColor('#E8720C');
  textCell.setBackgroundColor('#E8720C');
  appendCronogramaLogo_(logoCell);
  textCell.appendParagraph('Cronograma do Prestador').setFontSize(13).setBold(true).setForegroundColor('#FFFFFF');
  textCell.appendParagraph('Relatorio de pendencias por prestador de servico').setFontSize(8).setForegroundColor('#FFE0C0');
  appendCronogramaHeaderDivider_(body);

  var metaTable = body.appendTable([
    ['PRESTADOR', 'TOTAL DE PENDENCIAS', 'DATA DE EMISSAO'],
    [filtros.executor || '-', String(items.length), formatarData(now_())]
  ]);
  styleCronogramaMetaTable_(metaTable);
}

function styleCronogramaHeaderTable_(table) {
  try {
    var attrs = {};
    attrs[DocumentApp.Attribute.BORDER_WIDTH] = 0;
    table.setAttributes(attrs);
  } catch (error) {
    // Mantem o PDF gerando mesmo se o estilo da tabela variar por ambiente.
  }
  try {
    table.getRow(0).getCell(0).setPaddingTop(2).setPaddingBottom(2).setPaddingLeft(2).setPaddingRight(4);
    table.getRow(0).getCell(1).setPaddingTop(4).setPaddingBottom(4).setPaddingLeft(2).setPaddingRight(8);
  } catch (errorPadding) {}
}

function appendCronogramaLogo_(cell) {
  try {
    var blob = Utilities.newBlob(Utilities.base64Decode(CRONOGRAMA_PDF_LOGO_BASE64), 'image/png', 'cronograma-logo.png');
    var paragraph = cell.appendParagraph('');
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    var image = paragraph.appendInlineImage(blob);
    image.setWidth(40);
    image.setHeight(40);
  } catch (error) {
    registrarLog('ALERTA', 'Falha ao montar logo do cronograma PDF.', getErrorStack_(error), getCurrentUserIdentifier_());
  }
}

function appendCronogramaHeaderDivider_(body) {
  var divider = body.appendTable([['']]);
  try {
    divider.setBorderWidth(0);
    var cell = divider.getRow(0).getCell(0);
    cell.setBackgroundColor('#1A1A1A');
    cell.editAsText().setText('').setFontSize(1);
    cell.setPaddingTop(0);
    cell.setPaddingBottom(0);
    cell.setPaddingLeft(0);
    cell.setPaddingRight(0);
  } catch (error) {}
}

function styleCronogramaMetaTable_(table) {
  for (var col = 0; col < table.getRow(0).getNumCells(); col += 1) {
    var headerCell = table.getRow(0).getCell(col);
    var valueCell = table.getRow(1).getCell(col);
    headerCell.editAsText().setBold(true).setFontSize(8).setForegroundColor('#666666');
    valueCell.editAsText().setBold(true).setFontSize(10).setForegroundColor('#111111');
    headerCell.setBackgroundColor(col === 0 ? '#FFF3E8' : '#FFFAF5');
    valueCell.setBackgroundColor(col === 0 ? '#FFF3E8' : '#FFFFFF');
    try {
      headerCell.setPaddingTop(6).setPaddingBottom(3).setPaddingLeft(8).setPaddingRight(8);
      valueCell.setPaddingTop(3).setPaddingBottom(6).setPaddingLeft(8).setPaddingRight(8);
      headerCell.setBorderColor('#E0E0E0');
      valueCell.setBorderColor('#E0E0E0');
      headerCell.setBorderWidth(1);
      valueCell.setBorderWidth(1);
      if (col === 0) {
        headerCell.setBorderTopColor('#E8720C');
        valueCell.setBorderTopColor('#E8720C');
      } else if (col === 1) {
        headerCell.setBorderTopColor('#1A1A1A');
        valueCell.setBorderTopColor('#1A1A1A');
      } else {
        headerCell.setBorderTopColor('#E8720C');
        valueCell.setBorderTopColor('#E8720C');
      }
      headerCell.setBorderTopWidth(3);
      valueCell.setBorderTopWidth(3);
    } catch (error) {}
  }
}

function buildCronogramaResumoFiltros_(filtros, total) {
  var parts = ['Total de pendencias: ' + total];
  if (filtros.loja) {
    parts.push('Loja: ' + filtros.loja);
  }
  if (filtros.setor) {
    parts.push('Setor: ' + filtros.setor);
  }
  if (filtros.status) {
    parts.push('Status: ' + filtros.status);
  }
  if (filtros.dataAberturaDe || filtros.dataAberturaAte) {
    parts.push('Abertura: ' + (filtros.dataAberturaDe ? formatarData(filtros.dataAberturaDe) : '...') + ' ate ' + (filtros.dataAberturaAte ? formatarData(filtros.dataAberturaAte) : '...'));
  }
  if (filtros.previsaoEntregaDe || filtros.previsaoEntregaAte) {
    parts.push('Previsao: ' + (filtros.previsaoEntregaDe ? formatarData(filtros.previsaoEntregaDe) : '...') + ' ate ' + (filtros.previsaoEntregaAte ? formatarData(filtros.previsaoEntregaAte) : '...'));
  }
  return parts.join(' | ');
}

function styleCronogramaHeaderRow_(row) {
  for (var i = 0; i < row.getNumCells(); i += 1) {
    var cell = row.getCell(i);
    var text = cell.editAsText();
    text.setBold(true);
    text.setFontSize(8);
    text.setForegroundColor('#FFFFFF');
    cell.setBackgroundColor(i === 0 ? '#E8720C' : '#1A1A1A');
    try {
      cell.setPaddingTop(6).setPaddingBottom(6).setPaddingLeft(6).setPaddingRight(6);
    } catch (error) {}
  }
}

function styleCronogramaMainTable_(table) {
  try {
    table.setBorderColor('#E8720C');
    table.setBorderWidth(1.5);
  } catch (error) {}
}

function appendCronogramaPendenciaCard_(body, filtros, item) {
  var table = body.appendTable([
    ['LOCAL', 'SETOR', 'STATUS', 'PREVISAO'],
    [
      item.loja || '-',
      item.setor || '-',
      buildCronogramaStatusLabel_(item.status_cronograma || '-'),
      item.previsao_entrega_label || formatarData(item.previsao_entrega) || '-'
    ],
    ['Descricao:', '', '', ''],
    [sanitizeText_(item.descricao) || '-', '', '', ''],
    ['Observacao:', '', '', ''],
    [sanitizeText_(item.observacao) || '-', '', '', '']
  ]);

  styleCronogramaMainTable_(table);
  styleCronogramaHeaderRow_(table.getRow(0));

  try {
    var valueRow = table.getRow(1);
    for (var i = 0; i < valueRow.getNumCells(); i += 1) {
      var cell = valueRow.getCell(i);
      cell.setBackgroundColor(i % 2 === 0 ? '#FFF3E8' : '#FFFFFF');
      cell.setBorderColor('#E8D0C0');
      cell.setBorderWidth(0.5);
      cell.setPaddingTop(4);
      cell.setPaddingBottom(4);
      cell.setPaddingLeft(6);
      cell.setPaddingRight(6);
      cell.editAsText().setFontSize(8).setForegroundColor(i === 2 ? '#E8720C' : '#2C2C2C').setBold(i === 2);
    }

    styleCronogramaTextSectionRow_(table.getRow(2), true);
    styleCronogramaTextValueRow_(table.getRow(3));
    styleCronogramaTextSectionRow_(table.getRow(4), false);
    styleCronogramaTextValueRow_(table.getRow(5));
  } catch (errorCard) {}

  body.appendParagraph('');
}

function styleCronogramaTextSectionRow_(row, firstSection) {
  for (var i = 0; i < row.getNumCells(); i += 1) {
    var cell = row.getCell(i);
    cell.setBackgroundColor('#FFF3E8');
    cell.setBorderColor('#E8720C');
    cell.setBorderWidth(0.8);
    cell.setPaddingTop(firstSection ? 8 : 6);
    cell.setPaddingBottom(4);
    cell.setPaddingLeft(6);
    cell.setPaddingRight(6);
    if (i === 0) {
      cell.editAsText().setBold(true).setItalic(true).setFontSize(9).setForegroundColor('#111111');
    } else {
      cell.editAsText().setText('');
    }
  }
}

function styleCronogramaTextValueRow_(row) {
  for (var i = 0; i < row.getNumCells(); i += 1) {
    var cell = row.getCell(i);
    cell.setBackgroundColor('#FFF3E8');
    cell.setBorderColor('#E8720C');
    cell.setBorderWidth(0.8);
    cell.setPaddingTop(4);
    cell.setPaddingBottom(18);
    cell.setPaddingLeft(6);
    cell.setPaddingRight(6);
    cell.editAsText().setFontSize(8).setForegroundColor('#2C2C2C');
    if (i > 0) {
      cell.editAsText().setText('');
    }
  }
}

function appendCronogramaTableRow_(table, filtros, item) {
  var row = table.appendTableRow();
  setCronogramaCellText_(row.appendTableCell(), item.executor || filtros.executor || '-', true, '#111111');
  setCronogramaCellText_(row.appendTableCell(), item.loja || '-', false, '#2C2C2C');
  setCronogramaCellText_(row.appendTableCell(), item.setor || '-', false, '#2C2C2C');
  setCronogramaCellText_(row.appendTableCell(), buildCronogramaStatusLabel_(item.status_cronograma || '-'), true, '#E8720C');
  setCronogramaCellText_(row.appendTableCell(), item.previsao_entrega_label || formatarData(item.previsao_entrega) || '-', false, '#2C2C2C');
  setCronogramaCellText_(row.appendTableCell(), buildCronogramaDescricaoObservacao_(item) || '-', false, '#2C2C2C');
  try {
    var rowIndex = table.getNumRows() - 1;
    var bgColor = rowIndex % 2 === 0 ? '#FFF3E8' : '#FFFFFF';
    for (var i = 0; i < row.getNumCells(); i += 1) {
      var cell = row.getCell(i);
      cell.setBackgroundColor(bgColor);
      cell.setBorderColor('#E8D0C0');
      cell.setBorderWidth(0.5);
      cell.setPaddingTop(4);
      cell.setPaddingBottom(4);
      cell.setPaddingLeft(6);
      cell.setPaddingRight(6);
    }
  } catch (errorBg) {}
}

function setCronogramaCellText_(cell, textValue, bold, color) {
  var value = safeString_(textValue) || '-';
  cell.setText(value);
  cell.editAsText().setFontSize(8).setBold(!!bold).setForegroundColor(color || '#2C2C2C');
}

function buildCronogramaDescricaoObservacao_(item) {
  var parts = [];
  if (safeString_(item.descricao)) {
    parts.push('Descricao: ' + sanitizeText_(item.descricao));
  }
  if (safeString_(item.observacao)) {
    parts.push('Observacao: ' + sanitizeText_(item.observacao));
  }
  return parts.join('\n') || '-';
}

function buildCronogramaStatusLabel_(status) {
  return '\u25cf ' + safeString_(status || '-');
}

function buildCronogramaStatusSummary_(items) {
  var total = (items || []).length;
  var andamento = 0;
  var concluidos = 0;
  var vencidos = 0;
  (items || []).forEach(function(item) {
    var status = normalizeCompare_(item.status_cronograma || '');
    if (status === 'em andamento') {
      andamento += 1;
    } else if (status === 'concluido') {
      concluidos += 1;
    } else if (status === 'vencido') {
      vencidos += 1;
    }
  });
  return 'Total de registros: ' + total + ' | Em andamento: ' + andamento + ' | Concluidos: ' + concluidos + ' | Vencidos: ' + vencidos;
}

function appendCronogramaSummaryBar_(body, items) {
  var summaryTable = body.appendTable([
    ['RESUMO', buildCronogramaStatusSummary_(items)]
  ]);
  try {
    summaryTable.getRow(0).getCell(0).setBackgroundColor('#E8720C');
    summaryTable.getRow(0).getCell(1).setBackgroundColor('#2C2C2C');
    summaryTable.getRow(0).getCell(0).editAsText().setBold(true).setFontSize(8).setForegroundColor('#FFFFFF');
    summaryTable.getRow(0).getCell(1).editAsText().setFontSize(8).setForegroundColor('#FFFFFF');
    summaryTable.getRow(0).getCell(0).setPaddingTop(8).setPaddingBottom(8).setPaddingLeft(10).setPaddingRight(10);
    summaryTable.getRow(0).getCell(1).setPaddingTop(8).setPaddingBottom(8).setPaddingLeft(10).setPaddingRight(10);
  } catch (errorSummary) {}
}

function applyCronogramaDocumentStyle_(documentId) {
  try {
    var url = 'https://docs.googleapis.com/v1/documents/' + encodeURIComponent(documentId) + ':batchUpdate';
    var payload = {
      requests: [{
        updateDocumentStyle: {
          documentStyle: {
            marginTop: { magnitude: 10, unit: 'PT' },
            marginBottom: { magnitude: 10, unit: 'PT' },
            marginLeft: { magnitude: 10, unit: 'PT' },
            marginRight: { magnitude: 10, unit: 'PT' }
          },
          fields: 'marginTop,marginBottom,marginLeft,marginRight'
        }
      }]
    };
    UrlFetchApp.fetch(url, {
      method: 'post',
      contentType: 'application/json',
      headers: {
        Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });
  } catch (error) {
    registrarLog('ALERTA', 'Falha ao aplicar estilo do documento do cronograma.', getErrorStack_(error), getCurrentUserIdentifier_());
  }
}

function buildCronogramaSpreadsheet_(spreadsheet, filtros, items) {
  var sheet = spreadsheet.getSheets()[0];
  sheet.setName('Cronograma');
  sheet.clear();
  sheet.getRange(1, 1).setValue('Cronograma do Prestador').setFontWeight('bold').setFontSize(16).setFontColor('#f26400');
  sheet.getRange(2, 1).setValue('Prestador: ' + (filtros.executor || '-')).setFontWeight('bold');
  sheet.getRange(3, 1).setValue(buildCronogramaResumoFiltros_(filtros, items.length)).setFontSize(9).setFontColor('#6b7280');

  var headers = [['Prestador', 'Local', 'Setor', 'Status', 'Previsao de conclusao', 'Descricao', 'Observacao', 'Anexo']];
  sheet.getRange(5, 1, 1, headers[0].length).setValues(headers).setFontWeight('bold').setBackground('#fff1e3').setFontColor('#f26400');

  var data = items.map(function(item) {
    return [
      item.executor || filtros.executor || '-',
      item.loja || '-',
      item.setor || '-',
      item.status_cronograma || '-',
      item.previsao_entrega_label || formatarData(item.previsao_entrega) || '-',
      sanitizeText_(item.descricao) || '-',
      sanitizeText_(item.observacao) || '',
      item.link_foto || ''
    ];
  });
  if (data.length) {
    sheet.getRange(6, 1, data.length, data[0].length).setValues(data).setVerticalAlignment('middle').setWrap(true);
  }

  sheet.setFrozenRows(5);
  sheet.setColumnWidths(1, 1, 150);
  sheet.setColumnWidths(2, 1, 120);
  sheet.setColumnWidths(3, 1, 120);
  sheet.setColumnWidths(4, 1, 120);
  sheet.setColumnWidths(5, 1, 110);
  sheet.setColumnWidths(6, 1, 260);
  sheet.setColumnWidths(7, 1, 220);
  sheet.setColumnWidths(8, 1, 180);
  if (data.length) {
    sheet.getRange(6, 8, data.length, 1).setNumberFormat('@');
    items.forEach(function(item, index) {
      if (!item.id_arquivo_drive) {
        return;
      }
      try {
        var blob = DriveApp.getFileById(item.id_arquivo_drive).getBlob();
        sheet.setRowHeight(6 + index, 90);
        sheet.insertImage(blob, 8, 6 + index, 4, 4).setWidth(120).setHeight(80);
      } catch (error) {
        sheet.getRange(6 + index, 8).setValue('Anexo indisponivel');
        registrarLog('ALERTA', 'Falha ao anexar imagem no cronograma Excel.', safeString_(item.id_pendencia) + ' | ' + getErrorStack_(error), getCurrentUserIdentifier_());
      }
    });
  }
}

function exportSpreadsheetAsXlsx_(spreadsheetId, fileName) {
  var url = 'https://docs.google.com/spreadsheets/d/' + spreadsheetId + '/export?format=xlsx';
  var response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken()
    },
    muteHttpExceptions: true
  });
  var code = response.getResponseCode();
  if (code >= 300) {
    throw new Error('Falha ao exportar planilha para Excel. HTTP ' + code);
  }
  return response.getBlob().setName(fileName);
}
var CRONOGRAMA_PDF_LOGO_BASE64 = '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';

