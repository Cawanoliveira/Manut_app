function gerarCronogramaPdf(filtros) {
  var tempFile = null;
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

    tempFile = DocumentApp.create(buildCronogramaFileName_(cleanFilters, true));
    var document = DocumentApp.openById(tempFile.getId());
    var body = document.getBody();
    body.clear();
    buildCronogramaDocument_(body, cleanFilters, items);
    document.saveAndClose();

    var pdfBlob = DriveApp.getFileById(tempFile.getId()).getAs(MimeType.PDF).setName(buildCronogramaFileName_(cleanFilters, false));
    pdfFile = DriveApp.createFile(pdfBlob);
    return createSuccessResponse_('PDF do cronograma gerado com sucesso.', {
      fileName: pdfFile.getName(),
      fileId: pdfFile.getId(),
      url: pdfFile.getUrl(),
      total: items.length
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao gerar PDF do cronograma.', getErrorStack_(error), getCurrentUserIdentifier_());
    return createErrorResponse_('Nao foi possivel gerar o PDF do cronograma.', error);
  } finally {
    if (tempFile) {
      try {
        DriveApp.getFileById(tempFile.getId()).setTrashed(true);
      } catch (cleanupError) {
        registrarLog('ALERTA', 'Falha ao limpar arquivo temporario do cronograma.', getErrorStack_(cleanupError), getCurrentUserIdentifier_());
      }
    }
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

    var xlsxBlob = exportSpreadsheetAsXlsx_(tempSpreadsheet.getId(), buildCronogramaExcelFileName_(cleanFilters));
    xlsxFile = DriveApp.createFile(xlsxBlob);
    return createSuccessResponse_('Excel do cronograma gerado com sucesso.', {
      fileName: xlsxFile.getName(),
      fileId: xlsxFile.getId(),
      url: xlsxFile.getUrl(),
      total: items.length,
      format: 'xlsx'
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao gerar Excel do cronograma.', getErrorStack_(error), getCurrentUserIdentifier_());
    return createErrorResponse_('Nao foi possivel gerar o Excel do cronograma.', error);
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
    incluirFinalizadas: false
  });

  return filtered.sort(compareCronogramaItems_);
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

function buildCronogramaDocument_(body, filtros, items) {
  body.appendParagraph('Cronograma do Prestador').setHeading(DocumentApp.ParagraphHeading.HEADING1);
  body.appendParagraph('Prestador: ' + (filtros.executor || '-')).setBold(true);
  body.appendParagraph(buildCronogramaResumoFiltros_(filtros, items.length)).setFontSize(9).setForegroundColor('#6b7280');
  body.appendHorizontalRule();

  var headerRow = ['Prestador', 'Local', 'Setor', 'Previsao', 'Descricao / Observacao', 'Anexo'];
  var table = body.appendTable([headerRow]);
  styleCronogramaHeaderRow_(table.getRow(0));

  items.forEach(function(item) {
    appendCronogramaTableRow_(table, filtros, item);
  });

  body.appendParagraph('Emitido em ' + formatDateTime_(now_())).setFontSize(8).setForegroundColor('#6b7280');
}

function buildCronogramaResumoFiltros_(filtros, total) {
  var parts = ['Total de pendencias: ' + total];
  if (filtros.loja) {
    parts.push('Loja: ' + filtros.loja);
  }
  if (filtros.setor) {
    parts.push('Setor: ' + filtros.setor);
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
    text.setFontSize(9);
    text.setForegroundColor('#f26400');
  }
}

function appendCronogramaTableRow_(table, filtros, item) {
  var row = table.appendTableRow();
  setCronogramaCellText_(row.appendTableCell(), item.executor || filtros.executor || '-');
  setCronogramaCellText_(row.appendTableCell(), item.loja || '-');
  setCronogramaCellText_(row.appendTableCell(), item.setor || '-');
  setCronogramaCellText_(row.appendTableCell(), item.previsao_entrega_label || formatarData(item.previsao_entrega) || '-');
  setCronogramaCellText_(row.appendTableCell(), buildCronogramaDescricaoObservacao_(item));
  appendCronogramaImageCell_(row.appendTableCell(), item);
}

function setCronogramaCellText_(cell, textValue) {
  var value = safeString_(textValue) || '-';
  cell.setText(value);
  cell.editAsText().setFontSize(8);
}

function buildCronogramaDescricaoObservacao_(item) {
  var parts = [];
  if (safeString_(item.descricao)) {
    parts.push('Descricao: ' + sanitizeText_(item.descricao));
  }
  if (safeString_(item.observacao)) {
    parts.push('Observacao: ' + sanitizeText_(item.observacao));
  }
  return parts.join('\n') || 'Sem detalhes adicionais.';
}

function appendCronogramaImageCell_(cell, item) {
  cell.setText('');
  if (!item || !item.id_arquivo_drive) {
    cell.setText('Sem anexo');
    return;
  }

  try {
    var blob = DriveApp.getFileById(item.id_arquivo_drive).getBlob();
    var paragraph = cell.appendParagraph('');
    var image = paragraph.appendInlineImage(blob);
    image.setWidth(110);
  } catch (error) {
    cell.setText('Anexo indisponivel');
    registrarLog('ALERTA', 'Falha ao anexar imagem no cronograma PDF.', safeString_(item.id_pendencia) + ' | ' + getErrorStack_(error), getCurrentUserIdentifier_());
  }
}

function buildCronogramaSpreadsheet_(spreadsheet, filtros, items) {
  var sheet = spreadsheet.getSheets()[0];
  sheet.setName('Cronograma');
  sheet.clear();
  sheet.getRange(1, 1).setValue('Cronograma do Prestador').setFontWeight('bold').setFontSize(16).setFontColor('#f26400');
  sheet.getRange(2, 1).setValue('Prestador: ' + (filtros.executor || '-')).setFontWeight('bold');
  sheet.getRange(3, 1).setValue(buildCronogramaResumoFiltros_(filtros, items.length)).setFontSize(9).setFontColor('#6b7280');

  var headers = [['Prestador', 'Local', 'Setor', 'Previsao', 'Descricao', 'Observacao', 'Anexo']];
  sheet.getRange(5, 1, 1, headers[0].length).setValues(headers).setFontWeight('bold').setBackground('#fff1e3').setFontColor('#f26400');

  var data = items.map(function(item) {
    return [
      item.executor || filtros.executor || '-',
      item.loja || '-',
      item.setor || '-',
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
  sheet.setColumnWidths(4, 1, 90);
  sheet.setColumnWidths(5, 1, 280);
  sheet.setColumnWidths(6, 1, 220);
  sheet.setColumnWidths(7, 1, 180);
  if (data.length) {
    sheet.getRange(6, 7, data.length, 1).setNumberFormat('@');
    items.forEach(function(item, index) {
      if (!item.id_arquivo_drive) {
        return;
      }
      try {
        var blob = DriveApp.getFileById(item.id_arquivo_drive).getBlob();
        sheet.setRowHeight(6 + index, 90);
        sheet.insertImage(blob, 7, 6 + index, 4, 4).setWidth(120).setHeight(80);
      } catch (error) {
        sheet.getRange(6 + index, 7).setValue('Anexo indisponivel');
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
