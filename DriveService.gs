function obterOuCriarPastaFotos() {
  var folderName = getConfig('NOME_PASTA_DRIVE_FOTOS') || 'Fotos - Melhorias e Manutencoes';
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function salvarFotoBase64(base64, nomeArquivo, idPendencia) {
  try {
    if (!base64) {
      return createSuccessResponse_('Nenhuma foto enviada.', null);
    }
    var payload = base64;
    var mimeType = 'image/jpeg';
    if (base64.indexOf('data:') === 0) {
      var matches = base64.match(/^data:(.*?);base64,(.*)$/);
      if (!matches || matches.length < 3) {
        throw new Error('Base64 da foto invalido.');
      }
      mimeType = matches[1];
      payload = matches[2];
    }
    if (APP_CONFIG.MIME_FOTOS_PERMITIDOS.indexOf(mimeType) === -1) {
      throw new Error('Formato de imagem nao permitido: ' + mimeType);
    }

    var bytes = Utilities.base64Decode(payload);
    var extensao = mimeType.split('/')[1] || 'jpg';
    var fileName = sanitizeFileName_(nomeArquivo || (idPendencia + '.' + extensao));
    if (fileName.toLowerCase().indexOf('.' + extensao) === -1) {
      fileName += '.' + extensao;
    }
    var blob = Utilities.newBlob(bytes, mimeType, fileName);
    var folder = obterOuCriarPastaFotos();
    var file = folder.createFile(blob);

    return createSuccessResponse_('Foto salva com sucesso.', {
      id_arquivo_drive: file.getId(),
      link_foto: file.getUrl(),
      nome_arquivo: file.getName()
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao salvar foto no Drive.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel salvar a foto.', error);
  }
}

function sanitizeFileName_(value) {
  return safeString_(value)
    .replace(/[\\/:*?"<>|#%&{}$!'@+=`]/g, '-')
    .replace(/\s+/g, '_')
    .substring(0, 180);
}

function obterFotoPreview(idArquivoDrive) {
  try {
    if (!idArquivoDrive) {
      return createSuccessResponse_('Sem foto para visualizar.', '');
    }
    var file = DriveApp.getFileById(idArquivoDrive);
    var blob = file.getBlob();
    var dataUrl = 'data:' + blob.getContentType() + ';base64,' + Utilities.base64Encode(blob.getBytes());
    return createSuccessResponse_('Preview gerado com sucesso.', dataUrl);
  } catch (error) {
    registrarLog('ALERTA', 'Nao foi possivel gerar preview da foto.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel carregar a foto.', error);
  }
}

