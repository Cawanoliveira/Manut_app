var CACHE_KEY = 'manutencao_offline_cache_v2';
  var bridgeResolvers_ = {};
  var bridgeListenerReady_ = false;
  var filterFabDragState_ = null;
  var appState = getDefaultAppState_();

  document.addEventListener('DOMContentLoaded', function() {
    inicializarApp();
  });

  function getDefaultAppState_() {
    return {
      combos: null,
      configs: [],
      prestadoresAdmin: [],
      comboAdmin: {},
      allPendencias: [],
      detailsById: {},
      dashboard: buildEmptyDashboard_(),
      dashboardSelection: {
        type: '',
        key: ''
      },
      dashboardChartMode: {
        loja: 'list',
        setor: 'list'
      },
      pendingQueue: [],
      tempIdMap: {},
      formContext: {
        loja: '',
        setor: '',
        tipo: '',
        prioridade: '',
        executor: ''
      },
      speechState: {
        activeTargetId: '',
        activeRecognition: null,
        activeButtonTargetId: '',
        lastTranscript: '',
        lastAt: 0,
        listening: false
      },
      zoomContext: {
        title: '',
        description: '',
        items: [],
        anchorType: '',
        anchorKey: '',
        filterLoja: '',
        filterSetor: '',
        filterStatus: ''
      },
      comboEditor: {
        group: '',
        targetId: '',
        title: ''
      },
      spenLocked: true,
      currentSection: 'secaoDashboard',
      navigationStack: [],
      connection: {
        online: navigator.onLine,
        syncing: false,
        lastSyncAt: ''
      }
    };
  }

  function inicializarApp() {
      bindConnectivityHandlers_();
      bindFilterFab_();
      bindPenInputMode_();
      hydrateFromCache_();
      renderAll_();
      atualizarNomeArquivo('novaFoto', 'novaFotoNome');
      atualizarNomeArquivo('editFoto', 'editFotoNome');
      detectarConectividadeInicial_();
    }

  function bindConnectivityHandlers_() {
    window.addEventListener('online', function() {
        verificarConectividadeServidor_(true);
      });

    window.addEventListener('offline', function() {
        setConnectionState_(false);
        mostrarMensagemErro('Sem internet. As alteracoes serao guardadas localmente.');
      });
    }

  function detectarConectividadeInicial_() {
      if (!navigator.onLine) {
        setConnectionState_(false);
        mostrarMensagemErro('Sem internet. O app esta usando o cache local e a fila offline.');
        return;
      }
      verificarConectividadeServidor_(false);
    }

  function verificarConectividadeServidor_(showRecoveredMessage) {
      testarServidorDisponivel_()
        .then(function() {
          var wasOffline = !appState.connection.online;
          setConnectionState_(true);
          if (wasOffline && showRecoveredMessage) {
            mostrarMensagemSucesso('Conexao restabelecida. Sincronizando pendencias pendentes...');
          }
          return sincronizarFila_(showRecoveredMessage)
            .then(function() {
              return carregarEstadoServidor_();
            });
        })
        .catch(function() {
          setConnectionState_(false);
          if (showRecoveredMessage) {
            mostrarMensagemErro('Sem internet. O app esta usando o cache local e a fila offline.');
          }
        });
    }

  function testarServidorDisponivel_() {
      return serverCall_('pingBridge', [], { timeoutMs: 7000, quietOffline: true });
    }

  function setConnectionState_(isOnline) {
      appState.connection.online = !!isOnline;
      if (!isOnline) {
        appState.connection.syncing = false;
      }
      saveCache_();
      updateSyncStatusBar_();
    }

  function bindFilterFab_() {
    var fab = document.getElementById('filterFab');
    if (!fab) {
      return;
    }
    fab.dataset.userMoved = '0';
    applyFilterFabPosition_();
    fab.addEventListener('pointerdown', function(event) {
      if (event.button !== 0) {
        return;
      }
      filterFabDragState_ = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: parseFloat(fab.style.left) || 12,
        startTop: parseFloat(fab.style.top) || 42,
        moved: false
      };
      fab.dataset.dragging = '0';
      fab.setPointerCapture(event.pointerId);
    });
    fab.addEventListener('pointermove', function(event) {
      if (!filterFabDragState_ || filterFabDragState_.pointerId !== event.pointerId) {
        return;
      }
      var deltaX = event.clientX - filterFabDragState_.startX;
      var deltaY = event.clientY - filterFabDragState_.startY;
      if (Math.abs(deltaX) > 6 || Math.abs(deltaY) > 6) {
        filterFabDragState_.moved = true;
        fab.dataset.dragging = '1';
      }
      if (!filterFabDragState_.moved) {
        return;
      }
      event.preventDefault();
      setFilterFabPosition_(filterFabDragState_.startLeft + deltaX, filterFabDragState_.startTop + deltaY);
    });
    fab.addEventListener('pointerup', function(event) {
      if (!filterFabDragState_ || filterFabDragState_.pointerId !== event.pointerId) {
        return;
      }
      if (filterFabDragState_.moved) {
        fab.dataset.userMoved = '1';
        fab.dataset.suppressClick = '1';
        setTimeout(function() {
          fab.dataset.suppressClick = '0';
        }, 220);
      }
      try {
        fab.releasePointerCapture(event.pointerId);
      } catch (error) {}
      filterFabDragState_ = null;
    });
  }

  function applyFilterFabPosition_() {
    var fab = document.getElementById('filterFab');
    var indicator = document.getElementById('connectionIndicator');
    positionCenteredHeaderControls_();
    if (!fab) {
      return;
    }
    if (fab.dataset.userMoved === '1' && fab.style.left && fab.style.top) {
      setFilterFabPosition_(parseFloat(fab.style.left) || 12, parseFloat(fab.style.top) || 42);
      return;
    }
    var viewportWidth = (window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || 1024;
    var fabWidth = fab.offsetWidth || 124;
    var centeredLeft = Math.max(10, (viewportWidth / 2) - (fabWidth / 2));
    var top = 82;
    if (indicator) {
      var rect = indicator.getBoundingClientRect();
      var indicatorCenter = rect.left + (rect.width / 2);
      centeredLeft = Math.max(10, indicatorCenter - (fabWidth / 2));
      top = Math.max(54, rect.bottom + 10);
    }
    setFilterFabPosition_(centeredLeft, top);
  }

  function positionCenteredHeaderControls_() {
    var indicator = document.getElementById('connectionIndicator');
    var fab = document.getElementById('filterFab');
    if (!indicator || !fab) {
      return;
    }
    indicator.style.top = '8px';
    indicator.style.left = '50%';
    indicator.style.right = 'auto';
    indicator.style.transform = 'translateX(-50%)';
  }

  function setFilterFabPosition_(left, top) {
    var fab = document.getElementById('filterFab');
    if (!fab) {
      return;
    }
    var viewportWidth = (window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || 1024;
    var viewportHeight = (window.visualViewport && window.visualViewport.height) || window.innerHeight || document.documentElement.clientHeight || 768;
    var fabWidth = fab.offsetWidth || 92;
    var fabHeight = fab.offsetHeight || 42;
    var minLeft = 10;
    var minTop = 42;
    var maxLeft = Math.max(minLeft, viewportWidth - fabWidth - 10);
    var maxTop = Math.max(minTop, viewportHeight - fabHeight - 10);
    fab.style.left = Math.min(Math.max(minLeft, left), maxLeft) + 'px';
    fab.style.top = Math.min(Math.max(minTop, top), maxTop) + 'px';
  }

  function bindPenInputMode_() {
      document.addEventListener('pointerdown', function(event) {
        if (shouldBlockSpenInteraction_(event.target)) {
          event.preventDefault();
          event.stopPropagation();
          focusSpenInput_();
          return;
        }
        if (event.pointerType !== 'pen') {
          return;
        }
        if (document.getElementById('spenModal') && !document.getElementById('spenModal').classList.contains('hidden')) {
          return;
      }
      var target = event.target;
      if (!isTextLikeField_(target)) {
        return;
      }
        event.preventDefault();
        abrirSpenPopup(target.id, getSpenFieldTitle_(target));
      }, true);

      ['click', 'touchstart'].forEach(function(eventName) {
        document.addEventListener(eventName, function(event) {
          if (!shouldBlockSpenInteraction_(event.target)) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          focusSpenInput_();
        }, true);
      });

      document.addEventListener('focusin', function(event) {
        if (!shouldBlockSpenInteraction_(event.target)) {
          return;
        }
        event.preventDefault();
        focusSpenInput_();
      }, true);
    }

    function isSpenModalOpen_() {
      var modal = document.getElementById('spenModal');
      return !!(modal && !modal.classList.contains('hidden'));
    }

    function shouldBlockSpenInteraction_(target) {
      if (!appState.spenLocked || !isSpenModalOpen_()) {
        return false;
      }
      var modal = document.getElementById('spenModal');
      var card = modal ? modal.querySelector('.spen-modal-card') : null;
      if (!card) {
        return false;
      }
      return !card.contains(target);
    }

    function focusSpenInput_() {
      var input = document.getElementById('spenInputArea');
      if (input) {
        setTimeout(function() {
          input.focus();
          try {
            var end = (input.value || '').length;
            input.setSelectionRange(end, end);
          } catch (error) {}
        }, 0);
      }
    }

    function requestAppFullscreen_() {
      try {
        var root = document.documentElement;
        if (!document.fullscreenElement && root && typeof root.requestFullscreen === 'function') {
          root.requestFullscreen().catch(function() {});
        }
      } catch (error) {}
    }

    function syncSpenLockClasses_() {
      var method = appState.spenLocked ? 'add' : 'remove';
      document.body.classList[method]('spen-hard-locked');
      document.documentElement.classList[method]('spen-hard-locked');
    }

  function isTextLikeField_(target) {
    if (!target || !target.tagName || !target.id) {
      return false;
    }
    if (target.tagName === 'TEXTAREA') {
      return true;
    }
    if (target.tagName !== 'INPUT') {
      return false;
    }
    var allowed = ['text', 'search', 'email', 'tel', 'url', 'number'];
    return allowed.indexOf((target.type || 'text').toLowerCase()) > -1 && !target.readOnly && !target.disabled;
  }

  function getSpenFieldTitle_(target) {
    var id = typeof target === 'string' ? target : target.id;
    var map = {
      novaDescricao: 'Descricao',
      novaObservacao: 'Observacao',
      editObservacao: 'Observacao',
      novoPrestadorNome: 'Executor / prestador',
      concluirObservacao: 'Observacao da conclusao'
    };
    if (map[id]) {
      return map[id];
    }
    if (typeof target !== 'string' && target) {
      var label = target.closest('label');
      var titleNode = label ? label.querySelector('span') : null;
      if (titleNode && titleNode.textContent) {
        return titleNode.textContent.trim();
      }
      if (target.placeholder) {
        return target.placeholder;
      }
    }
    return 'Campo';
  }

  function hydrateFromCache_() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) {
        updateSyncStatusBar_();
        return;
      }
      var cached = JSON.parse(raw);
      appState.combos = cached.combos || null;
      appState.configs = cached.configs || [];
      appState.prestadoresAdmin = cached.prestadoresAdmin || [];
      appState.comboAdmin = cached.comboAdmin || {};
      appState.allPendencias = cached.allPendencias || [];
      appState.detailsById = cached.detailsById || {};
        appState.pendingQueue = cached.pendingQueue || [];
        appState.tempIdMap = cached.tempIdMap || {};
        appState.formContext = cached.formContext || appState.formContext;
          appState.dashboardChartMode = cached.dashboardChartMode || appState.dashboardChartMode;
          appState.currentSection = cached.currentSection || appState.currentSection;
          appState.navigationStack = cached.navigationStack || [];
          appState.connection.lastSyncAt = cached.lastSyncAt || '';
        resetDashboardChartModes_();
        appState.dashboard = buildDashboardFromLocalState_();
    } catch (error) {
      localStorage.removeItem(CACHE_KEY);
    }
    applyFilterFabPosition_();
    updateSyncStatusBar_();
  }

  function saveCache_() {
    try {
      var payload = {
        combos: appState.combos,
        configs: appState.configs,
        prestadoresAdmin: appState.prestadoresAdmin,
        comboAdmin: appState.comboAdmin,
        allPendencias: appState.allPendencias,
        detailsById: appState.detailsById,
          pendingQueue: appState.pendingQueue,
          tempIdMap: appState.tempIdMap,
          formContext: appState.formContext,
          dashboardChartMode: appState.dashboardChartMode,
          currentSection: appState.currentSection,
          navigationStack: appState.navigationStack,
          lastSyncAt: appState.connection.lastSyncAt
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      } catch (error) {
        if (isStorageQuotaError_(error)) {
          if (window.console && console.warn) {
            console.warn('Sem espaco para salvar cache offline.', error);
          }
        } else if (window.console && console.warn) {
          console.warn('Falha ao salvar cache offline.', error);
        }
      }
    updateSyncStatusBar_();
  }

  function renderAll_() {
    if (appState.combos) {
      preencherCombos(appState.combos);
      applySavedFormContext_();
    }
    renderConfiguracoes(appState.configs || []);
    renderCadastroList_();
    appState.dashboard = buildDashboardFromLocalState_();
    renderDashboard(buildDashboardFromVisibleState_());
    renderPendencias(getFilteredPendencias_(false));
    renderHistoricoGeral(getFilteredPendencias_(true));
    renderCronogramaPreview_();
    renderFiltroResumo();
    applyFilterFabPosition_();
    updateSyncStatusBar_();
    refreshBackButtons_();
  }

  function resetDashboardChartModes_() {
    appState.dashboardChartMode = {
      loja: 'list',
      setor: 'list'
    };
  }

  function carregarEstadoServidor_() {
    if (!appState.connection.online) {
      return Promise.resolve();
    }
    mostrarLoading();
    return Promise.all([
      serverCall_('getAppInitData', []),
      serverCall_('listarPendencias', [{ incluirFinalizadas: true }])
    ]).then(function(results) {
      var initResponse = results[0];
      var pendenciasResponse = results[1];
      if (!initResponse.success) {
        throw new Error(initResponse.message);
      }
      if (!pendenciasResponse.success) {
        throw new Error(pendenciasResponse.message);
      }

      appState.combos = initResponse.data.combos;
      appState.configs = initResponse.data.config.data || [];
      appState.prestadoresAdmin = (initResponse.data.prestadoresAdmin && initResponse.data.prestadoresAdmin.data) || [];
      appState.comboAdmin = initResponse.data.comboAdmin || {};
      appState.allPendencias = pendenciasResponse.data || [];
      appState.dashboard = buildDashboardFromLocalState_();
      appState.connection.lastSyncAt = new Date().toISOString();
      saveCache_();
      renderAll_();
      ocultarLoading();
    }).catch(function(error) {
      ocultarLoading();
      throw error;
    });
  }

  function navegar(sectionId, buttonEl, skipHistory) {
    if (appState.currentSection && appState.currentSection !== sectionId && !skipHistory) {
      appState.navigationStack.push(appState.currentSection);
    }
    appState.currentSection = sectionId;
    document.querySelectorAll('.page-section').forEach(function(section) {
      section.classList.toggle('active', section.id === sectionId);
    });
    document.querySelectorAll('.nav-button').forEach(function(button) {
      button.classList.remove('active');
    });
    if (buttonEl) {
      buttonEl.classList.add('active');
    } else {
      var targetButton = document.querySelector('.nav-button[data-section="' + sectionId + '"]');
      if (targetButton) {
        targetButton.classList.add('active');
      }
    }
      if (sectionId === 'secaoHistorico') {
        renderHistoricoGeral(getFilteredPendencias_(true));
      }
      if (sectionId === 'secaoDashboard') {
        resetDashboardChartModes_();
        renderDashboard(buildDashboardFromVisibleState_());
      }
      if (sectionId === 'secaoCronograma') {
        renderCronogramaPreview_();
      }
      if (sectionId === 'secaoListaPendencias') {
        renderPendencias(getFilteredPendencias_(false));
      }
    saveCache_();
    refreshBackButtons_();
  }

  function voltarTelaAnterior() {
    if (!appState.navigationStack.length) {
      return;
    }
    var previous = appState.navigationStack.pop();
    navegar(previous || 'secaoDashboard', null, true);
  }

  function refreshBackButtons_() {
    Array.prototype.forEach.call(document.querySelectorAll('.back-button'), function(button) {
      button.disabled = appState.navigationStack.length === 0;
      button.classList.toggle('disabled', appState.navigationStack.length === 0);
    });
  }

  function carregarDashboard() {
    if (!appState.connection.online) {
      appState.dashboard = buildDashboardFromLocalState_();
      renderDashboard(buildDashboardFromVisibleState_());
      mostrarMensagemSucesso('Dashboard atualizado com os dados offline salvos neste aparelho.');
      return;
    }
    carregarEstadoServidor_().catch(function(error) {
      mostrarMensagemErro(error.message || 'Nao foi possivel atualizar o dashboard.');
    });
  }

  function atualizarTelaAtual() {
    var active = document.querySelector('.page-section.active');
    if (!active) {
      carregarDashboard();
      return;
    }
    if (active.id === 'secaoHistorico') {
      carregarHistoricoPendencias();
      return;
    }
    if (active.id === 'secaoListaPendencias') {
      listarPendencias();
      return;
    }
    if (active.id === 'secaoCronograma') {
      if (appState.connection.online) {
        carregarEstadoServidor_()
          .then(function() {
            renderCronogramaPreview_();
          })
          .catch(function(error) {
            mostrarMensagemErro(error.message || 'Nao foi possivel atualizar o cronograma.');
          });
        return;
      }
      renderCronogramaPreview_();
      mostrarMensagemSucesso('Cronograma atualizado com o cache offline.');
      return;
    }
    if (appState.connection.online) {
      carregarEstadoServidor_().catch(function(error) {
        mostrarMensagemErro(error.message || 'Nao foi possivel atualizar os dados.');
      });
      return;
    }
    renderAll_();
    mostrarMensagemSucesso('Tela atualizada com o cache offline.');
  }

  function preencherCombos(combos) {
    if (combos) {
      combos.prestadores = normalizePrestadores_(combos.prestadores || []);
    }
    preencherSelect('novaLoja', combos.lojas, 'Selecione uma loja');
    preencherSelect('novoSetor', combos.setores, 'Selecione um setor');
    preencherSelect('novoTipo', combos.tipos, 'Selecione um tipo');
    preencherSelect('novaPrioridade', combos.prioridades, 'Selecione uma prioridade');
    preencherSelect('novoExecutor', combos.prestadores, 'Selecione um executor', true);

    preencherSelect('filtroLoja', combos.lojas, 'Todas as lojas', true);
    preencherSelect('filtroSetor', combos.setores, 'Todos os setores', true);
    preencherSelect('filtroStatus', combos.status, 'Todos os status', true);
    preencherSelect('filtroExecutor', combos.prestadores, 'Todos os executores', true);
    preencherSelect('filtroPrioridade', combos.prioridades, 'Todas as prioridades', true);
    preencherSelect('filtroTipo', combos.tipos, 'Todos os tipos', true);

    preencherSelect('editExecutor', combos.prestadores, 'Selecione um executor', true);
    preencherSelect('editStatus', combos.status, 'Selecione um status');
    preencherSelect('editSetor', combos.setores, 'Selecione um setor');
    preencherSelect('editTipo', combos.tipos, 'Selecione um tipo');
    preencherSelect('editPrioridade', combos.prioridades, 'Selecione uma prioridade');
    preencherSelect('cronogramaExecutor', combos.prestadores, 'Sem prestador definido', true);
    preencherSelect('cronogramaLoja', combos.lojas, 'Todas as lojas', true);
    preencherSelect('cronogramaSetor', combos.setores, 'Todos os setores', true);
    preencherSelect('cronogramaStatus', ['Em andamento', 'Concluido', 'Vencido'], 'Todos os status', true);
    bindManagedSelects_();
  }

  function preencherSelect(elementId, values, placeholder, allowBlank) {
    var select = document.getElementById(elementId);
    if (!select) {
      return;
    }
    var currentValue = select.value || (select.dataset.lastValue || '');
    var options = ['<option value="">' + (placeholder || 'Selecione') + '</option>'];
    (values || []).forEach(function(value) {
      options.push('<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>');
    });
    select.innerHTML = options.join('');
    if (currentValue) {
      select.value = currentValue;
    }
    if (!allowBlank && values && values.length === 1 && !select.value) {
      select.value = values[0];
    }
    if (select.value) {
      select.dataset.lastValue = select.value;
    }
  }

  function bindManagedSelects_() {
    Object.keys(getManagedSelectMap_()).forEach(function(selectId) {
      var select = document.getElementById(selectId);
      if (!select || select.dataset.comboEditorBound === '1') {
        return;
      }
      select.dataset.comboEditorBound = '1';
        select.addEventListener('focus', function() {
          if (select.value) {
            select.dataset.lastValue = select.value;
          }
        });
        select.addEventListener('change', function() {
          select.dataset.lastValue = select.value || '';
        });
      });
    }

  function getManagedSelectMap_() {
    return {
      novaLoja: { group: 'loja', title: 'Lojas' },
      novoSetor: { group: 'setor', title: 'Setores' },
      novoTipo: { group: 'tipo', title: 'Tipos' },
      novaPrioridade: { group: 'prioridade', title: 'Prioridades' },
      editExecutor: { group: 'executor', title: 'Executor / prestador' },
      editStatus: { group: 'status', title: 'Status' },
      editSetor: { group: 'setor', title: 'Setores' },
      editTipo: { group: 'tipo', title: 'Tipos' },
      editPrioridade: { group: 'prioridade', title: 'Prioridades' }
    };
  }

  function getManagedGroupCatalog_() {
    return [
      { group: 'executor', title: 'Executor / prestador' },
      { group: 'loja', title: 'Lojas' },
      { group: 'setor', title: 'Setores' },
      { group: 'tipo', title: 'Tipos' },
      { group: 'prioridade', title: 'Prioridades' },
      { group: 'status', title: 'Status' }
    ];
  }

  function getManagedSelectConfig_(selectId) {
    return getManagedSelectMap_()[selectId] || null;
  }

  function abrirEditorOpcoesSelect(selectId) {
    var config = getManagedSelectConfig_(selectId);
    if (!config) {
      return;
    }
    appState.comboEditor = {
      group: config.group,
      targetId: selectId,
      title: config.title
    };
    renderComboEditorModal_();
    document.getElementById('comboEditorModal').classList.remove('hidden');
  }

  function abrirEditorCadastroGrupo(group) {
    var target = getManagedGroupCatalog_().filter(function(item) {
      return item.group === group;
    })[0];
    if (!target) {
      return;
    }
    appState.comboEditor = {
      group: target.group,
      targetId: '',
      title: target.title
    };
    renderComboEditorModal_();
    document.getElementById('comboEditorModal').classList.remove('hidden');
  }

  async function salvarNovaPendencia(event) {
    event.preventDefault();
    captureFormContext_();
    var dados = {
      loja: document.getElementById('novaLoja').value,
      setor: document.getElementById('novoSetor').value,
      tipo: document.getElementById('novoTipo').value,
      prioridade: document.getElementById('novaPrioridade').value,
      executor: document.getElementById('novoExecutor').value,
      descricao: document.getElementById('novaDescricao').value,
      observacao: document.getElementById('novaObservacao').value
    };

    if (!dados.loja || !dados.setor || !dados.descricao.trim()) {
      mostrarMensagemErro('Preencha loja, setor e descricao antes de salvar.');
      return;
    }

    var fotoInput = document.getElementById('novaFoto');
    if (fotoInput.files && fotoInput.files[0]) {
      try {
        dados.foto = await converterFotoParaBase64(fotoInput.files[0]);
      } catch (error) {
        mostrarMensagemErro(error.message || 'Nao foi possivel preparar a foto.');
        return;
      }
    }

    if (!appState.connection.online) {
      criarPendenciaOffline_(dados);
      return;
    }

    mostrarLoading();
    serverCall_('criarPendencia', [dados])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message + ' ID: ' + response.data.id_pendencia);
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          renderAll_();
        }
        limparFormularioNovaPendencia();
        applySavedFormContext_();
        navegar('secaoNovaPendencia');
        focusNovaDescricao_();
      })
      .catch(handleFailure);
  }

  function criarPendenciaOffline_(dados) {
    var tempId = generateLocalId_('LOCAL');
    var now = new Date();
    var item = {
      id_pendencia: tempId,
      data_abertura: toInputDate_(now),
      hora_abertura: toTime_(now),
      loja: dados.loja,
      setor: dados.setor,
      tipo: dados.tipo || 'Outro',
      prioridade: dados.prioridade || 'Media',
      descricao: dados.descricao,
      observacao: dados.observacao || '',
      solicitante: 'offline_local',
      responsavel: '',
      executor: dados.executor || '',
      data_inicio: '',
      previsao_entrega: '',
      status: 'Aberto',
      data_conclusao: '',
      hora_conclusao: '',
      link_foto: '',
      id_arquivo_drive: '',
      excluir_foto_em: '',
      foto_excluida: 'NAO',
      ultima_atualizacao: formatDateTimeLocal_(now),
      atualizado_por: 'offline_local',
      foto_preview: dados.foto ? dados.foto.base64 : '',
      historico: [buildHistoryEntry_('', 'Aberto', 'offline_local', dados.observacao || 'Registro criado offline.')],
      _syncStatus: 'pendente',
      _offlineOnly: true
    };
    item.historico[0].id_pendencia = tempId;
    mergeItemIntoState_(item);
    enqueueOperation_({
      type: 'create',
      tempId: tempId,
      payload: deepClone_(dados)
    });
    limparFormularioNovaPendencia();
    applySavedFormContext_();
    renderAll_();
    navegar('secaoNovaPendencia');
    focusNovaDescricao_();
    mostrarMensagemSucesso('Pendencia salva offline. Ela sera sincronizada quando a internet voltar.');
  }

  function listarPendencias() {
    renderPendencias(getFilteredPendencias_(false));
    renderFiltroResumo();
    if (appState.connection.online && appState.pendingQueue.length === 0) {
      carregarEstadoServidor_().catch(function() {
        renderPendencias(getFilteredPendencias_(false));
      });
    }
  }

  function carregarHistoricoPendencias() {
    renderHistoricoGeral(getFilteredPendencias_(true));
    if (appState.connection.online && appState.pendingQueue.length === 0) {
      carregarEstadoServidor_().catch(function() {
        renderHistoricoGeral(getFilteredPendencias_(true));
      });
    }
  }

  function obterFiltrosTela(apenasHistorico) {
    return {
      loja: getElementValue_('filtroLoja'),
      setor: getElementValue_('filtroSetor'),
      status: getElementValue_('filtroStatus'),
      executor: getElementValue_('filtroExecutor'),
      prioridade: getElementValue_('filtroPrioridade'),
      tipo: getElementValue_('filtroTipo'),
      dataAberturaDe: getElementValue_('filtroDataAberturaDe'),
      dataAberturaAte: getElementValue_('filtroDataAberturaAte'),
      previsaoEntregaDe: getElementValue_('filtroPrevisaoDe'),
      previsaoEntregaAte: getElementValue_('filtroPrevisaoAte'),
      incluirFinalizadas: !!apenasHistorico,
      apenasHistorico: !!apenasHistorico
    };
  }

  function aplicarFiltros() {
    toggleFiltroDrawer(false);
    renderDashboard(buildDashboardFromVisibleState_());
    renderPendencias(getFilteredPendencias_(false));
    renderHistoricoGeral(getFilteredPendencias_(true));
    renderFiltroResumo();
  }

  function limparFiltros() {
    ['filtroLoja', 'filtroSetor', 'filtroStatus', 'filtroExecutor', 'filtroPrioridade', 'filtroTipo', 'filtroDataAberturaDe', 'filtroDataAberturaAte', 'filtroPrevisaoDe', 'filtroPrevisaoAte']
      .forEach(function(id) {
        document.getElementById(id).value = '';
      });
    renderDashboard(buildDashboardFromVisibleState_());
    renderPendencias(getFilteredPendencias_(false));
    renderHistoricoGeral(getFilteredPendencias_(true));
    renderFiltroResumo();
  }

  function obterFiltrosCronograma_() {
    return {
      executor: getElementValue_('cronogramaExecutor'),
      loja: getElementValue_('cronogramaLoja'),
      setor: getElementValue_('cronogramaSetor'),
      status: getElementValue_('cronogramaStatus'),
      dataAberturaDe: getElementValue_('cronogramaDataAberturaDe'),
      dataAberturaAte: getElementValue_('cronogramaDataAberturaAte'),
      previsaoEntregaDe: getElementValue_('cronogramaPrevisaoDe'),
      previsaoEntregaAte: getElementValue_('cronogramaPrevisaoAte')
    };
  }

  function validarFiltrosCronograma_(showFeedback) {
    return obterFiltrosCronograma_();
  }

  function aplicarFiltrosCronograma(event) {
    if (event && event.preventDefault) {
      event.preventDefault();
    }
    if (!validarFiltrosCronograma_(true)) {
      renderCronogramaPreview_();
      return;
    }
    renderCronogramaPreview_();
  }

  function limparFiltrosCronograma() {
    ['cronogramaExecutor', 'cronogramaLoja', 'cronogramaSetor', 'cronogramaStatus', 'cronogramaDataAberturaDe', 'cronogramaDataAberturaAte', 'cronogramaPrevisaoDe', 'cronogramaPrevisaoAte']
      .forEach(function(id) {
        var field = document.getElementById(id);
        if (field) {
          field.value = '';
        }
      });
    renderCronogramaPreview_();
  }

  function getCronogramaItemsLocal_() {
    var filtros = validarFiltrosCronograma_(false);
    return appState.allPendencias.filter(function(item) {
      var status = getCronogramaStatusLocal_(item);
      if (normalizeText_(item.status) === 'cancelado') {
        return false;
      }
      if (filtros.executor) {
        if (normalizeText_(item.executor) !== normalizeText_(filtros.executor)) {
          return false;
        }
      } else if (safeTrim_(item.executor)) {
        return false;
      }
      if (filtros.loja && normalizeText_(item.loja) !== normalizeText_(filtros.loja)) {
        return false;
      }
      if (filtros.setor && normalizeText_(item.setor) !== normalizeText_(filtros.setor)) {
        return false;
      }
      if ((filtros.dataAberturaDe || filtros.dataAberturaAte) && !dateWithinRangeLocal_(item.data_abertura, filtros.dataAberturaDe, filtros.dataAberturaAte)) {
        return false;
      }
      if ((filtros.previsaoEntregaDe || filtros.previsaoEntregaAte) && !dateWithinRangeLocal_(item.previsao_entrega, filtros.previsaoEntregaDe, filtros.previsaoEntregaAte)) {
        return false;
      }
      if (filtros.status && normalizeText_(status) !== normalizeText_(filtros.status)) {
        return false;
      }
      item.esta_vencida = isPendenciaVencidaLocal_(item);
      item.status_cronograma = status;
      item.data_abertura_label = formatDateBr(item.data_abertura);
      item.previsao_entrega_label = formatDateBr(item.previsao_entrega);
      return true;
    }).sort(compareCronogramaItemsLocal_);
  }

  function getCronogramaStatusLocal_(item) {
    if (!item) {
      return '';
    }
    if (normalizeText_(item.status) === 'concluido') {
      return 'Concluido';
    }
    if (isPendenciaVencidaLocal_(item)) {
      return 'Vencido';
    }
    if (safeTrim_(item.executor)) {
      return 'Em andamento';
    }
    return 'Aberto';
  }

  function compareCronogramaItemsLocal_(a, b) {
    var aDate = parseInputDate_(a.previsao_entrega);
    var bDate = parseInputDate_(b.previsao_entrega);
    var aTime = aDate ? aDate.getTime() : Number.MAX_SAFE_INTEGER;
    var bTime = bDate ? bDate.getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) {
      return aTime - bTime;
    }
    var lojaCompare = safeTrim_(a.loja).localeCompare(safeTrim_(b.loja), 'pt-BR');
    if (lojaCompare !== 0) {
      return lojaCompare;
    }
    var setorCompare = safeTrim_(a.setor).localeCompare(safeTrim_(b.setor), 'pt-BR');
    if (setorCompare !== 0) {
      return setorCompare;
    }
    return String(a.id_pendencia || '').localeCompare(String(b.id_pendencia || ''), 'pt-BR');
  }

  function renderCronogramaTextoCell_(item) {
      var html = [];
      html.push('<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'descricao\')">Descricao</button>');
      html.push('<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'observacao\')">Observacao</button>');
      return html.join('');
    }

  function renderCronogramaPreview_() {
    var cardsEl = document.getElementById('cronogramaCards');
    var tableEl = document.getElementById('cronogramaTabela');
    var resumoEl = document.getElementById('cronogramaResumo');
    if (!cardsEl || !tableEl || !resumoEl) {
      return;
    }
    var filtros = validarFiltrosCronograma_(false);
    if (!filtros) {
      resumoEl.textContent = 'Visualizando pendencias sem prestador definido.';
      cardsEl.innerHTML = '<div class="panel empty-state">Nenhuma pendencia sem prestador definido encontrada para os filtros informados.</div>';
      tableEl.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma pendencia sem prestador definido encontrada para os filtros informados.</td></tr>';
      return;
    }

    var items = getCronogramaItemsLocal_();
    resumoEl.textContent = items.length
      ? ('Programacao de ' + (filtros.executor || 'pendencias sem prestador definido') + ' com ' + items.length + ' pendencia' + (items.length > 1 ? 's' : '') + '.')
      : ('Nenhuma pendencia ativa encontrada para ' + (filtros.executor || 'sem prestador definido') + '.');

    if (!items.length) {
      cardsEl.innerHTML = '<div class="panel empty-state">Nenhuma pendencia ativa encontrada para os filtros informados.</div>';
      tableEl.innerHTML = '<tr><td colspan="7" class="empty-state">Nenhuma pendencia ativa encontrada para os filtros informados.</td></tr>';
      return;
    }

    cardsEl.innerHTML = items.map(function(item) {
      return '<article class="pendencia-card cronograma-card">' +
        '<div class="cronograma-card-top"><h3>' + escapeHtml(item.executor || filtros.executor) + '</h3>' +
        ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '') +
        '</div>' +
        '<div class="cronograma-card-grid">' +
          cardKv_('Local', escapeHtml(item.loja || '-')) +
          cardKv_('Setor', renderSetorBadge_(item.setor || '-')) +
          cardKv_('Status', renderTag('status', item.status_cronograma || getCronogramaStatusLocal_(item))) +
          cardKv_('Previsao', escapeHtml(item.previsao_entrega_label || '-')) +
          cardKv_('Descricao / Observacao', renderCronogramaTextoCell_(item)) +
        '</div>' +
      '</article>';
    }).join('');

    tableEl.innerHTML = items.map(function(item) {
      return '<tr>' +
        '<td>' + escapeHtml(item.executor || filtros.executor || '-') + '</td>' +
        '<td>' + escapeHtml(item.loja || '-') + '</td>' +
        '<td>' + renderSetorBadge_(item.setor || '-') + '</td>' +
        '<td>' + renderTag('status', item.status_cronograma || getCronogramaStatusLocal_(item)) + '</td>' +
        '<td>' + escapeHtml(item.previsao_entrega_label || '-') + '</td>' +
        '<td class="cronograma-text-cell">' + renderCronogramaTextoCell_(item) + '</td>' +
        '<td class="cronograma-anexo-cell">' + ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '<span class="muted-text">Sem anexo</span>') + '</td>' +
      '</tr>';
    }).join('');
  }

  function gerarPdfCronograma() {
    var filtros = validarFiltrosCronograma_(true);
    if (!filtros) {
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('A geracao do PDF do cronograma precisa de internet.');
      return;
    }
    mostrarLoading();
    serverCall_('gerarCronogramaPdf', [filtros])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        abrirPdfCronograma_(response.data);
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function gerarExcelCronograma() {
    var filtros = validarFiltrosCronograma_(true);
    if (!filtros) {
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('A geracao do Excel do cronograma precisa de internet.');
      return;
    }
    mostrarLoading();
    serverCall_('gerarCronogramaExcel', [filtros])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        baixarArquivoCronograma_(response.data);
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function abrirPdfCronograma_(payload) {
    if (!payload || !(payload.openUrl || payload.url)) {
      throw new Error('Arquivo PDF invalido.');
    }
    var url = payload.openUrl || payload.url;
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = payload.fileName || 'cronograma.pdf';
    anchor.target = '_blank';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function() {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }, 600);
  }

  function baixarArquivoCronograma_(payload) {
    if (!payload || !(payload.downloadUrl || payload.url)) {
      throw new Error('Arquivo do cronograma invalido.');
    }
    var targetUrl = payload.downloadUrl || payload.url;
    try {
      window.location.assign(targetUrl);
    } catch (error) {
      var anchor = document.createElement('a');
      anchor.href = targetUrl;
      anchor.target = '_self';
      anchor.rel = 'noopener';
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(function() {
        if (anchor.parentNode) {
          anchor.parentNode.removeChild(anchor);
        }
      }, 600);
    }
  }

  function renderFiltroResumo() {
    var summaryNode = document.getElementById('filtroResumo');
    if (!summaryNode) {
      return;
    }
    var filtros = obterFiltrosTela(false);
    var labels = [];
    Object.keys(filtros).forEach(function(key) {
      if (key === 'incluirFinalizadas' || key === 'apenasHistorico') {
        return;
      }
      if (filtros[key]) {
        labels.push(formatarChaveFiltro(key) + ': ' + filtros[key]);
      }
    });
    summaryNode.textContent = labels.length ? labels.join(' | ') : '';
  }

  function formatarChaveFiltro(chave) {
    var mapa = {
      loja: 'Loja',
      setor: 'Setor',
      status: 'Status',
      executor: 'Executor',
      prioridade: 'Prioridade',
      tipo: 'Tipo',
      dataAberturaDe: 'Abertura de',
      dataAberturaAte: 'Abertura ate',
      previsaoEntregaDe: 'Previsao de',
      previsaoEntregaAte: 'Previsao ate'
    };
    return mapa[chave] || chave;
  }

  function toggleFiltroDrawer(show) {
    document.getElementById('filtroDrawer').classList.toggle('hidden', !show);
    document.body.classList.toggle('sidebar-open', !!show);
    renderPendencias(getFilteredPendencias_(false));
    renderHistoricoGeral(getFilteredPendencias_(true));
    if (appState.zoomContext && !document.getElementById('metricZoomModal').classList.contains('hidden')) {
      aplicarFiltrosZoom();
    }
  }

  function abrirFiltrosFlutuante() {
    var fab = document.getElementById('filterFab');
    if (fab && fab.dataset.suppressClick === '1') {
      return;
    }
    var drawer = document.getElementById('filtroDrawer');
    toggleFiltroDrawer(drawer.classList.contains('hidden'));
  }

  function abrirDetalhesPendencia(id) {
    var itemLocal = getLocalItemById_(id);
    if (!appState.connection.online || isLocalId_(id)) {
      renderDetalhesPendencia(buildDetailFromLocalItem_(itemLocal));
      navegar('secaoDetalhesPendencia');
      return;
    }

    mostrarLoading();
    serverCall_('buscarPendenciaPorId', [resolveRemoteId_(id)])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        appState.detailsById[response.data.id_pendencia] = response.data;
        mergeItemIntoState_(response.data);
        saveCache_();
        renderDetalhesPendencia(response.data);
        navegar('secaoDetalhesPendencia');
      })
      .catch(function() {
        ocultarLoading();
        renderDetalhesPendencia(buildDetailFromLocalItem_(itemLocal));
        navegar('secaoDetalhesPendencia');
      });
  }

  function editarPendencia(id) {
    var item = buildDetailFromLocalItem_(getLocalItemById_(id));
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    document.getElementById('editIdPendencia').value = item.id_pendencia;
    document.getElementById('editExecutor').value = item.executor || '';
    document.getElementById('editStatus').value = item.status || '';
    document.getElementById('editSetor').value = item.setor || '';
    document.getElementById('editDataInicio').value = normalizeDateForInputValue_(item.data_inicio);
    document.getElementById('editPrevisaoEntrega').value = normalizeDateForInputValue_(item.previsao_entrega || item.previsao_entrega_label);
    document.getElementById('editTipo').value = item.tipo || '';
    document.getElementById('editPrioridade').value = item.prioridade || '';
    document.getElementById('editObservacao').value = item.observacao || '';
    document.getElementById('editFoto').value = '';
    atualizarNomeArquivo('editFoto', 'editFotoNome');
    navegar('secaoEdicaoPendencia');
  }

  function salvarExecutorRapido(id, executor) {
    var item = getLocalItemById_(id);
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    if (normalizeText_(item.executor) === normalizeText_(executor)) {
      return;
    }
    if (!appState.connection.online) {
      item.executor = executor || '';
      item._syncStatus = 'pendente';
      item.ultima_atualizacao = formatDateTimeLocal_(new Date());
      item.atualizado_por = 'offline_local';
      mergeItemIntoState_(item);
      enqueueOperation_({
        type: 'update',
        id: id,
        payload: { executor: executor || '' },
        observacao: ''
      });
      renderAll_();
      mostrarMensagemSucesso('Executor atualizado offline. Sera sincronizado ao reconectar.');
      return;
    }
    mostrarLoading();
    serverCall_('atualizarPendencia', [resolveRemoteId_(id), { executor: executor || '' }])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          renderAll_();
        } else {
          return carregarEstadoServidor_();
        }
        mostrarMensagemSucesso('Executor atualizado com sucesso.');
      })
      .catch(handleFailure);
  }

  async function salvarEdicaoPendencia(event) {
    event.preventDefault();
    var id = document.getElementById('editIdPendencia').value;
    var dados = {
      executor: document.getElementById('editExecutor').value,
      status: document.getElementById('editStatus').value,
      setor: document.getElementById('editSetor').value,
      data_inicio: document.getElementById('editDataInicio').value,
      previsao_entrega: document.getElementById('editPrevisaoEntrega').value,
      tipo: document.getElementById('editTipo').value,
      prioridade: document.getElementById('editPrioridade').value,
      observacao: document.getElementById('editObservacao').value
    };

    var fotoInput = document.getElementById('editFoto');
    if (fotoInput.files && fotoInput.files[0]) {
      try {
        dados.foto = await converterFotoParaBase64(fotoInput.files[0]);
      } catch (error) {
        mostrarMensagemErro(error.message || 'Nao foi possivel preparar a foto.');
        return;
      }
    }

    if (!appState.connection.online) {
      atualizarPendenciaOffline_(id, dados, 'update');
      return;
    }

    mostrarLoading();
    serverCall_('atualizarPendencia', [resolveRemoteId_(id), dados])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message);
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          renderAll_();
          renderDetalhesPendencia(response.data.pendencia);
          navegar('secaoDetalhesPendencia');
          return;
        }
        return carregarEstadoServidor_().then(function() {
          abrirDetalhesPendencia(resolveRemoteId_(id));
        });
      })
      .catch(handleFailure);
  }

  function atualizarPendenciaOffline_(id, dados, operationType) {
    var item = getLocalItemById_(id);
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    var previousStatus = item.status || 'Aberto';
    applyOfflineMutationToItem_(item, dados);
    if (dados.status && normalizeText_(dados.status) !== normalizeText_(previousStatus)) {
      item.historico = item.historico || [];
      item.historico.unshift(buildHistoryEntry_(previousStatus, dados.status, 'offline_local', dados.observacao || 'Status alterado offline.'));
    }
    mergeItemIntoState_(item);
    enqueueOperation_({
      type: operationType || 'update',
      id: id,
      payload: deepClone_(dados),
      observacao: dados.observacao || ''
    });
    renderAll_();
    abrirDetalhesPendencia(id);
    mostrarMensagemSucesso('Edicao salva offline. Ela sera sincronizada quando a internet voltar.');
  }

  function concluirPendencia(id) {
    if (!id) {
      mostrarMensagemErro('Nenhuma pendencia selecionada.');
      return;
    }
    document.getElementById('concluirPendenciaId').value = id;
    document.getElementById('concluirObservacao').value = '';
    document.getElementById('concluirModal').classList.remove('hidden');
  }

  function fecharConclusaoModal() {
    document.getElementById('concluirModal').classList.add('hidden');
  }

  function confirmarConclusaoModal() {
    var id = document.getElementById('concluirPendenciaId').value;
    var observacao = document.getElementById('concluirObservacao').value || '';
    fecharConclusaoModal();
    if (!appState.connection.online) {
      atualizarPendenciaOffline_(id, {
        status: 'Concluido',
        observacao: observacao
      }, 'conclude');
      navegar('secaoHistorico');
      return;
    }

    mostrarLoading();
    serverCall_('concluirPendencia', [resolveRemoteId_(id), observacao])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message);
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          renderAll_();
          navegar('secaoHistorico');
          return;
        }
        return carregarEstadoServidor_().then(function() {
          navegar('secaoHistorico');
        });
      })
      .catch(handleFailure);
  }

  function alterarStatus(id) {
    if (!id) {
      return;
    }
    var novoStatus = window.prompt('Novo status:', '');
    if (!novoStatus) {
      return;
    }
    var observacao = window.prompt('Observacao da mudanca (opcional):', '') || '';
    if (!appState.connection.online) {
      atualizarPendenciaOffline_(id, {
        status: novoStatus,
        observacao: observacao
      }, 'status');
      if (normalizeText_(novoStatus) === 'concluido' || normalizeText_(novoStatus) === 'cancelado') {
        navegar('secaoHistorico');
      }
      return;
    }

    mostrarLoading();
    serverCall_('alterarStatusPendencia', [resolveRemoteId_(id), novoStatus, observacao])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message);
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          renderAll_();
          if (normalizeText_(novoStatus) === 'concluido' || normalizeText_(novoStatus) === 'cancelado') {
            navegar('secaoHistorico');
          } else {
            renderDetalhesPendencia(response.data.pendencia);
            navegar('secaoDetalhesPendencia');
          }
          return;
        }
        return carregarEstadoServidor_().then(function() {
          if (normalizeText_(novoStatus) === 'concluido' || normalizeText_(novoStatus) === 'cancelado') {
            navegar('secaoHistorico');
          } else {
            abrirDetalhesPendencia(resolveRemoteId_(id));
          }
        });
      })
      .catch(handleFailure);
  }

  function excluirPendencia(id) {
    if (!id) {
      return;
    }
    if (!window.confirm('Deseja excluir esta pendencia?')) {
      return;
    }
    var observacao = window.prompt('Motivo da exclusao (opcional):', '') || '';

    if (isLocalId_(id)) {
      removePendingOperationsForId_(id);
      removeItemFromState_(id);
      saveCache_();
      renderAll_();
      mostrarMensagemSucesso('Pendencia local removida.');
      return;
    }

    if (!appState.connection.online) {
      removeItemFromState_(id);
      enqueueOperation_({
        type: 'delete',
        id: id,
        observacao: observacao
      });
      renderAll_();
      mostrarMensagemSucesso('Exclusao registrada offline. Ela sera sincronizada ao reconectar.');
      return;
    }

    mostrarLoading();
    serverCall_('excluirPendencia', [resolveRemoteId_(id), observacao])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message);
        removeItemFromState_(id);
        renderAll_();
        navegar('secaoListaPendencias');
      })
      .catch(handleFailure);
  }

  function converterFotoParaBase64(file) {
    return new Promise(function(resolve, reject) {
      if (!file.type || file.type.indexOf('image/') !== 0) {
        reject(new Error('Selecione apenas arquivos de imagem.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function(event) {
        resolve({
          base64: event.target.result,
          name: file.name,
          mimeType: file.type
        });
      };
      reader.onerror = function() {
        reject(new Error('Falha ao ler o arquivo.'));
      };
      reader.readAsDataURL(file);
    });
  }

  function salvarConfiguracoes() {
    var configs = Array.from(document.querySelectorAll('.config-input')).map(function(input) {
      var value = input.value;
      if (input.dataset.chave === 'DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO' && !String(value || '').trim()) {
        value = '10';
        input.value = value;
      }
      return {
        chave: input.dataset.chave,
        valor: value
      };
    });
    appState.configs = configs.map(function(config) {
      var existing = findConfigByKey_(config.chave) || { descricao: '' };
      return {
        chave: config.chave,
        valor: config.valor,
        descricao: existing.descricao || ''
      };
    });
    saveCache_();
    renderConfiguracoes(appState.configs);

    if (!appState.connection.online) {
      enqueueSaveConfigs_(configs);
      mostrarMensagemSucesso('Configuracoes salvas offline. Elas serao sincronizadas ao reconectar.');
      return;
    }

    mostrarLoading();
    serverCall_('salvarConfiguracoesSimples', [configs])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message);
        return carregarEstadoServidor_();
      })
      .catch(handleFailure);
  }

  function executarSetupSistema() {
    if (!appState.connection.online) {
      mostrarMensagemErro('Setup do sistema so pode ser executado com internet.');
      return;
    }
    mostrarLoading();
    serverCall_('setupSistema', [])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message);
        return carregarEstadoServidor_();
      })
      .catch(handleFailure);
  }

  function instalarTriggerFotos() {
    if (!appState.connection.online) {
      mostrarMensagemErro('Criacao de trigger so pode ser feita com internet.');
      return;
    }
    mostrarLoading();
    serverCall_('criarTriggerLimpezaFotos', [])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function sincronizarAgora() {
    if (!appState.connection.online) {
      mostrarMensagemErro('Sem internet. A sincronizacao sera feita automaticamente ao reconectar.');
      return;
    }
    sincronizarFila_(true)
      .then(function() {
        return carregarEstadoServidor_();
      })
      .then(function() {
        mostrarMensagemSucesso('Sincronizacao concluida com sucesso.');
      })
      .catch(function(error) {
        mostrarMensagemErro(error.message || 'Nao foi possivel sincronizar agora.');
      });
  }

  function sincronizarFila_(showMessages) {
    if (!appState.connection.online) {
      return Promise.resolve();
    }
    if (appState.connection.syncing) {
      return Promise.resolve();
    }
    if (!appState.pendingQueue.length) {
      updateSyncStatusBar_();
      return Promise.resolve();
    }

    appState.connection.syncing = true;
    updateSyncStatusBar_();

    var chain = Promise.resolve();
    appState.pendingQueue.slice().forEach(function(operation) {
      chain = chain.then(function() {
        return sincronizarOperacao_(operation);
      });
    });

    return chain.then(function() {
      appState.connection.syncing = false;
      appState.connection.lastSyncAt = new Date().toISOString();
      saveCache_();
      if (showMessages) {
        mostrarMensagemSucesso('Fila offline sincronizada.');
      }
    }).catch(function(error) {
      appState.connection.syncing = false;
      saveCache_();
      throw error;
    });
  }

  function sincronizarOperacao_(operation) {
    if (operation.type === 'create') {
      return serverCall_('criarPendencia', [operation.payload]).then(function(response) {
        if (!response.success) {
          throw new Error(response.message);
        }
        var realId = response.data.id_pendencia;
        appState.tempIdMap[operation.tempId] = realId;
        replaceItemIdInState_(operation.tempId, realId);
        removeOperationById_(operation.opId);
        saveCache_();
      });
    }

    if (operation.type === 'update') {
      return serverCall_('atualizarPendencia', [resolveRemoteId_(operation.id), operation.payload]).then(function(response) {
        if (!response.success) {
          throw new Error(response.message);
        }
        removeOperationById_(operation.opId);
        saveCache_();
      });
    }

    if (operation.type === 'status') {
      return serverCall_('alterarStatusPendencia', [resolveRemoteId_(operation.id), operation.payload.status, operation.observacao || '']).then(function(response) {
        if (!response.success) {
          throw new Error(response.message);
        }
        removeOperationById_(operation.opId);
        saveCache_();
      });
    }

    if (operation.type === 'conclude') {
      return serverCall_('concluirPendencia', [resolveRemoteId_(operation.id), operation.observacao || '']).then(function(response) {
        if (!response.success) {
          throw new Error(response.message);
        }
        removeOperationById_(operation.opId);
        saveCache_();
      });
    }

    if (operation.type === 'delete') {
      return serverCall_('excluirPendencia', [resolveRemoteId_(operation.id), operation.observacao || '']).then(function(response) {
        if (!response.success) {
          throw new Error(response.message);
        }
        removeOperationById_(operation.opId);
        saveCache_();
      });
    }

    if (operation.type === 'save_configs') {
      return serverCall_('salvarConfiguracoesSimples', [operation.payload]).then(function(response) {
        if (!response.success) {
          throw new Error(response.message);
        }
        removeOperationById_(operation.opId);
        saveCache_();
      });
    }

    removeOperationById_(operation.opId);
    saveCache_();
    return Promise.resolve();
  }

  function enqueueOperation_(operation) {
    operation.opId = operation.opId || generateLocalId_('OP');
    operation.createdAt = operation.createdAt || new Date().toISOString();
    appState.pendingQueue.push(operation);
    saveCache_();
  }

  function enqueueSaveConfigs_(configs) {
    appState.pendingQueue = appState.pendingQueue.filter(function(item) {
      return item.type !== 'save_configs';
    });
    enqueueOperation_({
      type: 'save_configs',
      payload: deepClone_(configs)
    });
  }

  function removeOperationById_(opId) {
    appState.pendingQueue = appState.pendingQueue.filter(function(item) {
      return item.opId !== opId;
    });
  }

  function removePendingOperationsForId_(id) {
    appState.pendingQueue = appState.pendingQueue.filter(function(item) {
      return item.id !== id && item.tempId !== id;
    });
  }

  function uiLabel_(full, shortLabel) {
    return document.body.classList.contains('sidebar-open') ? shortLabel : full;
  }

  function getDashboardDisplayStatus_(item) {
    if (!item) {
      return 'Aberta';
    }
    var status = normalizeText_(item.status);
    if (status === 'concluido') {
      return 'Concluida';
    }
    if (status === 'cancelado') {
      return 'Cancelada';
    }
    if (isPendenciaVencidaLocal_(item)) {
      return 'Vencida';
    }
    return safeTrim_(item.executor) ? 'Em andamento' : 'Aberta';
  }

  function renderExecutorSelect_(item) {
    var pendenciaId = escapeJs(item.id_pendencia);
    var options = ['<option value="">Sem executor</option>'];
    ((appState.combos && appState.combos.prestadores) || []).forEach(function(nome) {
      options.push('<option value="' + escapeHtml(nome) + '"' + (normalizeText_(nome) === normalizeText_(item.executor) ? ' selected' : '') + '>' + escapeHtml(nome) + '</option>');
    });
    return '<select class="executor-inline-select" onchange="salvarExecutorRapido(\'' + pendenciaId + '\', this.value)">' + options.join('') + '</select>';
  }

  function renderHistoryStatusButton_(item) {
    var status = normalizeText_(item.status);
    var className = status === 'cancelado' ? 'ghost-button compact-button' : 'success-button compact-button';
    var label = status === 'cancelado' ? 'Cancelado' : 'Concluido';
    return '<button class="' + className + '" type="button">' + uiLabel_(label, status === 'cancelado' ? 'Cancel.' : 'Concl.') + '</button>';
  }

  function renderDashboardStatusTag_(label) {
    var normalized = normalizeText_(label);
    var className = 'status-aberto';
    if (normalized === 'em andamento') {
      className = 'status-em-andamento';
    } else if (normalized === 'vencida') {
      className = 'prioridade-critica';
    } else if (normalized === 'concluida') {
      className = 'status-concluido';
    } else if (normalized === 'cancelada') {
      className = 'status-cancelado';
    }
    return '<span class="tag ' + className + '">' + escapeHtml(label) + '</span>';
  }

  function getSetorTheme_(setor) {
    var normalized = normalizeText_(setor);
    var map = {
      'acougue': { bg: '#b91c1c', color: '#ffffff' },
      'padaria': { bg: '#facc15', color: '#422006' },
      'mercearia': { bg: '#7c4a2d', color: '#ffffff' },
      'hortifruti': { bg: '#15803d', color: '#ffffff' },
      'frente de caixa': { bg: '#9ca3af', color: '#111827' },
      'deposito': { bg: '#7c3aed', color: '#ffffff' },
      'area externa': { bg: '#111111', color: '#ffffff' },
      'manutencao': { bg: '#6b7280', color: '#ffffff' },
      'outros': { bg: '#6b7280', color: '#ffffff' },
      'frios': { bg: '#2563eb', color: '#ffffff' },
      'gerencia': { bg: '#fdba74', color: '#7c2d12' }
    };
    return map[normalized] || { bg: '#111111', color: '#ffffff' };
  }

  function renderSetorBadge_(setor, extraClass) {
    var theme = getSetorTheme_(setor);
    return '<span class="setor-badge' + (extraClass ? ' ' + extraClass : '') + '" style="background:' + theme.bg + '; color:' + theme.color + ';">' + escapeHtml(setor || '-') + '</span>';
  }

  function renderDashboard(data) {
    var cards = [
      { key: 'abertas', label: 'Abertas', value: data.abertas || 0, className: '' },
      { key: 'emAndamento', label: 'Em andamento', value: data.emAndamento || 0, className: 'warning' },
      { key: 'concluidas', label: 'Concluidas', value: data.concluidas || 0, className: 'success' },
      { key: 'vencidas', label: 'Vencidas', value: data.vencidas || 0, className: 'danger' },
      { key: 'total', label: 'Total geral', value: data.total || 0, className: '' }
    ];

    document.getElementById('dashboardCards').innerHTML = cards.map(function(card) {
      var selectedClass = appState.dashboardSelection.type === 'metric' && appState.dashboardSelection.key === card.key ? ' selected' : '';
      return '<button class="metric-card ' + card.className + selectedClass + '" onclick="abrirZoomCard(\'' + card.key + '\', this)">' +
        '<span class="label">' + escapeHtml(card.label) + '</span>' +
        '<span class="value">' + escapeHtml(String(card.value)) + '</span>' +
      '</button>';
    }).join('');

    document.getElementById('resumoPorLoja').innerHTML = renderSummaryList(data.porLoja, 'loja');
    document.getElementById('resumoPorSetor').innerHTML = renderSummaryList(data.porSetor, 'setor');
  }

  function abrirZoomCard(metricKey, buttonEl) {
    var ativos = getFilteredPendencias_(false);
    var historico = getFilteredPendencias_(true);
    var title = 'Detalhes';
    var description = '';
    var value = 0;
    var items = [];
    appState.dashboardSelection = {
      type: 'metric',
      key: metricKey
    };
    saveCache_();
    highlightDashboardSelection_(buttonEl, '.metric-card');

    if (metricKey === 'abertas') {
      title = 'Pendencias abertas';
      description = 'Pendencias sem executor associado.';
      items = ativos.filter(function(item) { return getDashboardDisplayStatus_(item) === 'Aberta'; });
    } else if (metricKey === 'emAndamento') {
      title = 'Pendencias em andamento';
      description = 'Pendencias com executor associado.';
      items = ativos.filter(function(item) { return getDashboardDisplayStatus_(item) === 'Em andamento'; });
    } else if (metricKey === 'concluidas') {
      title = 'Pendencias concluidas';
      description = 'Itens finalizados no historico.';
      items = historico.filter(function(item) { return normalizeText_(item.status) === 'concluido'; });
    } else if (metricKey === 'vencidas') {
      title = 'Pendencias vencidas';
      description = 'Itens com prazo vencido.';
      items = ativos.filter(function(item) { return getDashboardDisplayStatus_(item) === 'Vencida'; });
    } else {
      title = 'Total geral';
      description = 'Todas as pendencias, incluindo historico.';
      items = getAllPendenciasFiltered_().slice().sort(function(a, b) {
        return String(b.id_pendencia).localeCompare(String(a.id_pendencia));
      });
    }

    openMetricZoom_(title, description, items, 'metric');
  }

  function fecharZoomCard() {
    document.getElementById('metricZoomModal').classList.add('hidden');
  }

  function renderSummaryList(collection, tipo) {
      var chartPlotHeight = 132;
      var chartAxisBase = 28;
      var keys = Object.keys(collection || {});
      if (!keys.length) {
        return '<div class="empty-state">Sem dados suficientes.</div>';
      }
      var orderedKeys = keys.sort(function(a, b) {
        var diff = Number(collection[b] || 0) - Number(collection[a] || 0);
        if (diff !== 0) {
          return diff;
        }
        return String(a || '').localeCompare(String(b || ''), 'pt-BR');
      });
      var mode = (appState.dashboardChartMode && appState.dashboardChartMode[tipo]) || 'list';
      var series = getDashboardChartSeries_(tipo, orderedKeys, collection);
      var maxValue = Math.max.apply(null, series.map(function(item) { return Number(item.count || 0); }).concat([0]));
      if (mode === 'chart') {
        var axisSteps = getDashboardAxisSteps_(maxValue);
        return '<div class="summary-column-chart"><div class="summary-column-stage">' +
          '<div class="summary-column-axis-y"></div>' +
          '<div class="summary-column-axis-x"></div>' +
          axisSteps.map(function(step) {
            var bottom = chartAxisBase + (maxValue ? Math.round((step / maxValue) * chartPlotHeight) : 0);
            return '<span class="summary-column-y-label" style="bottom:' + bottom + 'px">' + step + '</span>' +
              '<span class="summary-column-grid-line" style="bottom:' + bottom + 'px"></span>';
          }).join('') +
          '<div class="summary-column-grid" style="grid-template-columns:repeat(' + series.length + ', minmax(0, 1fr));">' + series.map(function(item, index) {
            var count = Number(item.count || 0);
            var ratio = series.length === 1 ? 0 : index / Math.max(1, series.length - 1);
            var tone = getSummaryTone_(ratio);
            var height = maxValue ? Math.max(10, Math.round((count / maxValue) * chartPlotHeight)) : 10;
            var selectedClass = appState.dashboardSelection.type === tipo && appState.dashboardSelection.key === item.key ? ' selected' : '';
            return '<button class="summary-column-item' + selectedClass + '" onclick="abrirResumoAgrupado(\'' + tipo + '\', \'' + escapeJs(item.key) + '\', this)">' +
              '<span class="summary-column-value">' + count + '</span>' +
              '<span class="summary-column-bar-wrap"><span class="summary-column-bar" style="height:' + height + 'px; background:' + tone.start + '"></span></span>' +
              '<span class="summary-column-label">' + escapeHtml(item.label) + '</span>' +
            '</button>';
          }).join('') + '</div></div></div>';
    }
    return orderedKeys.map(function(key, index) {
      var count = collection[key];
      var ratio = orderedKeys.length === 1 ? 0 : index / Math.max(1, orderedKeys.length - 1);
      var tone = getSummaryTone_(ratio);
      var bgColor = tone.start;
      var selectedClass = appState.dashboardSelection.type === tipo && appState.dashboardSelection.key === key ? ' selected' : '';
      return '<button class="summary-item clickable' + selectedClass + '" style="background:' + bgColor + '" onclick="abrirResumoAgrupado(\'' + tipo + '\', \'' + escapeJs(key) + '\', this)">' +
        '<div><strong>' + escapeHtml(key) + '</strong></div>' +
        '<strong>' + count + '</strong>' +
      '</button>';
      }).join('');
  }

  function getDashboardChartSeries_(tipo, orderedKeys, collection) {
      if (tipo === 'loja') {
        return getDashboardLojaSeries_(collection);
      }
      if (tipo === 'setor') {
        if (appState.combos && Array.isArray(appState.combos.setores) && appState.combos.setores.length) {
          return appState.combos.setores.slice().map(function(label) {
            return {
              key: label,
              label: label,
              count: Number(collection[label] || 0)
            };
          }).sort(function(a, b) {
            var diff = Number(b.count || 0) - Number(a.count || 0);
            if (diff !== 0) {
              return diff;
            }
            return String(a.label || '').localeCompare(String(b.label || ''), 'pt-BR');
          });
        }
      }
    return (orderedKeys || []).slice().map(function(label) {
      return {
        key: label,
        label: label,
        count: Number(collection[label] || 0)
      };
    });
  }

  function getDashboardChartLojaCount_(targetLabel, collection) {
    var target = normalizeLojaChartKey_(targetLabel);
    var count = 0;
    Object.keys(collection || {}).forEach(function(key) {
      if (normalizeLojaChartKey_(key) === target) {
        count += Number(collection[key] || 0);
      }
    });
    return count;
  }

  function normalizeLojaChartKey_(value) {
    var text = safeTrim_(value).toUpperCase();
    var match = text.match(/(\d{1,3})/);
    if (!match) {
      return text;
    }
    var number = Number(match[1]);
    return 'LOJA ' + (number < 10 ? '0' + number : String(number));
  }

  function getDashboardLojaSeries_(collection) {
    var labelsMap = {};
    var index;
    for (index = 1; index <= 10; index += 1) {
      labelsMap['LOJA ' + ('0' + index).slice(-2)] = true;
    }
    ((appState.combos && appState.combos.lojas) || []).forEach(function(label) {
      var normalized = normalizeLojaChartKey_(label);
      if (normalized) {
        labelsMap[normalized] = true;
      }
    });
    Object.keys(collection || {}).forEach(function(label) {
      var normalized = normalizeLojaChartKey_(label);
      if (normalized) {
        labelsMap[normalized] = true;
      }
    });
    return Object.keys(labelsMap).sort(function(a, b) {
      return extractLojaChartNumber_(a) - extractLojaChartNumber_(b);
    }).map(function(label) {
      return {
        key: label,
        label: label.replace('LOJA ', 'LJ '),
        count: getDashboardChartLojaCount_(label, collection)
      };
    });
  }

  function extractLojaChartNumber_(value) {
    var match = safeTrim_(value).match(/(\d{1,3})/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  function getDashboardAxisSteps_(maxValue) {
    var max = Math.max(0, Number(maxValue || 0));
    if (max <= 0) {
      return [1];
    }
    if (max <= 2) {
      return [1, 2].filter(function(item) { return item <= max; });
    }
    if (max <= 5) {
      return [1, max];
    }
    var mid = Math.ceil(max / 2);
    var items = [1, mid, max];
    return items.filter(function(value, index) {
      return items.indexOf(value) === index;
    });
  }

  function alternarGraficoResumo(tipo) {
    if (!tipo) {
      return;
    }
    var current = (appState.dashboardChartMode && appState.dashboardChartMode[tipo]) || 'list';
    appState.dashboardChartMode[tipo] = current === 'chart' ? 'list' : 'chart';
    saveCache_();
    renderDashboard(buildDashboardFromVisibleState_());
  }

  function getSummaryTone_(ratio) {
    var from = { r: 123, g: 18, b: 18 };
    var to = { r: 255, g: 196, b: 128 };
    var red = Math.round(from.r + (to.r - from.r) * ratio);
    var green = Math.round(from.g + (to.g - from.g) * ratio);
    var blue = Math.round(from.b + (to.b - from.b) * ratio);
    var endRed = Math.min(255, red + 24);
    var endGreen = Math.min(255, green + 18);
    var endBlue = Math.min(255, blue + 12);
    return {
      start: 'rgb(' + red + ',' + green + ',' + blue + ')',
      end: 'rgb(' + endRed + ',' + endGreen + ',' + endBlue + ')'
    };
  }

  function abrirResumoAgrupado(tipo, chave, buttonEl) {
    var ativos = getFilteredPendencias_(false);
    var items = ativos.filter(function(item) {
      return tipo === 'loja'
        ? normalizeText_(item.loja) === normalizeText_(chave)
        : normalizeText_(item.setor) === normalizeText_(chave);
    });
    appState.dashboardSelection = {
      type: tipo,
      key: chave
    };
    saveCache_();
    highlightDashboardSelection_(buttonEl, '.summary-item.clickable, .summary-bar-item');
    openMetricZoom_(
      (tipo === 'loja' ? 'Loja: ' : 'Setor: ') + chave,
      tipo === 'loja' ? 'Pendencias ativas desta loja.' : 'Pendencias ativas deste setor por loja.',
      items,
      tipo,
      chave
    );
  }

  function renderZoomItems_(items) {
    if (!items.length) {
      return '<div class="empty-state">Nenhum item encontrado.</div>';
    }
    return items.slice(0, 40).map(function(item) {
      var statusAtual = getDashboardDisplayStatus_(item);
      return '<div class="zoom-item zoom-table-item">' +
        '<div class="zoom-main"><div class="zoom-badges">' +
          '<span class="zoom-chip">' + escapeHtml(item.loja || '-') + '</span>' +
          renderSetorBadge_(item.setor || '-', 'zoom-chip alt setor-badge-compact') +
          renderDashboardStatusTag_(statusAtual) +
        '</div><div class="muted-text">' + escapeHtml(item.tipo || 'Sem classificacao') + ' | ' + escapeHtml(item.prioridade || 'Sem urgencia') + '</div>' +
        '<div class="muted-text">' + escapeHtml(resumirTexto(item.descricao || item.observacao || '', 96)) + '</div></div>' +
        '<div class="actions-row">' +
          '<button class="id-button compact-button" onclick="mostrarIdPendencia(\'' + escapeJs(item.id_pendencia) + '\')">ID</button>' +
          ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '') +
          '<button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\'); fecharZoomCard();">' + uiLabel_('Detalhes', 'Detal.') + '</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function openMetricZoom_(title, description, items, anchorType, anchorKey) {
    appState.zoomContext = {
      title: title || 'Detalhes',
      description: description || '',
      items: (items || []).slice(),
      anchorType: anchorType || 'metric',
      anchorKey: anchorKey || '',
      filterLoja: '',
      filterSetor: '',
      filterStatus: ''
    };
    document.getElementById('metricZoomTitle').textContent = appState.zoomContext.title;
    document.getElementById('metricZoomDescription').textContent = appState.zoomContext.description;
    preencherFiltrosZoom_();
    aplicarFiltrosZoom();
    document.getElementById('metricZoomModal').classList.remove('hidden');
  }

  function preencherFiltrosZoom_() {
    var items = appState.zoomContext.items || [];
    var lojas = uniqueSorted_(items.map(function(item) { return item.loja || ''; }).filter(Boolean));
    var setores = uniqueSorted_(items.map(function(item) { return item.setor || ''; }).filter(Boolean));
    var statusList = uniqueSorted_(items.map(function(item) {
      return getDashboardDisplayStatus_(item);
    }).filter(Boolean));
    preencherSelect('metricZoomFiltroLoja', lojas, 'Todas as lojas', true);
    preencherSelect('metricZoomFiltroSetor', setores, 'Todos os setores', true);
    preencherSelect('metricZoomFiltroStatus', statusList, 'Todos os status', true);
    document.getElementById('metricZoomLojaWrap').classList.toggle('hidden', appState.zoomContext.anchorType === 'loja');
    document.getElementById('metricZoomSetorWrap').classList.toggle('hidden', appState.zoomContext.anchorType === 'setor');
    document.getElementById('metricZoomStatusWrap').classList.toggle('hidden', appState.zoomContext.anchorType === 'metric');
    document.getElementById('metricZoomFiltroLoja').value = appState.zoomContext.filterLoja || '';
    document.getElementById('metricZoomFiltroSetor').value = appState.zoomContext.filterSetor || '';
    document.getElementById('metricZoomFiltroStatus').value = appState.zoomContext.filterStatus || '';
  }

  function aplicarFiltrosZoom() {
    if (!appState.zoomContext) {
      return;
    }
    appState.zoomContext.filterLoja = getElementValue_('metricZoomFiltroLoja');
    appState.zoomContext.filterSetor = getElementValue_('metricZoomFiltroSetor');
    appState.zoomContext.filterStatus = getElementValue_('metricZoomFiltroStatus');
    var items = (appState.zoomContext.items || []).filter(function(item) {
      if (appState.zoomContext.filterLoja && normalizeText_(item.loja) !== normalizeText_(appState.zoomContext.filterLoja)) {
        return false;
      }
      if (appState.zoomContext.filterSetor && normalizeText_(item.setor) !== normalizeText_(appState.zoomContext.filterSetor)) {
        return false;
      }
      if (appState.zoomContext.filterStatus && normalizeText_(getDashboardDisplayStatus_(item)) !== normalizeText_(appState.zoomContext.filterStatus)) {
        return false;
      }
      return true;
    });
    document.getElementById('metricZoomValue').textContent = items.length;
    document.getElementById('metricZoomList').innerHTML = renderZoomItems_(items);
  }

  function highlightDashboardSelection_(buttonEl, selector) {
    if (!buttonEl) {
      return;
    }
    Array.prototype.forEach.call(document.querySelectorAll(selector), function(node) {
      node.classList.remove('selected');
    });
    buttonEl.classList.add('selected');
  }

  function renderPendencias(items) {
    var cardsEl = document.getElementById('listaPendenciasCards');
    var tableEl = document.getElementById('listaPendenciasTabela');
    if (!items.length) {
      cardsEl.innerHTML = '<div class="panel empty-state">Nenhuma pendencia ativa encontrada.</div>';
      tableEl.innerHTML = '<tr><td colspan="11" class="empty-state">Nenhuma pendencia ativa encontrada.</td></tr>';
      return;
    }

    cardsEl.innerHTML = items.map(function(item) {
      return '<article class="pendencia-card">' +
        '<div><h3>' + escapeHtml(item.id_pendencia) + '</h3><p>' + escapeHtml(item.loja) + ' | ' + renderSetorBadge_(item.setor || '-', 'setor-badge-inline') + '</p></div>' +
        '<div class="card-meta">' +
          renderTag('status', item.status) +
          renderTag('prioridade', item.prioridade) +
          (item.esta_vencida ? '<span class="tag prioridade-critica">Vencida</span>' : '') +
        '</div>' +
        '<div class="card-kv-grid">' +
          cardKv_('Local', escapeHtml(item.loja || '-')) +
          cardKv_('Setor', renderSetorBadge_(item.setor || '-')) +
          cardKv_('Classificacao', escapeHtml(item.tipo || '-')) +
          cardKv_('Urgencia', escapeHtml(item.prioridade || '-')) +
          cardKv_('Executor', renderExecutorSelect_(item)) +
          cardKv_('Descricao', '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'descricao\')">' + uiLabel_('Descricao', 'Desc.') + '</button><button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'observacao\')">' + uiLabel_('Observacao', 'Obs.') + '</button>') +
        '</div>' +
        (item._syncStatus ? '<div class="muted-text">Sync: pendente</div>' : '') +
        '<div class="actions-row">' +
          '<button class="id-button compact-button" onclick="mostrarIdPendencia(\'' + escapeJs(item.id_pendencia) + '\')">ID</button>' +
          '<button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Detalhes', 'Detal.') + '</button>' +
          '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Editar', 'Edit.') + '</button>' +
          '<button class="success-button compact-button" onclick="concluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Concluido', 'Concl.') + '</button>' +
          ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '') +
          '<button class="icon-button" onclick="excluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button>' +
        '</div>' +
      '</article>';
    }).join('');

    tableEl.innerHTML = items.map(function(item) {
      return '<tr>' +
        '<td><button class="success-button compact-button" onclick="concluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Concluido', 'Concl.') + '</button></td>' +
        '<td><button class="id-button compact-button" onclick="mostrarIdPendencia(\'' + escapeJs(item.id_pendencia) + '\')">ID</button></td>' +
        '<td>' + escapeHtml(item.loja || '-') + '</td>' +
        '<td>' + escapeHtml(item.setor || '-') + '</td>' +
        '<td>' + escapeHtml(item.tipo || '-') + '</td>' +
        '<td>' + renderTag('prioridade', item.prioridade || '-') + '</td>' +
        '<td><div class="descricao-obs-cell">' +
          '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'descricao\')">' + uiLabel_('Descricao', 'Desc.') + '</button>' +
          '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'observacao\')">' + uiLabel_('Observacao', 'Obs.') + '</button>' +
        '</div></td>' +
        '<td>' + renderExecutorSelect_(item) + '</td>' +
        '<td><div class="table-actions">' +
          '<button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Detalhes', 'Detal.') + '</button>' +
          '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Editar', 'Edit.') + '</button>' +
        '</div></td>' +
        '<td>' + ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '<span class="clip-placeholder"></span>') + '</td>' +
        '<td><button class="icon-button" onclick="excluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button></td>' +
      '</tr>';
    }).join('');
  }

  function renderHistoricoGeral(items) {
    var container = document.getElementById('historicoListaCards');
    var tableEl = document.getElementById('historicoPendenciasTabela');
    if (!items.length) {
      container.innerHTML = '<div class="panel empty-state">Nenhuma pendencia concluida ou cancelada.</div>';
      if (tableEl) {
        tableEl.innerHTML = '<tr><td colspan="11" class="empty-state">Nenhuma pendencia concluida ou cancelada.</td></tr>';
      }
      return;
    }
    container.innerHTML = items.map(function(item) {
      return '<article class="pendencia-card">' +
        '<div><h3>' + escapeHtml(item.id_pendencia) + '</h3><p>' + escapeHtml(item.loja) + ' | ' + renderSetorBadge_(item.setor || '-', 'setor-badge-inline') + '</p></div>' +
        '<div class="card-meta">' + renderTag('status', item.status) + renderTag('prioridade', item.prioridade) + '</div>' +
        '<div class="card-kv-grid">' +
          cardKv_('Conclusao', escapeHtml(item.data_conclusao_label || formatDateBr(item.data_conclusao) || '-')) +
          cardKv_('Executor', escapeHtml(item.executor || 'Nao definido')) +
          cardKv_('Tipo', escapeHtml(item.tipo || '-')) +
          cardKv_('Local', escapeHtml(item.loja || '-') + '<br>' + renderSetorBadge_(item.setor || '-')) +
        '</div>' +
        (item._syncStatus ? '<div class="muted-text">Sync: pendente</div>' : '') +
        '<div class="actions-row">' +
          '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'descricao\')">' + uiLabel_('Descricao', 'Desc.') + '</button>' +
          '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'observacao\')">' + uiLabel_('Observacao', 'Obs.') + '</button>' +
          ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '') +
          '<button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Detalhes', 'Detal.') + '</button>' +
          '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Editar', 'Edit.') + '</button>' +
        '</div>' +
      '</article>';
    }).join('');

    if (tableEl) {
      tableEl.innerHTML = items.map(function(item) {
        return '<tr>' +
          '<td>' + renderHistoryStatusButton_(item) + '</td>' +
          '<td><button class="id-button compact-button" onclick="mostrarIdPendencia(\'' + escapeJs(item.id_pendencia) + '\')">ID</button></td>' +
          '<td>' + escapeHtml(item.loja || '-') + '</td>' +
          '<td>' + escapeHtml(item.setor || '-') + '</td>' +
          '<td>' + escapeHtml(item.tipo || '-') + '</td>' +
          '<td>' + renderTag('prioridade', item.prioridade || '-') + '</td>' +
          '<td><div class="descricao-obs-cell">' +
            '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'descricao\')">' + uiLabel_('Descricao', 'Desc.') + '</button>' +
            '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'observacao\')">' + uiLabel_('Observacao', 'Obs.') + '</button>' +
          '</div></td>' +
          '<td>' + escapeHtml(item.executor || '-') + '</td>' +
          '<td><div class="table-actions">' +
            '<button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Detalhes', 'Detal.') + '</button>' +
            '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Editar', 'Edit.') + '</button>' +
          '</div></td>' +
          '<td>' + ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '<span class="clip-placeholder"></span>') + '</td>' +
          '<td><button class="icon-button" onclick="excluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button></td>' +
        '</tr>';
      }).join('');
    }
  }

  function renderDetalhesPendencia(item) {
    if (!item) {
      document.getElementById('detalhesPendencia').innerHTML = '<div class="empty-state">Pendencia nao encontrada.</div>';
      return;
    }
    var anexoButton = (item.id_arquivo_drive || item.foto_preview)
      ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>'
      : '<button class="clip-button disabled" type="button" disabled>&#128206;</button>';
    var html = '<div class="details-grid">' +
      '<table class="details-table">' +
        '<tbody>' +
          detailsRow_('Identificacao', '<button class="id-button compact-button" onclick="mostrarIdPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Mostrar ID</button>') +
          detailsRow_('Loja / Setor / Tipo', groupedDetail_([
            { label: 'Loja', value: item.loja || '-' },
            { label: 'Setor', value: item.setor || '-' },
            { label: 'Tipo', value: item.tipo || '-' }
          ])) +
          detailsRow_('Prioridade / Status', groupedDetail_([
            { label: 'Prioridade', value: renderTag('prioridade', item.prioridade || '-') },
            { label: 'Status', value: renderTag('status', item.status || '-') }
          ], true)) +
          detailsRow_('Solicitante / Executor', groupedDetail_([
            { label: 'Solicitante', value: displaySolicitante_(item.solicitante) || '-' },
            { label: 'Executor', value: item.executor || '-' }
          ])) +
          detailsRow_('Datas', groupedDetail_([
            { label: 'Abertura', value: joinDateAndTime_(item.data_abertura, item.hora_abertura) },
            { label: 'Inicio', value: formatDateBr(item.data_inicio) || '-' },
            { label: 'Previsao', value: formatDateBr(item.previsao_entrega) || '-' },
            { label: 'Conclusao', value: joinDateAndTime_(item.data_conclusao, item.hora_conclusao) }
          ])) +
          detailsRow_('Textos', groupedDetail_([
            { label: 'Descricao', value: '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'descricao\')">Descricao</button>' },
            { label: 'Observacao', value: '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'observacao\')">Observacao</button>' }
          ], true)) +
          detailsRow_('Acoes', '<span class="details-table-title">Acoes da pendencia</span><div class="details-table-actions">' +
            '<button class="success-button compact-button" onclick="concluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Concluido</button>' +
            '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Editar</button>' +
            anexoButton +
            '<button class="icon-button" onclick="excluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button>' +
          '</div>') +
        '</tbody>' +
      '</table>' +
    '</div>';
    document.getElementById('detalhesPendencia').innerHTML = html;
  }

  function cardKv_(label, valueHtml) {
    return '<div class="card-kv"><strong>' + label + '</strong><div>' + valueHtml + '</div></div>';
  }

  function detailsRow_(label, valueHtml) {
    return '<tr><th>' + escapeHtml(label) + '</th><td>' + valueHtml + '</td></tr>';
  }

  function groupedDetail_(items, rawValues) {
    return '<div class="grouped-detail">' + (items || []).map(function(item) {
      return '<div class="grouped-detail-item"><strong>' + escapeHtml(item.label) + '</strong><div>' +
        (rawValues ? item.value : escapeHtml(item.value || '-')) +
      '</div></div>';
    }).join('') + '</div>';
  }

  function mostrarIdPendencia(id) {
    document.getElementById('quickViewTitle').textContent = 'ID da pendencia';
    document.getElementById('quickViewContent').innerHTML = '<p><strong>' + escapeHtml(id || '-') + '</strong></p>';
    document.getElementById('quickViewModal').classList.remove('hidden');
  }

  function renderConfiguracoes(items) {
    var container = document.getElementById('configList');
    var visibleItems = (items || []).filter(function(item) {
      return item.chave !== 'NOME_PASTA_DRIVE_FOTOS' && item.chave !== 'STATUS_PADRAO_NOVO_REGISTRO';
    });
    if (!visibleItems.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma configuracao encontrada.</div>';
      return;
    }
    container.innerHTML = visibleItems.map(function(item) {
      var isDias = item.chave === 'DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO';
      var inputType = isDias ? 'number' : 'text';
      var inputValue = isDias ? String(item.valor || '10') : String(item.valor || '');
      return '<div class="config-item">' +
        '<div><strong>' + escapeHtml(formatarNomeConfiguracao_(item.chave)) + ':</strong></div>' +
        '<div><input type="' + inputType + '" class="config-input" data-chave="' + escapeHtml(item.chave) + '" value="' + escapeHtml(inputValue) + '"' + (isDias ? ' min="0" step="1"' : '') + '></div>' +
      '</div>';
    }).join('');
  }

  function formatarNomeConfiguracao_(chave) {
    var mapa = {
      DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO: 'Dias para excluir fotos do Drive apos conclusao',
      STATUS_PADRAO_NOVO_REGISTRO: 'Status padrao do novo registro',
      PERMITIR_EXCLUSAO_FOTO_AUTOMATICA: 'Permitir exclusao automatica de fotos',
      VERSAO_SISTEMA: 'Versao do sistema'
    };
    return mapa[chave] || chave;
  }

  function renderCadastroList_() {
    var container = document.getElementById('cadastroList');
    if (!container) {
      return;
    }
    var cards = getManagedGroupCatalog_().map(function(item) {
      var count = getComboAdminItems_(item.group).length;
      return '<button type="button" class="cadastro-card" onclick="abrirEditorCadastroGrupo(\'' + escapeJs(item.group) + '\')">' +
        '<span class="cadastro-card-title">' + escapeHtml(item.title) + '</span>' +
        '<span class="cadastro-card-meta">' + count + ' itens</span>' +
      '</button>';
    });
    container.innerHTML = cards.join('');
  }

  function salvarNovoPrestador() {
    var input = document.getElementById('novoPrestadorNome');
    var nome = input ? input.value.trim() : '';
    if (!nome) {
      mostrarMensagemErro('Informe o nome do executor/prestador.');
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('Cadastre executores/prestadores com internet para sincronizar com a planilha.');
      return;
    }
    mostrarLoading();
    serverCall_('salvarPrestador', [nome])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        input.value = '';
        if (!appState.combos) {
          appState.combos = {};
        }
        appState.combos.prestadores = normalizePrestadores_((response.data && response.data.ativos) || []);
        appState.prestadoresAdmin = (response.data && response.data.todos) || [];
        appState.comboAdmin.executor = appState.prestadoresAdmin.slice();
        preencherCombos(appState.combos);
        renderCadastroList_();
        saveCache_();
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function alterarStatusPrestadorConfig(idPrestador, novoStatus) {
    if (!idPrestador || !novoStatus) {
      return;
    }
    var acao = normalizeText_(novoStatus) === 'inativo' ? 'desativar' : 'ativar';
    if (!window.confirm('Deseja ' + acao + ' este executor/prestador?')) {
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('Altere executores/prestadores com internet para sincronizar com a planilha.');
      return;
    }
    mostrarLoading();
    serverCall_('alterarStatusPrestador', [idPrestador, novoStatus])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        if (!appState.combos) {
          appState.combos = {};
        }
        appState.combos.prestadores = normalizePrestadores_((response.data && response.data.ativos) || []);
        appState.prestadoresAdmin = (response.data && response.data.todos) || [];
        appState.comboAdmin.executor = appState.prestadoresAdmin.slice();
        preencherCombos(appState.combos);
        renderCadastroList_();
        renderPendencias(getFilteredPendencias_(false));
        saveCache_();
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function excluirPrestadorConfig(idPrestador) {
    if (!idPrestador) {
      return;
    }
    if (!window.confirm('Deseja excluir este executor/prestador?')) {
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('Exclua executores/prestadores com internet para sincronizar com a planilha.');
      return;
    }
    mostrarLoading();
    serverCall_('excluirPrestador', [idPrestador])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        if (!appState.combos) {
          appState.combos = {};
        }
        appState.combos.prestadores = normalizePrestadores_((response.data && response.data.ativos) || []);
        appState.prestadoresAdmin = (response.data && response.data.todos) || [];
        appState.comboAdmin.executor = appState.prestadoresAdmin.slice();
        preencherCombos(appState.combos);
        renderCadastroList_();
        renderPendencias(getFilteredPendencias_(false));
        saveCache_();
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function getComboAdminItems_(group) {
    return (appState.comboAdmin && appState.comboAdmin[group]) || [];
  }

  function renderComboEditorModal_() {
    var titleEl = document.getElementById('comboEditorTitle');
    var listEl = document.getElementById('comboEditorList');
    if (!titleEl || !listEl) {
      return;
    }
    var group = appState.comboEditor.group;
    var items = getComboAdminItems_(group);
    titleEl.textContent = 'Editar ' + (appState.comboEditor.title || 'opcoes');
    if (!items.length) {
      listEl.innerHTML = '<div class="empty-state">Nenhuma opcao cadastrada.</div>';
      return;
    }
    listEl.innerHTML = items.map(function(item) {
      var status = normalizeText_(item.status) === 'inativo' ? 'Inativo' : 'Ativo';
      var statusButton = item.permiteStatus
        ? '<button class="ghost-button compact-button" type="button" onclick="alterarStatusOpcaoSelecionavel(\'' + escapeJs(group) + '\', \'' + escapeJs(item.id || item.nome) + '\', \'' + (status === 'Ativo' ? 'Inativo' : 'Ativo') + '\')">' + (status === 'Ativo' ? 'Desativar' : 'Ativar') + '</button>'
        : '';
      return '<div class="summary-item combo-editor-item">' +
        '<div><strong>' + escapeHtml(item.nome || '-') + '</strong><div class="summary-item-sub">' + escapeHtml(status) + '</div></div>' +
        '<div class="actions-row">' +
          statusButton +
          '<button class="icon-button combo-delete-button" type="button" onclick="excluirOpcaoSelecionavel(\'' + escapeJs(group) + '\', \'' + escapeJs(item.id || item.nome) + '\')">&times;</button>' +
        '</div>' +
      '</div>';
    }).join('');
  }

  function fecharEditorOpcoesSelect() {
    document.getElementById('comboEditorModal').classList.add('hidden');
  }

  function abrirAdicionarOpcaoModal() {
    var titleEl = document.getElementById('comboAddTitle');
    var input = document.getElementById('comboAddInput');
    if (titleEl) {
      titleEl.textContent = 'Adicionar em ' + (appState.comboEditor.title || 'opcoes');
    }
    if (input) {
      input.value = '';
    }
    document.getElementById('comboAddModal').classList.remove('hidden');
    setTimeout(function() {
      if (input) {
        input.focus();
      }
    }, 30);
  }

  function fecharAdicionarOpcaoModal() {
    document.getElementById('comboAddModal').classList.add('hidden');
  }

  function salvarNovaOpcaoSelect() {
    var input = document.getElementById('comboAddInput');
    var valor = input ? input.value.trim() : '';
    if (!valor) {
      mostrarMensagemErro('Informe um nome para adicionar.');
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('Edicoes de listas precisam de internet para sincronizar com a planilha.');
      return;
    }
    mostrarLoading();
    serverCall_('salvarOpcaoCombo', [appState.comboEditor.group, valor])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          throw new Error(response.message);
        }
        applyComboManagementPayload_(response.data);
        fecharAdicionarOpcaoModal();
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function excluirOpcaoSelecionavel(group, key) {
    if (!group || !key) {
      return;
    }
    if (!confirm('Deseja remover esta opcao?')) {
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('Edicoes de listas precisam de internet para sincronizar com a planilha.');
      return;
    }
    mostrarLoading();
    serverCall_('excluirOpcaoCombo', [group, key])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          throw new Error(response.message);
        }
        applyComboManagementPayload_(response.data);
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function alterarStatusOpcaoSelecionavel(group, key, status) {
    if (!group || !key || !status) {
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('Edicoes de listas precisam de internet para sincronizar com a planilha.');
      return;
    }
    mostrarLoading();
    serverCall_('alterarStatusOpcaoCombo', [group, key, status])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          throw new Error(response.message);
        }
        applyComboManagementPayload_(response.data);
        mostrarMensagemSucesso(response.message);
      })
      .catch(handleFailure);
  }

  function applyComboManagementPayload_(payload) {
    if (!payload) {
      return;
    }
    if (payload.combos) {
      appState.combos = payload.combos;
      if (appState.combos && appState.combos.prestadores) {
        appState.combos.prestadores = normalizePrestadores_(appState.combos.prestadores);
      }
      preencherCombos(appState.combos);
      applySavedFormContext_();
    }
    if (payload.admin) {
      appState.comboAdmin = payload.admin;
      appState.prestadoresAdmin = payload.admin.executor || [];
      renderCadastroList_();
      renderPendencias(getFilteredPendencias_(false));
      renderHistoricoGeral(getFilteredPendencias_(true));
      renderComboEditorModal_();
    }
    saveCache_();
  }

  function abrirTextoRapido(id, campo) {
      var item = buildDetailFromLocalItem_(getLocalItemById_(id));
      if (!item) {
        mostrarMensagemErro('Pendencia nao encontrada.');
        return;
      }
      var titulo = campo === 'observacao' ? 'Observacao' : 'Descricao';
      var valor = campo === 'observacao'
        ? (safeTrim_(item.observacao) || 'Nao ha observacao registrada para esta pendencia.')
        : (item.descricao || 'Sem descricao.');
      document.getElementById('quickViewTitle').textContent = titulo;
      document.getElementById('quickViewContent').innerHTML = '<p>' + escapeHtml(valor).replace(/\n/g, '<br>') + '</p>';
      document.getElementById('quickViewModal').classList.remove('hidden');
    }

  function abrirFotoRapida(id) {
    var item = buildDetailFromLocalItem_(getLocalItemById_(id));
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    if (item.foto_preview) {
      document.getElementById('quickViewTitle').textContent = 'Foto';
      document.getElementById('quickViewContent').innerHTML = '<img class="details-photo" src="' + item.foto_preview + '" alt="Foto da pendencia">';
      document.getElementById('quickViewModal').classList.remove('hidden');
      return;
    }
    if (!item.id_arquivo_drive) {
      mostrarMensagemErro('Esta pendencia nao possui foto.');
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('A foto original precisa de internet para ser carregada.');
      return;
    }
    mostrarLoading();
    serverCall_('obterFotoPreviewPendencia', [resolveRemoteId_(id)])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        item.foto_preview = response.data || '';
        mergeItemIntoState_(item);
        document.getElementById('quickViewTitle').textContent = 'Foto';
        document.getElementById('quickViewContent').innerHTML = '<img class="details-photo" src="' + response.data + '" alt="Foto da pendencia">';
        document.getElementById('quickViewModal').classList.remove('hidden');
      })
      .catch(handleFailure);
  }

  function fecharQuickView() {
    document.getElementById('quickViewModal').classList.add('hidden');
  }

  function abrirSpenPopup(targetId, title) {
    document.getElementById('spenTargetField').value = targetId;
    document.getElementById('spenModalTitle').textContent = 'Escrita com S Pen - ' + title;
    var spenInput = document.getElementById('spenInputArea');
    spenInput.value = document.getElementById(targetId).value || '';
    spenInput.lang = 'pt-BR';
    appState.spenLocked = true;
    renderSpenLockState_();
    syncSpenLockClasses_();
    document.body.classList.add('spen-open');
    document.documentElement.classList.add('spen-open');
    document.getElementById('spenModal').classList.remove('hidden');
    requestAppFullscreen_();
    setTimeout(function() {
      spenInput.focus();
      try {
        var end = (spenInput.value || '').length;
        spenInput.setSelectionRange(end, end);
      } catch (error) {}
    }, 80);
  }

  function aplicarSpenTexto() {
    if (appState.spenLocked) {
      mostrarMensagemErro('Destrave o cadeado para aplicar o texto ao campo.');
      return;
    }
    var targetId = document.getElementById('spenTargetField').value;
    var target = document.getElementById(targetId);
    if (!target) {
      fecharSpenPopup(true);
      return;
    }
    target.lang = 'pt-BR';
    target.spellcheck = true;
    target.value = normalizePtBrText_(document.getElementById('spenInputArea').value || '');
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    fecharSpenPopup(true);
  }

  function normalizePtBrText_(value) {
    var text = String(value || '')
      .replace(/\r\n/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/\s+([,.;:!?])/g, '$1')
      .replace(/([,.;:!?])([^\s\n])/g, '$1 $2')
      .trim();
    if (!text) {
      return '';
    }
    return text.split(/(\n+)/).map(function(part) {
      if (!part || /^\n+$/.test(part)) {
        return part;
      }
      return part.replace(/(^|[.!?]\s+)([a-zà-ÿ])/g, function(match, prefix, letter) {
        return prefix + letter.toUpperCase();
      });
    }).join('');
  }

  function limparSpenPopup() {
    if (appState.spenLocked) {
      mostrarMensagemErro('Destrave o cadeado para limpar a area de escrita.');
      return;
    }
    document.getElementById('spenInputArea').value = '';
    focusSpenInput_();
  }

  function fecharSpenPopup(forceClose) {
    if (appState.spenLocked && !forceClose) {
      mostrarMensagemErro('Destrave o cadeado para fechar a tela de escrita.');
      return;
    }
    document.body.classList.remove('spen-open');
    document.body.classList.remove('spen-hard-locked');
    document.documentElement.classList.remove('spen-open');
    document.documentElement.classList.remove('spen-hard-locked');
    document.getElementById('spenModal').classList.add('hidden');
  }

  function toggleSpenLock() {
    appState.spenLocked = !appState.spenLocked;
    renderSpenLockState_();
    if (appState.spenLocked) {
      requestAppFullscreen_();
      focusSpenInput_();
    }
  }

  function renderSpenLockState_() {
    var lockButton = document.getElementById('spenLockButton');
    var closeButton = document.getElementById('spenCloseButton');
    var clearButton = document.getElementById('spenClearButton');
    var applyButton = document.getElementById('spenApplyButton');
    var modal = document.getElementById('spenModal');
    if (!lockButton || !closeButton || !modal) {
      return;
    }
    lockButton.innerHTML = appState.spenLocked ? '&#128274;' : '&#128275;';
    closeButton.disabled = !!appState.spenLocked;
    closeButton.classList.toggle('disabled', !!appState.spenLocked);
    if (clearButton) {
      clearButton.disabled = false;
      clearButton.classList.toggle('blocked', !!appState.spenLocked);
    }
    if (applyButton) {
      applyButton.disabled = false;
      applyButton.classList.toggle('blocked', !!appState.spenLocked);
    }
    modal.classList.toggle('spen-unlocked', !appState.spenLocked);
    syncSpenLockClasses_();
  }

  function captureFormContext_() {
    appState.formContext = {
      loja: getElementValue_('novaLoja'),
      setor: getElementValue_('novoSetor'),
      tipo: getElementValue_('novoTipo'),
      prioridade: getElementValue_('novaPrioridade'),
      executor: getElementValue_('novoExecutor')
    };
    saveCache_();
  }

  function applySavedFormContext_() {
    if (!appState.formContext) {
      return;
    }
    setElementValueIfExists_('novaLoja', appState.formContext.loja);
    setElementValueIfExists_('novoSetor', appState.formContext.setor);
    setElementValueIfExists_('novoTipo', appState.formContext.tipo);
    setElementValueIfExists_('novaPrioridade', appState.formContext.prioridade);
    setElementValueIfExists_('novoExecutor', appState.formContext.executor);
  }

  function limparContextoRapido() {
    appState.formContext = {
      loja: '',
      setor: '',
      tipo: '',
      prioridade: '',
      executor: ''
    };
    saveCache_();
    applySavedFormContext_();
    mostrarMensagemSucesso('Contexto rapido limpo.');
  }

  function renderSpeechButtons_() {
    Array.from(document.querySelectorAll('.mic-button')).forEach(function(button) {
      var handler = button.getAttribute('onclick') || '';
      var match = handler.match(/toggleDitado\('([^']+)'/);
      var targetId = match ? match[1] : '';
      var isActive = appState.speechState.listening && appState.speechState.activeTargetId === targetId;
      button.classList.toggle('listening', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.textContent = isActive ? 'Parar' : 'Voz';
    });
  }

  function pararDitadoAtivo_() {
    if (appState.speechState.activeRecognition) {
      try {
        appState.speechState.activeRecognition.stop();
      } catch (error) {
        try {
          appState.speechState.activeRecognition.abort();
        } catch (innerError) {}
      }
    }
    appState.speechState.activeRecognition = null;
    appState.speechState.activeTargetId = '';
    appState.speechState.activeButtonTargetId = '';
    appState.speechState.listening = false;
    renderSpeechButtons_();
  }

  function toggleDitado(targetId) {
    if (appState.speechState.listening && appState.speechState.activeTargetId === targetId) {
      pararDitadoAtivo_();
      return;
    }
    iniciarDitado(targetId);
  }

  function iniciarDitado(targetId) {
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      mostrarMensagemErro('Ditado por voz nao suportado neste navegador.');
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('Ditado por voz offline nao esta disponivel neste navegador. Use a S Pen ou reconecte a internet.');
      return;
    }
    if (appState.speechState.activeRecognition) {
      pararDitadoAtivo_();
    }
    var recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    appState.speechState.activeRecognition = recognition;
    appState.speechState.activeTargetId = targetId;
    appState.speechState.activeButtonTargetId = targetId;
    appState.speechState.listening = true;
    renderSpeechButtons_();
    recognition.onresult = function(event) {
      var transcript = normalizeVoiceTranscript_((event.results[0] && event.results[0][0] && event.results[0][0].transcript) || '');
      var field = document.getElementById(targetId);
      if (!field) {
        return;
      }
      var now = Date.now();
      if (transcript && appState.speechState.lastTranscript === transcript && (now - Number(appState.speechState.lastAt || 0)) < 2500) {
        return;
      }
      appState.speechState.lastTranscript = transcript;
      appState.speechState.lastAt = now;
      var currentValue = field.value || '';
      var prefix = currentValue && transcript && transcript.charAt(0) !== '\n' ? ' ' : '';
      var nextValue = (currentValue + prefix + transcript).replace(/[ \t]+\n/g, '\n').trim();
      if (currentValue && transcript && normalizeText_(currentValue).slice(-normalizeText_(transcript).length) === normalizeText_(transcript)) {
        return;
      }
      field.value = nextValue;
    };
    recognition.onend = function() {
      if (appState.speechState.activeRecognition === recognition) {
        appState.speechState.activeRecognition = null;
        appState.speechState.activeTargetId = '';
        appState.speechState.activeButtonTargetId = '';
        appState.speechState.listening = false;
        renderSpeechButtons_();
      }
    };
    recognition.onerror = function(event) {
      if (appState.speechState.activeRecognition === recognition) {
        appState.speechState.activeRecognition = null;
        appState.speechState.activeTargetId = '';
        appState.speechState.activeButtonTargetId = '';
        appState.speechState.listening = false;
        renderSpeechButtons_();
      }
      var errorCode = event && event.error ? String(event.error) : '';
      if (errorCode === 'aborted' || errorCode === 'no-speech') {
        return;
      }
      if (errorCode === 'network') {
        mostrarMensagemErro('Ditado por voz offline nao esta disponivel neste navegador.');
        return;
      }
      if (errorCode === 'not-allowed' || errorCode === 'service-not-allowed') {
        mostrarMensagemErro('Permita o uso do microfone para ditado por voz.');
        return;
      }
      if (errorCode === 'audio-capture') {
        mostrarMensagemErro('Nenhum microfone disponivel para o ditado por voz.');
        return;
      }
      if (errorCode) {
        mostrarMensagemErro('Falha no ditado por voz: ' + errorCode + '.');
        return;
      }
      mostrarMensagemErro('Nao foi possivel iniciar o ditado por voz.');
    };
    recognition.start();
  }

  function atualizarNomeArquivo(inputId, targetId) {
    var input = document.getElementById(inputId);
    var target = document.getElementById(targetId);
    if (!input || !target) {
      return;
    }
    target.textContent = input.files && input.files[0] ? input.files[0].name : 'Nenhuma foto selecionada.';
  }

  function limparFormularioNovaPendencia(clearContext) {
    document.getElementById('formNovaPendencia').reset();
    atualizarNomeArquivo('novaFoto', 'novaFotoNome');
    if (clearContext) {
      appState.formContext = {
        loja: '',
        setor: '',
        tipo: '',
        prioridade: '',
        executor: ''
      };
      saveCache_();
    } else {
      applySavedFormContext_();
    }
  }

  function voltarParaLista() {
    navegar('secaoListaPendencias');
  }

  function mostrarLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
  }

  function ocultarLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
  }

  function mostrarMensagemSucesso(mensagem) {
    criarToast_(mensagem, 'success');
  }

  function mostrarMensagemErro(mensagem) {
      var text = safeTrim_(mensagem);
      if (text && (
        normalizeText_(text).indexOf('espaco para guardar dados offline') > -1 ||
        normalizeText_(text).indexOf('sem espaco no dispositivo') > -1 ||
        normalizeText_(text).indexOf('armazenamento local cheio') > -1
      )) {
        return;
      }
      criarToast_(mensagem, 'error');
    }

  function criarToast_(mensagem, tipo) {
    var container = document.getElementById('toastContainer');
    if (!container) {
      return;
    }
    var stack = container.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      container.appendChild(stack);
    }
    var toast = document.createElement('div');
    toast.className = 'toast ' + tipo;
    toast.innerHTML = '<div>' + escapeHtml(mensagem) + '</div><button class="toast-close" type="button" aria-label="Fechar notificacao">&times;</button>';
    var closeButton = toast.querySelector('.toast-close');
    closeButton.addEventListener('click', function() {
      toast.remove();
    });
    stack.appendChild(toast);
    setTimeout(function() {
      toast.remove();
      if (!stack.children.length) {
        stack.remove();
      }
    }, 4200);
  }

  function updateSyncStatusBar_() {
    var indicator = document.getElementById('connectionIndicator');
    if (!indicator) {
      return;
    }
    var statusText = appState.connection.online ? 'Online' : 'Offline';
    indicator.className = 'connection-indicator ' + (appState.connection.online ? 'online' : 'offline');
    if (appState.connection.syncing) {
      statusText = 'Sincronizando...';
      indicator.className = 'connection-indicator syncing';
    }
    indicator.textContent = statusText;
  }

  function buildDashboardFromLocalState_() {
    var dashboard = buildEmptyDashboard_();
    appState.allPendencias.forEach(function(item) {
      var status = normalizeText_(item.status);
      var displayStatus = getDashboardDisplayStatus_(item);
      var loja = item.loja || 'Sem loja';
      var setor = item.setor || 'Sem setor';
      var responsavel = item.responsavel || 'Nao definido';
      dashboard.porLoja[loja] = (dashboard.porLoja[loja] || 0) + 1;
      dashboard.porSetor[setor] = (dashboard.porSetor[setor] || 0) + 1;
      dashboard.porResponsavel[responsavel] = (dashboard.porResponsavel[responsavel] || 0) + 1;
      dashboard.total += 1;
      if (status === 'concluido') {
        dashboard.concluidas += 1;
      } else if (displayStatus === 'Vencida') {
        dashboard.vencidas += 1;
      } else if (displayStatus === 'Aberta') {
        dashboard.abertas += 1;
      } else if (displayStatus === 'Em andamento') {
        dashboard.emAndamento += 1;
      }
    });
    return dashboard;
  }

  function buildEmptyDashboard_() {
    return {
      total: 0,
      abertas: 0,
      emAndamento: 0,
      concluidas: 0,
      vencidas: 0,
      porLoja: {},
      porSetor: {},
      porResponsavel: {}
    };
  }

  function buildDashboardFromVisibleState_() {
    var dashboard = buildEmptyDashboard_();
    var ativos = getFilteredPendencias_(false);
    var historico = getFilteredPendencias_(true);
    ativos.forEach(function(item) {
      var displayStatus = getDashboardDisplayStatus_(item);
      dashboard.total += 1;
      dashboard.porLoja[item.loja || 'Sem loja'] = (dashboard.porLoja[item.loja || 'Sem loja'] || 0) + 1;
      dashboard.porSetor[item.setor || 'Sem setor'] = (dashboard.porSetor[item.setor || 'Sem setor'] || 0) + 1;
      if (displayStatus === 'Vencida') {
        dashboard.vencidas += 1;
      } else if (displayStatus === 'Aberta') {
        dashboard.abertas += 1;
      } else if (displayStatus === 'Em andamento') {
        dashboard.emAndamento += 1;
      }
    });
    historico.forEach(function(item) {
      dashboard.total += 1;
      if (normalizeText_(item.status) === 'concluido') {
        dashboard.concluidas += 1;
      }
    });
    return dashboard;
  }

  function getFilteredPendencias_(apenasHistorico, ignoreFilters) {
    var filtros = ignoreFilters ? {} : obterFiltrosTela(!!apenasHistorico);
    return appState.allPendencias.filter(function(item) {
      var status = normalizeText_(item.status);
      if (apenasHistorico) {
        if (status !== 'concluido' && status !== 'cancelado') {
          return false;
        }
      } else {
        if (status === 'concluido' || status === 'cancelado') {
          return false;
        }
      }
      if (filtros.loja && normalizeText_(item.loja) !== normalizeText_(filtros.loja)) {
        return false;
      }
      if (filtros.setor && normalizeText_(item.setor) !== normalizeText_(filtros.setor)) {
        return false;
      }
      if (filtros.status && normalizeText_(item.status) !== normalizeText_(filtros.status)) {
        return false;
      }
      if (filtros.executor && normalizeText_(item.executor) !== normalizeText_(filtros.executor)) {
        return false;
      }
      if (filtros.prioridade && normalizeText_(item.prioridade) !== normalizeText_(filtros.prioridade)) {
        return false;
      }
      if (filtros.tipo && normalizeText_(item.tipo) !== normalizeText_(filtros.tipo)) {
        return false;
      }
      if (filtros.dataAberturaDe || filtros.dataAberturaAte) {
        if (!dateWithinRangeLocal_(item.data_abertura, filtros.dataAberturaDe, filtros.dataAberturaAte)) {
          return false;
        }
      }
      if (filtros.previsaoEntregaDe || filtros.previsaoEntregaAte) {
        if (!dateWithinRangeLocal_(item.previsao_entrega, filtros.previsaoEntregaDe, filtros.previsaoEntregaAte)) {
          return false;
        }
      }
      item.esta_vencida = isPendenciaVencidaLocal_(item);
      item.data_abertura_label = formatDateBr(item.data_abertura);
      item.previsao_entrega_label = formatDateBr(item.previsao_entrega);
      item.data_conclusao_label = formatDateBr(item.data_conclusao);
      return true;
    }).sort(function(a, b) {
      return String(b.id_pendencia).localeCompare(String(a.id_pendencia));
    });
  }

  function dateWithinRangeLocal_(value, fromValue, toValue) {
    if (!fromValue && !toValue) {
      return true;
    }
    if (!value) {
      return false;
    }
    var date = parseInputDate_(value);
    var from = fromValue ? parseInputDate_(fromValue) : null;
    var to = toValue ? parseInputDate_(toValue) : null;
    if (!date) {
      return false;
    }
    if (from && date < from) {
      return false;
    }
    if (to) {
      var toLimit = new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59);
      if (date > toLimit) {
        return false;
      }
    }
    return true;
  }

  function isPendenciaVencidaLocal_(item) {
    if (!item || !(item.previsao_entrega || item.previsao_entrega_label)) {
      return false;
    }
    var status = normalizeText_(item.status);
    if (status === 'concluido' || status === 'cancelado') {
      return false;
    }
    var previsao = parseInputDate_(item.previsao_entrega || item.previsao_entrega_label);
    var hoje = parseInputDate_(toInputDate_(new Date()));
    return !!(previsao && hoje && previsao < hoje);
  }

  function mergeItemIntoState_(item) {
    if (!item || !item.id_pendencia) {
      return;
    }
    var cloned = deepClone_(item);
    cloned.esta_vencida = isPendenciaVencidaLocal_(cloned);
    cloned.data_abertura_label = formatDateBr(cloned.data_abertura);
    cloned.previsao_entrega_label = formatDateBr(cloned.previsao_entrega);
    cloned.data_conclusao_label = formatDateBr(cloned.data_conclusao);
    var replaced = false;
    appState.allPendencias = appState.allPendencias.map(function(current) {
      if (current.id_pendencia === cloned.id_pendencia) {
        replaced = true;
        return cloned;
      }
      return current;
    });
    if (!replaced) {
      appState.allPendencias.push(cloned);
    }
    appState.detailsById[cloned.id_pendencia] = deepClone_(cloned);
    appState.dashboard = buildDashboardFromLocalState_();
    saveCache_();
  }

  function replaceItemIdInState_(oldId, newId) {
    appState.allPendencias.forEach(function(item) {
      if (item.id_pendencia === oldId) {
        item.id_pendencia = newId;
        if (item.historico) {
          item.historico.forEach(function(historyItem) {
            historyItem.id_pendencia = newId;
          });
        }
        delete item._offlineOnly;
        delete item._syncStatus;
      }
    });
    if (appState.detailsById[oldId]) {
      appState.detailsById[newId] = appState.detailsById[oldId];
      appState.detailsById[newId].id_pendencia = newId;
      delete appState.detailsById[oldId];
    }
    appState.pendingQueue.forEach(function(operation) {
      if (operation.id === oldId) {
        operation.id = newId;
      }
    });
    saveCache_();
  }

  function removeItemFromState_(id) {
    appState.allPendencias = appState.allPendencias.filter(function(item) {
      return item.id_pendencia !== id;
    });
    delete appState.detailsById[id];
    appState.dashboard = buildDashboardFromLocalState_();
    saveCache_();
  }

  function getLocalItemById_(id) {
    var direct = appState.detailsById[id];
    if (direct) {
      return deepClone_(direct);
    }
    for (var i = 0; i < appState.allPendencias.length; i += 1) {
      if (appState.allPendencias[i].id_pendencia === id) {
        return deepClone_(appState.allPendencias[i]);
      }
    }
    var mappedId = appState.tempIdMap[id];
    if (mappedId && appState.detailsById[mappedId]) {
      return deepClone_(appState.detailsById[mappedId]);
    }
    return null;
  }

  function buildDetailFromLocalItem_(item) {
    if (!item) {
      return null;
    }
    item.esta_vencida = isPendenciaVencidaLocal_(item);
    item.data_abertura_label = formatDateBr(item.data_abertura);
    item.previsao_entrega_label = formatDateBr(item.previsao_entrega);
    item.data_conclusao_label = formatDateBr(item.data_conclusao);
    if (!item.historico) {
      item.historico = [];
    }
    return item;
  }

  function applyOfflineMutationToItem_(item, dados) {
    var now = new Date();
    if (Object.prototype.hasOwnProperty.call(dados, 'responsavel')) {
      item.responsavel = dados.responsavel || '';
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'executor')) {
      item.executor = dados.executor || '';
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'status') && dados.status) {
      item.status = dados.status;
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'data_inicio')) {
      item.data_inicio = dados.data_inicio || '';
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'previsao_entrega')) {
      item.previsao_entrega = dados.previsao_entrega || '';
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'tipo') && dados.tipo) {
      item.tipo = dados.tipo;
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'prioridade') && dados.prioridade) {
      item.prioridade = dados.prioridade;
    }
    if (Object.prototype.hasOwnProperty.call(dados, 'observacao')) {
      item.observacao = dados.observacao || '';
    }
    if (dados.foto && dados.foto.base64) {
      item.foto_preview = dados.foto.base64;
    }
    if (normalizeText_(item.status) === 'concluido') {
      item.data_conclusao = toInputDate_(now);
      item.hora_conclusao = toTime_(now);
      item.excluir_foto_em = calculateExcluirFotoEm_();
    } else if (normalizeText_(item.status) !== 'cancelado') {
      item.data_conclusao = '';
      item.hora_conclusao = '';
      item.excluir_foto_em = '';
    }
    item.ultima_atualizacao = formatDateTimeLocal_(now);
    item.atualizado_por = 'offline_local';
    item._syncStatus = 'pendente';
  }

  function buildHistoryEntry_(statusAnterior, statusNovo, usuario, observacao) {
    var now = new Date();
    return {
      id_historico: generateLocalId_('HIS'),
      id_pendencia: '',
      data: toInputDate_(now),
      data_label: formatDateBr(toInputDate_(now)),
      hora: toTime_(now),
      status_anterior: statusAnterior || '',
      status_novo: statusNovo || '',
      usuario: usuario || 'offline_local',
      observacao: observacao || ''
    };
  }

  function calculateExcluirFotoEm_() {
    var config = findConfigByKey_('DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO');
    var dias = Number(config && config.valor ? config.valor : 10);
    var base = new Date();
    var data = new Date(base.getFullYear(), base.getMonth(), base.getDate() + dias);
    return toInputDate_(data);
  }

  function findConfigByKey_(key) {
    for (var i = 0; i < appState.configs.length; i += 1) {
      if (appState.configs[i].chave === key) {
        return appState.configs[i];
      }
    }
    return null;
  }

  function serverCall_(functionName, args, options) {
      if (window.google && google.script && google.script.run) {
        return new Promise(function(resolve, reject) {
          var runner = google.script.run
            .withSuccessHandler(resolve)
            .withFailureHandler(function(error) {
            reject(error instanceof Error ? error : new Error(error && error.message ? error.message : 'Falha na chamada ao servidor.'));
          });
          runner[functionName].apply(runner, args || []);
        });
      }
      return externalBridgeCall_(functionName, args || [], options || {});
    }

  function externalBridgeCall_(functionName, args, options) {
      return new Promise(function(resolve, reject) {
        var opts = options || {};
        var config = window.PWA_CONFIG || {};
        var endpoint = (config.appsScriptBridgeUrl || '').trim();
        if (!endpoint) {
          reject(new Error('Configure o URL do Apps Script em docs/config.js antes de sincronizar com o servidor.'));
          return;
      }
      ensureBridgeListener_();
      var requestId = generateLocalId_('BRIDGE');
      var iframeName = 'bridge_frame_' + requestId;
      var iframe = document.createElement('iframe');
      iframe.name = iframeName;
      iframe.className = 'hidden';
      iframe.style.display = 'none';
      document.body.appendChild(iframe);

      var form = document.createElement('form');
      form.method = 'POST';
      form.action = endpoint;
      form.target = iframeName;
      form.style.display = 'none';

      appendHiddenField_(form, 'bridge', '1');
      appendHiddenField_(form, 'requestId', requestId);
      appendHiddenField_(form, 'origin', window.location.origin || '*');
      appendHiddenField_(form, 'functionName', functionName);
      appendHiddenField_(form, 'args', JSON.stringify(args || []));

        var timeout = setTimeout(function() {
          cleanupBridgeRequest_(requestId, iframe, form);
          if (!opts.quietOffline) {
            setConnectionState_(false);
          }
          reject(new Error('Tempo esgotado ao comunicar com o Apps Script.'));
        }, Number(opts.timeoutMs || 45000));

      bridgeResolvers_[requestId] = {
        resolve: resolve,
        reject: reject,
        iframe: iframe,
        form: form,
        timeout: timeout
      };

      document.body.appendChild(form);
      form.submit();
    });
  }

  function ensureBridgeListener_() {
    if (bridgeListenerReady_) {
      return;
    }
    window.addEventListener('message', function(event) {
      var data = event.data;
      if (!data || data.source !== 'apps-script-bridge' || !data.requestId) {
        return;
      }
      var resolver = bridgeResolvers_[data.requestId];
      if (!resolver) {
        return;
      }
      clearTimeout(resolver.timeout);
      cleanupBridgeRequest_(data.requestId, resolver.iframe, resolver.form);
      resolver.resolve(data.response);
    });
    bridgeListenerReady_ = true;
  }

  function cleanupBridgeRequest_(requestId, iframe, form) {
    delete bridgeResolvers_[requestId];
    if (form && form.parentNode) {
      form.parentNode.removeChild(form);
    }
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }

  function appendHiddenField_(form, name, value) {
    var input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  function handleFailure(error) {
    ocultarLoading();
    mostrarMensagemErro(error.message || 'Ocorreu um erro inesperado.');
  }

  function renderTag(type, value) {
    var slug = slugify_(value || '-');
    return '<span class="tag ' + type + '-' + slug + '">' + escapeHtml(value || '-') + '</span>';
  }

  function slugify_(value) {
    return normalizeText_(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  function normalizeText_(value) {
    return (value || '')
      .toString()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function safeTrim_(value) {
    return (value || '').toString().trim();
  }

  function uniqueSorted_(values) {
    var map = {};
    (values || []).forEach(function(value) {
      var key = safeTrim_(value);
      if (key) {
        map[key] = true;
      }
    });
    return Object.keys(map).sort(function(a, b) {
      return a.localeCompare(b, 'pt-BR');
    });
  }

  function getAllPendenciasFiltered_() {
    var filtros = obterFiltrosTela(false);
    return appState.allPendencias.filter(function(item) {
      if (filtros.loja && normalizeText_(item.loja) !== normalizeText_(filtros.loja)) {
        return false;
      }
      if (filtros.setor && normalizeText_(item.setor) !== normalizeText_(filtros.setor)) {
        return false;
      }
      if (filtros.status && normalizeText_(item.status) !== normalizeText_(filtros.status)) {
        return false;
      }
      if (filtros.executor && normalizeText_(item.executor) !== normalizeText_(filtros.executor)) {
        return false;
      }
      if (filtros.prioridade && normalizeText_(item.prioridade) !== normalizeText_(filtros.prioridade)) {
        return false;
      }
      if (filtros.tipo && normalizeText_(item.tipo) !== normalizeText_(filtros.tipo)) {
        return false;
      }
      if (filtros.dataAberturaDe || filtros.dataAberturaAte) {
        if (!dateWithinRangeLocal_(item.data_abertura, filtros.dataAberturaDe, filtros.dataAberturaAte)) {
          return false;
        }
      }
      if (filtros.previsaoEntregaDe || filtros.previsaoEntregaAte) {
        if (!dateWithinRangeLocal_(item.previsao_entrega, filtros.previsaoEntregaDe, filtros.previsaoEntregaAte)) {
          return false;
        }
      }
      return true;
    });
  }

  function normalizePrestadores_(values) {
    return (values || []).map(function(value) {
      if (value && typeof value === 'object') {
        return value.nome_prestador || value.nome || value.label || value.value || '';
      }
      return value;
    }).map(function(value) {
      return (value || '').toString().trim();
    }).filter(Boolean);
  }

  function resumirTexto(texto, limite) {
    if (!texto) {
      return '';
    }
    return texto.length > limite ? texto.slice(0, limite - 3) + '...' : texto;
  }

  function escapeHtml(value) {
    return (value || '')
      .toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function escapeJs(value) {
    return (value || '').toString().replace(/\\/g, '\\\\').replace(/'/g, '\\\'');
  }

  function formatDateBr(value) {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      if (isNaN(value.getTime()) || value.getFullYear() < 2000) {
        return '';
      }
      return [
        ('0' + value.getDate()).slice(-2),
        ('0' + (value.getMonth() + 1)).slice(-2),
        value.getFullYear()
      ].join('/');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var parts = value.split('-');
      if (Number(parts[0]) < 2000) {
        return '';
      }
      return parts[2] + '/' + parts[1] + '/' + parts[0];
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
      return formatDateBr(value.slice(0, 10));
    }
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return value.slice(0, 10);
    }
    var parsed = new Date(value);
    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 2000) {
      return formatDateBr(parsed);
    }
    return value;
  }

  function formatTimeOnly_(value) {
    if (!value) {
      return '';
    }
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return '';
      }
      return [
        ('0' + value.getHours()).slice(-2),
        ('0' + value.getMinutes()).slice(-2),
        ('0' + value.getSeconds()).slice(-2)
      ].join(':');
    }
    var text = String(value).trim();
    var match = text.match(/(\d{2}:\d{2}:\d{2})$/);
    if (match) {
      return match[1];
    }
    return '';
  }

  function joinDateAndTime_(dateValue, timeValue) {
    var dateText = formatDateBr(dateValue);
    var timeText = formatTimeOnly_(timeValue);
    if (dateText && timeText) {
      return dateText + ' ' + timeText;
    }
    return dateText || timeText || '-';
  }

  function displaySolicitante_(value) {
    var text = safeTrim_(value);
    if (!text || normalizeText_(text) === 'usuario_nao_identificado') {
      return 'cawan.oliveira@bigcompras.local';
    }
    return text;
  }

  function formatDateTimeHuman_(value) {
    if (!value) {
      return '';
    }
    var date = new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }
    return date.toLocaleString('pt-BR');
  }

  function parseInputDate_(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      var parts = value.split('-');
      return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    }
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
      var brParts = value.split('/');
      return new Date(Number(brParts[2]), Number(brParts[1]) - 1, Number(brParts[0]));
    }
    if (/^\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/.test(value)) {
      return parseInputDate_(value.slice(0, 10));
    }
    var parsed = new Date(value);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  function normalizeDateForInputValue_(value) {
    var parsed = parseInputDate_(value);
    return parsed ? toInputDate_(parsed) : '';
  }

  function toInputDate_(date) {
    return [
      date.getFullYear(),
      ('0' + (date.getMonth() + 1)).slice(-2),
      ('0' + date.getDate()).slice(-2)
    ].join('-');
  }

  function toTime_(date) {
    return [
      ('0' + date.getHours()).slice(-2),
      ('0' + date.getMinutes()).slice(-2),
      ('0' + date.getSeconds()).slice(-2)
    ].join(':');
  }

  function formatDateTimeLocal_(date) {
    return formatDateBr(toInputDate_(date)) + ' ' + toTime_(date);
  }

  function isStorageQuotaError_(error) {
    if (!error) {
      return false;
    }
    var name = String(error.name || '');
    var code = Number(error.code || 0);
    var message = String(error.message || '').toLowerCase();
    return name === 'QuotaExceededError' ||
      name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      code === 22 ||
      code === 1014 ||
      message.indexOf('quota') > -1 ||
      message.indexOf('storage') > -1 && message.indexOf('full') > -1;
  }

  function normalizeVoiceTranscript_(value) {
    return String(value || '')
      .replace(/\b(nova linha|novo paragrafo|novo parÃ¡grafo)\b/gi, '\n')
      .replace(/\b(virgula|vÃ­rgula)\b/gi, ',')
      .replace(/\b(ponto final)\b/gi, '.')
      .replace(/\b(dois pontos)\b/gi, ':')
      .replace(/\b(ponto e virgula)\b/gi, ';')
      .replace(/\b(abrir parenteses|abrir parÃªnteses)\b/gi, '(')
      .replace(/\b(fechar parenteses|fechar parÃªnteses)\b/gi, ')')
      .replace(/[ \t]*\n[ \t]*/g, '\n')
      .replace(/\s+,/g, ',')
      .replace(/\s+\./g, '.')
      .replace(/\s+:/g, ':')
      .replace(/\s+;/g, ';')
      .trim();
  }

  function generateLocalId_(prefix) {
    return prefix + '-' + Date.now() + '-' + Math.floor(Math.random() * 9000 + 1000);
  }

  function isLocalId_(id) {
    return String(id || '').indexOf('LOCAL-') === 0;
  }

  function resolveRemoteId_(id) {
    return appState.tempIdMap[id] || id;
  }

  function deepClone_(obj) {
    return JSON.parse(JSON.stringify(obj || null));
  }

  function getElementValue_(id) {
    var element = document.getElementById(id);
    return element ? element.value : '';
  }

  function setElementValueIfExists_(id, value) {
    var element = document.getElementById(id);
    if (!element) {
      return;
    }
    element.value = value || '';
  }

  function focusNovaDescricao_() {
    var field = document.getElementById('novaDescricao');
    if (field) {
      field.focus();
    }
  }
