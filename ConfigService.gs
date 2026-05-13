function getConfig(chave) {
  var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.CONFIG, 'chave', chave);
  if (rowIndex === -1) {
    if (chave === 'DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO') {
      setConfig(chave, '10');
      return '10';
    }
    return '';
  }
  var valor = safeString_(getSheet_(APP_CONFIG.SHEETS.CONFIG).getRange(rowIndex, 2).getValue());
  if (chave === 'DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO' && (!valor || valor === '30')) {
    setConfig(chave, '10');
    return '10';
  }
  return valor;
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
    var items = getAllSheetData_(APP_CONFIG.SHEETS.CONFIG).map(function(item) {
      if (item.chave === 'DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO' && (!item.valor || item.valor === '30')) {
        item.valor = '10';
      }
      return item;
    });
    return createSuccessResponse_('Configuracoes carregadas.', items);
  } catch (error) {
    registrarLog('ERRO', 'Falha ao listar configuracoes.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel listar as configuracoes.', error);
  }
}

function salvarConfiguracoesSimples(configs) {
  try {
    (configs || []).forEach(function(item) {
      if (item && item.chave && item.chave !== 'STATUS_PADRAO_NOVO_REGISTRO') {
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
    responsaveis: (listarUsuarios().data || []).map(function(item) {
      return item.nome || item.email;
    }),
    prestadores: (listarPrestadores().data || []).map(function(item) {
      return item.nome_prestador;
    }),
    tipos: getManagedOptionValues_('tipo'),
    prioridades: getManagedOptionValues_('prioridade'),
    status: getManagedOptionValues_('status')
  };
}

function listarOpcoesComboGerenciaveis() {
  return {
    loja: listarItensComboSheet_(APP_CONFIG.SHEETS.LOJAS, 'id_loja', 'nome_loja', false),
    setor: listarItensComboSheet_(APP_CONFIG.SHEETS.SETORES, 'id_setor', 'nome_setor', false),
    responsavel: listarItensComboSheet_(APP_CONFIG.SHEETS.USUARIOS, 'id_usuario', 'nome', true),
    tipo: listarItensComboConfig_('tipo'),
    prioridade: listarItensComboConfig_('prioridade'),
    status: listarItensComboConfig_('status'),
    executor: listarItensComboSheet_(APP_CONFIG.SHEETS.PRESTADORES, 'id_prestador', 'nome_prestador', true)
  };
}

function salvarOpcaoCombo(grupo, valor) {
  try {
    var grupoNormalizado = normalizeComboGroup_(grupo);
    var nome = normalizeComboOptionName_(grupoNormalizado, valor);
    if (!grupoNormalizado || !nome) {
      return createErrorResponse_('Informe um grupo e um valor valido.');
    }

    if (grupoNormalizado === 'loja') {
      saveSheetComboOption_(APP_CONFIG.SHEETS.LOJAS, 'id_loja', 'nome_loja', {
        id_loja: gerarId('LOJ'),
        nome_loja: nome,
        cidade: '',
        status: 'Ativo',
        data_cadastro: parseDateInput_(formatDateForInput_(now_()))
      });
    } else if (grupoNormalizado === 'setor') {
      saveSheetComboOption_(APP_CONFIG.SHEETS.SETORES, 'id_setor', 'nome_setor', {
        id_setor: gerarId('SET'),
        nome_setor: nome,
        status: 'Ativo',
        data_cadastro: parseDateInput_(formatDateForInput_(now_()))
      });
    } else if (grupoNormalizado === 'responsavel') {
      saveSheetComboOption_(APP_CONFIG.SHEETS.USUARIOS, 'id_usuario', 'nome', {
        id_usuario: gerarId('USR'),
        nome: nome,
        email: '',
        perfil: 'Responsavel',
        status: 'Ativo',
        data_cadastro: parseDateInput_(formatDateForInput_(now_()))
      });
    } else if (grupoNormalizado === 'executor') {
      saveSheetComboOption_(APP_CONFIG.SHEETS.PRESTADORES, 'id_prestador', 'nome_prestador', {
        id_prestador: gerarId('PRE'),
        nome_prestador: nome,
        status: 'Ativo',
        data_cadastro: parseDateInput_(formatDateForInput_(now_()))
      });
    } else {
      addManagedConfigOption_(grupoNormalizado, nome);
    }

    aplicarValidacoesBasicas_();
    SpreadsheetApp.flush();
    return createSuccessResponse_('Opcao salva com sucesso.', buildComboManagementPayload_());
  } catch (error) {
    registrarLog('ERRO', 'Falha ao salvar opcao de combo.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel salvar a opcao.', error);
  }
}

function excluirOpcaoCombo(grupo, idOuValor) {
  try {
    var grupoNormalizado = normalizeComboGroup_(grupo);
    var chave = safeString_(idOuValor);
    if (!grupoNormalizado || !chave) {
      return createErrorResponse_('Grupo ou opcao invalida.');
    }

    if (grupoNormalizado === 'loja') {
      deleteSheetComboItem_(APP_CONFIG.SHEETS.LOJAS, 'id_loja', 'nome_loja', chave);
    } else if (grupoNormalizado === 'setor') {
      deleteSheetComboItem_(APP_CONFIG.SHEETS.SETORES, 'id_setor', 'nome_setor', chave);
    } else if (grupoNormalizado === 'responsavel') {
      deleteSheetComboItem_(APP_CONFIG.SHEETS.USUARIOS, 'id_usuario', 'nome', chave);
    } else if (grupoNormalizado === 'executor') {
      deleteSheetComboItem_(APP_CONFIG.SHEETS.PRESTADORES, 'id_prestador', 'nome_prestador', chave);
    } else {
      removeManagedConfigOption_(grupoNormalizado, chave);
    }

    aplicarValidacoesBasicas_();
    SpreadsheetApp.flush();
    return createSuccessResponse_('Opcao removida com sucesso.', buildComboManagementPayload_());
  } catch (error) {
    registrarLog('ERRO', 'Falha ao excluir opcao de combo.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel excluir a opcao.', error);
  }
}

function alterarStatusOpcaoCombo(grupo, idOuValor, novoStatus) {
  try {
    var grupoNormalizado = normalizeComboGroup_(grupo);
    var chave = safeString_(idOuValor);
    var status = normalizeLabel_(novoStatus);
    if (!grupoNormalizado || !chave || !status) {
      return createErrorResponse_('Dados invalidos para alterar o status.');
    }

    if (grupoNormalizado === 'responsavel') {
      updateSheetComboStatus_(APP_CONFIG.SHEETS.USUARIOS, 'id_usuario', 'nome', chave, status);
    } else if (grupoNormalizado === 'executor') {
      updateSheetComboStatus_(APP_CONFIG.SHEETS.PRESTADORES, 'id_prestador', 'nome_prestador', chave, status);
    } else {
      return createErrorResponse_('Este grupo nao permite ativar ou desativar itens.');
    }

    aplicarValidacoesBasicas_();
    SpreadsheetApp.flush();
    return createSuccessResponse_('Status da opcao atualizado com sucesso.', buildComboManagementPayload_());
  } catch (error) {
    registrarLog('ERRO', 'Falha ao alterar status da opcao de combo.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel alterar o status da opcao.', error);
  }
}

function salvarPrestador(nomePrestador) {
  try {
    var nome = normalizeComboOptionName_('executor', nomePrestador);
    if (!nome) {
      return createErrorResponse_('Informe o nome do executor/prestador.');
    }
    upsertSheetRecordByKey_(APP_CONFIG.SHEETS.PRESTADORES, 'nome_prestador', {
      id_prestador: gerarId('PRE'),
      nome_prestador: nome,
      status: 'Ativo',
      data_cadastro: parseDateInput_(formatDateForInput_(now_()))
    });
    return createSuccessResponse_('Executor/prestador salvo com sucesso.', buildPrestadoresPayload_());
  } catch (error) {
    registrarLog('ERRO', 'Falha ao salvar prestador.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel salvar o executor/prestador.', error);
  }
}

function alterarStatusPrestador(idPrestador, novoStatus) {
  try {
    var id = sanitizeText_(idPrestador);
    var status = sanitizeText_(novoStatus);
    if (!id || !status) {
      return createErrorResponse_('Prestador ou status invalido.');
    }
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.PRESTADORES, 'id_prestador', id);
    if (rowIndex === -1) {
      return createErrorResponse_('Prestador nao encontrado.');
    }
    updateSheetRecordByRow_(APP_CONFIG.SHEETS.PRESTADORES, rowIndex, {
      status: status
    });
    return createSuccessResponse_('Status do executor/prestador atualizado com sucesso.', buildPrestadoresPayload_());
  } catch (error) {
    registrarLog('ERRO', 'Falha ao atualizar status do prestador.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel atualizar o status do executor/prestador.', error);
  }
}

function excluirPrestador(idPrestador) {
  try {
    var id = sanitizeText_(idPrestador);
    if (!id) {
      return createErrorResponse_('Prestador invalido.');
    }
    var rowIndex = findRowIndexByValue_(APP_CONFIG.SHEETS.PRESTADORES, 'id_prestador', id);
    if (rowIndex === -1) {
      return createErrorResponse_('Prestador nao encontrado.');
    }
    getSheet_(APP_CONFIG.SHEETS.PRESTADORES).deleteRow(rowIndex);
    return createSuccessResponse_('Executor/prestador excluido com sucesso.', buildPrestadoresPayload_());
  } catch (error) {
    registrarLog('ERRO', 'Falha ao excluir prestador.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel excluir o executor/prestador.', error);
  }
}

function buildPrestadoresPayload_() {
  return {
    ativos: getFormSupportData().prestadores || [],
    todos: listarPrestadoresTodos().data || []
  };
}

function buildComboManagementPayload_() {
  return {
    combos: getFormSupportData(),
    admin: listarOpcoesComboGerenciaveis()
  };
}

function getManagedOptionValues_(grupo) {
  return getManagedOptionItems_(grupo)
    .filter(function(item) {
      return normalizeCompare_(item.status || 'Ativo') !== 'inativo';
    })
    .map(function(item) {
      return item.nome;
    });
}

function getManagedOptionItems_(grupo) {
  var grupoNormalizado = normalizeComboGroup_(grupo);
  if (grupoNormalizado === 'tipo') {
    return parseManagedConfigOptions_(grupoNormalizado, APP_CONFIG.TIPOS_VALIDOS);
  }
  if (grupoNormalizado === 'prioridade') {
    return parseManagedConfigOptions_(grupoNormalizado, APP_CONFIG.PRIORIDADES_VALIDAS);
  }
  if (grupoNormalizado === 'status') {
    return parseManagedConfigOptions_(grupoNormalizado, APP_CONFIG.STATUS_VALIDOS);
  }
  return [];
}

function parseManagedConfigOptions_(grupo, fallbackValues) {
  var configKey = getManagedConfigKey_(grupo);
  var raw = safeString_(getConfig(configKey));
  var items = [];
  if (raw) {
    try {
      items = JSON.parse(raw);
    } catch (error) {
      items = [];
    }
  }
  if (!Array.isArray(items) || !items.length) {
    items = (fallbackValues || []).map(function(value, index) {
      return {
        id: grupo.toUpperCase() + '_' + (index + 1),
        nome: normalizeLabel_(value),
        status: 'Ativo'
      };
    });
  }
  return items.map(function(item, index) {
    if (typeof item === 'string') {
      return {
        id: grupo.toUpperCase() + '_' + (index + 1),
        nome: normalizeLabel_(item),
        status: 'Ativo'
      };
    }
    return {
      id: safeString_(item.id) || (grupo.toUpperCase() + '_' + (index + 1)),
      nome: normalizeLabel_(item.nome || item.label || item.value),
      status: normalizeLabel_(item.status || 'Ativo') || 'Ativo'
    };
  }).filter(function(item) {
    return !!item.nome;
  });
}

function saveManagedConfigOptions_(grupo, items) {
  var configKey = getManagedConfigKey_(grupo);
  setConfig(configKey, JSON.stringify((items || []).map(function(item, index) {
    return {
      id: safeString_(item.id) || (grupo.toUpperCase() + '_' + (index + 1)),
      nome: normalizeLabel_(item.nome),
      status: normalizeLabel_(item.status || 'Ativo') || 'Ativo'
    };
  })));
}

function addManagedConfigOption_(grupo, nome) {
  var items = getManagedOptionItems_(grupo);
  var normalizedName = normalizeComboOptionName_(grupo, nome);
  var targetKey = normalizeCompare_(stripAccents_(normalizedName));
  var existing = items.filter(function(item) {
    return normalizeCompare_(stripAccents_(item.nome)) === targetKey;
  })[0];
  if (existing) {
    existing.status = 'Ativo';
    existing.nome = normalizedName;
  } else {
    items.push({
      id: grupo.toUpperCase() + '_' + new Date().getTime(),
      nome: normalizedName,
      status: 'Ativo'
    });
  }
  saveManagedConfigOptions_(grupo, items);
}

function removeManagedConfigOption_(grupo, idOuValor) {
  var lookup = normalizeCompare_(stripAccents_(idOuValor));
  var items = getManagedOptionItems_(grupo).filter(function(item) {
    return normalizeCompare_(stripAccents_(item.id)) !== lookup &&
      normalizeCompare_(stripAccents_(item.nome)) !== lookup;
  });
  saveManagedConfigOptions_(grupo, items);
}

function listarItensComboConfig_(grupo) {
  return getManagedOptionItems_(grupo).map(function(item) {
    return {
      id: item.id,
      nome: item.nome,
      status: normalizeLabel_(item.status || 'Ativo') || 'Ativo',
      permiteStatus: false,
      permiteExcluir: true
    };
  });
}

function listarItensComboSheet_(sheetName, idField, nameField, allowStatus) {
  return getAllSheetData_(sheetName).map(function(item) {
    return {
      id: item[idField],
      nome: normalizeLabel_(item[nameField]),
      status: normalizeLabel_(item.status || 'Ativo') || 'Ativo',
      permiteStatus: !!allowStatus,
      permiteExcluir: true
    };
  }).filter(function(item) {
    return !!item.nome;
  });
}

function deleteSheetComboItem_(sheetName, idField, nameField, idOuValor) {
  var rowIndex = findRowIndexByValue_(sheetName, idField, idOuValor);
  if (rowIndex === -1) {
    rowIndex = findRowIndexByValue_(sheetName, nameField, normalizeLabel_(idOuValor));
  }
  if (rowIndex === -1) {
    throw new Error('Opcao nao encontrada para exclusao.');
  }
  getSheet_(sheetName).deleteRow(rowIndex);
}

function updateSheetComboStatus_(sheetName, idField, nameField, idOuValor, status) {
  var rowIndex = findRowIndexByValue_(sheetName, idField, idOuValor);
  if (rowIndex === -1) {
    rowIndex = findRowIndexByValue_(sheetName, nameField, normalizeLabel_(idOuValor));
  }
  if (rowIndex === -1) {
    throw new Error('Opcao nao encontrada para atualizar status.');
  }
  updateSheetRecordByRow_(sheetName, rowIndex, {
    status: status
  });
}

function saveSheetComboOption_(sheetName, idField, nameField, data) {
  var rowIndex = findRowIndexByValue_(sheetName, nameField, data[nameField]);
  if (rowIndex > -1) {
    updateSheetRecordByRow_(sheetName, rowIndex, {
      status: 'Ativo',
      nome: data.nome,
      nome_loja: data.nome_loja,
      nome_setor: data.nome_setor,
      nome_prestador: data.nome_prestador
    });
    return;
  }
  appendSheetRecord_(sheetName, data);
}

function normalizeComboOptionName_(grupo, valor) {
  var group = normalizeComboGroup_(grupo);
  var raw = sanitizeText_(valor);
  if (!raw) {
    return '';
  }
  if (group === 'loja') {
    return normalizeLojaOptionName_(raw);
  }
  return normalizeLabel_(raw);
}

function normalizeLojaOptionName_(valor) {
  var text = stripAccents_(safeString_(valor)).toUpperCase();
  var match = text.match(/(\d{1,3})/);
  if (match) {
    var number = Number(match[1]);
    return 'LOJA ' + (number < 10 ? '0' + number : String(number));
  }
  return text;
}

function getManagedConfigKey_(grupo) {
  var map = {
    tipo: 'OPCOES_TIPOS',
    prioridade: 'OPCOES_PRIORIDADES',
    status: 'OPCOES_STATUS'
  };
  var key = map[normalizeComboGroup_(grupo)];
  if (!key) {
    throw new Error('Grupo de configuracao nao suportado: ' + grupo);
  }
  return key;
}

function normalizeComboGroup_(grupo) {
  var normalized = normalizeCompare_(stripAccents_(grupo));
  var map = {
    lojas: 'loja',
    loja: 'loja',
    setores: 'setor',
    setor: 'setor',
    responsavel: 'responsavel',
    responsaveis: 'responsavel',
    tipos: 'tipo',
    tipo: 'tipo',
    prioridades: 'prioridade',
    prioridade: 'prioridade',
    status: 'status',
    prestador: 'executor',
    prestadores: 'executor',
    executor: 'executor'
  };
  return map[normalized] || '';
}
