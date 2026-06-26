(function() {
  var DEFAULT_STATUS = ['Aberto', 'Em andamento', 'Aguardando', 'Concluido', 'Cancelado'];
  var DEFAULT_PRIORIDADES = ['Critica', 'Alta', 'Media', 'Baixa', 'Projeto'];
  var DEFAULT_TIPOS = ['Melhoria', 'Manutencao', 'Limpeza', 'Organizacao', 'Seguranca', 'Outro'];
  var DEFAULT_LOJAS = [];
  var DEFAULT_CONFIG = [
    ['DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO', '10', 'Quantidade de dias apos conclusao para excluir fotos'],
    ['STATUS_PADRAO_NOVO_REGISTRO', 'Aberto', 'Status inicial de novas pendencias'],
    ['SLA_CRITICA_DIAS', '7', 'Prazo sugerido em dias para pendencias de prioridade critica'],
    ['SLA_ALTA_DIAS', '14', 'Prazo sugerido em dias para pendencias de prioridade alta'],
    ['SLA_MEDIA_DIAS', '21', 'Prazo sugerido em dias para pendencias de prioridade media'],
    ['SLA_BAIXA_DIAS', '28', 'Prazo sugerido em dias para pendencias de prioridade baixa'],
    ['SLA_PROJETO_DIAS', '30', 'Prazo sugerido em dias para pendencias de prioridade projeto'],
    ['PERMITIR_EXCLUSAO_FOTO_AUTOMATICA', 'SIM', 'Define se fotos serao excluidas automaticamente'],
    ['VERSAO_SISTEMA', '1.0', 'Versao inicial do sistema']
  ];
  var GROUP_CONFIG_MAP = {
    tipo: 'OPCOES_TIPOS',
    prioridade: 'OPCOES_PRIORIDADES',
    status: 'OPCOES_STATUS'
  };
  var FIREBASE_METHODS = {
    pingBridge: true,
    getAppInitData: true,
    listarPendencias: true,
    buscarPendenciaPorId: true,
    criarPendencia: true,
    atualizarPendencia: true,
    alterarStatusPendencia: true,
    concluirPendencia: true,
    excluirPendencia: true,
    obterFotoPreviewPendencia: true,
    salvarPrestador: true,
    alterarStatusPrestador: true,
    excluirPrestador: true,
    salvarOpcaoCombo: true,
    excluirOpcaoCombo: true,
    alterarStatusOpcaoCombo: true,
    salvarConfiguracoesSimples: true,
    setupSistema: true,
    criarTriggerLimpezaFotos: true,
    criarOrcamentoPendencias: true,
    gerarPdfOrcamento: true,
    excluirOrcamento: true,
    gerarCronogramaPdf: true,
    gerarCronogramaExcel: true
  };
  var firebaseState = {
    app: null,
    db: null
  };

  function safeString(value) {
    return value === null || value === undefined ? '' : String(value).trim();
  }

  function stripAccents(value) {
    return safeString(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function normalizeText(value) {
    return stripAccents(value).toLowerCase();
  }

  function sanitizeText(value) {
    return safeString(value).replace(/\s+/g, ' ').trim();
  }

  function normalizeLabel(value) {
    var text = safeString(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) {
      return '';
    }
    return text.split(' ').map(function(part) {
      return part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '';
    }).join(' ');
  }

  function createSuccessResponse(message, data) {
    return {
      success: true,
      message: message || 'OK',
      data: data === undefined ? null : data
    };
  }

  function createErrorResponse(message, error) {
    return {
      success: false,
      message: message || 'Erro inesperado.',
      error: error ? (error.message || String(error)) : null
    };
  }

  function getCurrentUserIdentifier() {
    if (window.firebase && typeof window.firebase.auth === 'function') {
      try {
        var currentUser = window.firebase.auth().currentUser;
        var currentEmail = safeString(currentUser && currentUser.email);
        if (currentEmail) {
          return currentEmail;
        }
      } catch (error) {}
    }
    var config = window.PWA_CONFIG || {};
    return safeString(config.currentUserEmail) || 'firebase-copy@local';
  }

  function parseDateInput(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }
    var text = safeString(value);
    if (!text) {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      var isoParts = text.split('-');
      return new Date(Number(isoParts[0]), Number(isoParts[1]) - 1, Number(isoParts[2]));
    }
    var brDateTimeMatch = text.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (brDateTimeMatch) {
      return new Date(
        Number(brDateTimeMatch[3]),
        Number(brDateTimeMatch[2]) - 1,
        Number(brDateTimeMatch[1]),
        Number(brDateTimeMatch[4] || 0),
        Number(brDateTimeMatch[5] || 0),
        Number(brDateTimeMatch[6] || 0)
      );
    }
    var parsed = new Date(text);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function pad2(value) {
    return String(value).padStart(2, '0');
  }

  function formatDateForInput(value) {
    var date = parseDateInput(value);
    if (!date) {
      return '';
    }
    return [
      date.getFullYear(),
      pad2(date.getMonth() + 1),
      pad2(date.getDate())
    ].join('-');
  }

  function formatDateTimeBr(value) {
    var date = parseDateInput(value);
    if (!date) {
      return '';
    }
    return [
      pad2(date.getDate()),
      '/',
      pad2(date.getMonth() + 1),
      '/',
      date.getFullYear(),
      ' ',
      pad2(date.getHours()),
      ':',
      pad2(date.getMinutes()),
      ':',
      pad2(date.getSeconds())
    ].join('');
  }

  function formatDateLabel(value) {
    var date = parseDateInput(value);
    if (!date) {
      return '';
    }
    return [
      pad2(date.getDate()),
      '/',
      pad2(date.getMonth() + 1),
      '/',
      date.getFullYear()
    ].join('');
  }

  function formatTimeValue(value) {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      return [pad2(value.getHours()), pad2(value.getMinutes()), pad2(value.getSeconds())].join(':');
    }
    var text = safeString(value);
    if (!text) {
      return '';
    }
    var match = text.match(/(\d{2}:\d{2}(?::\d{2})?)$/);
    if (!match) {
      return text;
    }
    return match[1].length === 5 ? match[1] + ':00' : match[1];
  }

  function generateId(prefix) {
    var now = new Date();
    var stamp = [
      now.getFullYear(),
      pad2(now.getMonth() + 1),
      pad2(now.getDate()),
      pad2(now.getHours()),
      pad2(now.getMinutes()),
      pad2(now.getSeconds())
    ].join('');
    var suffix = String(Math.floor(Math.random() * 9000) + 1000);
    return (prefix || 'ID') + '-' + stamp + '-' + suffix;
  }

  function addCalendarDays(baseDate, days) {
    var date = parseDateInput(baseDate);
    var amount = Number(days || 0);
    if (!date || isNaN(date.getTime())) {
      return null;
    }
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
  }

  function parseCurrencyValue(value) {
    if (typeof value === 'number') {
      return value;
    }
    var text = safeString(value);
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

  function formatCurrencyBr(value) {
    var number = Number(value || 0);
    if (!isFinite(number)) {
      number = 0;
    }
    var fixed = number.toFixed(2).split('.');
    var integerPart = fixed[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return 'R$ ' + integerPart + ',' + fixed[1];
  }

  function sanitizeFileName(value) {
    return safeString(value)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function getConfigObject() {
    return window.PWA_CONFIG || {};
  }

  function isEnabled() {
    var config = getConfigObject();
    return config.backendMode === 'firebase' && !!config.firebase;
  }

  function canHandle(functionName) {
    return !!FIREBASE_METHODS[functionName];
  }

  function ensureFirebase() {
    if (!isEnabled()) {
      return Promise.reject(new Error('Firebase Bridge desabilitado.'));
    }
    if (firebaseState.db) {
      return Promise.resolve(firebaseState.db);
    }
    if (!window.firebase) {
      return Promise.reject(new Error('SDK do Firebase nao foi carregado.'));
    }
    if (!firebaseState.app) {
      firebaseState.app = window.firebase.apps.length
        ? window.firebase.app()
        : window.firebase.initializeApp(getConfigObject().firebase);
    }
    firebaseState.db = window.firebase.firestore();
    return Promise.resolve(firebaseState.db);
  }

  function collectionRef(name) {
    return firebaseState.db.collection(name);
  }

  function mapDocs(snapshot) {
    return snapshot.docs.map(function(doc) {
      var data = doc.data() || {};
      data.__docId = doc.id;
      return data;
    });
  }

  async function listCollection(name) {
    var snapshot = await collectionRef(name).get();
    return mapDocs(snapshot);
  }

  async function getDoc(collectionName, docId) {
    var snapshot = await collectionRef(collectionName).doc(docId).get();
    return snapshot.exists ? snapshot.data() : null;
  }

  async function setDoc(collectionName, docId, data, merge) {
    await collectionRef(collectionName).doc(docId).set(data, { merge: merge !== false });
  }

  async function deleteDoc(collectionName, docId) {
    await collectionRef(collectionName).doc(docId).delete();
  }

  function buildDefaultConfigDocs() {
    return DEFAULT_CONFIG.map(function(entry) {
      return {
        chave: entry[0],
        valor: entry[1],
        descricao: entry[2]
      };
    });
  }

  function getConfigValue(configs, key, fallback) {
    var target = null;
    (configs || []).forEach(function(item) {
      if (!target && safeString(item.chave) === safeString(key)) {
        target = item;
      }
    });
    if (target && safeString(target.valor)) {
      return safeString(target.valor);
    }
    return fallback === undefined ? '' : safeString(fallback);
  }

  function mergeConfigDefaults(configs) {
    var byKey = {};
    (configs || []).forEach(function(item) {
      if (!byKey[item.chave]) {
        byKey[item.chave] = {
          chave: item.chave,
          valor: safeString(item.valor),
          descricao: safeString(item.descricao)
        };
      }
    });
    buildDefaultConfigDocs().forEach(function(item) {
      if (!byKey[item.chave]) {
        byKey[item.chave] = item;
      } else if (!safeString(byKey[item.chave].descricao)) {
        byKey[item.chave].descricao = item.descricao;
      }
    });
    return Object.keys(byKey).sort().map(function(key) {
      return byKey[key];
    });
  }

  function getManagedConfigKey(group) {
    return GROUP_CONFIG_MAP[group] || '';
  }

  function getManagedOptionItems(group, configs) {
    var key = getManagedConfigKey(group);
    var fallbackValues = group === 'tipo' ? DEFAULT_TIPOS : (group === 'prioridade' ? DEFAULT_PRIORIDADES : DEFAULT_STATUS);
    var raw = key ? getConfigValue(configs, key, '') : '';
    var items = [];
    if (raw) {
      try {
        items = JSON.parse(raw);
      } catch (error) {
        items = [];
      }
    }
    if (!Array.isArray(items) || !items.length) {
      items = fallbackValues.map(function(value, index) {
        return {
          id: group.toUpperCase() + '_' + (index + 1),
          nome: normalizeLabel(value),
          status: 'Ativo'
        };
      });
    }
    return items.map(function(item, index) {
      if (typeof item === 'string') {
        return {
          id: group.toUpperCase() + '_' + (index + 1),
          nome: normalizeLabel(item),
          status: 'Ativo'
        };
      }
      return {
        id: safeString(item.id) || (group.toUpperCase() + '_' + (index + 1)),
        nome: normalizeLabel(item.nome || item.label || item.value),
        status: normalizeLabel(item.status || 'Ativo') || 'Ativo'
      };
    }).filter(function(item) {
      return !!item.nome;
    });
  }

  function getManagedOptionValues(group, configs) {
    return getManagedOptionItems(group, configs).filter(function(item) {
      return normalizeText(item.status || 'Ativo') !== 'inativo';
    }).map(function(item) {
      return item.nome;
    });
  }

  function normalizeLojaOptionName(value) {
    var text = stripAccents(value).toUpperCase();
    var match = text.match(/(\d{1,3})/);
    if (match) {
      var number = Number(match[1]);
      return 'LOJA ' + (number < 10 ? '0' + number : String(number));
    }
    return text;
  }

  function normalizeComboGroup(group) {
    var normalized = normalizeText(group);
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

  function normalizeComboOptionName(group, value) {
    var clean = sanitizeText(value);
    if (!clean) {
      return '';
    }
    return normalizeComboGroup(group) === 'loja' ? normalizeLojaOptionName(clean) : normalizeLabel(clean);
  }

  function listAdminItems(docs, idField, nameField, allowStatus) {
    return (docs || []).map(function(item) {
      return {
        id: safeString(item[idField]),
        nome: normalizeLabel(item[nameField]),
        status: normalizeLabel(item.status || 'Ativo') || 'Ativo',
        permiteStatus: !!allowStatus,
        permiteExcluir: true
      };
    }).filter(function(item) {
      return !!item.nome;
    });
  }

  function listConfigAdminItems(group, configs) {
    return getManagedOptionItems(group, configs).map(function(item) {
      return {
        id: item.id,
        nome: item.nome,
        status: item.status,
        permiteStatus: false,
        permiteExcluir: true
      };
    });
  }

  function buildFormSupportData(baseData) {
    var lojas = (baseData.lojas || []).filter(function(item) {
      return normalizeText(item.status || 'Ativo') !== 'inativo';
    }).map(function(item) {
      return item.nome_loja;
    });
    var setores = (baseData.setores || []).filter(function(item) {
      return normalizeText(item.status || 'Ativo') !== 'inativo';
    }).map(function(item) {
      return item.nome_setor;
    });
    var usuarios = (baseData.usuarios || []).filter(function(item) {
      return normalizeText(item.status || 'Ativo') !== 'inativo';
    }).map(function(item) {
      return item.nome || item.email;
    });
    var prestadores = (baseData.prestadores || []).filter(function(item) {
      return normalizeText(item.status || 'Ativo') !== 'inativo';
    }).map(function(item) {
      return item.nome_prestador;
    });
    return {
      lojas: lojas.length ? lojas : DEFAULT_LOJAS.slice(),
      setores: setores,
      usuarios: usuarios,
      responsaveis: usuarios.slice(),
      prestadores: prestadores,
      tipos: getManagedOptionValues('tipo', baseData.configs),
      prioridades: getManagedOptionValues('prioridade', baseData.configs),
      status: getManagedOptionValues('status', baseData.configs)
    };
  }

  function buildComboAdmin(baseData) {
    return {
      loja: listAdminItems(baseData.lojas, 'id_loja', 'nome_loja', false),
      setor: listAdminItems(baseData.setores, 'id_setor', 'nome_setor', false),
      responsavel: listAdminItems(baseData.usuarios, 'id_usuario', 'nome', true),
      tipo: listConfigAdminItems('tipo', baseData.configs),
      prioridade: listConfigAdminItems('prioridade', baseData.configs),
      status: listConfigAdminItems('status', baseData.configs),
      executor: listAdminItems(baseData.prestadores, 'id_prestador', 'nome_prestador', true)
    };
  }

  async function fetchBaseData() {
    var results = await Promise.all([
      listCollection('configs'),
      listCollection('lojas'),
      listCollection('setores'),
      listCollection('usuarios'),
      listCollection('prestadores')
    ]);
    return {
      configs: mergeConfigDefaults(results[0]),
      lojas: results[1],
      setores: results[2],
      usuarios: results[3],
      prestadores: results[4]
    };
  }

  function normalizeFilterList(filterValue) {
    if (Array.isArray(filterValue)) {
      return filterValue.map(normalizeText).filter(function(value) {
        return !!value;
      });
    }
    var normalized = normalizeText(filterValue);
    return normalized ? [normalized] : [];
  }

  function matchesFilterSelection(value, filterValue) {
    var normalizedFilter = normalizeFilterList(filterValue);
    if (!normalizedFilter.length) {
      return true;
    }
    return normalizedFilter.indexOf(normalizeText(value)) > -1;
  }

  function dateWithinRange(dateValue, fromValue, toValue) {
    if (!fromValue && !toValue) {
      return true;
    }
    var date = parseDateInput(dateValue);
    if (!date) {
      return false;
    }
    var from = fromValue ? parseDateInput(fromValue) : null;
    var to = toValue ? parseDateInput(toValue) : null;
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

  function isPendenciaFinalizada(status) {
    var normalized = normalizeText(status);
    return normalized === 'concluido' || normalized === 'cancelado';
  }

  function isPendenciaVencida(item) {
    var previsao = parseDateInput(item.previsao_entrega);
    if (!previsao) {
      return false;
    }
    if (isPendenciaFinalizada(item.status)) {
      return false;
    }
    var hoje = parseDateInput(formatDateForInput(new Date()));
    return previsao < hoje;
  }

  function decoratePendencia(record) {
    var item = Object.assign({}, record || {});
    item.status = normalizeLabel(item.status);
    item.prioridade = normalizeLabel(item.prioridade);
    item.tipo = normalizeLabel(item.tipo);
    if (!item.solicitante || normalizeText(item.solicitante) === 'usuario_nao_identificado') {
      item.solicitante = getCurrentUserIdentifier();
    }
    item.data_abertura_label = formatDateLabel(item.data_abertura);
    item.previsao_entrega_label = formatDateLabel(item.previsao_entrega);
    item.data_conclusao_label = formatDateLabel(item.data_conclusao);
    item.esta_vencida = isPendenciaVencida(item);
    return item;
  }

  function applyPendenciasFilters(items, filtros) {
    return (items || []).filter(function(item) {
      var statusAtual = normalizeText(item.status);
      if (filtros.apenasHistorico) {
        if (statusAtual !== 'concluido' && statusAtual !== 'cancelado') {
          return false;
        }
      } else if (!filtros.incluirFinalizadas) {
        if (statusAtual === 'concluido' || statusAtual === 'cancelado') {
          return false;
        }
      }
      if (!matchesFilterSelection(item.loja, filtros.loja)) return false;
      if (!matchesFilterSelection(item.setor, filtros.setor)) return false;
      if (!matchesFilterSelection(item.status, filtros.status)) return false;
      if (!matchesFilterSelection(item.responsavel, filtros.responsavel)) return false;
      if (!matchesFilterSelection(item.executor, filtros.executor)) return false;
      if (!matchesFilterSelection(item.prioridade, filtros.prioridade)) return false;
      if (!matchesFilterSelection(item.tipo, filtros.tipo)) return false;
      if ((filtros.dataAberturaDe || filtros.dataAberturaAte) && !dateWithinRange(item.data_abertura, filtros.dataAberturaDe, filtros.dataAberturaAte)) return false;
      if ((filtros.previsaoEntregaDe || filtros.previsaoEntregaAte) && !dateWithinRange(item.previsao_entrega, filtros.previsaoEntregaDe, filtros.previsaoEntregaAte)) return false;
      return true;
    }).sort(function(a, b) {
      return safeString(b.id_pendencia).localeCompare(safeString(a.id_pendencia));
    });
  }

  async function listPendenciasRaw() {
    var docs = await listCollection('pendencias');
    return docs.map(decoratePendencia);
  }

  async function listHistoricoByPendencia(idPendencia) {
    var snapshot = await collectionRef('pendencias').doc(idPendencia).collection('historico').get();
    return mapDocs(snapshot).map(function(item) {
      item.status_anterior = normalizeLabel(item.status_anterior);
      item.status_novo = normalizeLabel(item.status_novo);
      item.data_label = formatDateLabel(item.data);
      item.hora = formatTimeValue(item.hora);
      return item;
    }).sort(function(a, b) {
      var chaveA = parseDateInput((a.data_label || formatDateLabel(a.data) || '') + ' ' + formatTimeValue(a.hora));
      var chaveB = parseDateInput((b.data_label || formatDateLabel(b.data) || '') + ' ' + formatTimeValue(b.hora));
      var tempoA = chaveA && !isNaN(chaveA.getTime()) ? chaveA.getTime() : 0;
      var tempoB = chaveB && !isNaN(chaveB.getTime()) ? chaveB.getTime() : 0;
      return tempoB - tempoA;
    });
  }

  async function buildPendenciaPayloadById(id) {
    var record = await getDoc('pendencias', id);
    if (!record) {
      return null;
    }
    var item = decoratePendencia(record);
    item.historico = await listHistoricoByPendencia(id);
    item.foto_preview = '';
    return item;
  }

  function getPrioritySlaDays(prioridade, configs) {
    var normalized = normalizeText(prioridade);
    var keyMap = {
      critica: 'SLA_CRITICA_DIAS',
      alta: 'SLA_ALTA_DIAS',
      media: 'SLA_MEDIA_DIAS',
      baixa: 'SLA_BAIXA_DIAS',
      projeto: 'SLA_PROJETO_DIAS'
    };
    var fallbackMap = {
      critica: 7,
      alta: 14,
      media: 21,
      baixa: 28,
      projeto: 30
    };
    var configKey = keyMap[normalized] || 'SLA_MEDIA_DIAS';
    var fallback = fallbackMap[normalized] === undefined ? 21 : fallbackMap[normalized];
    var configured = Number(getConfigValue(configs, configKey, String(fallback)));
    return isFinite(configured) && configured >= 0 ? configured : fallback;
  }

  function hasOwnField(source, key) {
    return Object.prototype.hasOwnProperty.call(source || {}, key);
  }

  function validatePendenciaData(dados, modo, configs) {
    var errors = [];
    var sanitized = {
      loja: sanitizeText(dados && dados.loja),
      setor: sanitizeText(dados && dados.setor),
      tipo: normalizeLabel(dados && dados.tipo),
      prioridade: normalizeLabel(dados && dados.prioridade),
      descricao: sanitizeText(dados && dados.descricao),
      observacao: sanitizeText(dados && dados.observacao),
      solicitante: sanitizeText(dados && dados.solicitante) || getCurrentUserIdentifier(),
      responsavel: sanitizeText(dados && dados.responsavel),
      executor: sanitizeText(dados && dados.executor),
      data_inicio: dados && dados.data_inicio ? formatDateForInput(dados.data_inicio) : '',
      previsao_entrega: dados && dados.previsao_entrega ? formatDateForInput(dados.previsao_entrega) : '',
      status: normalizeLabel(dados && dados.status),
      foto: dados && dados.foto ? dados.foto : null
    };
    var validStatus = getManagedOptionValues('status', configs);
    var validPrioridades = getManagedOptionValues('prioridade', configs);
    var validTipos = getManagedOptionValues('tipo', configs);

    if (modo === 'criacao' || hasOwnField(dados, 'loja')) {
      if (!sanitized.loja) errors.push('Loja e obrigatoria.');
    }
    if (modo === 'criacao' || hasOwnField(dados, 'setor')) {
      if (!sanitized.setor) errors.push('Setor e obrigatorio.');
    }
    if (modo === 'criacao' || hasOwnField(dados, 'descricao')) {
      if (!sanitized.descricao) errors.push('Descricao e obrigatoria.');
    }
    if (sanitized.status && validStatus.indexOf(sanitized.status) === -1) {
      errors.push('Status invalido.');
    }
    if (sanitized.prioridade && validPrioridades.indexOf(sanitized.prioridade) === -1) {
      errors.push('Prioridade invalida.');
    }
    if (sanitized.tipo && validTipos.indexOf(sanitized.tipo) === -1) {
      errors.push('Tipo invalido.');
    }
    if (dados && dados.previsao_entrega && !parseDateInput(dados.previsao_entrega)) {
      errors.push('Data de previsao invalida.');
    }
    if (dados && dados.data_inicio && !parseDateInput(dados.data_inicio)) {
      errors.push('Data de inicio invalida.');
    }
    if (sanitized.foto && sanitized.foto.base64) {
      errors.push('Fotos ainda nao estao habilitadas nesta copia Firebase. Ative o billing para migrarmos o Storage.');
    }
    return {
      valid: errors.length === 0,
      errors: errors,
      sanitized: sanitized
    };
  }

  function resolvePendenciaWorkflowStatus(currentRecord, clean, dados, modo, defaultStatus) {
    var explicitStatus = clean.status ? normalizeLabel(clean.status) : '';
    var currentStatus = normalizeLabel(currentRecord && currentRecord.status);
    var baseStatus = explicitStatus || currentStatus || normalizeLabel(defaultStatus) || 'Aberto';
    var workflowTouched = modo === 'criacao' ||
      hasOwnField(dados, 'executor') ||
      hasOwnField(dados, 'data_inicio') ||
      hasOwnField(dados, 'previsao_entrega');

    if (explicitStatus) return explicitStatus;
    if (isPendenciaFinalizada(baseStatus)) return baseStatus;
    if (!workflowTouched) return baseStatus;

    var hasInicio = hasOwnField(dados, 'data_inicio') ? !!clean.data_inicio : !!(currentRecord && currentRecord.data_inicio);
    var hasExecutor = hasOwnField(dados, 'executor') ? !!clean.executor : !!(currentRecord && safeString(currentRecord.executor));
    if (!hasExecutor) return 'Aberto';
    if (hasInicio) return 'Em andamento';
    return 'Aguardando';
  }

  function resolvePendenciaPlanningFields(currentRecord, clean, dados, status, configs) {
    var today = parseDateInput(formatDateForInput(new Date()));
    var planningTouched = !currentRecord ||
      hasOwnField(dados, 'status') ||
      hasOwnField(dados, 'executor') ||
      hasOwnField(dados, 'data_inicio') ||
      hasOwnField(dados, 'previsao_entrega') ||
      hasOwnField(dados, 'prioridade');
    var dataInicio = hasOwnField(dados, 'data_inicio')
      ? (clean.data_inicio ? parseDateInput(clean.data_inicio) : null)
      : (currentRecord && currentRecord.data_inicio ? parseDateInput(currentRecord.data_inicio) : null);
    var previsaoEntrega = hasOwnField(dados, 'previsao_entrega')
      ? (clean.previsao_entrega ? parseDateInput(clean.previsao_entrega) : null)
      : (currentRecord && currentRecord.previsao_entrega ? parseDateInput(currentRecord.previsao_entrega) : null);
    var prioridade = clean.prioridade || (currentRecord && currentRecord.prioridade) || 'Media';
    var normalizedStatus = normalizeText(status);

    if (!currentRecord && !dataInicio && !isPendenciaFinalizada(status)) {
      dataInicio = today;
    }
    if (planningTouched && normalizedStatus === 'em andamento' && !dataInicio) {
      dataInicio = today;
    }
    if (planningTouched && !previsaoEntrega && !isPendenciaFinalizada(status)) {
      previsaoEntrega = addCalendarDays(dataInicio || today, getPrioritySlaDays(prioridade, configs));
    }
    return {
      data_inicio: dataInicio ? formatDateForInput(dataInicio) : '',
      previsao_entrega: previsaoEntrega ? formatDateForInput(previsaoEntrega) : ''
    };
  }

  function applyStatusSideEffects(currentRecord, updatedData, novoStatus, configs) {
    if (normalizeText(novoStatus) === 'concluido') {
      var now = new Date();
      var dias = Number(getConfigValue(configs, 'DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO', '10'));
      var dataExclusao = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dias);
      updatedData.data_conclusao = formatDateForInput(now);
      updatedData.hora_conclusao = formatTimeValue(now);
      updatedData.excluir_foto_em = formatDateForInput(dataExclusao);
    } else if (currentRecord && normalizeText(currentRecord.status) === 'concluido') {
      updatedData.data_conclusao = '';
      updatedData.hora_conclusao = '';
      updatedData.excluir_foto_em = '';
    }
  }

  async function registrarHistoricoStatus(idPendencia, statusAnterior, statusNovo, usuario, observacao) {
    var now = new Date();
    var historicoId = generateId('HIS');
    await collectionRef('pendencias').doc(idPendencia).collection('historico').doc(historicoId).set({
      id_historico: historicoId,
      id_pendencia: idPendencia,
      data: formatDateForInput(now),
      hora: formatTimeValue(now),
      status_anterior: normalizeLabel(statusAnterior),
      status_novo: normalizeLabel(statusNovo),
      usuario: usuario || getCurrentUserIdentifier(),
      observacao: sanitizeText(observacao)
    });
  }

  async function buildDashboardMetrics() {
    var pendencias = await listPendenciasRaw();
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
      var status = normalizeText(item.status);
      var prioridade = normalizeText(item.prioridade);
      var possuiExecutor = !!safeString(item.executor);
      var loja = item.loja || 'Sem loja';
      var setor = item.setor || 'Sem setor';
      var responsavel = item.responsavel || 'Nao definido';
      metrics.porLoja[loja] = (metrics.porLoja[loja] || 0) + 1;
      metrics.porSetor[setor] = (metrics.porSetor[setor] || 0) + 1;
      metrics.porResponsavel[responsavel] = (metrics.porResponsavel[responsavel] || 0) + 1;

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

  function buildPhotoPreviewUrl(record) {
    if (record && safeString(record.id_arquivo_drive)) {
      return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(record.id_arquivo_drive) + '&sz=w1600';
    }
    if (record && safeString(record.link_foto)) {
      var match = safeString(record.link_foto).match(/[-\w]{25,}/);
      if (match) {
        return 'https://drive.google.com/thumbnail?id=' + encodeURIComponent(match[0]) + '&sz=w1600';
      }
      return record.link_foto;
    }
    return '';
  }

  function buildDrivePayload(fileId, url, fileName) {
    var targetUrl = safeString(url);
    if (!targetUrl && fileId) {
      targetUrl = 'https://drive.google.com/file/d/' + fileId + '/view';
    }
    return {
      fileId: safeString(fileId),
      fileName: safeString(fileName) || 'arquivo.pdf',
      url: targetUrl,
      openUrl: targetUrl,
      downloadUrl: fileId ? ('https://drive.google.com/uc?export=download&id=' + fileId) : targetUrl
    };
  }

  function createBlobPayload(content, mimeType, fileName) {
    var blob = new Blob([content], { type: mimeType });
    var objectUrl = URL.createObjectURL(blob);
    return {
      fileName: fileName,
      url: objectUrl,
      openUrl: objectUrl,
      downloadUrl: objectUrl
    };
  }

  function escapeHtml(value) {
    return safeString(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildOrcamentoPreviewHtml(orcamento, items) {
    var rows = (items || []).map(function(item) {
      return '<tr>' +
        '<td>' + escapeHtml(item.loja || '-') + '</td>' +
        '<td>' + escapeHtml(item.setor || '-') + '</td>' +
        '<td>' + escapeHtml(item.tipo || '-') + '</td>' +
        '<td>' + escapeHtml(item.prioridade || '-') + '</td>' +
        '<td>' + escapeHtml(formatDateLabel(item.previsao_entrega || item.previsao_snapshot) || '-') + '</td>' +
        '<td style="text-align:right;">' + escapeHtml(formatCurrencyBr(item.valor || item.valor_snapshot || 0)) + '</td>' +
      '</tr><tr><td colspan="6" class="desc-row"><strong>Descricao:</strong> ' + escapeHtml(item.descricao || item.descricao_snapshot || '-') + '</td></tr>';
    }).join('');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Orcamento</title><style>' +
      'body{font-family:Arial,sans-serif;margin:32px;color:#111;}h1{color:#ef7200;margin-bottom:8px;}table{width:100%;border-collapse:collapse;margin-top:20px;}th,td{border:1px solid #ddd;padding:10px;vertical-align:top;}th{background:#111;color:#fff;} .desc-row{background:#faf5ef;} .meta{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:18px;} .card{border:1px solid #efc39b;border-radius:12px;padding:12px;background:#fff8f1;} .total{margin-top:20px;padding:16px;border:2px solid #ef7200;border-radius:14px;background:#fff7ef;font-size:24px;font-weight:700;text-align:right;} .obs{margin-top:20px;padding:12px;border:1px solid #ddd;border-radius:12px;} @media print{body{margin:16px;}}</style></head><body>' +
      '<h1>Orcamento do Prestador</h1>' +
      '<div class="meta">' +
      '<div class="card"><strong>Prestador</strong><div>' + escapeHtml(orcamento.prestador || '-') + '</div></div>' +
      '<div class="card"><strong>Data</strong><div>' + escapeHtml(formatDateLabel(orcamento.data_orcamento) || '-') + '</div></div>' +
      '<div class="card"><strong>Pendencias</strong><div>' + escapeHtml(String(items.length)) + '</div></div>' +
      '</div>' +
      '<table><thead><tr><th>Loja</th><th>Setor</th><th>Tipo</th><th>Prioridade</th><th>Previsao</th><th>Valor</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '<div class="obs"><strong>Observacao:</strong><div>' + escapeHtml(orcamento.observacao || '-') + '</div></div>' +
      '<div class="total">Valor total: ' + escapeHtml(formatCurrencyBr(orcamento.valor_total || 0)) + '</div>' +
      '</body></html>';
  }

  function buildCronogramaPreviewHtml(filters, items) {
    var rows = (items || []).map(function(item) {
      return '<tr>' +
        '<td>' + escapeHtml(item.executor || 'Sem prestador') + '</td>' +
        '<td>' + escapeHtml(item.loja || '-') + '</td>' +
        '<td>' + escapeHtml(item.setor || '-') + '</td>' +
        '<td>' + escapeHtml(item.status || '-') + '</td>' +
        '<td>' + escapeHtml(formatDateLabel(item.previsao_entrega) || '-') + '</td>' +
        '<td>' + escapeHtml(item.descricao || '-') + '</td>' +
      '</tr>';
    }).join('');
    return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Cronograma</title><style>' +
      'body{font-family:Arial,sans-serif;margin:32px;color:#111;}h1{color:#ef7200;margin-bottom:8px;}table{width:100%;border-collapse:collapse;margin-top:18px;}th,td{border:1px solid #ddd;padding:10px;vertical-align:top;}th{background:#111;color:#fff;} .meta{margin-top:10px;color:#666;} @media print{body{margin:16px;}}</style></head><body>' +
      '<h1>Cronograma de Servicos</h1><div class="meta">Itens: ' + escapeHtml(String(items.length)) + '</div>' +
      '<table><thead><tr><th>Prestador</th><th>Loja</th><th>Setor</th><th>Status</th><th>Previsao</th><th>Descricao</th></tr></thead><tbody>' + rows + '</tbody></table>' +
      '</body></html>';
  }

  function buildCronogramaCsv(items) {
    var lines = ['Prestador;Loja;Setor;Status;Previsao;Descricao'];
    (items || []).forEach(function(item) {
      lines.push([
        safeString(item.executor || 'Sem prestador').replace(/;/g, ','),
        safeString(item.loja).replace(/;/g, ','),
        safeString(item.setor).replace(/;/g, ','),
        safeString(item.status).replace(/;/g, ','),
        safeString(formatDateLabel(item.previsao_entrega)).replace(/;/g, ','),
        safeString(item.descricao).replace(/;/g, ',')
      ].join(';'));
    });
    return '\uFEFF' + lines.join('\r\n');
  }

  async function listOrcamentoItems(idOrcamento) {
    var snapshot = await collectionRef('orcamentos').doc(idOrcamento).collection('itens').get();
    return mapDocs(snapshot).sort(function(a, b) {
      return safeString(a.id_pendencia).localeCompare(safeString(b.id_pendencia), 'pt-BR');
    });
  }

  async function buildInitData() {
    var baseData = await fetchBaseData();
    var dashboard = await buildDashboardMetrics();
    return createSuccessResponse('Dados iniciais carregados.', {
      dashboard: createSuccessResponse('Dashboard carregado.', dashboard),
      combos: buildFormSupportData(baseData),
      prestadoresAdmin: createSuccessResponse('Prestadores administrativos carregados.', baseData.prestadores),
      comboAdmin: buildComboAdmin(baseData),
      config: createSuccessResponse('Configuracoes carregadas.', baseData.configs),
      versao: getConfigValue(baseData.configs, 'VERSAO_SISTEMA', '1.0')
    });
  }

  async function handleGetAppInitData() {
    return buildInitData();
  }

  async function handleListarPendencias(filtros) {
    try {
      var items = await listPendenciasRaw();
      return createSuccessResponse('Pendencias carregadas.', applyPendenciasFilters(items, filtros || {}));
    } catch (error) {
      return createErrorResponse('Nao foi possivel listar as pendencias.', error);
    }
  }

  async function handleBuscarPendenciaPorId(id) {
    try {
      var pendencia = await buildPendenciaPayloadById(safeString(id));
      if (!pendencia) {
        return createErrorResponse('Pendencia nao encontrada.');
      }
      return createSuccessResponse('Pendencia localizada.', pendencia);
    } catch (error) {
      return createErrorResponse('Nao foi possivel carregar a pendencia.', error);
    }
  }

  async function handleCriarPendencia(dados) {
    try {
      var baseData = await fetchBaseData();
      var validation = validatePendenciaData(dados, 'criacao', baseData.configs);
      if (!validation.valid) {
        return createErrorResponse(validation.errors.join(' '));
      }
      var clean = validation.sanitized;
      var now = new Date();
      var idPendencia = generateId('PEN');
      var statusInicial = getConfigValue(baseData.configs, 'STATUS_PADRAO_NOVO_REGISTRO', 'Aberto');
      var statusResolvido = resolvePendenciaWorkflowStatus(null, clean, dados, 'criacao', statusInicial);
      var planejamento = resolvePendenciaPlanningFields(null, clean, dados, statusResolvido, baseData.configs);
      var record = {
        id_pendencia: idPendencia,
        data_abertura: formatDateTimeBr(now),
        hora_abertura: formatTimeValue(now),
        loja: clean.loja,
        setor: clean.setor,
        tipo: clean.tipo || 'Outro',
        prioridade: clean.prioridade || 'Media',
        descricao: clean.descricao,
        observacao: clean.observacao,
        solicitante: clean.solicitante,
        responsavel: clean.responsavel,
        executor: clean.executor,
        data_inicio: planejamento.data_inicio || '',
        previsao_entrega: planejamento.previsao_entrega || '',
        status: statusResolvido,
        data_conclusao: '',
        hora_conclusao: '',
        link_foto: '',
        id_arquivo_drive: '',
        excluir_foto_em: '',
        foto_excluida: 'NAO',
        id_orcamento_ativo: '',
        prestador_orcamento_ativo: '',
        valor_orcamento_ativo: '',
        data_orcamento_ativo: '',
        ultima_atualizacao: formatDateLabel(now),
        atualizado_por: getCurrentUserIdentifier()
      };
      await setDoc('pendencias', idPendencia, record, true);
      await registrarHistoricoStatus(idPendencia, '', record.status, record.solicitante, clean.observacao || 'Registro criado.');
      return createSuccessResponse('Pendencia criada com sucesso.', {
        id_pendencia: idPendencia,
        pendencia: await buildPendenciaPayloadById(idPendencia)
      });
    } catch (error) {
      return createErrorResponse('Nao foi possivel criar a pendencia.', error);
    }
  }

  async function handleAtualizarPendencia(id, dados) {
    try {
      var cleanId = safeString(id);
      var baseData = await fetchBaseData();
      var validation = validatePendenciaData(dados, 'edicao', baseData.configs);
      if (!validation.valid) {
        return createErrorResponse(validation.errors.join(' '));
      }
      var currentRecord = await getDoc('pendencias', cleanId);
      if (!currentRecord) {
        return createErrorResponse('Pendencia nao encontrada.');
      }
      var clean = validation.sanitized;
      var novoStatus = resolvePendenciaWorkflowStatus(currentRecord, clean, dados, 'edicao', currentRecord.status);
      var planejamento = resolvePendenciaPlanningFields(currentRecord, clean, dados, novoStatus, baseData.configs);
      var updatedData = {
        loja: clean.loja || currentRecord.loja,
        setor: clean.setor || currentRecord.setor,
        tipo: clean.tipo || currentRecord.tipo,
        prioridade: clean.prioridade || currentRecord.prioridade,
        descricao: clean.descricao || currentRecord.descricao,
        observacao: hasOwnField(dados, 'observacao') ? clean.observacao : currentRecord.observacao,
        solicitante: clean.solicitante || currentRecord.solicitante,
        responsavel: hasOwnField(dados, 'responsavel') ? clean.responsavel : currentRecord.responsavel,
        executor: hasOwnField(dados, 'executor') ? clean.executor : currentRecord.executor,
        data_inicio: planejamento.data_inicio || '',
        previsao_entrega: planejamento.previsao_entrega || '',
        status: novoStatus,
        link_foto: currentRecord.link_foto || '',
        id_arquivo_drive: currentRecord.id_arquivo_drive || '',
        foto_excluida: currentRecord.foto_excluida || 'NAO',
        ultima_atualizacao: formatDateLabel(new Date()),
        atualizado_por: getCurrentUserIdentifier()
      };
      applyStatusSideEffects(currentRecord, updatedData, novoStatus, baseData.configs);
      await setDoc('pendencias', cleanId, updatedData, true);
      if (normalizeText(currentRecord.status) !== normalizeText(novoStatus)) {
        await registrarHistoricoStatus(cleanId, currentRecord.status, novoStatus, getCurrentUserIdentifier(), clean.observacao || 'Status alterado pela edicao.');
      }
      return createSuccessResponse('Pendencia atualizada com sucesso.', {
        id_pendencia: cleanId,
        pendencia: await buildPendenciaPayloadById(cleanId)
      });
    } catch (error) {
      return createErrorResponse('Nao foi possivel atualizar a pendencia.', error);
    }
  }

  async function handleExcluirPendencia(id, observacao) {
    try {
      var cleanId = safeString(id);
      var currentRecord = await getDoc('pendencias', cleanId);
      if (!currentRecord) {
        return createErrorResponse('Pendencia nao encontrada.');
      }
      var historico = await collectionRef('pendencias').doc(cleanId).collection('historico').get();
      var deleteOps = historico.docs.map(function(doc) { return doc.ref.delete(); });
      await Promise.all(deleteOps);
      await deleteDoc('pendencias', cleanId);
      return createSuccessResponse('Pendencia excluida com sucesso.', {
        id_pendencia: cleanId
      });
    } catch (error) {
      return createErrorResponse('Nao foi possivel excluir a pendencia.', error);
    }
  }

  async function handleObterFotoPreviewPendencia(id) {
    try {
      var record = await getDoc('pendencias', safeString(id));
      if (!record) {
        return createErrorResponse('Pendencia nao encontrada.');
      }
      var previewUrl = buildPhotoPreviewUrl(record);
      if (!previewUrl) {
        return createErrorResponse('Nenhuma foto encontrada para esta pendencia.');
      }
      return createSuccessResponse('Foto localizada.', previewUrl);
    } catch (error) {
      return createErrorResponse('Nao foi possivel carregar a foto.', error);
    }
  }

  async function saveConfigs(configs) {
    var updates = Array.isArray(configs) ? configs : [];
    for (var i = 0; i < updates.length; i += 1) {
      var item = updates[i];
      if (item && item.chave && item.chave !== 'STATUS_PADRAO_NOVO_REGISTRO') {
        await setDoc('configs', safeString(item.chave), {
          chave: safeString(item.chave),
          valor: safeString(item.valor),
          descricao: safeString(item.descricao)
        }, true);
      }
    }
    return createSuccessResponse('Configuracoes salvas com sucesso.');
  }

  async function getComboManagementPayload() {
    var baseData = await fetchBaseData();
    return {
      combos: buildFormSupportData(baseData),
      admin: buildComboAdmin(baseData)
    };
  }

  async function saveComboOption(group, value) {
    var normalizedGroup = normalizeComboGroup(group);
    var nome = normalizeComboOptionName(normalizedGroup, value);
    if (!normalizedGroup || !nome) {
      return createErrorResponse('Informe um grupo e um valor valido.');
    }
    if (normalizedGroup === 'loja') {
      var lojaId = generateId('LOJ');
      await setDoc('lojas', lojaId, {
        id_loja: lojaId,
        nome_loja: nome,
        cidade: '',
        status: 'Ativo',
        data_cadastro: formatDateForInput(new Date())
      }, false);
    } else if (normalizedGroup === 'setor') {
      var setorId = generateId('SET');
      await setDoc('setores', setorId, {
        id_setor: setorId,
        nome_setor: nome,
        status: 'Ativo',
        data_cadastro: formatDateForInput(new Date())
      }, false);
    } else if (normalizedGroup === 'responsavel') {
      var usuarioId = generateId('USR');
      await setDoc('usuarios', usuarioId, {
        id_usuario: usuarioId,
        nome: nome,
        email: '',
        perfil: 'Responsavel',
        status: 'Ativo',
        data_cadastro: formatDateForInput(new Date())
      }, false);
    } else if (normalizedGroup === 'executor') {
      return savePrestador(nome);
    } else {
      var baseData = await fetchBaseData();
      var items = getManagedOptionItems(normalizedGroup, baseData.configs);
      var targetKey = normalizeText(nome);
      var existing = null;
      items.forEach(function(item) {
        if (!existing && normalizeText(item.nome) === targetKey) {
          existing = item;
        }
      });
      if (existing) {
        existing.status = 'Ativo';
        existing.nome = nome;
      } else {
        items.push({
          id: normalizedGroup.toUpperCase() + '_' + Date.now(),
          nome: nome,
          status: 'Ativo'
        });
      }
      await setDoc('configs', getManagedConfigKey(normalizedGroup), {
        chave: getManagedConfigKey(normalizedGroup),
        valor: JSON.stringify(items),
        descricao: 'Opcoes gerenciadas de ' + normalizedGroup
      }, true);
    }
    return createSuccessResponse('Opcao salva com sucesso.', await getComboManagementPayload());
  }

  async function deleteComboOption(group, idOrValue) {
    var normalizedGroup = normalizeComboGroup(group);
    var key = safeString(idOrValue);
    if (!normalizedGroup || !key) {
      return createErrorResponse('Grupo ou opcao invalida.');
    }
    if (normalizedGroup === 'loja') {
      await deleteDoc('lojas', key);
    } else if (normalizedGroup === 'setor') {
      await deleteDoc('setores', key);
    } else if (normalizedGroup === 'responsavel') {
      await deleteDoc('usuarios', key);
    } else if (normalizedGroup === 'executor') {
      await deleteDoc('prestadores', key);
    } else {
      var baseData = await fetchBaseData();
      var items = getManagedOptionItems(normalizedGroup, baseData.configs).filter(function(item) {
        return normalizeText(item.id) !== normalizeText(key) && normalizeText(item.nome) !== normalizeText(key);
      });
      await setDoc('configs', getManagedConfigKey(normalizedGroup), {
        chave: getManagedConfigKey(normalizedGroup),
        valor: JSON.stringify(items),
        descricao: 'Opcoes gerenciadas de ' + normalizedGroup
      }, true);
    }
    return createSuccessResponse('Opcao removida com sucesso.', await getComboManagementPayload());
  }

  async function updateComboStatus(group, idOrValue, novoStatus) {
    var normalizedGroup = normalizeComboGroup(group);
    var key = safeString(idOrValue);
    var status = normalizeLabel(novoStatus);
    if ((normalizedGroup !== 'responsavel' && normalizedGroup !== 'executor') || !key || !status) {
      return createErrorResponse('Dados invalidos para alterar o status.');
    }
    var collectionName = normalizedGroup === 'responsavel' ? 'usuarios' : 'prestadores';
    var record = await getDoc(collectionName, key);
    if (!record) {
      return createErrorResponse('Opcao nao encontrada para atualizar status.');
    }
    await setDoc(collectionName, key, { status: status }, true);
    return createSuccessResponse('Status da opcao atualizado com sucesso.', await getComboManagementPayload());
  }

  async function savePrestador(nomePrestador) {
    var nome = normalizeComboOptionName('executor', nomePrestador);
    if (!nome) {
      return createErrorResponse('Informe o nome do executor/prestador.');
    }
    var id = generateId('PRE');
    await setDoc('prestadores', id, {
      id_prestador: id,
      nome_prestador: nome,
      status: 'Ativo',
      data_cadastro: formatDateForInput(new Date())
    }, false);
    var baseData = await fetchBaseData();
    return createSuccessResponse('Executor/prestador salvo com sucesso.', {
      ativos: buildFormSupportData(baseData).prestadores || [],
      todos: baseData.prestadores
    });
  }

  async function changePrestadorStatus(idPrestador, novoStatus) {
    var id = safeString(idPrestador);
    var status = normalizeLabel(novoStatus);
    var record = await getDoc('prestadores', id);
    if (!record) {
      return createErrorResponse('Prestador nao encontrado.');
    }
    await setDoc('prestadores', id, { status: status }, true);
    var baseData = await fetchBaseData();
    return createSuccessResponse('Status do executor/prestador atualizado com sucesso.', {
      ativos: buildFormSupportData(baseData).prestadores || [],
      todos: baseData.prestadores
    });
  }

  async function deletePrestador(idPrestador) {
    var id = safeString(idPrestador);
    var record = await getDoc('prestadores', id);
    if (!record) {
      return createErrorResponse('Prestador nao encontrado.');
    }
    await deleteDoc('prestadores', id);
    var baseData = await fetchBaseData();
    return createSuccessResponse('Executor/prestador excluido com sucesso.', {
      ativos: buildFormSupportData(baseData).prestadores || [],
      todos: baseData.prestadores
    });
  }

  function normalizeOrcamentoPayload(payload) {
    var pendenciaIds = Array.isArray(payload.pendenciaIds) ? payload.pendenciaIds : [];
    var itens = Array.isArray(payload.itens) ? payload.itens : [];
    var cleanIds = [];
    var seen = {};
    var valorPorPendencia = {};
    itens.forEach(function(item) {
      var cleanId = safeString(item && item.id_pendencia);
      if (cleanId && !seen[cleanId]) {
        seen[cleanId] = true;
        cleanIds.push(cleanId);
        var rawValor = safeString(item && item.valor);
        valorPorPendencia[cleanId] = rawValor ? parseCurrencyValue(rawValor) : '';
      }
    });
    pendenciaIds.forEach(function(id) {
      var cleanId = safeString(id);
      if (cleanId && !seen[cleanId]) {
        seen[cleanId] = true;
        cleanIds.push(cleanId);
      }
    });
    var prestador = sanitizeText(payload.prestador);
    var dataOrcamento = payload.data_orcamento ? formatDateForInput(payload.data_orcamento) : formatDateForInput(new Date());
    var valorTotalManualRaw = safeString(payload.valor_total);
    var valorTotalManual = valorTotalManualRaw ? parseCurrencyValue(valorTotalManualRaw) : NaN;
    var observacao = sanitizeText(payload.observacao);
    var somaServicos = cleanIds.reduce(function(total, id) {
      var valor = valorPorPendencia[id];
      return total + (isFinite(valor) ? valor : 0);
    }, 0);
    var valorTotal = isFinite(valorTotalManual) ? valorTotalManual : somaServicos;
    if (!cleanIds.length) return { valid: false, message: 'Selecione ao menos uma pendencia para o orcamento.' };
    if (!prestador) return { valid: false, message: 'Selecione o prestador do orcamento.' };
    if (!dataOrcamento) return { valid: false, message: 'Informe a data do orcamento.' };
    var invalidos = cleanIds.filter(function(id) {
      return safeString(valorPorPendencia[id]) && (!isFinite(valorPorPendencia[id]) || valorPorPendencia[id] < 0);
    });
    if (invalidos.length) return { valid: false, message: 'Informe um valor valido para cada servico selecionado.' };
    if (valorTotalManualRaw && (!isFinite(valorTotalManual) || valorTotalManual < 0)) return { valid: false, message: 'Informe um valor total valido para o orcamento.' };
    if (!isFinite(valorTotal) || valorTotal < 0) return { valid: false, message: 'Nao foi possivel calcular o valor total do orcamento.' };
    return {
      valid: true,
      pendenciaIds: cleanIds,
      prestador: prestador,
      data_orcamento: dataOrcamento,
      valor_total: valorTotal,
      valorPorPendencia: valorPorPendencia,
      observacao: observacao
    };
  }

  async function handleCriarOrcamento(payload) {
    try {
      var clean = normalizeOrcamentoPayload(payload || {});
      if (!clean.valid) {
        return createErrorResponse(clean.message);
      }
      var pendencias = [];
      for (var i = 0; i < clean.pendenciaIds.length; i += 1) {
        var pendencia = await getDoc('pendencias', clean.pendenciaIds[i]);
        if (!pendencia) {
          return createErrorResponse('Nao foi possivel incluir as pendencias selecionadas.');
        }
        if (isPendenciaFinalizada(pendencia.status)) {
          return createErrorResponse('Nao foi possivel incluir as pendencias selecionadas.');
        }
        if (safeString(pendencia.id_orcamento_ativo)) {
          return createErrorResponse('Algumas pendencias selecionadas ja possuem um orcamento ativo.');
        }
        pendencias.push(pendencia);
      }
      var orcamentoId = generateId('ORC');
      var now = new Date();
      var orcamentoRecord = {
        id_orcamento: orcamentoId,
        data_orcamento: clean.data_orcamento,
        prestador: clean.prestador,
        valor_total: clean.valor_total,
        quantidade_pendencias: pendencias.length,
        observacao: clean.observacao,
        status: 'Ativo',
        pdf_file_id: '',
        pdf_file_url: '',
        data_criacao: formatDateTimeBr(now),
        criado_por: getCurrentUserIdentifier()
      };
      await setDoc('orcamentos', orcamentoId, orcamentoRecord, false);
      for (var p = 0; p < pendencias.length; p += 1) {
        var record = pendencias[p];
        var itemId = generateId('ORI');
        await collectionRef('orcamentos').doc(orcamentoId).collection('itens').doc(itemId).set({
          id_orcamento_item: itemId,
          id_orcamento: orcamentoId,
          id_pendencia: record.id_pendencia,
          loja_snapshot: record.loja || '-',
          setor_snapshot: record.setor || '-',
          tipo_snapshot: record.tipo || '-',
          prioridade_snapshot: record.prioridade || '-',
          previsao_snapshot: record.previsao_entrega || '',
          valor_snapshot: clean.valorPorPendencia[record.id_pendencia] || 0,
          descricao_snapshot: sanitizeText(record.descricao) || '-',
          responsavel_snapshot: record.responsavel || 'Nao definido',
          status_snapshot: 'Ativo',
          data_criacao: formatDateTimeBr(now)
        });
        await setDoc('pendencias', record.id_pendencia, {
          executor: clean.prestador,
          id_orcamento_ativo: orcamentoId,
          prestador_orcamento_ativo: clean.prestador,
          valor_orcamento_ativo: clean.valorPorPendencia[record.id_pendencia] || 0,
          data_orcamento_ativo: clean.data_orcamento,
          ultima_atualizacao: formatDateLabel(now),
          atualizado_por: getCurrentUserIdentifier()
        }, true);
      }
      var items = await listOrcamentoItems(orcamentoId);
      var pdfPayload = createBlobPayload(buildOrcamentoPreviewHtml(orcamentoRecord, items), 'text/html', sanitizeFileName('orcamento-' + orcamentoId) + '.html');
      return createSuccessResponse('Orcamento registrado com sucesso. A copia Firebase abre uma visualizacao para impressao.', {
        orcamento: orcamentoRecord,
        pdf: pdfPayload,
        pendencias: clean.pendenciaIds,
        warning: 'Visualizacao HTML gerada no lugar do PDF do Apps Script.'
      });
    } catch (error) {
      return createErrorResponse('Nao foi possivel criar o orcamento.', error);
    }
  }

  async function handleGerarPdfOrcamento(idOrcamento) {
    try {
      var cleanId = safeString(idOrcamento);
      var orcamento = await getDoc('orcamentos', cleanId);
      if (!orcamento) {
        return createErrorResponse('Orcamento nao encontrado.');
      }
      if (safeString(orcamento.pdf_file_id) || safeString(orcamento.pdf_file_url)) {
        return createSuccessResponse('PDF do orcamento localizado.', buildDrivePayload(orcamento.pdf_file_id, orcamento.pdf_file_url, sanitizeFileName('orcamento-' + cleanId) + '.pdf'));
      }
      var items = await listOrcamentoItems(cleanId);
      if (!items.length) {
        return createErrorResponse('Esse orcamento nao possui pendencias vinculadas.');
      }
      return createSuccessResponse('Visualizacao do orcamento gerada com sucesso.', createBlobPayload(buildOrcamentoPreviewHtml(orcamento, items), 'text/html', sanitizeFileName('orcamento-' + cleanId) + '.html'));
    } catch (error) {
      return createErrorResponse('Nao foi possivel gerar o PDF do orcamento.', error);
    }
  }

  async function handleExcluirOrcamento(idOrcamento) {
    try {
      var cleanId = safeString(idOrcamento);
      var orcamento = await getDoc('orcamentos', cleanId);
      if (!orcamento) {
        return createErrorResponse('Orcamento nao encontrado.');
      }
      var pendencias = await listPendenciasRaw();
      var pendenciasIds = [];
      for (var i = 0; i < pendencias.length; i += 1) {
        if (safeString(pendencias[i].id_orcamento_ativo) === cleanId) {
          pendenciasIds.push(pendencias[i].id_pendencia);
          await setDoc('pendencias', pendencias[i].id_pendencia, {
            id_orcamento_ativo: '',
            prestador_orcamento_ativo: '',
            valor_orcamento_ativo: '',
            data_orcamento_ativo: '',
            ultima_atualizacao: formatDateLabel(new Date()),
            atualizado_por: getCurrentUserIdentifier()
          }, true);
        }
      }
      var items = await collectionRef('orcamentos').doc(cleanId).collection('itens').get();
      await Promise.all(items.docs.map(function(doc) { return doc.ref.delete(); }));
      await deleteDoc('orcamentos', cleanId);
      return createSuccessResponse('Orcamento excluido com sucesso.', {
        id_orcamento: cleanId,
        pendencias: pendenciasIds
      });
    } catch (error) {
      return createErrorResponse('Nao foi possivel excluir o orcamento.', error);
    }
  }

  function getCronogramaStatus(item) {
    if (normalizeText(item.status) === 'concluido') return 'Concluido';
    if (isPendenciaVencida(item)) return 'Vencido';
    if (safeString(item.executor)) return 'Em andamento';
    return 'Aberto';
  }

  async function getCronogramaItems(filters) {
    var items = await listPendenciasRaw();
    items.forEach(function(item) {
      item.status_cronograma = getCronogramaStatus(item);
    });
    return items.filter(function(item) {
      if (normalizeText(item.status) === 'cancelado') return false;
      if (!matchesFilterSelection(item.loja, filters.loja)) return false;
      if (!matchesFilterSelection(item.setor, filters.setor)) return false;
      if (!matchesFilterSelection(item.responsavel, filters.responsavel)) return false;
      if (!matchesFilterSelection(item.status_cronograma, filters.status)) return false;
      if ((filters.dataAberturaDe || filters.dataAberturaAte) && !dateWithinRange(item.data_abertura, filters.dataAberturaDe, filters.dataAberturaAte)) return false;
      if ((filters.previsaoEntregaDe || filters.previsaoEntregaAte) && !dateWithinRange(item.previsao_entrega, filters.previsaoEntregaDe, filters.previsaoEntregaAte)) return false;
      if (filters.executor && filters.executor !== '__TODOS_PRESTADORES__' && filters.executor !== '__SEM_PRESTADOR__') {
        if (normalizeText(item.executor) !== normalizeText(filters.executor)) return false;
      } else if (!filters.executor || filters.executor === '__SEM_PRESTADOR__') {
        if (safeString(item.executor)) return false;
      }
      return true;
    }).sort(function(a, b) {
      var previsaoA = parseDateInput(a.previsao_entrega);
      var previsaoB = parseDateInput(b.previsao_entrega);
      var timeA = previsaoA ? previsaoA.getTime() : Number.MAX_SAFE_INTEGER;
      var timeB = previsaoB ? previsaoB.getTime() : Number.MAX_SAFE_INTEGER;
      if (timeA !== timeB) return timeA - timeB;
      var lojaCompare = safeString(a.loja).localeCompare(safeString(b.loja), 'pt-BR');
      if (lojaCompare !== 0) return lojaCompare;
      return safeString(a.setor).localeCompare(safeString(b.setor), 'pt-BR');
    });
  }

  async function handleGerarCronogramaPdf(filtros) {
    try {
      var items = await getCronogramaItems(filtros || {});
      if (!items.length) {
        return createErrorResponse('Nenhuma pendencia ativa encontrada para os filtros informados.');
      }
      return createSuccessResponse('Visualizacao do cronograma gerada com sucesso.', createBlobPayload(buildCronogramaPreviewHtml(filtros || {}, items), 'text/html', 'cronograma.html'));
    } catch (error) {
      return createErrorResponse('Nao foi possivel gerar o PDF do cronograma.', error);
    }
  }

  async function handleGerarCronogramaExcel(filtros) {
    try {
      var items = await getCronogramaItems(filtros || {});
      if (!items.length) {
        return createErrorResponse('Nenhuma pendencia ativa encontrada para os filtros informados.');
      }
      return createSuccessResponse('Arquivo do cronograma gerado com sucesso.', createBlobPayload(buildCronogramaCsv(items), 'text/csv;charset=utf-8', 'cronograma.csv'));
    } catch (error) {
      return createErrorResponse('Nao foi possivel gerar o Excel do cronograma.', error);
    }
  }

  async function dispatch(functionName, args) {
    switch (functionName) {
      case 'pingBridge':
        return createSuccessResponse('Bridge online.', { timestamp: new Date().toISOString() });
      case 'getAppInitData':
        return handleGetAppInitData();
      case 'listarPendencias':
        return handleListarPendencias(args[0] || {});
      case 'buscarPendenciaPorId':
        return handleBuscarPendenciaPorId(args[0]);
      case 'criarPendencia':
        return handleCriarPendencia(args[0] || {});
      case 'atualizarPendencia':
        return handleAtualizarPendencia(args[0], args[1] || {});
      case 'alterarStatusPendencia':
        return handleAtualizarPendencia(args[0], { status: args[1], observacao: args[2] });
      case 'concluirPendencia':
        return handleAtualizarPendencia(args[0], { status: 'Concluido', observacao: args[1] });
      case 'excluirPendencia':
        return handleExcluirPendencia(args[0], args[1]);
      case 'obterFotoPreviewPendencia':
        return handleObterFotoPreviewPendencia(args[0]);
      case 'salvarConfiguracoesSimples':
        return saveConfigs(args[0] || []);
      case 'salvarOpcaoCombo':
        return saveComboOption(args[0], args[1]);
      case 'excluirOpcaoCombo':
        return deleteComboOption(args[0], args[1]);
      case 'alterarStatusOpcaoCombo':
        return updateComboStatus(args[0], args[1], args[2]);
      case 'salvarPrestador':
        return savePrestador(args[0]);
      case 'alterarStatusPrestador':
        return changePrestadorStatus(args[0], args[1]);
      case 'excluirPrestador':
        return deletePrestador(args[0]);
      case 'setupSistema':
        return createSuccessResponse('Copia Firebase pronta para uso.');
      case 'criarTriggerLimpezaFotos':
        return createSuccessResponse('Limpeza automatica de fotos nao se aplica nesta copia Firebase.');
      case 'criarOrcamentoPendencias':
        return handleCriarOrcamento(args[0] || {});
      case 'gerarPdfOrcamento':
        return handleGerarPdfOrcamento(args[0]);
      case 'excluirOrcamento':
        return handleExcluirOrcamento(args[0]);
      case 'gerarCronogramaPdf':
        return handleGerarCronogramaPdf(args[0] || {});
      case 'gerarCronogramaExcel':
        return handleGerarCronogramaExcel(args[0] || {});
      default:
        return createErrorResponse('Funcao nao implementada na copia Firebase: ' + functionName);
    }
  }

  window.FirebaseBridge = {
    isEnabled: isEnabled,
    canHandle: canHandle,
    call: function(functionName, args) {
      return ensureFirebase().then(function() {
        return dispatch(functionName, args || []);
      }).catch(function(error) {
        return createErrorResponse('Falha ao comunicar com o Firebase.', error);
      });
    }
  };
})();
