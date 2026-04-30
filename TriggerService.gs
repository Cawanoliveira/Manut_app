function limparFotosConcluidas() {
  var lock = LockService.getDocumentLock();
  try {
    lock.waitLock(30000);
    var permitir = normalizeCompare_(getConfig('PERMITIR_EXCLUSAO_FOTO_AUTOMATICA') || 'SIM');
    if (permitir !== 'sim') {
      return createSuccessResponse_('Exclusao automatica de fotos desativada.', { removidas: 0 });
    }

    var sheet = getSheet_(APP_CONFIG.SHEETS.PENDENCIAS);
    var headers = APP_CONFIG.HEADERS[APP_CONFIG.SHEETS.PENDENCIAS];
    var indexMap = getHeaderIndexMap_(APP_CONFIG.SHEETS.PENDENCIAS);
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return createSuccessResponse_('Nenhuma pendencia para processar.', { removidas: 0 });
    }

    var values = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
    var hoje = parseDateInput_(formatDateForInput_(now_()));
    var removidas = 0;

    values.forEach(function(row, idx) {
      var status = normalizeCompare_(row[indexMap.status]);
      var arquivoId = safeString_(row[indexMap.id_arquivo_drive]);
      var fotoExcluida = normalizeCompare_(row[indexMap.foto_excluida]);
      var excluirEm = parseDateInput_(row[indexMap.excluir_foto_em]);
      var rowNumber = idx + 2;

      if (status !== 'concluido') {
        return;
      }
      if (!arquivoId || fotoExcluida === 'sim' || !excluirEm || excluirEm > hoje) {
        return;
      }

      try {
        DriveApp.getFileById(arquivoId).setTrashed(true);
        sheet.getRange(rowNumber, indexMap.foto_excluida + 1).setValue('SIM');
        sheet.getRange(rowNumber, indexMap.link_foto + 1).setValue('');
        sheet.getRange(rowNumber, indexMap.ultima_atualizacao + 1).setValue(now_());
        sheet.getRange(rowNumber, indexMap.atualizado_por + 1).setValue('trigger_limpeza_fotos');
        removidas += 1;
        registrarLog('INFO', 'Foto de pendencia movida para lixeira.', row[indexMap.id_pendencia], 'trigger_limpeza_fotos');
      } catch (fileError) {
        registrarLog('ALERTA', 'Falha ao mover foto para lixeira.', row[indexMap.id_pendencia] + ' | ' + getErrorStack_(fileError), 'trigger_limpeza_fotos');
      }
    });

    SpreadsheetApp.flush();
    return createSuccessResponse_('Limpeza de fotos concluida.', { removidas: removidas });
  } catch (error) {
    registrarLog('ERRO', 'Falha em limparFotosConcluidas.', getErrorStack_(error), 'trigger_limpeza_fotos');
    return createErrorResponse_('Nao foi possivel executar a limpeza de fotos.', error);
  } finally {
    lock.releaseLock();
  }
}

function criarTriggerLimpezaFotos() {
  try {
    var existentes = ScriptApp.getProjectTriggers().filter(function(trigger) {
      return trigger.getHandlerFunction() === 'limparFotosConcluidas';
    });
    existentes.forEach(function(trigger) {
      ScriptApp.deleteTrigger(trigger);
    });
    ScriptApp.newTrigger('limparFotosConcluidas')
      .timeBased()
      .everyDays(1)
      .atHour(3)
      .create();
    registrarLog('INFO', 'Trigger diario de limpeza de fotos criado.', '', getCurrentUserIdentifier_());
    return createSuccessResponse_('Trigger criado com sucesso.');
  } catch (error) {
    registrarLog('ERRO', 'Falha ao criar trigger de limpeza de fotos.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel criar o trigger.', error);
  }
}

