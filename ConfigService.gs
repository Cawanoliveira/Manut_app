function getConfig(chave) {
  var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.CONFIG, 'chave', chave);
  if (rowIndex === -1) {
    return '';
  }
  return safeString_(getSheet_(APP_CONFIG.SHEETS.CONFIG).getRange(rowIndex, 2).getValue());
}

function setConfig(chave, valor) {
  try {
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.CONFIG, 'chave', chave);
    if (rowIndex === -1) {
      appendSheetRecord_(APP_CONFIG.SHEETS.CONFIG, {
        chave: chave,
        valor: valor,
        descricao: ''
      });
    } else {
      getSheet_(APP_CONFIG.SHEETS.CONFIG).getRange(rowIndex, 2).setValue(valor);
    }
    registrarLog('INFO', 'Configuracao atualizada.', chave + '=' + valor);
    return createSuccessResponse_('Configuracao atualizada com sucesso.');
  } catch (error) {
    registrarLog('ERRO', 'Falha ao atualizar configuracao.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel atualizar a configuracao.', error);
  }
}

function listarConfiguracoes() {
  try {
    return createSuccessResponse_('Configuracoes carregadas.', getAllSheetData_(APP_CONFIG.SHEETS.CONFIG));
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar configuracoes.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar as configuracoes.', error);
  }
}

function salvarConfiguracoesSimples(configs) {
  try {
    (configs || []).forEach(function(item) {
      if (item && item.chave) {
        setConfig(item.chave, item.valor);
      }
    });
    return createSuccessResponse_('Configuracoes salvas com sucesso.');
  } catch (error) {
    registrarLog('ERRO', 'Falha ao salvar configuracoes simples.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel salvar as configuracoes.', error);
  }
}

function getFormSupportData() {
  return {
    lojas: (listarLojas().data || []).map(function(item) {
      return item.nome_loja;
    }),
    setores: (listarSetores().data || []).map(function(item) {
      return item.nome_setor;
    }),
    usuarios: (listarUsuarios().data || []).map(function(item) {
      return item.nome || item.email;
    }),
    prestadores: (listarPrestadores().data || []).map(function(item) {
      return item.nome_prestador;
    }),
    tipos: APP_CONFIG.TIPOS_VALIDOS.map(normalizeLabel_),
    prioridades: APP_CONFIG.PRIORIDADES_VALIDAS.map(normalizeLabel_),
    status: APP_CONFIG.STATUS_VALIDOS.map(normalizeLabel_)
  };
}

function salvarPrestador(nomePrestador) {
  try {
    var nome = sanitizeText_(nomePrestador);
    if (!nome) {
      return createErrorResponse_('Informe o nome do executor/prestador.');
    }
    upsertSheetRecordByKey_(APP_CONFIG.SHEETS.PRESTADORES, 'nome_prestador', {
      id_prestador: gerarId('PRE'),
      nome_prestador: nome,
      status: 'Ativo',
      data_cadastro: parseDateInput_(formatDateForInput_(now_()))
    });
    return createSuccessResponse_('Executor/prestador salvo com sucesso.', listarPrestadores().data || []);
  } catch (error) {
    registrarLog('ERRO', 'Falha ao salvar prestador.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel salvar o executor/prestador.', error);
  }
}
