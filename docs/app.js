var CACHE_KEY = 'manutencao_offline_cache_v4';
  var CLIENT_BUILD_LABEL = 'v19';
  var CRONOGRAMA_EXECUTOR_ALL = '__TODOS_PRESTADORES__';
  var CRONOGRAMA_EXECUTOR_UNASSIGNED = '__SEM_PRESTADOR__';
  var bridgeResolvers_ = {};
  var bridgeListenerReady_ = false;
  var filterFabDragState_ = null;
  var multiSelectOutsideHandlerBound_ = false;
  var openMultiSelectId_ = '';
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
        setor: 'list',
        responsavel: 'list'
      },
      pendingQueue: [],
      tempIdMap: {},
      formContext: {
        loja: '',
        setor: '',
        tipo: '',
        prioridade: '',
        responsavel: '',
        executor: ''
      },
      newPendenciaCarryContext: null,
      newPendenciaStep: 1,
      speechState: {
        activeTargetId: '',
        activeRecognition: null,
        activeButtonTargetId: '',
        lastTranscript: '',
        lastAt: 0,
        listening: false,
        manualStop: false,
        baseValue: '',
        finalTranscript: '',
        startedAt: 0,
        timerId: null,
        nativeMode: false
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
      selectedOrcamentoIds: [],
      spenLocked: true,
      listPreset: 'all',
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
      registerNativeBridgeCallbacks_();
      bindConnectivityHandlers_();
      bindFilterFab_();
      bindFormExperience_();
      bindPenInputMode_();
      hydrateFromCache_();
      appState.currentSection = 'secaoDashboard';
      renderAll_();
      navegar('secaoDashboard', null, true);
      atualizarNomeArquivo('novaFoto', 'novaFotoNome');
      atualizarNomeArquivo('editFoto', 'editFotoNome');
      setTimeout(function() {
        detectarConectividadeInicial_(0);
      }, 180);
      setTimeout(function() {
        garantirBootstrapInicialDashboard_();
      }, 3200);
    }

  function registerNativeBridgeCallbacks_() {
    window.handleNativeVoiceEvent = function(payload) {
      handleNativeVoiceEventPayload_(payload);
    };
    window.handleNativeSpenResult = function(payload) {
      handleNativeSpenResultPayload_(payload);
    };
  }

  function getNativeBridge_() {
    return window.ZeloHubAndroid || window.AndroidBridge || null;
  }

  function hasNativeBridgeMethod_(methodName) {
    var bridge = getNativeBridge_();
    return !!(bridge && typeof bridge[methodName] === 'function');
  }

  function parseNativePayload_(payload) {
    if (!payload) {
      return {};
    }
    if (typeof payload === 'string') {
      try {
        return JSON.parse(payload);
      } catch (error) {
        return { raw: payload };
      }
    }
    return payload;
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

  function detectarConectividadeInicial_(attempt) {
      var tries = Number(attempt || 0);
      var maxBridgeRetries = 36;
      if (!navigator.onLine) {
        setConnectionState_(false);
        mostrarMensagemErro('Sem internet. O app esta usando o cache local e a fila offline.');
        return;
      }
      if (!isServerBridgeReady_()) {
        if (tries < maxBridgeRetries) {
          setTimeout(function() {
            detectarConectividadeInicial_(tries + 1);
          }, tries < 10 ? 220 : 420);
        } else {
          carregarEstadoServidor_({ waitForBridgeMs: 15000 })
            .then(function() {
              return sincronizarFila_(false);
            })
            .catch(function() {
              setTimeout(function() {
                garantirBootstrapInicialDashboard_();
              }, 1400);
            });
        }
        return;
      }
      setConnectionState_(true);
      var hadPendingQueue = !!(appState.pendingQueue && appState.pendingQueue.length);
      carregarEstadoServidor_({ waitForBridgeMs: 15000 })
        .then(function() {
          return sincronizarFila_(false);
        })
        .then(function() {
          if (hadPendingQueue) {
            return carregarEstadoServidor_();
          }
          return null;
        })
        .catch(function() {
          if (tries < 3) {
            setTimeout(function() {
              detectarConectividadeInicial_(tries + 1);
            }, 600);
            return;
          }
          garantirBootstrapInicialDashboard_();
        });
    }

  function garantirBootstrapInicialDashboard_() {
    if (!navigator.onLine || !isDashboardBootstrapPendendo_()) {
      return;
    }
    carregarEstadoServidor_({ waitForBridgeMs: 15000 })
      .then(function() {
        return sincronizarFila_(false);
      })
      .catch(function() {
        setTimeout(function() {
          if (isDashboardBootstrapPendendo_()) {
            verificarConectividadeServidor_(false);
          }
        }, 1200);
      });
  }

  function isDashboardBootstrapPendendo_() {
    return !((appState.allPendencias && appState.allPendencias.length) || hasDashboardData_(appState.dashboard));
  }

  function hasDashboardData_(dashboard) {
    var data = dashboard || {};
    return Number(data.total || 0) > 0 ||
      Object.keys(data.porLoja || {}).length > 0 ||
      Object.keys(data.porSetor || {}).length > 0 ||
      Object.keys(data.porResponsavel || {}).length > 0;
  }

  function bindFormExperience_() {
    [
      'novaLoja',
      'novoSetor',
      'novoTipo',
      'novaPrioridade',
      'novoResponsavel',
      'novoExecutor',
      'novaDataInicio',
      'novaPrevisaoEntrega',
      'novaDescricao',
      'novaObservacao'
    ].forEach(function(id) {
      var node = document.getElementById(id);
      if (!node) {
        return;
      }
      node.addEventListener('change', function() {
        if (id !== 'novaDescricao' && id !== 'novaObservacao') {
          captureFormContext_();
        }
        if (id === 'novaPrioridade') {
          applyNovaPendenciaPlanningDefaults_(true);
        } else if (id === 'novaDataInicio') {
          markNovaPlanningFieldManual_('dataInicio');
          applyNovaPendenciaPlanningDefaults_(true);
        } else if (id === 'novaPrevisaoEntrega') {
          markNovaPlanningFieldManual_('previsao');
        }
        updateFormPlanningHint_('nova');
        renderNovaPendenciaFlow_();
      });
      node.addEventListener('input', function() {
        if (id !== 'novaDescricao' && id !== 'novaObservacao') {
          captureFormContext_();
        }
        if (id === 'novaPrioridade') {
          applyNovaPendenciaPlanningDefaults_(true);
        } else if (id === 'novaDataInicio') {
          markNovaPlanningFieldManual_('dataInicio');
          applyNovaPendenciaPlanningDefaults_(true);
        } else if (id === 'novaPrevisaoEntrega') {
          markNovaPlanningFieldManual_('previsao');
        }
        updateFormPlanningHint_('nova');
        renderNovaPendenciaFlow_();
      });
    });

    [
      'editPrioridade',
      'editExecutor',
      'editStatus',
      'editDataInicio',
      'editPrevisaoEntrega'
    ].forEach(function(id) {
      var node = document.getElementById(id);
      if (!node) {
        return;
      }
      node.addEventListener('change', function() {
        renderEditGuidance_();
        updateFormPlanningHint_('edit');
      });
      node.addEventListener('input', function() {
        renderEditGuidance_();
        updateFormPlanningHint_('edit');
      });
    });
  }

  function getNovaPendenciaStepDefinitions_() {
    return [
      { index: 1, title: 'Local' },
      { index: 2, title: 'Classificacao' },
      { index: 3, title: 'Descricao' },
      { index: 4, title: 'Revisao' }
    ];
  }

  function readNovaPendenciaSnapshot_() {
    return {
      loja: getElementValue_('novaLoja') || (appState.formContext && appState.formContext.loja) || '',
      setor: getElementValue_('novoSetor') || (appState.formContext && appState.formContext.setor) || '',
      tipo: getElementValue_('novoTipo') || (appState.formContext && appState.formContext.tipo) || '',
      prioridade: getElementValue_('novaPrioridade') || (appState.formContext && appState.formContext.prioridade) || '',
      responsavel: getElementValue_('novoResponsavel') || (appState.formContext && appState.formContext.responsavel) || '',
      executor: getElementValue_('novoExecutor') || (appState.formContext && appState.formContext.executor) || '',
      data_inicio: getElementValue_('novaDataInicio'),
      previsao_entrega: getElementValue_('novaPrevisaoEntrega'),
      descricao: getElementValue_('novaDescricao'),
      observacao: getElementValue_('novaObservacao')
    };
  }

  function renderNovaPendenciaFlow_() {
    var indicator = document.getElementById('novaPendenciaStepIndicator');
    if (!indicator) {
      return;
    }
    var defs = getNovaPendenciaStepDefinitions_();
    var maxStep = defs.length;
    var currentStep = Math.max(1, Math.min(maxStep, Number(appState.newPendenciaStep || 1)));
    var snapshot = readNovaPendenciaSnapshot_();
    var indicatorHtml = defs.map(function(def) {
      var isActive = def.index === currentStep;
      var isDone = def.index < currentStep;
      return '<button type="button" class="flow-step-pill' +
        (isActive ? ' active' : '') +
        (isDone ? ' done' : '') +
        '" onclick="goToNovaPendenciaStep_(' + def.index + ')">' +
          '<span class="flow-step-pill-index">' + def.index + '</span>' +
          '<span class="flow-step-pill-copy">' +
            '<strong>' + escapeHtml(def.title) + '</strong>' +
          '</span>' +
        '</button>';
    }).join('');
    indicator.innerHTML = indicatorHtml;

    Array.prototype.forEach.call(document.querySelectorAll('#formNovaPendencia .flow-step-panel'), function(panel) {
      var panelStep = Number(panel.getAttribute('data-step') || '0');
      panel.classList.toggle('active', panelStep === currentStep);
    });

    setNodeHtml_('novaPendenciaFlowSummary', buildNovaPendenciaFlowSummary_(snapshot, currentStep));
    setNodeHtml_('novaPendenciaReviewCard', buildNovaPendenciaReviewHtml_(snapshot));

    var prevButton = document.getElementById('novaPendenciaPrevButton');
    var nextButton = document.getElementById('novaPendenciaNextButton');
    var submitButton = document.getElementById('novaPendenciaSubmitButton');
    if (prevButton) {
      prevButton.disabled = currentStep === 1;
      prevButton.classList.toggle('hidden', currentStep === 1);
    }
    if (nextButton) {
      nextButton.classList.toggle('hidden', currentStep === maxStep);
    }
    if (submitButton) {
      submitButton.classList.toggle('hidden', currentStep !== maxStep);
    }
    appState.newPendenciaStep = currentStep;
  }

  function buildNovaPendenciaFlowSummary_(snapshot, currentStep) {
    var resumoLocal = snapshot.loja && snapshot.setor
      ? snapshot.loja + ' / ' + snapshot.setor
      : 'Defina onde a pendencia aconteceu.';
    var resumoClassificacao = [
      snapshot.tipo || 'Tipo nao definido',
      snapshot.prioridade || 'Prioridade nao definida'
    ].join(' | ');
    var resumoDescricao = safeTrim_(snapshot.descricao)
      ? truncateText_(snapshot.descricao, 110)
      : 'Descreva o problema para o executor entender o contexto.';
    return [
      '<div class="flow-summary-item' + (currentStep === 1 ? ' current' : '') + '"><strong>Local</strong><span>' + escapeHtml(resumoLocal) + '</span></div>',
      '<div class="flow-summary-item' + (currentStep === 2 ? ' current' : '') + '"><strong>Classificacao</strong><span>' + escapeHtml(resumoClassificacao) + '</span></div>',
      '<div class="flow-summary-item' + (currentStep === 3 ? ' current' : '') + '"><strong>Descricao</strong><span>' + escapeHtml(resumoDescricao) + '</span></div>'
    ].join('');
  }

  function buildNovaPendenciaReviewHtml_(snapshot) {
    var items = [];
    var localLabel = [safeTrim_(snapshot.loja), safeTrim_(snapshot.setor)].filter(Boolean).join(' / ');
    if (localLabel) {
      items.push('<div class="flow-review-item"><strong>Local</strong><span>' + escapeHtml(localLabel) + '</span></div>');
    }
    if (safeTrim_(snapshot.tipo)) {
      items.push('<div class="flow-review-item"><strong>Tipo</strong><span>' + escapeHtml(snapshot.tipo) + '</span></div>');
    }
    if (safeTrim_(snapshot.prioridade)) {
      items.push('<div class="flow-review-item"><strong>Prioridade</strong><span>' + escapeHtml(snapshot.prioridade) + '</span></div>');
    }
    if (safeTrim_(snapshot.executor)) {
      items.push('<div class="flow-review-item"><strong>Executor</strong><span>' + escapeHtml(snapshot.executor) + '</span></div>');
    }
    if (safeTrim_(snapshot.responsavel)) {
      items.push('<div class="flow-review-item"><strong>Responsavel</strong><span>' + escapeHtml(snapshot.responsavel) + '</span></div>');
    }
    if (safeTrim_(snapshot.previsao_entrega)) {
      items.push('<div class="flow-review-item"><strong>Prazo</strong><span>' + escapeHtml(formatDateBr(snapshot.previsao_entrega) || snapshot.previsao_entrega) + '</span></div>');
    }
    if (safeTrim_(snapshot.descricao)) {
      items.push('<div class="flow-review-item full"><strong>Descricao</strong><span>' + escapeHtml(snapshot.descricao).replace(/\n/g, '<br>') + '</span></div>');
    }
    if (safeTrim_(snapshot.observacao)) {
      items.push('<div class="flow-review-item full"><strong>Observacao</strong><span>' + escapeHtml(snapshot.observacao).replace(/\n/g, '<br>') + '</span></div>');
    }
    if (!items.length) {
      items.push('<div class="flow-review-item full"><strong>Revisao</strong><span class="muted-text">Preencha os campos principais para revisar a pendencia.</span></div>');
    }
    return '<div class="flow-review-grid">' + items.join('') + '</div>';
  }

  function moveNovaPendenciaStep_(delta) {
    var next = Number(appState.newPendenciaStep || 1) + Number(delta || 0);
    goToNovaPendenciaStep_(next);
  }

  function goToNovaPendenciaStep_(step) {
    var defs = getNovaPendenciaStepDefinitions_();
    var targetStep = Math.max(1, Math.min(defs.length, Number(step || 1)));
    var currentStep = Math.max(1, Math.min(defs.length, Number(appState.newPendenciaStep || 1)));
    if (targetStep > currentStep) {
      var idx;
      for (idx = currentStep; idx < targetStep; idx += 1) {
        if (!validarNovaPendenciaStep_(idx)) {
          return;
        }
      }
    }
    appState.newPendenciaStep = targetStep;
    saveCache_();
    renderNovaPendenciaFlow_();
    focusNovaPendenciaStepField_(targetStep);
  }

  function validarNovaPendenciaStep_(step) {
    var snapshot = readNovaPendenciaSnapshot_();
    if (step === 1) {
      if (!snapshot.loja || !snapshot.setor) {
        mostrarMensagemErro('Escolha loja e setor para continuar.');
        return false;
      }
    }
    if (step === 3 && !safeTrim_(snapshot.descricao)) {
      mostrarMensagemErro('Descreva o problema antes de continuar.');
      return false;
    }
    return true;
  }

  function focusNovaPendenciaStepField_(step) {
    var fieldMap = {
      1: 'novaLoja',
      2: 'novoTipo',
      3: 'novaDescricao',
      4: 'novaFoto'
    };
    var target = document.getElementById(fieldMap[step]);
    if (target && typeof target.focus === 'function' && fieldMap[step] !== 'novaFoto') {
      setTimeout(function() {
        target.focus();
      }, 40);
    }
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
      return serverCall_('pingBridge', [], { timeoutMs: 7000, waitForBridgeMs: 15000, quietOffline: true });
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
        if (shouldIgnoreLockedSpenTouch_(event.target, event.pointerType)) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
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
          if (shouldIgnoreLockedSpenTouch_(event.target, 'touch')) {
            event.preventDefault();
            event.stopPropagation();
            return;
          }
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

    function shouldIgnoreLockedSpenTouch_(target, pointerType) {
      if (!appState.spenLocked || !isSpenModalOpen_() || pointerType === 'pen') {
        return false;
      }
      var modal = document.getElementById('spenModal');
      var card = modal ? modal.querySelector('.spen-modal-card') : null;
      if (!card || !card.contains(target)) {
        return false;
      }
      return !isSpenLockControl_(target);
    }

    function isSpenLockControl_(target) {
      return !!(target && typeof target.closest === 'function' && target.closest('#spenLockButton'));
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
      appState.newPendenciaCarryContext = null;
      appState.newPendenciaStep = Number(cached.newPendenciaStep || appState.newPendenciaStep || 1);
          appState.selectedOrcamentoIds = cached.selectedOrcamentoIds || [];
          appState.listPreset = cached.listPreset || appState.listPreset;
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
          newPendenciaStep: appState.newPendenciaStep,
          selectedOrcamentoIds: appState.selectedOrcamentoIds,
          listPreset: appState.listPreset,
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
    applyNovaPendenciaPlanningDefaults_(false);
    renderConfiguracoes(appState.configs || []);
    renderCadastroList_();
    appState.dashboard = buildDashboardFromLocalState_();
    renderDashboard(buildDashboardFromVisibleState_());
    renderDashboardActionHub_();
    renderListPresetBar_();
    sanitizeOrcamentoSelection_();
    renderPendencias(getVisibleWorklistItems_());
    renderHistoricoGeral(getFilteredPendencias_(true));
    renderCronogramaPreview_();
    renderFiltroResumo();
    renderSectionInsights_();
    renderNovaPendenciaFlow_();
    updateFormPlanningHint_('nova');
    renderEditGuidance_();
    updateFilterFabState_();
    applyFilterFabPosition_();
    updateSyncStatusBar_();
    refreshBackButtons_();
  }

  function refreshCurrentSectionUi_() {
    navegar(appState.currentSection || 'secaoDashboard', null, true);
  }

  function rerenderViewsAfterPendenciaUpdate_(id) {
    sanitizeOrcamentoSelection_();
    if (appState.currentSection === 'secaoListaPendencias') {
      renderListPresetBar_();
      renderPendencias(getVisibleWorklistItems_());
    } else if (appState.currentSection === 'secaoHistorico') {
      renderHistoricoGeral(getFilteredPendencias_(true));
    } else if (appState.currentSection === 'secaoDashboard') {
      renderDashboard(buildDashboardFromVisibleState_());
      renderDashboardActionHub_();
    } else if (appState.currentSection === 'secaoCronograma') {
      renderCronogramaPreview_();
    } else if (appState.currentSection === 'secaoDetalhesPendencia') {
      var itemAtualizado = buildDetailFromLocalItem_(getLocalItemById_(id));
      if (itemAtualizado) {
        renderDetalhesPendencia(itemAtualizado);
      }
    } else if (appState.currentSection === 'secaoEdicaoPendencia') {
      renderEditGuidance_();
    }
    if (appState.zoomContext && !document.getElementById('metricZoomModal').classList.contains('hidden')) {
      aplicarFiltrosZoom();
    }
    renderFiltroResumo();
    renderSectionInsights_();
    renderNovaPendenciaFlow_();
    updateFormPlanningHint_('nova');
    updateFormPlanningHint_('edit');
    updateFilterFabState_();
    updateSyncStatusBar_();
    refreshBackButtons_();
  }

  function setInlineFieldSavingState_(fieldEl, saving) {
    if (!fieldEl) {
      return;
    }
    fieldEl.disabled = !!saving;
    fieldEl.dataset.saving = saving ? '1' : '0';
  }

  function resetDashboardChartModes_() {
    appState.dashboardChartMode = {
      loja: 'list',
      setor: 'list',
      responsavel: 'list'
    };
  }

  function carregarEstadoServidor_(options) {
    var opts = options || {};
    if (!appState.connection.online) {
      return Promise.resolve();
    }
    mostrarLoading();
    return Promise.all([
      serverCall_('getAppInitData', [], { timeoutMs: 120000, waitForBridgeMs: opts.waitForBridgeMs || 15000 }),
      serverCall_('listarPendencias', [{ incluirFinalizadas: true }], { timeoutMs: 120000, waitForBridgeMs: opts.waitForBridgeMs || 15000 })
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
      refreshCurrentSectionUi_();
      ocultarLoading();
    }).catch(function(error) {
      ocultarLoading();
      throw error;
    });
  }

  function getCurrentScrollTop_() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function restoreScrollTop_(scrollTop) {
    var top = Number(scrollTop || 0);
    setTimeout(function() {
      window.scrollTo(0, top);
    }, 0);
  }

  function captureNavigationState_() {
    var zoomModal = document.getElementById('metricZoomModal');
    var zoomOpen = !!(zoomModal && !zoomModal.classList.contains('hidden'));
    return {
      sectionId: appState.currentSection || 'secaoDashboard',
      scrollTop: getCurrentScrollTop_(),
      zoomOpen: zoomOpen,
      zoomContext: zoomOpen ? deepClone_(appState.zoomContext || {}) : null,
      dashboardSelection: zoomOpen ? deepClone_(appState.dashboardSelection || {}) : null
    };
  }

  function restoreNavigationState_(state) {
    var isLegacy = typeof state === 'string';
    var sectionId = isLegacy ? state : (state && state.sectionId) || 'secaoDashboard';
    navegar(sectionId || 'secaoDashboard', null, true);
    if (!isLegacy && state && sectionId === 'secaoDashboard' && state.zoomOpen && state.zoomContext) {
      appState.zoomContext = deepClone_(state.zoomContext);
      appState.dashboardSelection = deepClone_(state.dashboardSelection || appState.dashboardSelection || {});
      preencherFiltrosZoom_();
      aplicarFiltrosZoom();
      document.getElementById('metricZoomModal').classList.remove('hidden');
    } else {
      fecharZoomCard();
    }
    if (!isLegacy && state) {
      restoreScrollTop_(state.scrollTop);
    }
  }

  function navegar(sectionId, buttonEl, skipHistory) {
    if (appState.currentSection && appState.currentSection !== sectionId && !skipHistory) {
      appState.navigationStack.push(captureNavigationState_());
    }
    closeAllMultiSelectDropdowns_();
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
      renderDashboardActionHub_();
    }
    if (sectionId === 'secaoNovaPendencia') {
      renderNovaPendenciaFlow_();
    }
    if (sectionId === 'secaoCronograma') {
      renderCronogramaPreview_();
    }
    if (sectionId === 'secaoListaPendencias') {
      renderListPresetBar_();
      renderPendencias(getVisibleWorklistItems_());
    }
    if (sectionId === 'secaoConfiguracoes') {
      ensureConfigViewData_();
    }
    if (sectionId === 'secaoEdicaoPendencia') {
      renderEditGuidance_();
    }
    renderSectionInsights_();
    updateFilterFabState_();
    saveCache_();
    refreshBackButtons_();
  }

  function voltarTelaAnterior() {
    if (!appState.navigationStack.length) {
      return;
    }
    var previous = appState.navigationStack.pop();
    restoreNavigationState_(previous);
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
    preencherSelect('novoResponsavel', combos.responsaveis, 'Selecione um responsavel', true);
    preencherSelect('novoExecutor', combos.prestadores, 'Selecione um executor', true);

    preencherSelect('filtroLoja', combos.lojas, 'Todas as lojas', true);
    preencherSelect('filtroSetor', combos.setores, 'Todos os setores', true);
    preencherSelect('filtroStatus', combos.status, 'Todos os status', true);
    preencherSelect('filtroResponsavel', combos.responsaveis, 'Todos os responsaveis', true);
    preencherSelect('filtroExecutor', combos.prestadores, 'Todos os executores', true);
    preencherSelect('filtroOrcamento', ['Sem orcamento', 'Com orcamento'], 'Todos', true);
    preencherSelect('filtroPrioridade', combos.prioridades, 'Todas as prioridades', true);
    preencherSelect('filtroTipo', combos.tipos, 'Todos os tipos', true);

    preencherSelect('editResponsavel', combos.responsaveis, 'Selecione um responsavel', true);
    preencherSelect('editExecutor', combos.prestadores, 'Selecione um executor', true);
    preencherSelect('editStatus', combos.status, 'Selecione um status');
    preencherSelect('editSetor', combos.setores, 'Selecione um setor');
    preencherSelect('editTipo', combos.tipos, 'Selecione um tipo');
    preencherSelect('editPrioridade', combos.prioridades, 'Selecione uma prioridade');
    preencherSelectCronogramaExecutor_(combos.prestadores);
    preencherSelect('cronogramaLoja', combos.lojas, 'Todas as lojas', true);
    preencherSelect('cronogramaSetor', combos.setores, 'Todos os setores', true);
    preencherSelect('cronogramaResponsavel', combos.responsaveis, 'Todos os responsaveis', true);
    preencherSelect('cronogramaStatus', ['Aberto', 'Aguardando', 'Em andamento', 'Concluido', 'Vencido'], 'Todos os status', true);
    preencherSelect('orcamentoPrestador', combos.prestadores, 'Selecione um prestador');
    bindManagedSelects_();
    hydrateMultiSelectDropdowns_();
  }

  function preencherSelect(elementId, values, placeholder, allowBlank) {
    var select = document.getElementById(elementId);
    if (!select) {
      return;
    }
    var isMultiple = !!select.multiple;
    var currentValue = getStoredSelectValue_(select);
    var options = isMultiple ? [] : ['<option value="">' + (placeholder || 'Selecione') + '</option>'];
    (values || []).forEach(function(value) {
      options.push('<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>');
    });
    select.innerHTML = options.join('');
    setStoredSelectValue_(select, currentValue);
    if (!isMultiple && !allowBlank && values && values.length === 1 && !select.value) {
      select.value = values[0];
    }
    if (isMultiple) {
      select.dataset.lastValue = JSON.stringify(getSelectValues_(select));
      syncMultiSelectDropdown_(select.id);
    } else if (select.value) {
      select.dataset.lastValue = select.value;
    }
  }

  function preencherSelectCronogramaExecutor_(values) {
    var select = document.getElementById('cronogramaExecutor');
    if (!select) {
      return;
    }
    var currentValue = select.value || (select.dataset.lastValue || CRONOGRAMA_EXECUTOR_ALL);
    var options = [
      '<option value="' + CRONOGRAMA_EXECUTOR_ALL + '">Todos os prestadores</option>',
      '<option value="' + CRONOGRAMA_EXECUTOR_UNASSIGNED + '">Sem prestador definido</option>'
    ];
    (values || []).forEach(function(value) {
      if (!value) {
        return;
      }
      options.push('<option value="' + escapeHtml(value) + '">' + escapeHtml(value) + '</option>');
    });
    select.innerHTML = options.join('');
    select.value = currentValue;
    if (!select.value) {
      select.value = CRONOGRAMA_EXECUTOR_ALL;
    }
    select.dataset.lastValue = select.value || CRONOGRAMA_EXECUTOR_ALL;
  }

  function getStoredSelectValue_(select) {
    if (!select) {
      return select && select.multiple ? [] : '';
    }
    if (select.multiple) {
      var currentValues = getSelectValues_(select);
      if (currentValues.length) {
        return currentValues;
      }
      try {
        return JSON.parse(select.dataset.lastValue || '[]');
      } catch (error) {
        return [];
      }
    }
    return select.value || (select.dataset.lastValue || '');
  }

  function setStoredSelectValue_(select, value) {
    if (!select) {
      return;
    }
    if (select.multiple) {
      var list = Array.isArray(value) ? value : [];
      Array.prototype.forEach.call(select.options || [], function(option) {
        option.selected = list.indexOf(option.value) > -1;
      });
      select.dataset.lastValue = JSON.stringify(getSelectValues_(select));
      syncMultiSelectDropdown_(select.id);
      return;
    }
    select.value = value || '';
    select.dataset.lastValue = select.value || '';
  }

  function getSelectValues_(select) {
    if (!select) {
      return [];
    }
    return Array.prototype.filter.call(select.options || [], function(option) {
      return option.selected && option.value;
    }).map(function(option) {
      return option.value;
    });
  }

  function getMultiSelectConfigMap_() {
    return {
      filtroLoja: { emptyLabel: 'Todas as lojas', noun: 'loja' },
      filtroSetor: { emptyLabel: 'Todos os setores', noun: 'setor' },
      filtroStatus: { emptyLabel: 'Todos os status', noun: 'status' },
      filtroPrioridade: { emptyLabel: 'Todas as prioridades', noun: 'prioridade' },
      filtroTipo: { emptyLabel: 'Todos os tipos', noun: 'tipo' },
      filtroResponsavel: { emptyLabel: 'Todos os responsaveis', noun: 'responsavel' },
      filtroExecutor: { emptyLabel: 'Todos os executores', noun: 'executor' },
      cronogramaLoja: { emptyLabel: 'Todas as lojas', noun: 'loja' },
      cronogramaSetor: { emptyLabel: 'Todos os setores', noun: 'setor' },
      cronogramaResponsavel: { emptyLabel: 'Todos os responsaveis', noun: 'responsavel' },
      cronogramaStatus: { emptyLabel: 'Todos os status', noun: 'status' }
    };
  }

  function hydrateMultiSelectDropdowns_() {
    bindMultiSelectOutsideHandler_();
    Object.keys(getMultiSelectConfigMap_()).forEach(function(selectId) {
      syncMultiSelectDropdown_(selectId);
    });
  }

  function bindMultiSelectOutsideHandler_() {
    if (multiSelectOutsideHandlerBound_) {
      return;
    }
    document.addEventListener('click', function(event) {
      var toggleNode = event.target.closest('[data-multi-select-trigger]');
      if (toggleNode) {
        event.preventDefault();
        event.stopPropagation();
        toggleMultiSelectDropdown_(toggleNode.getAttribute('data-multi-select-trigger'));
        return;
      }
      var optionNode = event.target.closest('[data-multi-select-option]');
      if (optionNode) {
        event.preventDefault();
        event.stopPropagation();
        toggleMultiSelectOption_(
          optionNode.getAttribute('data-multi-select-option'),
          optionNode.getAttribute('data-multi-select-value')
        );
        return;
      }
      if (!event.target.closest('.multi-select-dropdown')) {
        closeAllMultiSelectDropdowns_();
      }
    });
    multiSelectOutsideHandlerBound_ = true;
  }

  function syncMultiSelectDropdown_(selectId) {
    var select = document.getElementById(selectId);
    var config = getMultiSelectConfigMap_()[selectId];
    if (!select || !config || !select.multiple) {
      return;
    }
    var host = ensureMultiSelectDropdownHost_(select);
    if (!host) {
      return;
    }
    var values = getSelectValues_(select);
    var summary = buildMultiSelectSummary_(config, values);
    var optionsHtml = Array.prototype.map.call(select.options || [], function(option) {
      if (!option.value) {
        return '';
      }
      var selected = !!option.selected;
      return '<button type="button" class="multi-select-option' + (selected ? ' selected' : '') + '"' +
        ' data-multi-select-option="' + escapeHtml(selectId) + '"' +
        ' data-multi-select-value="' + escapeHtml(option.value) + '">' +
          '<span class="multi-select-option-check">' + (selected ? '&#10003;' : '') + '</span>' +
          '<span class="multi-select-option-label">' + escapeHtml(option.textContent || option.value) + '</span>' +
        '</button>';
    }).join('');
    var countBadge = summary.count > 0
      ? '<span class="multi-select-trigger-badge">' + summary.count + '</span>'
      : '';
    host.classList.toggle('open', openMultiSelectId_ === selectId);
    host.innerHTML =
      '<button type="button" class="multi-select-trigger" aria-expanded="' + (openMultiSelectId_ === selectId ? 'true' : 'false') + '"' +
        ' data-multi-select-trigger="' + escapeHtml(selectId) + '">' +
        '<span class="multi-select-trigger-copy">' +
          '<strong class="multi-select-trigger-value">' + escapeHtml(summary.title) + '</strong>' +
        '</span>' +
        '<span class="multi-select-trigger-side">' +
          countBadge +
          '<span class="multi-select-trigger-arrow">' + (openMultiSelectId_ === selectId ? '&#9650;' : '&#9660;') + '</span>' +
        '</span>' +
      '</button>' +
      '<div class="multi-select-menu' + (openMultiSelectId_ === selectId ? '' : ' hidden') + '">' +
        (optionsHtml || '<div class="multi-select-empty">Nenhuma opcao disponivel.</div>') +
      '</div>';
  }

  function ensureMultiSelectDropdownHost_(select) {
    var next = select.nextElementSibling;
    if (next && next.classList && next.classList.contains('multi-select-dropdown')) {
      return next;
    }
    var host = document.createElement('div');
    host.className = 'multi-select-dropdown';
    host.setAttribute('data-select-id', select.id || '');
    select.insertAdjacentElement('afterend', host);
    return host;
  }

  function buildMultiSelectSummary_(config, values) {
    var list = Array.isArray(values) ? values.filter(Boolean) : [];
    if (!list.length) {
      return {
        title: config.emptyLabel,
        subtitle: '',
        count: 0
      };
    }
    if (list.length <= 2) {
      return {
        title: list.join(', '),
        subtitle: '',
        count: list.length
      };
    }
    return {
      title: list.length + ' selecionados',
      subtitle: '',
      count: list.length
    };
  }

  function toggleMultiSelectDropdown_(selectId) {
    openMultiSelectId_ = openMultiSelectId_ === selectId ? '' : selectId;
    Object.keys(getMultiSelectConfigMap_()).forEach(function(id) {
      syncMultiSelectDropdown_(id);
    });
  }

  function closeAllMultiSelectDropdowns_() {
    if (!openMultiSelectId_) {
      return;
    }
    openMultiSelectId_ = '';
    Object.keys(getMultiSelectConfigMap_()).forEach(function(id) {
      syncMultiSelectDropdown_(id);
    });
  }

  function toggleMultiSelectOption_(selectId, value) {
    var select = document.getElementById(selectId);
    if (!select || !select.multiple) {
      return;
    }
    Array.prototype.forEach.call(select.options || [], function(option) {
      if (option.value === value) {
        option.selected = !option.selected;
      }
    });
    select.dataset.lastValue = JSON.stringify(getSelectValues_(select));
    syncMultiSelectDropdown_(selectId);
    select.dispatchEvent(new Event('change', { bubbles: true }));
    updateFilterFabState_();
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
      novoResponsavel: { group: 'responsavel', title: 'Responsaveis' },
      editExecutor: { group: 'executor', title: 'Executor / prestador' },
      editResponsavel: { group: 'responsavel', title: 'Responsaveis' },
      editStatus: { group: 'status', title: 'Status' },
      editSetor: { group: 'setor', title: 'Setores' },
      editTipo: { group: 'tipo', title: 'Tipos' },
      editPrioridade: { group: 'prioridade', title: 'Prioridades' }
    };
  }

  function getManagedGroupCatalog_() {
    return [
      { group: 'responsavel', title: 'Responsaveis' },
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
    applyNovaPendenciaPlanningDefaults_(true);
    if (Number(appState.newPendenciaStep || 1) < getNovaPendenciaStepDefinitions_().length) {
      goToNovaPendenciaStep_(Number(appState.newPendenciaStep || 1) + 1);
      return;
    }
    if (!validarNovaPendenciaStep_(1) || !validarNovaPendenciaStep_(3)) {
      return;
    }
    var dados = {
      loja: document.getElementById('novaLoja').value,
      setor: document.getElementById('novoSetor').value,
      tipo: document.getElementById('novoTipo').value,
      prioridade: document.getElementById('novaPrioridade').value,
      responsavel: document.getElementById('novoResponsavel').value,
      executor: document.getElementById('novoExecutor').value,
      data_inicio: document.getElementById('novaDataInicio').value,
      previsao_entrega: document.getElementById('novaPrevisaoEntrega').value,
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
        abrirPosSalvarPendenciaModal_(dados, false);
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
      responsavel: dados.responsavel || '',
      executor: dados.executor || '',
      data_inicio: dados.data_inicio || '',
      previsao_entrega: dados.previsao_entrega || '',
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
      historico: [],
      _syncStatus: 'pendente',
      _offlineOnly: true
    };
    applyWorkflowHeuristicsLocal_(item, dados, 'create');
    item.historico = [buildHistoryEntry_('', item.status || 'Aberto', 'offline_local', dados.observacao || 'Registro criado offline.')];
    item.historico[0].id_pendencia = tempId;
    mergeItemIntoState_(item);
    enqueueOperation_({
      type: 'create',
      tempId: tempId,
      payload: deepClone_(dados)
    });
    renderAll_();
    abrirPosSalvarPendenciaModal_(dados, true);
    mostrarMensagemSucesso('Pendencia salva offline. Ela sera sincronizada quando a internet voltar.');
  }

  function abrirPosSalvarPendenciaModal_(dados, offlineMode) {
    appState.newPendenciaCarryContext = {
      loja: dados.loja || '',
      setor: dados.setor || '',
      tipo: dados.tipo || '',
      prioridade: dados.prioridade || '',
      offlineMode: !!offlineMode
    };
    saveCache_();
    var modal = document.getElementById('novaPendenciaPosSaveModal');
    var messageNode = document.getElementById('novaPendenciaPosSaveMessage');
    if (messageNode) {
      messageNode.textContent = offlineMode
        ? 'A pendencia foi guardada offline. Deseja abrir a proxima mantendo loja, setor, tipo e prioridade?'
        : 'A pendencia foi salva. Deseja abrir a proxima mantendo loja, setor, tipo e prioridade?';
    }
    if (modal) {
      modal.classList.remove('hidden');
    }
  }

  function fecharPosSalvarPendenciaModal_() {
    var modal = document.getElementById('novaPendenciaPosSaveModal');
    if (modal) {
      modal.classList.add('hidden');
    }
  }

  function escolherContextoPosSalvarPendencia_(preserveContext) {
    var context = appState.newPendenciaCarryContext || {};
    if (preserveContext) {
      appState.formContext = {
        loja: context.loja || '',
        setor: context.setor || '',
        tipo: context.tipo || '',
        prioridade: context.prioridade || '',
        responsavel: '',
        executor: ''
      };
      limparFormularioNovaPendencia(false);
      appState.newPendenciaStep = resolveNextNovaPendenciaStep_(appState.formContext);
      applySavedFormContext_();
      renderNovaPendenciaFlow_();
      navegar('secaoNovaPendencia');
      setTimeout(function() {
        var targetStep = Number(appState.newPendenciaStep || 1);
        var target = document.getElementById(
          targetStep === 1 ? 'novaLoja' :
          (targetStep === 2 ? 'novoTipo' : 'novaDescricao')
        );
        if (target && typeof target.focus === 'function') {
          target.focus();
        }
      }, 60);
      mostrarMensagemSucesso(
        Number(appState.newPendenciaStep || 1) >= 3
          ? 'Contexto mantido. Continue pela descricao da proxima pendencia.'
          : 'Contexto mantido. Continue pela classificacao da proxima pendencia.'
      );
    } else {
      limparFormularioNovaPendencia(true);
      appState.newPendenciaStep = 1;
      renderNovaPendenciaFlow_();
      navegar('secaoNovaPendencia');
      focusNovaPendenciaStepField_(1);
      mostrarMensagemSucesso('Formulario limpo para iniciar uma nova pendencia.');
    }
    appState.newPendenciaCarryContext = null;
    saveCache_();
    fecharPosSalvarPendenciaModal_();
  }

  function listarPendencias() {
    renderListPresetBar_();
    renderPendencias(getVisibleWorklistItems_());
    renderFiltroResumo();
    if (appState.connection.online && appState.pendingQueue.length === 0) {
      carregarEstadoServidor_().catch(function() {
        renderPendencias(getVisibleWorklistItems_());
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

  function getFilterFieldValue_(id) {
    var field = document.getElementById(id);
    if (!field) {
      return '';
    }
    return field.multiple ? getSelectValues_(field) : field.value;
  }

  function clearFieldValue_(id, fallbackValue) {
    var field = document.getElementById(id);
    if (!field) {
      return;
    }
    if (field.multiple) {
      setStoredSelectValue_(field, []);
      return;
    }
    field.value = fallbackValue || '';
    field.dataset.lastValue = field.value || '';
  }

  function obterFiltrosTela(apenasHistorico) {
    return {
      loja: getFilterFieldValue_('filtroLoja'),
      setor: getFilterFieldValue_('filtroSetor'),
      status: getFilterFieldValue_('filtroStatus'),
      responsavel: getFilterFieldValue_('filtroResponsavel'),
      executor: getFilterFieldValue_('filtroExecutor'),
      orcamento: getElementValue_('filtroOrcamento'),
      prioridade: getFilterFieldValue_('filtroPrioridade'),
      tipo: getFilterFieldValue_('filtroTipo'),
      dataAberturaDe: getElementValue_('filtroDataAberturaDe'),
      dataAberturaAte: getElementValue_('filtroDataAberturaAte'),
      previsaoEntregaDe: getElementValue_('filtroPrevisaoDe'),
      previsaoEntregaAte: getElementValue_('filtroPrevisaoAte'),
      incluirFinalizadas: !!apenasHistorico,
      apenasHistorico: !!apenasHistorico
    };
  }

  function aplicarFiltros() {
    closeAllMultiSelectDropdowns_();
    toggleFiltroDrawer(false);
    renderDashboard(buildDashboardFromVisibleState_());
    renderDashboardActionHub_();
    renderListPresetBar_();
    renderPendencias(getVisibleWorklistItems_());
    renderHistoricoGeral(getFilteredPendencias_(true));
    renderFiltroResumo();
    renderSectionInsights_();
    updateFilterFabState_();
  }

  function limparFiltros() {
    closeAllMultiSelectDropdowns_();
    ['filtroLoja', 'filtroSetor', 'filtroStatus', 'filtroResponsavel', 'filtroExecutor', 'filtroOrcamento', 'filtroPrioridade', 'filtroTipo', 'filtroDataAberturaDe', 'filtroDataAberturaAte', 'filtroPrevisaoDe', 'filtroPrevisaoAte']
      .forEach(function(id) {
        clearFieldValue_(id);
      });
    appState.listPreset = 'all';
    renderDashboard(buildDashboardFromVisibleState_());
    renderDashboardActionHub_();
    renderListPresetBar_();
    renderPendencias(getVisibleWorklistItems_());
    renderHistoricoGeral(getFilteredPendencias_(true));
    renderFiltroResumo();
    renderSectionInsights_();
    updateFilterFabState_();
    saveCache_();
  }

  function obterFiltrosCronograma_() {
    return {
      executor: getElementValue_('cronogramaExecutor'),
      loja: getFilterFieldValue_('cronogramaLoja'),
      setor: getFilterFieldValue_('cronogramaSetor'),
      responsavel: getFilterFieldValue_('cronogramaResponsavel'),
      status: getFilterFieldValue_('cronogramaStatus'),
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
    closeAllMultiSelectDropdowns_();
    if (!validarFiltrosCronograma_(true)) {
      renderCronogramaPreview_();
      return;
    }
    renderCronogramaPreview_();
    renderSectionInsights_();
  }

  function limparFiltrosCronograma() {
    closeAllMultiSelectDropdowns_();
    ['cronogramaExecutor', 'cronogramaLoja', 'cronogramaSetor', 'cronogramaResponsavel', 'cronogramaStatus', 'cronogramaDataAberturaDe', 'cronogramaDataAberturaAte', 'cronogramaPrevisaoDe', 'cronogramaPrevisaoAte']
      .forEach(function(id) {
        clearFieldValue_(id, id === 'cronogramaExecutor' ? CRONOGRAMA_EXECUTOR_ALL : '');
      });
    renderCronogramaPreview_();
    renderSectionInsights_();
  }

  function getCronogramaItemsLocal_() {
    var filtros = validarFiltrosCronograma_(false);
    return appState.allPendencias.filter(function(item) {
      var status = getCronogramaStatusLocal_(item);
      if (normalizeText_(item.status) === 'cancelado') {
        return false;
      }
      if (filtros.executor === CRONOGRAMA_EXECUTOR_ALL) {
        // todos os prestadores
      } else if (filtros.executor === CRONOGRAMA_EXECUTOR_UNASSIGNED) {
        if (safeTrim_(item.executor)) {
          return false;
        }
      } else if (filtros.executor) {
        if (normalizeText_(item.executor) !== normalizeText_(filtros.executor)) {
          return false;
        }
      } else if (safeTrim_(item.executor)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.loja, filtros.loja)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.setor, filtros.setor)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.responsavel, filtros.responsavel)) {
        return false;
      }
      if ((filtros.dataAberturaDe || filtros.dataAberturaAte) && !dateWithinRangeLocal_(item.data_abertura, filtros.dataAberturaDe, filtros.dataAberturaAte)) {
        return false;
      }
      if ((filtros.previsaoEntregaDe || filtros.previsaoEntregaAte) && !dateWithinRangeLocal_(item.previsao_entrega, filtros.previsaoEntregaDe, filtros.previsaoEntregaAte)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(status, filtros.status)) {
        return false;
      }
      item.esta_vencida = isPendenciaVencidaLocal_(item);
      item.status_cronograma = status;
      item.data_abertura_label = formatDateBr(item.data_abertura);
      item.data_inicio_label = formatDateBr(item.data_inicio);
      item.previsao_entrega_label = formatDateBr(item.previsao_entrega);
      return true;
    }).sort(compareCronogramaItemsLocal_);
  }

  function getCronogramaStatusLocal_(item) {
    if (!item) {
      return '';
    }
    var dashboardStatus = getDashboardDisplayStatus_(item);
    if (dashboardStatus === 'Concluida') {
      return 'Concluido';
    }
    if (dashboardStatus === 'Vencida') {
      return 'Vencido';
    }
    if (dashboardStatus === 'Aguardando') {
      return 'Aguardando';
    }
    if (dashboardStatus === 'Em andamento') {
      return 'Em andamento';
    }
    return 'Aberto';
  }

  function getCronogramaExecutorFilterLabel_(executorFilter, lowerCase) {
    if (executorFilter === CRONOGRAMA_EXECUTOR_ALL) {
      return lowerCase ? 'todos os prestadores' : 'Todos os prestadores';
    }
    if (executorFilter === CRONOGRAMA_EXECUTOR_UNASSIGNED || !executorFilter) {
      return lowerCase ? 'pendencias sem prestador definido' : 'Sem prestador definido';
    }
    return executorFilter;
  }

  function getCronogramaExecutorDisplayName_(item, filtros) {
    if (safeTrim_(item && item.executor)) {
      return item.executor;
    }
    return getCronogramaExecutorFilterLabel_(filtros && filtros.executor, false);
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

  function renderCronogramaDateEditor_(item, fieldName, currentValue) {
      return '<input class="cronograma-date-input" type="date" value="' + escapeHtml(normalizeDateForInputValue_(currentValue)) + '" onclick="if(this.showPicker){try{this.showPicker();}catch(e){}}" onfocus="if(this.showPicker){try{this.showPicker();}catch(e){}}" onchange="salvarCronogramaDataRapida(\'' + escapeJs(item.id_pendencia) + '\', \'' + escapeJs(fieldName) + '\', this.value)">';
    }

  function salvarCronogramaDataRapida(id, fieldName, value) {
      var item = getLocalItemById_(id);
      if (!item) {
        mostrarMensagemErro('Pendencia nao encontrada.');
        return;
      }
      var payload = {};
      payload[fieldName] = value || '';
      if (!appState.connection.online) {
        applyOfflineMutationToItem_(item, payload);
        mergeItemIntoState_(item);
        enqueueOperation_({
          type: 'update',
          id: id,
          payload: payload,
          observacao: ''
        });
        renderCronogramaPreview_();
        mostrarMensagemSucesso((fieldName === 'data_inicio' ? 'Inicio' : 'Termino') + ' atualizado offline.');
        return;
      }
      mostrarLoading();
      serverCall_('atualizarPendencia', [resolveRemoteId_(id), payload])
        .then(function(response) {
          ocultarLoading();
          if (!response.success) {
            mostrarMensagemErro(response.message);
            return;
          }
          if (response.data && response.data.pendencia) {
            mergeItemIntoState_(response.data.pendencia);
          }
          renderAll_();
          mostrarMensagemSucesso((fieldName === 'data_inicio' ? 'Inicio' : 'Termino') + ' atualizado com sucesso.');
        })
        .catch(handleFailure);
    }

  function renderCronogramaPreview_() {
    var cardsEl = document.getElementById('cronogramaCards');
    var tableEl = document.getElementById('cronogramaTabela');
    var resumoEl = document.getElementById('cronogramaResumo');
    if (!cardsEl || !tableEl || !resumoEl) {
      return;
    }
    var filtros = validarFiltrosCronograma_(false);
    var items = getCronogramaItemsLocal_();
    resumoEl.textContent = items.length
      ? ('Programacao de ' + getCronogramaExecutorFilterLabel_(filtros.executor, true) + ' com ' + items.length + ' pendencia' + (items.length > 1 ? 's' : '') + '.')
      : ('Nenhuma pendencia ativa encontrada para ' + getCronogramaExecutorFilterLabel_(filtros.executor, true) + '.');

    if (!items.length) {
      cardsEl.innerHTML = buildCronogramaEmptyState_();
      tableEl.innerHTML = '<tr><td colspan="8" class="empty-state">Nenhuma pendencia ativa encontrada para os filtros informados.</td></tr>';
      renderSectionInsights_();
      return;
    }

    cardsEl.innerHTML = items.map(function(item) {
      return '<article class="pendencia-card cronograma-card">' +
        '<div class="cronograma-card-top"><h3>' + escapeHtml(getCronogramaExecutorDisplayName_(item, filtros)) + '</h3>' +
        ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '') +
        '</div>' +
        '<div class="cronograma-card-grid">' +
          cardKv_('Local', escapeHtml(item.loja || '-')) +
          cardKv_('Setor', renderSetorBadge_(item.setor || '-')) +
          cardKv_('Status', renderTag('status', item.status_cronograma || getCronogramaStatusLocal_(item))) +
          cardKv_('Prazo', renderCronogramaDateEditor_(item, 'previsao_entrega', item.previsao_entrega || item.previsao_entrega_label)) +
          cardKv_('Descricao / Observacao', renderCronogramaTextoCell_(item)) +
          cardKv_('Acoes', '<div class="cronograma-actions"><button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Detalhes</button><button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Editar</button></div>') +
        '</div>' +
      '</article>';
    }).join('');

    tableEl.innerHTML = items.map(function(item) {
      return '<tr>' +
        '<td>' + escapeHtml(getCronogramaExecutorDisplayName_(item, filtros) || '-') + '</td>' +
        '<td>' + escapeHtml(item.loja || '-') + '</td>' +
        '<td>' + renderSetorBadge_(item.setor || '-') + '</td>' +
        '<td>' + renderTag('status', item.status_cronograma || getCronogramaStatusLocal_(item)) + '</td>' +
        '<td class="cronograma-date-cell">' + renderCronogramaDateEditor_(item, 'previsao_entrega', item.previsao_entrega || item.previsao_entrega_label) + '</td>' +
        '<td class="cronograma-text-cell">' + renderCronogramaTextoCell_(item) + '</td>' +
        '<td><div class="table-actions"><button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Detalhes</button><button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Editar</button></div></td>' +
        '<td class="cronograma-anexo-cell">' + ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '<span class="muted-text">Sem anexo</span>') + '</td>' +
      '</tr>';
    }).join('');
    renderSectionInsights_();
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
    abrirPdfExterno_(payload.openUrl || payload.url, payload.fileName || 'cronograma.pdf');
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

  function hasOwnFieldClient_(source, key) {
    return Object.prototype.hasOwnProperty.call(source || {}, key);
  }

  function getConfigNumberLocal_(key, fallback) {
    var entry = findConfigByKey_(key);
    var raw = entry && entry.valor ? Number(entry.valor) : Number(fallback);
    return isFinite(raw) ? raw : Number(fallback || 0);
  }

  function getPriorityRankLocal_(prioridade) {
    var map = {
      'projeto': 0,
      'baixa': 1,
      'media': 2,
      'alta': 3,
      'critica': 4
    };
    return map[normalizeText_(prioridade)] || 0;
  }

  function getPrioritySlaDaysLocal_(prioridade) {
    var normalized = normalizeText_(prioridade);
    var keyMap = {
      'critica': 'SLA_CRITICA_DIAS',
      'alta': 'SLA_ALTA_DIAS',
      'media': 'SLA_MEDIA_DIAS',
      'baixa': 'SLA_BAIXA_DIAS',
      'projeto': 'SLA_PROJETO_DIAS'
    };
    var fallbackMap = {
      'critica': 7,
      'alta': 14,
      'media': 21,
      'baixa': 28,
      'projeto': 30
    };
    return getConfigNumberLocal_(keyMap[normalized] || 'SLA_MEDIA_DIAS', fallbackMap[normalized] === undefined ? 21 : fallbackMap[normalized]);
  }

  function addDaysToInputDate_(baseValue, days) {
    var baseDate = parseInputDate_(baseValue) || new Date();
    var amount = Number(days || 0);
    if (!isFinite(amount)) {
      amount = 0;
    }
    var next = new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() + amount);
    return toInputDate_(next);
  }

  function isFinalStatusLocal_(status) {
    var normalized = normalizeText_(status);
    return normalized === 'concluido' || normalized === 'cancelado';
  }

  function deriveWorkflowStatusLocal_(item, dados, mode) {
    var explicitStatus = hasOwnFieldClient_(dados, 'status') ? normalizeLabel_(dados.status || '') : '';
    var currentStatus = normalizeLabel_((item && item.status) || '');
    var baseStatus = explicitStatus || currentStatus || 'Aberto';
    var workflowTouched = mode === 'create' ||
      hasOwnFieldClient_(dados, 'executor') ||
      hasOwnFieldClient_(dados, 'data_inicio') ||
      hasOwnFieldClient_(dados, 'previsao_entrega');

    if (explicitStatus) {
      return explicitStatus;
    }
    if (isFinalStatusLocal_(baseStatus)) {
      return baseStatus;
    }
    if (!workflowTouched) {
      return baseStatus || 'Aberto';
    }
    if (!safeTrim_(item && item.executor)) {
      return 'Aberto';
    }
    if (safeTrim_(item && item.data_inicio)) {
      return 'Em andamento';
    }
    return 'Aguardando';
  }

  function applyWorkflowHeuristicsLocal_(item, dados, mode) {
    if (!item) {
      return;
    }
    var today = toInputDate_(new Date());
    var planningTouched = mode === 'create' ||
      hasOwnFieldClient_(dados, 'status') ||
      hasOwnFieldClient_(dados, 'executor') ||
      hasOwnFieldClient_(dados, 'data_inicio') ||
      hasOwnFieldClient_(dados, 'previsao_entrega') ||
      hasOwnFieldClient_(dados, 'prioridade');
    var nextStatus = deriveWorkflowStatusLocal_(item, dados || {}, mode);
    if (mode === 'create' && !safeTrim_(item.data_inicio) && !isFinalStatusLocal_(nextStatus)) {
      item.data_inicio = today;
    }
    if (planningTouched && normalizeText_(nextStatus) === 'em andamento' && !safeTrim_(item.data_inicio)) {
      item.data_inicio = today;
    }
    if (planningTouched && !safeTrim_(item.previsao_entrega) && !isFinalStatusLocal_(nextStatus)) {
      item.previsao_entrega = addDaysToInputDate_(item.data_inicio || today, getPrioritySlaDaysLocal_(item.prioridade || 'Media'));
    }
    item.status = nextStatus;
  }

  function getDaysUntilDate_(value) {
    var target = parseInputDate_(value);
    var today = parseInputDate_(toInputDate_(new Date()));
    if (!target || !today) {
      return null;
    }
    return Math.round((target.getTime() - today.getTime()) / 86400000);
  }

  function getDaysSinceDate_(value) {
    var target = parseInputDate_(value);
    var today = parseInputDate_(toInputDate_(new Date()));
    if (!target || !today) {
      return null;
    }
    return Math.round((today.getTime() - target.getTime()) / 86400000);
  }

  function isPendenciaAtivaLocal_(item) {
    return !isFinalStatusLocal_(item && item.status);
  }

  function getPendenciaBaseDateLocal_(item) {
    return parseInputDate_((item && item.data_inicio) || (item && item.data_abertura));
  }

  function isPendenciaCriticaAtivaLocal_(item) {
    return isPendenciaAtivaLocal_(item) && normalizeText_(item && item.prioridade) === 'critica';
  }

  function isPendenciaSemExecutorAtivaLocal_(item) {
    return isPendenciaAtivaLocal_(item) && !safeTrim_(item && item.executor);
  }

  function isPendenciaDentroDoPrazoLocal_(item) {
    if (!isPendenciaAtivaLocal_(item)) {
      return false;
    }
    var inicio = getPendenciaBaseDateLocal_(item);
    var previsao = parseInputDate_(item && item.previsao_entrega);
    var hoje = parseInputDate_(toInputDate_(new Date()));
    return !!(inicio && previsao && hoje && inicio <= hoje && hoje <= previsao);
  }

  function isPendenciaForaDoPrazoLocal_(item) {
    return isPendenciaAtivaLocal_(item) && isPendenciaVencidaLocal_(item);
  }

  function getPendenciaWorkflowMeta_(item) {
    if (!item) {
      return {
        healthLabel: 'Sem dados',
        toneClass: 'neutral',
        nextAction: 'Sem acao sugerida.',
        contextLine: '',
        dashboardStatus: 'Aberta',
        score: 0,
        dueLabel: 'Sem previsao',
        ageLabel: '',
        canStartToday: false,
        canSuggestDue: false
      };
    }
    var status = normalizeText_(item.status);
    var prioridade = normalizeText_(item.prioridade);
    var hasExecutor = !!safeTrim_(item.executor);
    var hasResponsavel = !!safeTrim_(item.responsavel);
    var hasInicio = !!safeTrim_(item.data_inicio);
    var hasPrevisao = !!safeTrim_(item.previsao_entrega);
    var hasBudget = !!safeTrim_(item.id_orcamento_ativo);
    var overdue = isPendenciaVencidaLocal_(item);
    var daysToDue = getDaysUntilDate_(item.previsao_entrega || item.previsao_entrega_label);
    var daysOpen = getDaysSinceDate_(item.data_abertura || item.data_abertura_label);
    var dueLabel = 'Sem previsao definida.';
    var ageLabel = daysOpen === null ? 'Abertura nao informada.' : (daysOpen <= 0 ? 'Aberta hoje.' : 'Aberta ha ' + daysOpen + ' dia' + (daysOpen > 1 ? 's' : '') + '.');
    var healthLabel = 'Em acompanhamento';
    var toneClass = 'neutral';
    var nextAction = 'Acompanhar execucao.';
    var dashboardStatus = 'Aberta';
    var score = getPriorityRankLocal_(prioridade) * 8;

    if (hasPrevisao) {
      if (daysToDue === null) {
        dueLabel = 'Previsao registrada.';
      } else if (daysToDue < 0) {
        dueLabel = 'Atrasada ha ' + Math.abs(daysToDue) + ' dia' + (Math.abs(daysToDue) > 1 ? 's' : '') + '.';
      } else if (daysToDue === 0) {
        dueLabel = 'Vence hoje.';
      } else if (daysToDue === 1) {
        dueLabel = 'Vence amanha.';
      } else {
        dueLabel = 'Vence em ' + daysToDue + ' dias.';
      }
    }

    if (status === 'concluido') {
      healthLabel = 'Concluida';
      toneClass = 'success';
      nextAction = 'Somente consulta e auditoria.';
      dashboardStatus = 'Concluida';
      score = -10;
    } else if (status === 'cancelado') {
      healthLabel = 'Cancelada';
      toneClass = 'neutral';
      nextAction = 'Consultar historico para entender o cancelamento.';
      dashboardStatus = 'Cancelada';
      score = -20;
    } else if (overdue) {
      healthLabel = 'Prazo estourado';
      toneClass = 'danger';
      nextAction = hasExecutor ? 'Renegociar prazo ou concluir agora.' : 'Definir prestador e renegociar o prazo.';
      dashboardStatus = 'Vencida';
      score = 140 + getPriorityRankLocal_(prioridade) * 10;
    } else if (!hasExecutor) {
      healthLabel = prioridade === 'critica' ? 'Critica sem prestador' : 'Sem prestador';
      toneClass = prioridade === 'critica' ? 'danger' : 'warning';
      nextAction = 'Atribuir executor para tirar a pendencia da fila.';
      dashboardStatus = 'Aberta';
      score = 110 + getPriorityRankLocal_(prioridade) * 10;
    } else if (!hasPrevisao) {
      healthLabel = 'Sem previsao';
      toneClass = 'warning';
      nextAction = 'Definir uma data de entrega realista.';
      dashboardStatus = 'Aguardando';
      score = 96 + getPriorityRankLocal_(prioridade) * 8;
    } else if (!hasInicio) {
      healthLabel = 'Aguardando inicio';
      toneClass = 'info';
      nextAction = 'Programar o inicio da execucao.';
      dashboardStatus = 'Aguardando';
      score = 82 + getPriorityRankLocal_(prioridade) * 7;
    } else if (!hasResponsavel) {
      healthLabel = 'Sem responsavel';
      toneClass = 'neutral';
      nextAction = 'Definir quem acompanha internamente a entrega.';
      dashboardStatus = 'Em andamento';
      score = 58 + getPriorityRankLocal_(prioridade) * 6;
    } else if (daysToDue !== null && daysToDue <= 1) {
      healthLabel = daysToDue === 0 ? 'Vence hoje' : 'Vence amanha';
      toneClass = 'warning';
      nextAction = 'Acompanhar de perto para evitar atraso.';
      dashboardStatus = 'Em andamento';
      score = 70 + getPriorityRankLocal_(prioridade) * 7;
    } else {
      healthLabel = hasBudget ? 'Com orcamento e em fluxo' : 'Em execucao';
      toneClass = 'success';
      nextAction = hasBudget ? 'Acompanhar a entrega do orcamento/servico.' : 'Manter acompanhamento ate a conclusao.';
      dashboardStatus = 'Em andamento';
      score = 32 + getPriorityRankLocal_(prioridade) * 5;
    }

    return {
      healthLabel: healthLabel,
      toneClass: toneClass,
      nextAction: nextAction,
      contextLine: [dueLabel, ageLabel, hasBudget ? 'Com orcamento ativo.' : 'Sem orcamento ativo.'].join(' '),
      dashboardStatus: dashboardStatus,
      score: score,
      dueLabel: dueLabel,
      ageLabel: ageLabel,
      canStartToday: !isFinalStatusLocal_(item.status) && hasExecutor && !hasInicio,
      canSuggestDue: !isFinalStatusLocal_(item.status) && (!hasPrevisao || overdue)
    };
  }

  function comparePendenciasForWorklist_(a, b) {
    var metaA = getPendenciaWorkflowMeta_(a);
    var metaB = getPendenciaWorkflowMeta_(b);
    if (metaB.score !== metaA.score) {
      return metaB.score - metaA.score;
    }
    var dueA = parseInputDate_(a.previsao_entrega) || parseInputDate_('2999-12-31');
    var dueB = parseInputDate_(b.previsao_entrega) || parseInputDate_('2999-12-31');
    if (dueA.getTime() !== dueB.getTime()) {
      return dueA.getTime() - dueB.getTime();
    }
    var abertaA = parseInputDate_(a.data_abertura) || parseInputDate_('1900-01-01');
    var abertaB = parseInputDate_(b.data_abertura) || parseInputDate_('1900-01-01');
    if (abertaA.getTime() !== abertaB.getTime()) {
      return abertaB.getTime() - abertaA.getTime();
    }
    return String(b.id_pendencia || '').localeCompare(String(a.id_pendencia || ''), 'pt-BR');
  }

  function compareHistoricoPendencias_(a, b) {
    var conclA = parseInputDate_(a.data_conclusao) || parseInputDate_(a.data_abertura) || parseInputDate_('1900-01-01');
    var conclB = parseInputDate_(b.data_conclusao) || parseInputDate_(b.data_abertura) || parseInputDate_('1900-01-01');
    if (conclA.getTime() !== conclB.getTime()) {
      return conclB.getTime() - conclA.getTime();
    }
    return String(b.id_pendencia || '').localeCompare(String(a.id_pendencia || ''), 'pt-BR');
  }

  function getWorklistPresetDefinitions_() {
    return [
      { key: 'all', label: 'Tudo' },
      { key: 'criticas_7dias', label: 'Criticas (7 dias)' },
      { key: 'sem_executor', label: 'Sem executor' },
      { key: 'dentro_prazo', label: 'Dentro do prazo' },
      { key: 'fora_prazo', label: 'Fora do prazo' },
      { key: 'sem_previsao', label: 'Sem previsao' },
      { key: 'sem_responsavel', label: 'Sem responsavel' }
    ];
  }

  function matchesListPreset_(item, presetKey) {
    var meta = getPendenciaWorkflowMeta_(item);
    if (!presetKey || presetKey === 'all') {
      return true;
    }
    if (presetKey === 'criticas_7dias') {
      return isPendenciaCriticaAtivaLocal_(item);
    }
    if (presetKey === 'sem_executor') {
      return isPendenciaSemExecutorAtivaLocal_(item);
    }
    if (presetKey === 'dentro_prazo') {
      return isPendenciaDentroDoPrazoLocal_(item);
    }
    if (presetKey === 'fora_prazo') {
      return isPendenciaForaDoPrazoLocal_(item);
    }
    if (presetKey === 'sem_previsao') {
      return !safeTrim_(item && item.previsao_entrega);
    }
    if (presetKey === 'sem_responsavel') {
      return !safeTrim_(item && item.responsavel);
    }
    return true;
  }

  function getVisibleWorklistItems_() {
    return getFilteredPendencias_(false, false, true);
  }

  function renderListPresetBar_() {
    var host = document.getElementById('listPresetBar');
    if (!host) {
      return;
    }
    var items = getFilteredPendencias_(false);
    var currentPreset = appState.listPreset || 'all';
    host.innerHTML = getWorklistPresetDefinitions_().map(function(definition) {
      var count = definition.key === 'all'
        ? items.length
        : items.filter(function(item) { return matchesListPreset_(item, definition.key); }).length;
      return '<button class="preset-chip' + (currentPreset === definition.key ? ' active' : '') + '" type="button" onclick="applyListPreset_(\'' + escapeJs(definition.key) + '\')">' +
        '<span>' + escapeHtml(definition.label) + '</span>' +
        '<span class="preset-chip-count">' + escapeHtml(String(count)) + '</span>' +
      '</button>';
    }).join('');
  }

  function applyListPreset_(presetKey, options) {
    appState.listPreset = presetKey || 'all';
    saveCache_();
    renderListPresetBar_();
    renderPendencias(getVisibleWorklistItems_());
    renderFiltroResumo();
    renderSectionInsights_();
    if (!(options && options.skipNavigate) && appState.currentSection !== 'secaoListaPendencias') {
      navegar('secaoListaPendencias');
    }
  }

  function renderDashboardActionHub_() {
    var host = document.getElementById('dashboardActionHub');
    if (!host) {
      return;
    }
    var items = getFilteredPendencias_(false);
    var cards = [
      { key: 'criticas_7dias', label: 'Criticas (7 dias)', meta: 'Pendencias criticas ativas.', tone: 'warning' },
      { key: 'sem_executor', label: 'Sem executor', meta: 'Pendencias ativas sem prestador.', tone: 'danger' },
      { key: 'dentro_prazo', label: 'Dentro do prazo', meta: 'Pendencias ativas dentro da janela de entrega.', tone: 'success' },
      { key: 'fora_prazo', label: 'Fora do prazo', meta: 'Pendencias com entrega vencida.', tone: 'danger' }
    ];

    if (!items.length) {
      host.innerHTML = '<div class="empty-state">Nenhuma pendencia ativa no recorte atual.</div>';
      return;
    }

    host.innerHTML = cards.map(function(card) {
      var count = items.filter(function(item) {
        return matchesListPreset_(item, card.key);
      }).length;
      return '<button class="action-hub-card ' + card.tone + '" type="button" onclick="applyListPreset_(\'' + escapeJs(card.key) + '\')">' +
        '<span class="action-hub-label">' + escapeHtml(card.label) + '</span>' +
        '<strong class="action-hub-value">' + escapeHtml(String(count)) + '</strong>' +
        '<span class="action-hub-meta">' + escapeHtml(card.meta) + '</span>' +
      '</button>';
    }).join('');
  }

  function renderFiltroResumo() {
    var summaryNode = document.getElementById('filtroResumo');
    if (!summaryNode) {
      return;
    }
    var filtros = obterFiltrosTela(false);
    var labels = [];
    var presetAtual = appState.listPreset || 'all';
    var presetDef = getWorklistPresetDefinitions_().filter(function(item) {
      return item.key === presetAtual;
    })[0];
    Object.keys(filtros).forEach(function(key) {
      if (key === 'incluirFinalizadas' || key === 'apenasHistorico') {
        return;
      }
      if (Array.isArray(filtros[key]) ? filtros[key].length : filtros[key]) {
        labels.push(formatarChaveFiltro(key) + ': ' + formatarValorFiltro_(filtros[key]));
      }
    });
    if (presetDef && presetDef.key !== 'all') {
      labels.unshift('Recorte: ' + presetDef.label);
    }
    if (!labels.length) {
      summaryNode.classList.add('hidden');
      summaryNode.innerHTML = '';
      return;
    }
    summaryNode.classList.remove('hidden');
    summaryNode.innerHTML =
      '<div class="filter-summary-row">' +
        '<div class="filter-summary-copy">' +
          '<span class="filter-summary-title">' + labels.length + ' filtro' + (labels.length > 1 ? 's' : '') + ' ativo' + (labels.length > 1 ? 's' : '') + '</span>' +
          '<span class="filter-summary-text">' + escapeHtml(labels.join(' | ')) + '</span>' +
        '</div>' +
        '<div class="filter-summary-actions">' +
          '<button class="ghost-button compact-button" type="button" onclick="abrirFiltrosFlutuante()">Editar filtros</button>' +
          '<button class="ghost-button compact-button" type="button" onclick="limparFiltros()">Limpar</button>' +
        '</div>' +
      '</div>';
  }

  function formatarValorFiltro_(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value;
  }

  function formatarChaveFiltro(chave) {
    var mapa = {
      loja: 'Loja',
      setor: 'Setor',
      status: 'Status',
      responsavel: 'Responsavel',
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

  function countActiveFields_(source, ignoredKeys) {
    return Object.keys(source || {}).reduce(function(total, key) {
      if (ignoredKeys && ignoredKeys[key]) {
        return total;
      }
      if (Array.isArray(source[key])) {
        return source[key].length ? total + 1 : total;
      }
      return source[key] ? total + 1 : total;
    }, 0);
  }

  function setNodeHtml_(id, html) {
    var node = document.getElementById(id);
    if (!node) {
      return;
    }
    node.innerHTML = html || '';
  }

  function buildInsightCard_(label, value, detail) {
    return '<article class="insight-card">' +
      '<span class="insight-label">' + escapeHtml(label) + '</span>' +
      '<strong class="insight-value">' + escapeHtml(value) + '</strong>' +
      '<span class="insight-detail">' + escapeHtml(detail) + '</span>' +
    '</article>';
  }

  function formatLastSyncLabel_() {
    var raw = appState.connection && appState.connection.lastSyncAt;
    if (!raw) {
      return 'Ainda nao sincronizado.';
    }
    var date = new Date(raw);
    if (isNaN(date.getTime())) {
      return 'Sincronizacao registrada.';
    }
    var hh = ('0' + date.getHours()).slice(-2);
    var mm = ('0' + date.getMinutes()).slice(-2);
    return formatDateBr(date) + ' ' + hh + ':' + mm;
  }

  function renderSectionInsights_() {
    var ativos = getFilteredPendencias_(false);
    var worklist = getVisibleWorklistItems_();
    var historico = getFilteredPendencias_(true);
    var cronogramaItems = getCronogramaItemsLocal_();
    var filtrosAtivos = countActiveFields_(obterFiltrosTela(false), {
      incluirFinalizadas: true,
      apenasHistorico: true
    });
    var presetAtivo = appState.listPreset && appState.listPreset !== 'all'
      ? (getWorklistPresetDefinitions_().filter(function(item) { return item.key === appState.listPreset; })[0] || {}).label
      : '';
    var filtrosCronograma = countActiveFields_(obterFiltrosCronograma_());
    var vencidas = ativos.filter(function(item) {
      return item.esta_vencida || isPendenciaVencidaLocal_(item);
    }).length;
    var selecionadas = (appState.selectedOrcamentoIds || []).length;
    var filaOffline = (appState.pendingQueue || []).length;
    var configuracoesVisiveis = (appState.configs || []).filter(function(item) {
      return item.chave !== 'NOME_PASTA_DRIVE_FOTOS' && item.chave !== 'STATUS_PADRAO_NOVO_REGISTRO';
    }).length;

    setNodeHtml_('dashboardInsights', [
      buildInsightCard_('Ativas no recorte', String(ativos.length), filtrosAtivos ? 'Com filtros globais aplicados.' : 'Sem filtros globais aplicados.'),
      buildInsightCard_('Vencidas', String(vencidas), vencidas ? 'Essas pendencias merecem prioridade.' : 'Nenhum item vencido no momento.'),
      buildInsightCard_('Ultima sincronizacao', appState.connection.online ? 'Online' : 'Offline', formatLastSyncLabel_())
    ].join(''));

    setNodeHtml_('novaPendenciaInsights', [
      buildInsightCard_('Campos obrigatorios', '3', 'Loja, setor e descricao.'),
      buildInsightCard_('Foto', 'Opcional', 'Use quando a imagem ajudar o executor.'),
      buildInsightCard_('Fila offline', String(filaOffline), filaOffline ? 'Itens aguardando sincronizacao.' : 'Nenhum envio pendente.')
    ].join(''));

    setNodeHtml_('listaInsights', [
      buildInsightCard_('Pendencias na lista', String(worklist.length), presetAtivo ? ('Recorte rapido ativo: ' + presetAtivo + '.') : (filtrosAtivos ? 'Lista refinada pelos filtros ativos.' : 'Mostrando todas as pendencias ativas.')),
      buildInsightCard_('Selecionadas para orcamento', String(selecionadas), selecionadas ? 'A barra de orcamento esta pronta para uso.' : 'Selecione itens para montar orcamento em lote.'),
      buildInsightCard_('Fila offline', String(filaOffline), filaOffline ? 'Existem alteracoes locais aguardando envio.' : 'Todos os dados locais ja foram sincronizados.')
    ].join(''));

    setNodeHtml_('historicoInsights', [
      buildInsightCard_('Itens no historico', String(historico.length), filtrosAtivos ? 'Historico considerando o filtro global atual.' : 'Concluidos e cancelados no recorte completo.'),
      buildInsightCard_('Cancelados ou concluidos', String(historico.length), 'Use esta tela para auditoria e reabertura manual.'),
      buildInsightCard_('Ultima sincronizacao', filaOffline ? 'Pendente' : 'Estavel', filaOffline ? 'O historico pode mudar apos a proxima sincronizacao.' : formatLastSyncLabel_())
    ].join(''));

    setNodeHtml_('cronogramaInsights', [
      buildInsightCard_('Pendencias no cronograma', String(cronogramaItems.length), filtrosCronograma ? 'Cronograma refinado pelos filtros desta tela.' : 'Mostrando o recorte padrao do cronograma.'),
      buildInsightCard_('Filtros do cronograma', String(filtrosCronograma), filtrosCronograma ? 'Ha criterios ativos para prestador, local ou data.' : 'Nenhum filtro especifico ativo.'),
      buildInsightCard_('Exportacao', appState.connection.online ? 'Disponivel' : 'Bloqueada', appState.connection.online ? 'PDF e Excel podem ser gerados agora.' : 'PDF e Excel exigem conexao com a internet.')
    ].join(''));

    setNodeHtml_('configInsights', [
      buildInsightCard_('Configuracoes visiveis', String(configuracoesVisiveis), 'Parametros principais exibidos para ajuste rapido.'),
      buildInsightCard_('Grupos de cadastro', String(getManagedGroupCatalog_().length), 'Loja, setor, responsavel, executor, tipo, prioridade e status.'),
      buildInsightCard_('Prestadores cadastrados', String((appState.prestadoresAdmin || []).length), 'Executores disponiveis para atribuicao e cronograma.')
    ].join(''));
  }

  function updateFilterFabState_() {
    var badge = document.getElementById('filterFabCount');
    if (!badge) {
      return;
    }
    var total = countActiveFields_(obterFiltrosTela(false), {
      incluirFinalizadas: true,
      apenasHistorico: true
    });
    badge.textContent = total > 99 ? '99+' : String(total);
    badge.classList.toggle('hidden', total === 0);
  }

  function buildPendenciasEmptyState_() {
    var hasFilters = countActiveFields_(obterFiltrosTela(false), {
      incluirFinalizadas: true,
      apenasHistorico: true
    }) > 0;
    var hasPreset = !!(appState.listPreset && appState.listPreset !== 'all');
    if (hasFilters || hasPreset) {
      return '<div class="panel empty-state empty-state-cta">' +
        '<strong>Nenhuma pendencia ativa corresponde aos filtros atuais.</strong>' +
        '<p>Voce pode limpar filtros e recortes rapidos para voltar ao panorama completo ou ajustar o recorte pelo botao de filtros.</p>' +
        '<div class="empty-state-actions">' +
          '<button class="ghost-button" type="button" onclick="limparFiltros()">Limpar filtros e recortes</button>' +
          '<button class="primary-button" type="button" onclick="abrirFiltrosFlutuante()">Editar filtros</button>' +
        '</div>' +
      '</div>';
    }
    return '<div class="panel empty-state empty-state-cta">' +
      '<strong>Nenhuma pendencia ativa foi encontrada.</strong>' +
      '<p>Se isso estiver correto, o proximo passo natural e registrar uma nova pendencia ou atualizar o dashboard para confirmar o estado atual da operacao.</p>' +
      '<div class="empty-state-actions">' +
        '<button class="primary-button" type="button" onclick="navegar(\'secaoNovaPendencia\')">Nova pendencia</button>' +
        '<button class="ghost-button" type="button" onclick="carregarDashboard()">Atualizar dashboard</button>' +
      '</div>' +
    '</div>';
  }

  function buildHistoricoEmptyState_() {
    var hasFilters = countActiveFields_(obterFiltrosTela(true), {
      incluirFinalizadas: true,
      apenasHistorico: true
    }) > 0;
    return '<div class="panel empty-state empty-state-cta">' +
      '<strong>' + (hasFilters ? 'Nenhum item do historico corresponde aos filtros atuais.' : 'Ainda nao ha itens concluidos ou cancelados para exibir.') + '</strong>' +
      '<p>' + (hasFilters ? 'Limpe ou ajuste o filtro global para ampliar o recorte do historico.' : 'Assim que uma pendencia for concluida ou cancelada, ela aparece aqui para consulta e auditoria.') + '</p>' +
      '<div class="empty-state-actions">' +
        (hasFilters ? '<button class="ghost-button" type="button" onclick="limparFiltros()">Limpar filtros</button>' : '') +
        '<button class="primary-button" type="button" onclick="navegar(\'secaoListaPendencias\')">Ir para lista ativa</button>' +
      '</div>' +
    '</div>';
  }

  function buildCronogramaEmptyState_() {
    var filtrosAtivos = countActiveFields_(obterFiltrosCronograma_()) > 0;
    return '<div class="panel empty-state empty-state-cta">' +
      '<strong>' + (filtrosAtivos ? 'Nenhuma pendencia entrou no cronograma com esse recorte.' : 'Nao ha pendencias prontas para o cronograma atual.') + '</strong>' +
      '<p>' + (filtrosAtivos ? 'Revise prestador, local, status ou datas para ampliar a agenda exibida.' : 'Pendencias sem executor ou sem datas podem precisar primeiro de ajuste na tela de lista ou edicao.') + '</p>' +
      '<div class="empty-state-actions">' +
        (filtrosAtivos ? '<button class="ghost-button" type="button" onclick="limparFiltrosCronograma()">Limpar filtros do cronograma</button>' : '') +
        '<button class="primary-button" type="button" onclick="navegar(\'secaoListaPendencias\')">Ver lista de pendencias</button>' +
      '</div>' +
    '</div>';
  }

  function toggleFiltroDrawer(show) {
    document.getElementById('filtroDrawer').classList.toggle('hidden', !show);
    document.body.classList.toggle('sidebar-open', !!show);
    if (!show) {
      closeAllMultiSelectDropdowns_();
    }
    renderPendencias(getVisibleWorklistItems_());
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
    var localItem = buildDetailFromLocalItem_(getLocalItemById_(id));
    if (!localItem) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }

    navegar('secaoEdicaoPendencia');
    preencherFormularioEdicao_(localItem);

    if (!appState.connection.online || isLocalId_(id)) {
      return;
    }

    mostrarLoading();
    serverCall_('buscarPendenciaPorId', [resolveRemoteId_(id)])
      .then(function(response) {
        ocultarLoading();
        if (!response.success || !response.data) {
          preencherFormularioEdicao_(localItem);
          if (response && response.message) {
            mostrarMensagemErro(response.message);
          }
          return;
        }
        appState.detailsById[response.data.id_pendencia] = response.data;
        mergeItemIntoState_(response.data);
        preencherFormularioEdicao_(response.data);
      })
      .catch(function() {
        ocultarLoading();
        preencherFormularioEdicao_(localItem);
      });
  }

  function preencherFormularioEdicao_(item) {
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    document.getElementById('editIdPendencia').value = item.id_pendencia;
    document.getElementById('editResponsavel').value = item.responsavel || '';
    document.getElementById('editExecutor').value = item.executor || '';
    document.getElementById('editStatus').value = item.status || '';
    document.getElementById('editSetor').value = item.setor || '';
    document.getElementById('editDataInicio').value = normalizeDateForInputValue_(item.data_inicio || item.data_abertura);
    document.getElementById('editPrevisaoEntrega').value = normalizeDateForInputValue_(item.previsao_entrega || item.previsao_entrega_label);
    document.getElementById('editTipo').value = item.tipo || '';
    document.getElementById('editPrioridade').value = item.prioridade || '';
    document.getElementById('editDescricao').value = item.descricao || '';
    document.getElementById('editObservacao').value = item.observacao || '';
    document.getElementById('editFoto').value = '';
    atualizarNomeArquivo('editFoto', 'editFotoNome');
    setTimeout(function() {
      renderEditGuidance_();
      updateFormPlanningHint_('edit');
    }, 0);
  }

  function salvarExecutorRapido(id, executor, fieldEl) {
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
      rerenderViewsAfterPendenciaUpdate_(id);
      mostrarMensagemSucesso('Executor atualizado offline. Sera sincronizado ao reconectar.');
      return;
    }
    setInlineFieldSavingState_(fieldEl, true);
    serverCall_('atualizarPendencia', [resolveRemoteId_(id), { executor: executor || '' }])
      .then(function(response) {
        setInlineFieldSavingState_(fieldEl, false);
        if (!response.success) {
          rerenderViewsAfterPendenciaUpdate_(id);
          mostrarMensagemErro(response.message);
          return;
        }
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          rerenderViewsAfterPendenciaUpdate_(id);
          mostrarMensagemSucesso('Executor atualizado com sucesso.');
        } else {
          return carregarEstadoServidor_().then(function() {
            mostrarMensagemSucesso('Executor atualizado com sucesso.');
          });
        }
      })
      .catch(function(error) {
        setInlineFieldSavingState_(fieldEl, false);
        rerenderViewsAfterPendenciaUpdate_(id);
        handleFailure(error);
      });
  }

  function salvarResponsavelRapido(id, responsavel, fieldEl) {
    var item = getLocalItemById_(id);
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    if (normalizeText_(item.responsavel) === normalizeText_(responsavel)) {
      return;
    }
    if (!appState.connection.online) {
      item.responsavel = responsavel || '';
      item._syncStatus = 'pendente';
      item.ultima_atualizacao = formatDateTimeLocal_(new Date());
      item.atualizado_por = 'offline_local';
      mergeItemIntoState_(item);
      enqueueOperation_({
        type: 'update',
        id: id,
        payload: { responsavel: responsavel || '' },
        observacao: ''
      });
      rerenderViewsAfterPendenciaUpdate_(id);
      mostrarMensagemSucesso('Responsavel atualizado offline. Sera sincronizado ao reconectar.');
      return;
    }
    setInlineFieldSavingState_(fieldEl, true);
    serverCall_('atualizarPendencia', [resolveRemoteId_(id), { responsavel: responsavel || '' }])
      .then(function(response) {
        setInlineFieldSavingState_(fieldEl, false);
        if (!response.success) {
          rerenderViewsAfterPendenciaUpdate_(id);
          mostrarMensagemErro(response.message);
          return;
        }
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          rerenderViewsAfterPendenciaUpdate_(id);
          mostrarMensagemSucesso('Responsavel atualizado com sucesso.');
        } else {
          return carregarEstadoServidor_().then(function() {
            mostrarMensagemSucesso('Responsavel atualizado com sucesso.');
          });
        }
      })
      .catch(function(error) {
        setInlineFieldSavingState_(fieldEl, false);
        rerenderViewsAfterPendenciaUpdate_(id);
        handleFailure(error);
      });
  }

  async function salvarEdicaoPendencia(event) {
    event.preventDefault();
    var id = document.getElementById('editIdPendencia').value;
    var dados = {
      responsavel: document.getElementById('editResponsavel').value,
      executor: document.getElementById('editExecutor').value,
      status: document.getElementById('editStatus').value,
      setor: document.getElementById('editSetor').value,
      data_inicio: document.getElementById('editDataInicio').value,
      previsao_entrega: document.getElementById('editPrevisaoEntrega').value,
      tipo: document.getElementById('editTipo').value,
      prioridade: document.getElementById('editPrioridade').value,
      descricao: document.getElementById('editDescricao').value,
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
    if (normalizeText_(item.status) !== normalizeText_(previousStatus)) {
      item.historico = item.historico || [];
      item.historico.unshift(buildHistoryEntry_(previousStatus, item.status, 'offline_local', dados.observacao || 'Status alterado offline.'));
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
    var width = (window.visualViewport && window.visualViewport.width) || window.innerWidth || document.documentElement.clientWidth || 0;
    return (document.body.classList.contains('sidebar-open') || width < 1380) ? shortLabel : full;
  }

  function getDashboardDisplayStatus_(item) {
    return getPendenciaWorkflowMeta_(item).dashboardStatus || 'Aberta';
  }

  function renderExecutorSelect_(item) {
    var pendenciaId = escapeJs(item.id_pendencia);
    var options = ['<option value="">Sem executor</option>'];
    var hasExecutor = !!safeTrim_(item.executor);
    ((appState.combos && appState.combos.prestadores) || []).forEach(function(nome) {
      options.push('<option value="' + escapeHtml(nome) + '"' + (normalizeText_(nome) === normalizeText_(item.executor) ? ' selected' : '') + '>' + escapeHtml(nome) + '</option>');
    });
    return '<div class="executor-inline-wrap' + (hasExecutor ? '' : ' is-empty') + '">' +
      '<select class="executor-inline-select' + (hasExecutor ? '' : ' attention') + '" onchange="salvarExecutorRapido(\'' + pendenciaId + '\', this.value, this)">' + options.join('') + '</select>' +
      '<span class="executor-inline-note">' + escapeHtml(hasExecutor ? 'Prestador definido' : 'Definir prestador') + '</span>' +
    '</div>';
  }

  function renderResponsavelSelect_(item) {
    var pendenciaId = escapeJs(item.id_pendencia);
    var options = ['<option value="">Sem responsavel</option>'];
    var hasResponsavel = !!safeTrim_(item.responsavel);
    ((appState.combos && appState.combos.responsaveis) || []).forEach(function(nome) {
      options.push('<option value="' + escapeHtml(nome) + '"' + (normalizeText_(nome) === normalizeText_(item.responsavel) ? ' selected' : '') + '>' + escapeHtml(nome) + '</option>');
    });
    return '<div class="executor-inline-wrap responsavel-inline-wrap' + (hasResponsavel ? '' : ' is-empty') + '">' +
      '<select class="executor-inline-select" onchange="salvarResponsavelRapido(\'' + pendenciaId + '\', this.value, this)">' + options.join('') + '</select>' +
      '<span class="executor-inline-note executor-inline-note-placeholder" aria-hidden="true">&nbsp;</span>' +
    '</div>';
  }

  function renderDescricaoResumoCell_(item, options) {
    var opts = options || {};
    var limite = Number(opts.limite || 120);
    var descricao = safeTrim_(item.descricao);
    var preview = descricao ? truncateText_(descricao, limite) : 'Sem descricao registrada.';
    var precisaExpandir = descricao.length > limite;
    return '<div class="descricao-preview-cell">' +
      '<div class="descricao-preview-text">' + escapeHtml(preview) + '</div>' +
      '<div class="descricao-preview-actions">' +
        (precisaExpandir ? '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'descricao\')">Exibir mais</button>' : '') +
        '<button class="ghost-button compact-button text-action-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'observacao\')">Observacao</button>' +
      '</div>' +
    '</div>';
  }

  function renderHistoryStatusButton_(item) {
    var status = normalizeText_(item.status);
    var className = status === 'cancelado' ? 'ghost-button compact-button' : 'success-button compact-button';
    return '<button class="' + className + '" type="button">' + (status === 'cancelado' ? uiLabel_('Cancelado', 'Cancel.') : 'OK') + '</button>';
  }

  function renderDashboardStatusTag_(label) {
    var normalized = normalizeText_(label);
    var className = 'status-aberto';
    if (normalized === 'em andamento') {
      className = 'status-em-andamento';
    } else if (normalized === 'aguardando') {
      className = 'status-aguardando';
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
      { key: 'aguardando', label: 'Aguardando', value: data.aguardando || 0, className: 'waiting' },
      { key: 'emAndamento', label: 'Em andamento', value: data.emAndamento || 0, className: 'warning' },
      { key: 'concluidas', label: 'Concluidas', value: data.concluidas || 0, className: 'success' },
      { key: 'vencidas', label: 'Vencidas', value: data.vencidas || 0, className: 'danger' }
    ];
    getDashboardResponsavelCards_(data.porResponsavel).forEach(function(card) {
      cards.push(card);
    });
    cards.push({ key: 'total', label: 'Total geral', value: data.total || 0, className: '' });

    var cardsNode = document.getElementById('dashboardCards');
    if (cardsNode) {
      cardsNode.innerHTML = cards.map(function(card) {
        var isResponsavelCard = String(card.key || '').indexOf('responsavel:') === 0;
        var selectedClass = ((appState.dashboardSelection.type === 'metric' && appState.dashboardSelection.key === card.key) || (isResponsavelCard && appState.dashboardSelection.type === 'responsavel' && appState.dashboardSelection.key === card.responsavel)) ? ' selected' : '';
        return '<button class="metric-card ' + card.className + selectedClass + '" onclick="' + (isResponsavelCard ? ('abrirZoomResponsavel(\'' + escapeJs(card.responsavel) + '\', this)') : ('abrirZoomCard(\'' + card.key + '\', this)')) + '">' +
          '<span class="label">' + escapeHtml(card.label) + '</span>' +
          '<span class="value">' + escapeHtml(String(card.value)) + '</span>' +
        '</button>';
      }).join('');
    }

    document.getElementById('resumoPorLoja').innerHTML = renderSummaryList(data.porLoja, 'loja');
    document.getElementById('resumoPorSetor').innerHTML = renderSummaryList(data.porSetor, 'setor');
  }

  function getDashboardResponsavelCards_(collection) {
    return Object.keys(collection || {}).sort(function(a, b) {
      var diff = Number(collection[b] || 0) - Number(collection[a] || 0);
      if (diff !== 0) {
        return diff;
      }
      return String(a || '').localeCompare(String(b || ''), 'pt-BR');
    }).map(function(nome) {
      return {
        key: 'responsavel:' + nome,
        responsavel: nome,
        label: nome,
        value: Number(collection[nome] || 0),
        className: 'secondary'
      };
    });
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
    } else if (metricKey === 'aguardando') {
      title = 'Pendencias aguardando';
      description = 'Pendencias com prestador ou prazo, mas sem inicio efetivo.';
      items = ativos.filter(function(item) { return getDashboardDisplayStatus_(item) === 'Aguardando'; });
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

  function abrirZoomResponsavel(nome, buttonEl) {
    var ativos = getFilteredPendencias_(false);
    var items = ativos.filter(function(item) {
      return normalizeText_(item.responsavel || 'Nao definido') === normalizeText_(nome);
    });
    appState.dashboardSelection = {
      type: 'responsavel',
      key: nome
    };
    saveCache_();
    highlightDashboardSelection_(buttonEl, '.metric-card');
    openMetricZoom_(
      'Responsavel: ' + nome,
      'Pendencias ativas deste responsavel.',
      items,
      'responsavel',
      nome
    );
  }

  function fecharZoomCard() {
    document.getElementById('metricZoomModal').classList.add('hidden');
  }

  function renderSummaryList(collection, tipo) {
      var chartPlotHeight = 148;
      var chartAxisBase = 18;
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
      var mode = tipo === 'setor'
        ? 'list'
        : ((appState.dashboardChartMode && appState.dashboardChartMode[tipo]) || 'list');
      var series = getDashboardChartSeries_(tipo, orderedKeys, collection);
      var maxValue = Math.max.apply(null, series.map(function(item) { return Number(item.count || 0); }).concat([0]));
      if (mode === 'chart') {
        var axisSteps = getDashboardAxisSteps_(maxValue);
        return '<div class="summary-column-chart"><div class="summary-column-stage">' +
          axisSteps.map(function(step) {
            var bottom = chartAxisBase + (maxValue ? Math.round((step / maxValue) * chartPlotHeight) : 0);
            return '<span class="summary-column-y-label" style="bottom:' + bottom + 'px">' + step + '</span>' +
              '<span class="summary-column-grid-line" style="bottom:' + bottom + 'px"></span>';
          }).join('') +
          '<div class="summary-column-grid" style="grid-template-columns:repeat(' + series.length + ', minmax(0, 1fr));">' + series.map(function(item, index) {
            var count = Number(item.count || 0);
            var ratio = series.length === 1 ? 0 : index / Math.max(1, series.length - 1);
            var tone = getSummaryTone_(ratio);
            var height = maxValue ? Math.round((count / maxValue) * chartPlotHeight) : 0;
            var selectedClass = appState.dashboardSelection.type === tipo && appState.dashboardSelection.key === item.key ? ' selected' : '';
            if (tipo === 'loja') {
              return '<button class="summary-column-item glass-column-item' + selectedClass + '" onclick="abrirResumoAgrupado(\'' + tipo + '\', \'' + escapeJs(item.key) + '\', this)">' +
                '<span class="summary-column-value">' + count + '</span>' +
                '<span class="summary-column-bar-wrap"><span class="summary-column-bar-shell"><span class="summary-column-bar-fill-glass" style="height:' + height + 'px; background:linear-gradient(180deg, ' + tone.light + ' 0%, ' + tone.mid + ' 52%, ' + tone.dark + ' 100%)"></span></span></span>' +
                '<span class="summary-column-label">' + escapeHtml(item.label) + '</span>' +
              '</button>';
            }
            return '<button class="summary-column-item' + selectedClass + '" onclick="abrirResumoAgrupado(\'' + tipo + '\', \'' + escapeJs(item.key) + '\', this)">' +
              '<span class="summary-column-value">' + count + '</span>' +
              '<span class="summary-column-bar-wrap"><span class="summary-column-bar" style="height:' + Math.max(14, height) + 'px; background:linear-gradient(180deg, ' + tone.light + ' 0%, ' + tone.mid + ' 52%, ' + tone.dark + ' 100%)"></span></span>' +
              '<span class="summary-column-label">' + escapeHtml(item.label) + '</span>' +
            '</button>';
          }).join('') + '</div></div></div>';
    }
    return orderedKeys.map(function(key, index) {
      var count = Number(collection[key] || 0);
      var ratio = orderedKeys.length === 1 ? 0 : index / Math.max(1, orderedKeys.length - 1);
      var tone = getSummaryTone_(ratio);
      var width = maxValue ? Math.max(10, Math.round((count / maxValue) * 100)) : 10;
      var selectedClass = appState.dashboardSelection.type === tipo && appState.dashboardSelection.key === key ? ' selected' : '';
      return '<button class="summary-item clickable summary-bar-item' + selectedClass + '" style="background:' + tone.surface + '" onclick="abrirResumoAgrupado(\'' + tipo + '\', \'' + escapeJs(key) + '\', this)">' +
        '<div class="summary-bar-copy"><strong>' + escapeHtml(key) + '</strong></div>' +
        '<div class="summary-bar-track"><span class="summary-bar-fill" style="width:' + width + '%; background:linear-gradient(90deg, ' + tone.light + ' 0%, ' + tone.mid + ' 52%, ' + tone.dark + ' 100%)"></span></div>' +
        '<strong class="summary-bar-value">' + count + '</strong>' +
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
    var from = { r: 242, g: 100, b: 0 };
    var to = { r: 255, g: 196, b: 128 };
    var red = Math.round(from.r + (to.r - from.r) * ratio);
    var green = Math.round(from.g + (to.g - from.g) * ratio);
    var blue = Math.round(from.b + (to.b - from.b) * ratio);
    var lightRed = Math.min(255, red + 22);
    var lightGreen = Math.min(255, green + 18);
    var lightBlue = Math.min(255, blue + 14);
    var darkRed = Math.max(122, red - 18);
    var darkGreen = Math.max(52, green - 22);
    var darkBlue = Math.max(0, blue - 6);
    return {
      light: 'rgb(' + lightRed + ',' + lightGreen + ',' + lightBlue + ')',
      mid: 'rgb(' + red + ',' + green + ',' + blue + ')',
      dark: 'rgb(' + darkRed + ',' + darkGreen + ',' + darkBlue + ')',
      surface: 'rgba(' + red + ',' + green + ',' + blue + ',0.10)',
      start: 'rgb(' + red + ',' + green + ',' + blue + ')',
      end: 'rgb(' + lightRed + ',' + lightGreen + ',' + lightBlue + ')'
    };
  }

  function abrirResumoAgrupado(tipo, chave, buttonEl) {
    var ativos = getFilteredPendencias_(false);
    var items = ativos.filter(function(item) {
      if (tipo === 'loja') {
        return normalizeText_(item.loja) === normalizeText_(chave);
      }
      if (tipo === 'setor') {
        return normalizeText_(item.setor) === normalizeText_(chave);
      }
      return normalizeText_(item.responsavel || 'Nao definido') === normalizeText_(chave);
    });
    appState.dashboardSelection = {
      type: tipo,
      key: chave
    };
    saveCache_();
    highlightDashboardSelection_(buttonEl, '.summary-item.clickable, .summary-bar-item');
    openMetricZoom_(
      (tipo === 'loja' ? 'Loja: ' : tipo === 'setor' ? 'Setor: ' : 'Responsavel: ') + chave,
      tipo === 'loja' ? 'Pendencias ativas desta loja.' : (tipo === 'setor' ? 'Pendencias ativas deste setor por loja.' : 'Pendencias ativas deste responsavel.'),
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
        '<div class="muted-text">Responsavel: ' + escapeHtml(item.responsavel || 'Nao definido') + ' | Executor: ' + escapeHtml(item.executor || 'Nao definido') + '</div>' +
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
      filterStatus: '',
      filterResponsavel: ''
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
    var responsaveis = uniqueSorted_(items.map(function(item) { return item.responsavel || 'Nao definido'; }).filter(Boolean));
    var statusList = uniqueSorted_(items.map(function(item) {
      return getDashboardDisplayStatus_(item);
    }).filter(Boolean));
    preencherSelect('metricZoomFiltroLoja', lojas, 'Todas as lojas', true);
    preencherSelect('metricZoomFiltroSetor', setores, 'Todos os setores', true);
    preencherSelect('metricZoomFiltroStatus', statusList, 'Todos os status', true);
    preencherSelect('metricZoomFiltroResponsavel', responsaveis, 'Todos os responsaveis', true);
    document.getElementById('metricZoomLojaWrap').classList.toggle('hidden', appState.zoomContext.anchorType === 'loja');
    document.getElementById('metricZoomSetorWrap').classList.toggle('hidden', appState.zoomContext.anchorType === 'setor');
    document.getElementById('metricZoomStatusWrap').classList.toggle('hidden', appState.zoomContext.anchorType === 'metric');
    document.getElementById('metricZoomResponsavelWrap').classList.toggle('hidden', appState.zoomContext.anchorType === 'responsavel');
    document.getElementById('metricZoomFiltroLoja').value = appState.zoomContext.filterLoja || '';
    document.getElementById('metricZoomFiltroSetor').value = appState.zoomContext.filterSetor || '';
    document.getElementById('metricZoomFiltroStatus').value = appState.zoomContext.filterStatus || '';
    document.getElementById('metricZoomFiltroResponsavel').value = appState.zoomContext.filterResponsavel || '';
  }

  function aplicarFiltrosZoom() {
    if (!appState.zoomContext) {
      return;
    }
    appState.zoomContext.filterLoja = getElementValue_('metricZoomFiltroLoja');
    appState.zoomContext.filterSetor = getElementValue_('metricZoomFiltroSetor');
    appState.zoomContext.filterStatus = getElementValue_('metricZoomFiltroStatus');
    appState.zoomContext.filterResponsavel = getElementValue_('metricZoomFiltroResponsavel');
    var items = (appState.zoomContext.items || []).filter(function(item) {
      if (appState.zoomContext.filterLoja && normalizeText_(item.loja) !== normalizeText_(appState.zoomContext.filterLoja)) {
        return false;
      }
      if (appState.zoomContext.filterSetor && normalizeText_(item.setor) !== normalizeText_(appState.zoomContext.filterSetor)) {
        return false;
      }
      if (appState.zoomContext.filterResponsavel && normalizeText_(item.responsavel || 'Nao definido') !== normalizeText_(appState.zoomContext.filterResponsavel)) {
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

  function sanitizeOrcamentoSelection_() {
    var validIds = {};
    appState.allPendencias.forEach(function(item) {
      if (isPendenciaOrcavel_(item)) {
        validIds[item.id_pendencia] = true;
      }
    });
    appState.selectedOrcamentoIds = (appState.selectedOrcamentoIds || []).filter(function(id) {
      return !!validIds[id];
    });
  }

  function isPendenciaOrcavel_(item) {
    return !!(item && item.id_pendencia && !safeTrim_(item.id_orcamento_ativo));
  }

  function isPendenciaSelecionadaParaOrcamento_(id) {
    return (appState.selectedOrcamentoIds || []).indexOf(id) > -1;
  }

  function renderControleOrcamento_(item, compact) {
    var orcavel = isPendenciaOrcavel_(item);
    var selecionada = isPendenciaSelecionadaParaOrcamento_(item && item.id_pendencia);
    if (!orcavel) {
      return '<button class="danger-button compact-button orcamento-pdf-button" type="button" title="Abrir PDF do orcamento" onclick="abrirPdfOrcamentoExistente(\'' + escapeJs(item.id_orcamento_ativo) + '\')">PDF</button>';
    }
    return '<input class="orcamento-select-input" type="checkbox" ' + (selecionada ? 'checked ' : '') + 'title="Selecionar para orcamento" onclick="toggleSelecaoOrcamento(\'' + escapeJs(item.id_pendencia) + '\')">';
  }

  function toggleSelecaoOrcamento(id) {
    if (!id) {
      return;
    }
    var item = getLocalItemById_(id);
    if (!isPendenciaOrcavel_(item)) {
      mostrarMensagemErro('Esta pendencia ja possui um orcamento ativo.');
      renderPendencias(getVisibleWorklistItems_());
      return;
    }
    sanitizeOrcamentoSelection_();
    var selected = appState.selectedOrcamentoIds || [];
    var index = selected.indexOf(id);
    if (index === -1) {
      selected.push(id);
    } else {
      selected.splice(index, 1);
    }
    appState.selectedOrcamentoIds = selected;
    saveCache_();
    renderPendencias(getVisibleWorklistItems_());
  }

  function toggleSelecaoPendenciasVisiveis(checked) {
    var visiveis = getVisibleWorklistItems_().filter(isPendenciaOrcavel_);
    var map = {};
    (appState.selectedOrcamentoIds || []).forEach(function(id) {
      map[id] = true;
    });
    visiveis.forEach(function(item) {
      if (checked) {
        map[item.id_pendencia] = true;
      } else {
        delete map[item.id_pendencia];
      }
    });
    appState.selectedOrcamentoIds = Object.keys(map);
    saveCache_();
    renderPendencias(getVisibleWorklistItems_());
  }

  function selecionarPendenciasFiltradas() {
    appState.selectedOrcamentoIds = getVisibleWorklistItems_()
      .filter(isPendenciaOrcavel_)
      .map(function(item) { return item.id_pendencia; });
    saveCache_();
    renderPendencias(getVisibleWorklistItems_());
  }

  function limparSelecaoOrcamento() {
    appState.selectedOrcamentoIds = [];
    saveCache_();
    renderPendencias(getVisibleWorklistItems_());
  }

  function getSelectedPendenciasParaOrcamento_() {
    sanitizeOrcamentoSelection_();
    var map = {};
    appState.allPendencias.forEach(function(item) {
      map[item.id_pendencia] = item;
    });
    return (appState.selectedOrcamentoIds || []).map(function(id) {
      return map[id];
    }).filter(Boolean);
  }

  function updateOrcamentoToolbar_() {
    var toolbar = document.getElementById('orcamentoToolbar');
    var text = document.getElementById('orcamentoToolbarText');
    if (!toolbar || !text) {
      return;
    }
    sanitizeOrcamentoSelection_();
    var selectedCount = (appState.selectedOrcamentoIds || []).length;
    toolbar.classList.toggle('hidden', selectedCount === 0);
    if (selectedCount) {
      text.textContent = selectedCount + ' pendencia' + (selectedCount > 1 ? 's' : '') + ' selecionada' + (selectedCount > 1 ? 's' : '') + ' para o orcamento.';
    } else {
      text.textContent = 'Marque uma ou mais pendencias para gerar um orcamento em lote.';
    }
    renderSectionInsights_();
  }

  function renderWorkflowChip_(meta) {
    if (!meta) {
      return '';
    }
    return '<span class="workflow-chip ' + escapeHtml(meta.toneClass || 'neutral') + '">' + escapeHtml(meta.healthLabel || 'Em fluxo') + '</span>';
  }

  function buildPlanningPayloadFromAction_(snapshot, actionKey) {
    var today = toInputDate_(new Date());
    var slaDays = getPrioritySlaDaysLocal_((snapshot && snapshot.prioridade) || 'Media');
    var startDate = normalizeDateForInputValue_(snapshot && snapshot.data_inicio);
    if (actionKey === 'clear') {
      return {
        data_inicio: '',
        previsao_entrega: ''
      };
    }
    if (actionKey === 'today') {
      return {
        data_inicio: today,
        previsao_entrega: addDaysToInputDate_(today, slaDays)
      };
    }
    if (actionKey === 'tomorrow') {
      var tomorrow = addDaysToInputDate_(today, 1);
      return {
        data_inicio: tomorrow,
        previsao_entrega: addDaysToInputDate_(tomorrow, slaDays)
      };
    }
    return {
      data_inicio: startDate || '',
      previsao_entrega: addDaysToInputDate_(startDate || today, slaDays)
    };
  }

  function aplicarPlanejamentoFormulario_(mode, actionKey) {
    var isEdit = mode === 'edit';
    var prefix = isEdit ? 'edit' : 'nova';
    var snapshot = {
      prioridade: getElementValue_(isEdit ? 'editPrioridade' : 'novaPrioridade'),
      executor: getElementValue_(isEdit ? 'editExecutor' : 'novoExecutor'),
      data_inicio: getElementValue_(isEdit ? 'editDataInicio' : 'novaDataInicio'),
      previsao_entrega: getElementValue_(isEdit ? 'editPrevisaoEntrega' : 'novaPrevisaoEntrega'),
      status: isEdit ? getElementValue_('editStatus') : ''
    };
    var payload = buildPlanningPayloadFromAction_(snapshot, actionKey);
    setElementValueIfExists_(prefix + 'DataInicio', payload.data_inicio || '');
    setElementValueIfExists_(prefix + 'PrevisaoEntrega', payload.previsao_entrega || '');
    if (isEdit) {
      if (actionKey === 'today') {
        setElementValueIfExists_('editStatus', 'Em andamento');
      } else if (actionKey !== 'clear' && snapshot.executor && !getElementValue_('editStatus')) {
        setElementValueIfExists_('editStatus', 'Aguardando');
      }
      renderEditGuidance_();
    }
    updateFormPlanningHint_(mode);
  }

  function updateFormPlanningHint_(mode) {
    var targetId = mode === 'edit' ? 'editPlanningHint' : 'novaPlanningHint';
    var host = document.getElementById(targetId);
    if (!host) {
      return;
    }
    var isEdit = mode === 'edit';
    var snapshot = {
      prioridade: getElementValue_(isEdit ? 'editPrioridade' : 'novaPrioridade') || 'Media',
      executor: getElementValue_(isEdit ? 'editExecutor' : 'novoExecutor'),
      data_inicio: getElementValue_(isEdit ? 'editDataInicio' : 'novaDataInicio'),
      previsao_entrega: getElementValue_(isEdit ? 'editPrevisaoEntrega' : 'novaPrevisaoEntrega'),
      status: isEdit ? getElementValue_('editStatus') : ''
    };
    var preview = {
      status: snapshot.status || '',
      prioridade: snapshot.prioridade,
      executor: snapshot.executor,
      data_inicio: snapshot.data_inicio,
      previsao_entrega: snapshot.previsao_entrega
    };
    applyWorkflowHeuristicsLocal_(preview, snapshot, isEdit ? 'edit' : 'create');
    var meta = getPendenciaWorkflowMeta_(preview);
    host.innerHTML = '<strong>Fluxo sugerido:</strong> ao salvar agora, a pendencia tende a ficar como <strong>' +
      escapeHtml(preview.status || 'Aberto') + '</strong>.' +
      ' ' + escapeHtml(meta.dueLabel) +
      ' ' + escapeHtml(meta.nextAction);
  }

  function renderPendenciaQuickPlanningButtons_(item) {
    var meta = getPendenciaWorkflowMeta_(item);
    var buttons = [];
    if (meta.canStartToday) {
      buttons.push('<button class="ghost-button compact-button" type="button" onclick="aplicarPlanejamentoRapidoPendencia(\'' + escapeJs(item.id_pendencia) + '\', \'today\')">Iniciar hoje</button>');
    }
    if (meta.canSuggestDue) {
      buttons.push('<button class="warning-button compact-button" type="button" onclick="aplicarPlanejamentoRapidoPendencia(\'' + escapeJs(item.id_pendencia) + '\', \'suggested\')">Prazo sugerido</button>');
    }
    return buttons.length ? ('<div class="card-inline-actions">' + buttons.join('') + '</div>') : '';
  }

  function aplicarPlanejamentoRapidoPendencia(id, actionKey) {
    var item = getLocalItemById_(id);
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    var payload = buildPlanningPayloadFromAction_(item, actionKey);
    if (actionKey === 'today') {
      payload.status = 'Em andamento';
    }
    if (!appState.connection.online) {
      atualizarPendenciaOffline_(id, payload, 'update');
      return;
    }
    mostrarLoading();
    serverCall_('atualizarPendencia', [resolveRemoteId_(id), payload])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
        }
        rerenderViewsAfterPendenciaUpdate_(id);
        mostrarMensagemSucesso(actionKey === 'today' ? 'Planejamento atualizado com inicio hoje.' : 'Prazo sugerido aplicado com sucesso.');
      })
      .catch(handleFailure);
  }

  function renderEditGuidance_() {
    var host = document.getElementById('editGuidancePanel');
    if (!host) {
      return;
    }
    var id = getElementValue_('editIdPendencia');
    if (!id) {
      host.innerHTML = '<div class="muted-text">Abra uma pendencia na tela de edicao para ver a proxima acao sugerida.</div>';
      return;
    }
    var baseItem = buildDetailFromLocalItem_(getLocalItemById_(id)) || {};
    var preview = deepClone_(baseItem);
    preview.executor = getElementValue_('editExecutor');
    preview.responsavel = getElementValue_('editResponsavel');
    preview.status = getElementValue_('editStatus');
    preview.data_inicio = getElementValue_('editDataInicio');
    preview.previsao_entrega = getElementValue_('editPrevisaoEntrega');
    preview.prioridade = getElementValue_('editPrioridade');
    applyWorkflowHeuristicsLocal_(preview, {
      executor: preview.executor,
      responsavel: preview.responsavel,
      status: preview.status,
      data_inicio: preview.data_inicio,
      previsao_entrega: preview.previsao_entrega,
      prioridade: preview.prioridade
    }, 'edit');
    var meta = getPendenciaWorkflowMeta_(preview);
    host.innerHTML =
      '<div class="panel-title-row">' +
        '<h3>Proxima acao sugerida</h3>' +
        renderWorkflowChip_(meta) +
      '</div>' +
      '<div class="workflow-summary">' +
        '<span class="workflow-summary-label">Antes de salvar</span>' +
        '<strong>' + escapeHtml(meta.nextAction) + '</strong>' +
        '<span class="workflow-summary-copy">' + escapeHtml(meta.contextLine) + '</span>' +
      '</div>';
  }

  function renderPendencias(items) {
    var cardsEl = document.getElementById('listaPendenciasCards');
    var tableEl = document.getElementById('listaPendenciasTabela');
    if (!items.length) {
      cardsEl.innerHTML = buildPendenciasEmptyState_();
      tableEl.innerHTML = '<tr><td colspan="11" class="empty-state">Nenhuma pendencia ativa encontrada.</td></tr>';
      updateOrcamentoToolbar_();
      renderSectionInsights_();
      return;
    }

    cardsEl.innerHTML = items.map(function(item) {
      var orcavel = isPendenciaOrcavel_(item);
      var selecionada = isPendenciaSelecionadaParaOrcamento_(item.id_pendencia);
      var orcamentoInfo = safeTrim_(item.id_orcamento_ativo)
        ? '<div class="muted-text">Orcamento ativo: ' + escapeHtml(item.id_orcamento_ativo) + ' | ' + escapeHtml(renderOrcamentoValorResumo_(item.valor_orcamento_ativo)) + '</div>'
        : '';
      var controleOrcamento = orcavel
        ? '<label class="orcamento-select-wrap">' +
            renderControleOrcamento_(item, false) +
            '<span>Orc.</span>' +
          '</label>'
        : renderControleOrcamento_(item, false);
      return '<article class="pendencia-card' + (selecionada ? ' pendencia-card-selected' : '') + '">' +
        '<div class="pendencia-card-head">' +
          '<div><h3>' + escapeHtml(item.id_pendencia) + '</h3><p>' + escapeHtml(item.loja) + ' | ' + renderSetorBadge_(item.setor || '-', 'setor-badge-inline') + '</p></div>' +
          controleOrcamento +
        '</div>' +
        '<div class="card-meta">' +
          renderTag('status', item.status) +
        '</div>' +
        '<div class="card-kv-grid">' +
          cardKv_('Local', escapeHtml(item.loja || '-')) +
          cardKv_('Setor', renderSetorBadge_(item.setor || '-')) +
          cardKv_('Descricao', renderDescricaoResumoCell_(item, { limite: 100 })) +
          cardKv_('Responsavel', renderResponsavelSelect_(item)) +
          cardKv_('Executor', renderExecutorSelect_(item)) +
        '</div>' +
        orcamentoInfo +
        (item._syncStatus ? '<div class="muted-text">Sync: pendente</div>' : '') +
        '<div class="actions-row">' +
          '<button class="id-button compact-button" onclick="mostrarIdPendencia(\'' + escapeJs(item.id_pendencia) + '\')">ID</button>' +
          '<button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Detalhes', 'Detal.') + '</button>' +
          '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Editar', 'Edit.') + '</button>' +
          '<button class="success-button compact-button" onclick="concluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">OK</button>' +
          ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '') +
          '<button class="icon-button" onclick="excluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button>' +
        '</div>' +
      '</article>';
    }).join('');

    tableEl.innerHTML = items.map(function(item) {
      var selecionada = isPendenciaSelecionadaParaOrcamento_(item.id_pendencia);
      return '<tr class="' + (selecionada ? 'row-selected' : '') + '">' +
        '<td>' + renderControleOrcamento_(item, true) + '</td>' +
        '<td><button class="success-button compact-button" onclick="concluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">OK</button></td>' +
        '<td><button class="id-button compact-button" onclick="mostrarIdPendencia(\'' + escapeJs(item.id_pendencia) + '\')">ID</button></td>' +
        '<td>' + escapeHtml(item.loja || '-') + '</td>' +
        '<td>' + escapeHtml(item.setor || '-') + '</td>' +
        '<td>' + renderDescricaoResumoCell_(item, { limite: 130 }) + '</td>' +
        '<td>' + renderResponsavelSelect_(item) + '</td>' +
        '<td>' + renderExecutorSelect_(item) + '</td>' +
        '<td><div class="table-actions">' +
          '<button class="warning-button compact-button" onclick="abrirDetalhesPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Detalhes', 'Detal.') + '</button>' +
          '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">' + uiLabel_('Editar', 'Edit.') + '</button>' +
        '</div></td>' +
        '<td>' + ((item.id_arquivo_drive || item.foto_preview) ? '<button class="clip-button" onclick="abrirFotoRapida(\'' + escapeJs(item.id_pendencia) + '\')">&#128206;</button>' : '<span class="clip-placeholder"></span>') + '</td>' +
        '<td><button class="icon-button" onclick="excluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button></td>' +
      '</tr>';
    }).join('');
    updateOrcamentoToolbar_();
    renderSectionInsights_();
  }

  function renderHistoricoGeral(items) {
    var container = document.getElementById('historicoListaCards');
    var tableEl = document.getElementById('historicoPendenciasTabela');
    if (!items.length) {
      container.innerHTML = buildHistoricoEmptyState_();
      if (tableEl) {
        tableEl.innerHTML = '<tr><td colspan="10" class="empty-state">Nenhuma pendencia concluida ou cancelada.</td></tr>';
      }
      renderSectionInsights_();
      return;
    }
    container.innerHTML = items.map(function(item) {
      return '<article class="pendencia-card">' +
        '<div><h3>' + escapeHtml(item.id_pendencia) + '</h3><p>' + escapeHtml(item.loja) + ' | ' + renderSetorBadge_(item.setor || '-', 'setor-badge-inline') + '</p></div>' +
        '<div class="card-meta">' + renderTag('status', item.status) + '</div>' +
        '<div class="card-kv-grid">' +
          cardKv_('Conclusao', escapeHtml(item.data_conclusao_label || formatDateBr(item.data_conclusao) || '-')) +
          cardKv_('Executor', escapeHtml(item.executor || 'Nao definido')) +
          cardKv_('Descricao', renderDescricaoResumoCell_(item, { limite: 100 })) +
          cardKv_('Local', escapeHtml(item.loja || '-') + '<br>' + renderSetorBadge_(item.setor || '-')) +
        '</div>' +
        (item._syncStatus ? '<div class="muted-text">Sync: pendente</div>' : '') +
        '<div class="actions-row">' +
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
          '<td>' + renderDescricaoResumoCell_(item, { limite: 130 }) + '</td>' +
          '<td>' + escapeHtml(item.responsavel || '-') + '</td>' +
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
    renderSectionInsights_();
  }

  function abrirOrcamentoModal() {
    var selecionadas = getSelectedPendenciasParaOrcamento_();
    if (!selecionadas.length) {
      mostrarMensagemErro('Selecione ao menos uma pendencia para gerar o orcamento.');
      return;
    }
    var prestadores = uniqueSorted_(selecionadas.map(function(item) {
      return item.executor || '';
    }).filter(Boolean));
    var resumo = selecionadas.slice(0, 6).map(function(item) {
      return escapeHtml((item.loja || '-') + ' / ' + (item.setor || '-'));
    }).join('<br>');
    document.getElementById('orcamentoResumoSelecao').innerHTML =
      '<strong>' + selecionadas.length + ' servico' + (selecionadas.length > 1 ? 's' : '') + ' selecionado' + (selecionadas.length > 1 ? 's' : '') + '</strong>' +
      (resumo ? '<div class="summary-item-sub">' + resumo + (selecionadas.length > 6 ? '<br>...' : '') + '</div>' : '');
    document.getElementById('orcamentoData').value = toInputDate_(new Date());
    document.getElementById('orcamentoValor').value = '';
    document.getElementById('orcamentoObservacao').value = '';
    document.getElementById('orcamentoPrestador').value = prestadores.length === 1 ? prestadores[0] : '';
    preencherItensOrcamentoModal_(selecionadas);
    document.getElementById('orcamentoModal').classList.remove('hidden');
  }

  function fecharOrcamentoModal() {
    document.getElementById('orcamentoModal').classList.add('hidden');
  }

  function preencherItensOrcamentoModal_(selecionadas) {
    var host = document.getElementById('orcamentoItensEditor');
    if (!host) {
      return;
    }
    host.innerHTML = (selecionadas || []).map(function(item, index) {
      var titulo = [item.loja || '-', item.setor || '-', item.tipo || '-'].join(' | ');
      var subtitulo = [
        item.prioridade ? ('Prioridade: ' + item.prioridade) : '',
        item.previsao_entrega ? ('Previsao: ' + formatDateBr(item.previsao_entrega)) : ''
      ].filter(Boolean).join(' | ');
      var descricao = safeTrim_(item.descricao) || 'Sem descricao informada.';
      return '<div class="orcamento-item-editor">' +
        '<div class="orcamento-item-editor-main">' +
          '<div class="orcamento-item-editor-copy">' +
            '<strong><span class="item-index-badge">' + String(index + 1).padStart(2, '0') + '</span> ' + escapeHtml(titulo) + '</strong>' +
            '<span>' + escapeHtml(subtitulo || 'Valor opcional por servico.') + '</span>' +
            '<small class="orcamento-item-editor-desc">' + escapeHtml(descricao) + '</small>' +
          '</div>' +
          '<label class="orcamento-item-editor-value">' +
            '<span>Valor</span>' +
            '<input class="orcamento-item-valor-input" data-id="' + escapeHtml(item.id_pendencia) + '" type="text" inputmode="decimal" placeholder="0,00" oninput="atualizarTotalOrcamentoModal()" onblur="formatarValorOrcamentoItemInput(this)">' +
          '</label>' +
        '</div>' +
      '</div>';
    }).join('');
    atualizarTotalOrcamentoModal();
  }

  function formatarValorOrcamentoItemInput(input) {
    if (!input) {
      return;
    }
    var valor = parseCurrencyValueClient_(input.value);
    input.value = isFinite(valor) && valor >= 0 ? formatCurrencyBrClient_(valor).replace(/^R\$\s?/, '') : '';
    atualizarTotalOrcamentoModal();
  }

  function formatarValorOrcamentoTotalInput(input) {
    if (!input) {
      return;
    }
    var valor = parseCurrencyValueClient_(input.value);
    input.value = safeTrim_(input.value) && isFinite(valor) && valor >= 0
      ? formatCurrencyBrClient_(valor).replace(/^R\$\s?/, '')
      : '';
  }

  function atualizarTotalOrcamentoModal() {
    var totalNode = document.getElementById('orcamentoValorTotalDisplay');
    if (!totalNode) {
      return;
    }
    var total = coletarItensOrcamentoFormulario_().reduce(function(sum, item) {
      var valor = parseCurrencyValueClient_(item.valor);
      return sum + (isFinite(valor) ? valor : 0);
    }, 0);
    totalNode.textContent = formatCurrencyBrClient_(total);
  }

  function coletarItensOrcamentoFormulario_() {
    return Array.from(document.querySelectorAll('#orcamentoItensEditor .orcamento-item-valor-input')).map(function(input) {
      return {
        id_pendencia: input.getAttribute('data-id') || '',
        valor: input.value || ''
      };
    });
  }

  function confirmarOrcamentoPendencias() {
    if (!appState.connection.online) {
      mostrarMensagemErro('A criacao do orcamento precisa de internet.');
      return;
    }
    var selecionadas = getSelectedPendenciasParaOrcamento_();
    if (!selecionadas.length) {
      mostrarMensagemErro('Selecione ao menos uma pendencia para gerar o orcamento.');
      return;
    }
    var payload = {
      pendenciaIds: selecionadas.map(function(item) { return item.id_pendencia; }),
      prestador: getElementValue_('orcamentoPrestador'),
      data_orcamento: getElementValue_('orcamentoData'),
      observacao: getElementValue_('orcamentoObservacao'),
      valor_total: getElementValue_('orcamentoValor'),
      itens: coletarItensOrcamentoFormulario_()
    };
    if (!payload.prestador) {
      mostrarMensagemErro('Selecione o prestador do orcamento.');
      return;
    }
    if (!payload.data_orcamento) {
      mostrarMensagemErro('Informe a data do orcamento.');
      return;
    }
    var itensInvalidos = payload.itens.filter(function(item) {
      if (!safeTrim_(item.valor)) {
        return false;
      }
      var valor = parseCurrencyValueClient_(item.valor);
      return !item.id_pendencia || !isFinite(valor) || valor < 0;
    });
    if (itensInvalidos.length) {
      mostrarMensagemErro('Informe um valor valido para cada servico selecionado.');
      return;
    }
    if (safeTrim_(payload.valor_total)) {
      var valorTotal = parseCurrencyValueClient_(payload.valor_total);
      if (!isFinite(valorTotal) || valorTotal < 0) {
        mostrarMensagemErro('Informe um valor total valido para o orcamento.');
        return;
      }
    }

    mostrarLoading();
    serverCall_('criarOrcamentoPendencias', [payload])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        fecharOrcamentoModal();
        limparSelecaoOrcamento();
        var pdfPayload = response.data && response.data.pdf;
        var message = response.message || 'Orcamento salvo com sucesso.';
        carregarEstadoServidor_()
          .catch(function() {})
          .then(function() {
            mostrarMensagemSucesso(message);
            if (pdfPayload) {
              abrirPdfOrcamento_(pdfPayload);
            }
          });
      })
      .catch(handleFailure);
  }

  function abrirPdfOrcamento_(payload) {
    if (!payload || !(payload.openUrl || payload.url || payload.downloadUrl)) {
      throw new Error('Arquivo PDF do orcamento invalido.');
    }
    abrirPdfExterno_(payload.openUrl || payload.url || payload.downloadUrl, payload.fileName || 'orcamento.pdf');
  }

  function abrirPdfExterno_(url, fileName) {
    if (!url) {
      throw new Error('Link do PDF invalido.');
    }
    if (hasNativeBridgeMethod_('openExternalLink')) {
      try {
        getNativeBridge_().openExternalLink(url, fileName || 'arquivo.pdf');
        return;
      } catch (error) {}
    }
    var anchor = document.createElement('a');
    anchor.href = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(function() {
      if (anchor.parentNode) {
        anchor.parentNode.removeChild(anchor);
      }
    }, 600);
  }

  function renderHistoryTimeline_(historyItems) {
    var items = Array.isArray(historyItems) ? historyItems : [];
    if (!items.length) {
      return '<div class="empty-state">Nenhum evento de historico registrado para esta pendencia.</div>';
    }
    return items.slice(0, 8).map(function(entry) {
      var fromStatus = safeTrim_(entry.status_anterior) ? ('De ' + entry.status_anterior) : 'Criacao';
      var toStatus = safeTrim_(entry.status_novo) ? ('Para ' + entry.status_novo) : 'Atualizacao';
      return '<article class="history-timeline-item">' +
        '<div class="history-timeline-head">' +
          renderWorkflowChip_({
            toneClass: normalizeText_(entry.status_novo) === 'concluido' ? 'success' : (normalizeText_(entry.status_novo) === 'cancelado' ? 'neutral' : 'info'),
            healthLabel: fromStatus + ' -> ' + toStatus
          }) +
          '<span class="history-timeline-meta">' + escapeHtml(joinDateAndTime_(entry.data_label || entry.data, entry.hora)) + ' | ' + escapeHtml(entry.usuario || '-') + '</span>' +
        '</div>' +
        '<div class="history-timeline-text">' + escapeHtml(entry.observacao || 'Sem observacao registrada.') + '</div>' +
      '</article>';
    }).join('');
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
          detailsRow_('Solicitante / Responsavel / Executor', groupedDetail_([
            { label: 'Solicitante', value: displaySolicitante_(item.solicitante) || '-' },
            { label: 'Responsavel', value: item.responsavel || '-' },
            { label: 'Executor', value: item.executor || '-' }
          ])) +
          detailsRow_('Datas', groupedDetail_([
            { label: 'Abertura', value: joinDateAndTime_(item.data_abertura, item.hora_abertura) },
            { label: 'Inicio', value: formatDateBr(item.data_inicio) || '-' },
            { label: 'Previsao', value: formatDateBr(item.previsao_entrega) || '-' },
            { label: 'Conclusao', value: joinDateAndTime_(item.data_conclusao, item.hora_conclusao) }
          ])) +
          detailsRow_('Orcamento ativo', renderOrcamentoAtivoInfo_(item)) +
          detailsRow_('Textos', renderEditableTextDetails_(item)) +
          detailsRow_('Acoes', '<span class="details-table-title">Acoes da pendencia</span><div class="details-table-actions">' +
            '<button class="success-button compact-button" onclick="concluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Concluido</button>' +
            '<button class="warning-button compact-button" onclick="editarPendencia(\'' + escapeJs(item.id_pendencia) + '\')">Editar</button>' +
            anexoButton +
            '<button class="icon-button" onclick="excluirPendencia(\'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button>' +
          '</div>') +
        '</tbody>' +
      '</table>' +
      '<div class="panel">' +
        '<div class="panel-title-row">' +
          '<h3>Historico recente</h3>' +
          '<span class="muted-text">' + escapeHtml(String((item.historico || []).length)) + ' evento' + ((item.historico || []).length > 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div class="history-timeline">' + renderHistoryTimeline_(item.historico || []) + '</div>' +
      '</div>' +
    '</div>';
    document.getElementById('detalhesPendencia').innerHTML = html;
  }

  function renderEditableTextDetails_(item) {
    return '<div class="detail-text-grid">' +
      renderEditableTextCard_(item, 'descricao', 'Descricao', item.descricao || 'Sem descricao.') +
      renderEditableTextCard_(item, 'observacao', 'Observacao', safeTrim_(item.observacao) || 'Nao ha observacao registrada para esta pendencia.') +
    '</div>';
  }

  function renderEditableTextCard_(item, campo, titulo, valor) {
    return '<div class="detail-text-card">' +
      '<div class="detail-text-card-header">' +
        '<strong>' + escapeHtml(titulo) + '</strong>' +
        '<div class="details-inline-actions table-actions">' +
          '<button class="ghost-button compact-button" onclick="abrirTextoRapido(\'' + escapeJs(item.id_pendencia) + '\', \'' + escapeJs(campo) + '\')">Ver</button>' +
          '<button class="warning-button compact-button" onclick="abrirEditorTextoPendencia(\'' + escapeJs(item.id_pendencia) + '\', \'' + escapeJs(campo) + '\')">Editar</button>' +
        '</div>' +
      '</div>' +
      '<div class="detail-text-value">' + escapeHtml(valor).replace(/\n/g, '<br>') + '</div>' +
    '</div>';
  }

  function renderOrcamentoAtivoInfo_(item) {
    if (!safeTrim_(item.id_orcamento_ativo)) {
      return '<span class="muted-text">Sem orcamento vinculado.</span>';
    }
    return groupedDetail_([
      { label: 'ID', value: item.id_orcamento_ativo || '-' },
      { label: 'Prestador', value: item.prestador_orcamento_ativo || '-' },
      { label: 'Data', value: formatDateBr(item.data_orcamento_ativo) || '-' },
      { label: 'Valor', value: renderOrcamentoValorResumo_(item.valor_orcamento_ativo) }
    ]) + '<div class="actions-row details-inline-actions">' +
      '<button class="danger-button compact-button" onclick="abrirPdfOrcamentoExistente(\'' + escapeJs(item.id_orcamento_ativo) + '\')">PDF orcamento</button>' +
      '<button class="icon-button" type="button" title="Excluir orcamento" onclick="excluirOrcamentoAtivo(\'' + escapeJs(item.id_orcamento_ativo) + '\', \'' + escapeJs(item.id_pendencia) + '\')">&#128465;</button>' +
    '</div>';
  }

  function renderOrcamentoValorResumo_(value) {
    return safeTrim_(value) ? formatCurrencyBrClient_(value) : '-';
  }

  function abrirPdfOrcamentoExistente(idOrcamento) {
    if (!idOrcamento) {
      mostrarMensagemErro('Orcamento nao encontrado.');
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('A abertura do PDF do orcamento precisa de internet.');
      return;
    }
    mostrarLoading();
    serverCall_('gerarPdfOrcamento', [idOrcamento])
      .then(function(response) {
        ocultarLoading();
        if (!response.success) {
          mostrarMensagemErro(response.message);
          return;
        }
        abrirPdfOrcamento_(response.data);
      })
      .catch(handleFailure);
  }

  function excluirOrcamentoAtivo(idOrcamento, pendenciaId) {
    if (!idOrcamento) {
      mostrarMensagemErro('Orcamento nao encontrado.');
      return;
    }
    if (!appState.connection.online) {
      mostrarMensagemErro('A exclusao do orcamento precisa de internet.');
      return;
    }
    if (!window.confirm('Deseja excluir este orcamento e desvincular as pendencias relacionadas?')) {
      return;
    }
    mostrarLoading();
    serverCall_('excluirOrcamento', [idOrcamento])
      .then(function(response) {
        if (!response.success) {
          ocultarLoading();
          mostrarMensagemErro(response.message);
          return;
        }
        return carregarEstadoServidor_()
          .then(function() {
            ocultarLoading();
            if (pendenciaId) {
              abrirDetalhesPendencia(pendenciaId);
            }
            mostrarMensagemSucesso(response.message || 'Orcamento excluido com sucesso.');
          })
          .catch(function() {
            ocultarLoading();
            if (pendenciaId) {
              abrirDetalhesPendencia(pendenciaId);
            }
            mostrarMensagemSucesso(response.message || 'Orcamento excluido com sucesso.');
          });
      })
      .catch(handleFailure);
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

  function abrirEditorTextoPendencia(id, campo) {
    var item = buildDetailFromLocalItem_(getLocalItemById_(id));
    if (!item) {
      mostrarMensagemErro('Pendencia nao encontrada.');
      return;
    }
    var titulo = campo === 'observacao' ? 'Editar observacao' : 'Editar descricao';
    var descricao = campo === 'observacao'
      ? 'Atualize a observacao vinculada a esta pendencia.'
      : 'Atualize a descricao principal desta pendencia.';
    var valor = campo === 'observacao' ? (item.observacao || '') : (item.descricao || '');
    document.getElementById('textEditorPendenciaId').value = item.id_pendencia;
    document.getElementById('textEditorCampo').value = campo;
    document.getElementById('textEditorTitle').textContent = titulo;
    document.getElementById('textEditorDescription').textContent = descricao;
    document.getElementById('textEditorValue').value = valor;
    document.getElementById('textEditorModal').classList.remove('hidden');
  }

  function fecharEditorTextoPendencia() {
    var modal = document.getElementById('textEditorModal');
    if (!modal) {
      return;
    }
    modal.classList.add('hidden');
    document.getElementById('textEditorPendenciaId').value = '';
    document.getElementById('textEditorCampo').value = '';
    document.getElementById('textEditorValue').value = '';
  }

  function salvarTextoPendenciaDetalhes() {
    var id = document.getElementById('textEditorPendenciaId').value;
    var campo = document.getElementById('textEditorCampo').value;
    var valor = document.getElementById('textEditorValue').value;
    if (!id || (campo !== 'descricao' && campo !== 'observacao')) {
      mostrarMensagemErro('Nao foi possivel identificar o texto a ser atualizado.');
      return;
    }
    if (campo === 'descricao' && !safeTrim_(valor)) {
      mostrarMensagemErro('Descricao nao pode ficar vazia.');
      return;
    }
    var dados = {};
    dados[campo] = valor;
    if (!appState.connection.online) {
      fecharEditorTextoPendencia();
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
        fecharEditorTextoPendencia();
        if (response.data && response.data.pendencia) {
          mergeItemIntoState_(response.data.pendencia);
          renderDetalhesPendencia(response.data.pendencia);
          navegar('secaoDetalhesPendencia');
        } else {
          abrirDetalhesPendencia(resolveRemoteId_(id));
        }
        mostrarMensagemSucesso((campo === 'observacao' ? 'Observacao' : 'Descricao') + ' atualizada com sucesso.');
      })
      .catch(handleFailure);
  }

  function renderConfiguracoes(items) {
    var container = document.getElementById('configList');
    if (!container) {
      return;
    }
    var visibleItems = (items || []).filter(function(item) {
      return item.chave !== 'NOME_PASTA_DRIVE_FOTOS' &&
        item.chave !== 'STATUS_PADRAO_NOVO_REGISTRO' &&
        item.chave !== 'OPCOES_PRIORIDADES';
    });
    if (!visibleItems.length) {
      container.innerHTML = '<div class="empty-state">Nenhuma configuracao encontrada.</div>';
      return;
    }
    container.innerHTML = visibleItems.map(function(item) {
      var isDias = item.chave === 'DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO' || /_DIAS$/.test(item.chave || '');
      var inputType = isDias ? 'number' : 'text';
      var inputValue = isDias ? String(item.valor || '10') : String(item.valor || '');
      return '<div class="config-item">' +
        '<div><strong>' + escapeHtml(formatarNomeConfiguracao_(item.chave)) + ':</strong></div>' +
        '<div><input type="' + inputType + '" class="config-input" data-chave="' + escapeHtml(item.chave) + '" value="' + escapeHtml(inputValue) + '"' + (isDias ? ' min="0" step="1"' : '') + '></div>' +
      '</div>';
    }).join('');
  }

  function ensureConfigViewData_() {
    renderConfiguracoes(appState.configs || []);
    renderCadastroList_();
    var needsConfigs = !Array.isArray(appState.configs) || !appState.configs.length;
    var needsCadastros = !appState.comboAdmin || !Object.keys(appState.comboAdmin).length;
    if (!appState.connection.online || (!needsConfigs && !needsCadastros)) {
      return;
    }
    var configNode = document.getElementById('configList');
    var cadastroNode = document.getElementById('cadastroList');
    if (configNode) {
      configNode.innerHTML = '<div class="empty-state">Carregando configuracoes...</div>';
    }
    if (cadastroNode) {
      cadastroNode.innerHTML = '<div class="empty-state">Carregando cadastros...</div>';
    }
    carregarEstadoServidor_().catch(function(error) {
      renderConfiguracoes(appState.configs || []);
      renderCadastroList_();
      mostrarMensagemErro(error.message || 'Nao foi possivel atualizar configuracoes e cadastros.');
    });
  }

  function formatarNomeConfiguracao_(chave) {
    var mapa = {
      DIAS_PARA_EXCLUIR_FOTO_APOS_CONCLUSAO: 'Dias para excluir fotos do Drive apos conclusao',
      STATUS_PADRAO_NOVO_REGISTRO: 'Status padrao do novo registro',
      SLA_CRITICA_DIAS: 'Prazo sugerido para prioridade critica',
      SLA_ALTA_DIAS: 'Prazo sugerido para prioridade alta',
      SLA_MEDIA_DIAS: 'Prazo sugerido para prioridade media',
      SLA_BAIXA_DIAS: 'Prazo sugerido para prioridade baixa',
      SLA_PROJETO_DIAS: 'Prazo sugerido para prioridade projeto',
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
        renderListPresetBar_();
        renderPendencias(getVisibleWorklistItems_());
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
        renderListPresetBar_();
        renderPendencias(getVisibleWorklistItems_());
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
      renderListPresetBar_();
      renderPendencias(getVisibleWorklistItems_());
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
    if (hasNativeBridgeMethod_('openSpenEditor')) {
      try {
        getNativeBridge_().openSpenEditor(targetId, title || getSpenFieldTitle_(targetId), document.getElementById(targetId).value || '');
        return;
      } catch (error) {
        mostrarMensagemErro('Nao foi possivel abrir a escrita nativa da S Pen.');
      }
    }
    document.getElementById('spenTargetField').value = targetId;
    document.getElementById('spenModalTitle').textContent = 'Escrita com S Pen - ' + title;
    var spenInput = resetSpenInputElement_(document.getElementById(targetId).value || '');
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
    try {
      if (document.activeElement && typeof document.activeElement.blur === 'function') {
        document.activeElement.blur();
      }
    } catch (error) {}
    document.body.classList.remove('spen-open');
    document.body.classList.remove('spen-hard-locked');
    document.documentElement.classList.remove('spen-open');
    document.documentElement.classList.remove('spen-hard-locked');
    document.getElementById('spenModal').classList.add('hidden');
    resetSpenInputElement_('');
    document.getElementById('spenTargetField').value = '';
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

  function resetSpenInputElement_(value) {
    var current = document.getElementById('spenInputArea');
    if (!current || !current.parentNode) {
      return current;
    }
    var replacement = current.cloneNode(false);
    replacement.value = value || '';
    replacement.lang = 'pt-BR';
    current.parentNode.replaceChild(replacement, current);
    return replacement;
  }

  function captureFormContext_() {
    appState.formContext = {
      loja: getElementValue_('novaLoja'),
      setor: getElementValue_('novoSetor'),
      tipo: getElementValue_('novoTipo'),
      prioridade: getElementValue_('novaPrioridade'),
      responsavel: getElementValue_('novoResponsavel'),
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
    setElementValueIfExists_('novoResponsavel', appState.formContext.responsavel);
    setElementValueIfExists_('novoExecutor', appState.formContext.executor);
    renderNovaPendenciaFlow_();
    updateFormPlanningHint_('nova');
  }

  function resolveNextNovaPendenciaStep_(context) {
    var current = context || {};
    if (!safeTrim_(current.loja) || !safeTrim_(current.setor)) {
      return 1;
    }
    if (!safeTrim_(current.tipo) || !safeTrim_(current.prioridade)) {
      return 2;
    }
    return 3;
  }

  function limparContextoRapido() {
    appState.formContext = {
      loja: '',
      setor: '',
      tipo: '',
      prioridade: '',
      responsavel: '',
      executor: ''
    };
    saveCache_();
    applySavedFormContext_();
    renderNovaPendenciaFlow_();
    updateFormPlanningHint_('nova');
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
      button.textContent = isActive ? ('Parar ' + formatSpeechElapsed_()) : 'Voz';
    });
  }

  function formatSpeechElapsed_() {
    var seconds = Math.max(0, Math.floor((Date.now() - Number(appState.speechState.startedAt || 0)) / 1000));
    var minutes = Math.floor(seconds / 60);
    var remainder = seconds % 60;
    return String(minutes).padStart(2, '0') + ':' + String(remainder).padStart(2, '0');
  }

  function startSpeechTimer_() {
    stopSpeechTimer_();
    appState.speechState.startedAt = Date.now();
    appState.speechState.timerId = setInterval(function() {
      if (!appState.speechState.listening) {
        stopSpeechTimer_();
        return;
      }
      renderSpeechButtons_();
    }, 1000);
  }

  function stopSpeechTimer_() {
    if (appState.speechState.timerId) {
      clearInterval(appState.speechState.timerId);
      appState.speechState.timerId = null;
    }
    appState.speechState.startedAt = 0;
  }

  function setSpeechPreviewState_(targetId, active) {
    var field = document.getElementById(targetId);
    if (!field) {
      return;
    }
    field.classList.toggle('voice-preview-active', !!active);
  }

  function pararDitadoAtivo_(skipNativeStop) {
    var activeTargetId = appState.speechState.activeTargetId;
    appState.speechState.manualStop = true;
    if (appState.speechState.nativeMode && !skipNativeStop && hasNativeBridgeMethod_('stopVoiceSession')) {
      try {
        getNativeBridge_().stopVoiceSession();
      } catch (error) {}
    }
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
    appState.speechState.baseValue = '';
    appState.speechState.finalTranscript = '';
    appState.speechState.nativeMode = false;
    setSpeechPreviewState_(activeTargetId, false);
    stopSpeechTimer_();
    renderSpeechButtons_();
  }

  function toggleDitado(targetId) {
    if (appState.speechState.listening && appState.speechState.activeTargetId === targetId) {
      pararDitadoAtivo_();
      return;
    }
    iniciarDitado(targetId);
  }

  function focarCampoComTecladoNativo_(targetId) {
    var field = document.getElementById(targetId);
    if (!field) {
      return false;
    }
    try {
      field.focus();
      var end = (field.value || '').length;
      if (typeof field.setSelectionRange === 'function') {
        field.setSelectionRange(end, end);
      }
      if (typeof field.click === 'function') {
        field.click();
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function iniciarDitado(targetId) {
    if (hasNativeBridgeMethod_('startVoiceSession')) {
      iniciarDitadoNativo_(targetId);
      return;
    }
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      if (focarCampoComTecladoNativo_(targetId)) {
        mostrarMensagemSucesso('Use o microfone do teclado nativo do dispositivo.');
        return;
      }
      mostrarMensagemErro('Ditado por voz nao suportado neste navegador.');
      return;
    }
    if (!appState.connection.online) {
      if (focarCampoComTecladoNativo_(targetId)) {
        mostrarMensagemSucesso('Offline: use o microfone do teclado nativo do dispositivo.');
        return;
      }
      mostrarMensagemErro('Ditado por voz offline nao esta disponivel neste navegador. Use a S Pen ou reconecte a internet.');
      return;
    }
    if (appState.speechState.activeRecognition) {
      pararDitadoAtivo_();
    }
    var recognition = new Recognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    var field = document.getElementById(targetId);
    var baseValue = field ? String(field.value || '') : '';
    appState.speechState.activeRecognition = recognition;
    appState.speechState.activeTargetId = targetId;
    appState.speechState.activeButtonTargetId = targetId;
    appState.speechState.listening = true;
    appState.speechState.manualStop = false;
    appState.speechState.baseValue = baseValue;
    appState.speechState.finalTranscript = '';
    appState.speechState.nativeMode = false;
    setSpeechPreviewState_(targetId, true);
    startSpeechTimer_();
    renderSpeechButtons_();
    recognition.onresult = function(event) {
      var field = document.getElementById(targetId);
      if (!field) {
        return;
      }
      var finalTranscript = '';
      var interimTranscript = '';
      for (var i = 0; i < event.results.length; i += 1) {
        var result = event.results[i];
        var transcript = normalizeVoiceTranscript_((result && result[0] && result[0].transcript) || '');
        if (!transcript) {
          continue;
        }
        if (result.isFinal) {
          finalTranscript = appendVoiceChunk_(finalTranscript, transcript);
        } else {
          interimTranscript = appendVoiceChunk_(interimTranscript, transcript);
        }
      }
      appState.speechState.finalTranscript = finalTranscript;
      appState.speechState.lastTranscript = finalTranscript || interimTranscript;
      appState.speechState.lastAt = Date.now();
      field.value = composeVoiceFieldValue_(appState.speechState.baseValue, finalTranscript, interimTranscript);
      field.dispatchEvent(new Event('input', { bubbles: true }));
    };
    recognition.onend = function() {
      if (appState.speechState.activeRecognition === recognition) {
        appState.speechState.activeRecognition = null;
        appState.speechState.activeTargetId = '';
        appState.speechState.activeButtonTargetId = '';
        appState.speechState.listening = false;
        appState.speechState.baseValue = '';
        appState.speechState.finalTranscript = '';
        setSpeechPreviewState_(targetId, false);
        stopSpeechTimer_();
        renderSpeechButtons_();
      }
    };
    recognition.onerror = function(event) {
      var errorCode = event && event.error ? String(event.error) : '';
      if ((errorCode === 'aborted' && appState.speechState.manualStop) || errorCode === 'no-speech') {
        setSpeechPreviewState_(targetId, false);
        stopSpeechTimer_();
        appState.speechState.activeTargetId = '';
        appState.speechState.activeButtonTargetId = '';
        appState.speechState.listening = false;
        appState.speechState.baseValue = '';
        appState.speechState.finalTranscript = '';
        renderSpeechButtons_();
        return;
      }
      if (appState.speechState.activeRecognition === recognition) {
        appState.speechState.activeRecognition = null;
        appState.speechState.activeTargetId = '';
        appState.speechState.activeButtonTargetId = '';
        appState.speechState.listening = false;
        appState.speechState.baseValue = '';
        appState.speechState.finalTranscript = '';
        setSpeechPreviewState_(targetId, false);
        stopSpeechTimer_();
        renderSpeechButtons_();
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

  function iniciarDitadoNativo_(targetId) {
    var field = document.getElementById(targetId);
    if (!field) {
      return;
    }
    if (appState.speechState.activeRecognition || appState.speechState.nativeMode) {
      pararDitadoAtivo_(true);
    }
    appState.speechState.activeTargetId = targetId;
    appState.speechState.activeButtonTargetId = targetId;
    appState.speechState.listening = true;
    appState.speechState.manualStop = false;
    appState.speechState.baseValue = String(field.value || '');
    appState.speechState.finalTranscript = '';
    appState.speechState.nativeMode = true;
    setSpeechPreviewState_(targetId, true);
    startSpeechTimer_();
    renderSpeechButtons_();
    try {
      getNativeBridge_().startVoiceSession(targetId, appState.speechState.baseValue);
    } catch (error) {
      pararDitadoAtivo_(true);
      mostrarMensagemErro('Nao foi possivel iniciar o ditado nativo.');
    }
  }

  function handleNativeVoiceEventPayload_(payload) {
    var data = parseNativePayload_(payload);
    var targetId = data.targetId || appState.speechState.activeTargetId;
    if (!targetId) {
      return;
    }
    if (data.type === 'started') {
      return;
    }
    if (data.type === 'partial' || data.type === 'final') {
      if (!appState.speechState.listening) {
        appState.speechState.listening = true;
        appState.speechState.nativeMode = true;
        appState.speechState.activeTargetId = targetId;
        appState.speechState.activeButtonTargetId = targetId;
        setSpeechPreviewState_(targetId, true);
        startSpeechTimer_();
      }
      var field = document.getElementById(targetId);
      if (!field) {
        return;
      }
      var finalTranscript = data.finalTranscript || '';
      var interimTranscript = data.interimTranscript || '';
      appState.speechState.finalTranscript = finalTranscript;
      field.value = composeVoiceFieldValue_(appState.speechState.baseValue, finalTranscript, interimTranscript);
      field.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    if (data.type === 'stopped') {
      pararDitadoAtivo_(true);
      return;
    }
    if (data.type === 'error') {
      pararDitadoAtivo_(true);
      if (data.message) {
        mostrarMensagemErro(data.message);
      }
    }
  }

  function handleNativeSpenResultPayload_(payload) {
    var data = parseNativePayload_(payload);
    var targetId = data.targetId;
    var target = targetId ? document.getElementById(targetId) : null;
    if (!target) {
      return;
    }
    if (data.applied === false) {
      return;
    }
    target.value = normalizePtBrText_(String(data.value || ''));
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function appendVoiceChunk_(currentValue, transcript) {
    var current = String(currentValue || '');
    var next = String(transcript || '');
    if (!next) {
      return current;
    }
    if (!current) {
      return next;
    }
    if (normalizeText_(current).slice(-normalizeText_(next).length) === normalizeText_(next)) {
      return current;
    }
    var prefix = next.charAt(0) !== '\n' ? ' ' : '';
    return (current + prefix + next).replace(/[ \t]+\n/g, '\n').trim();
  }

  function composeVoiceFieldValue_(baseValue, finalTranscript, interimTranscript) {
    var value = String(baseValue || '');
    if (finalTranscript) {
      value = appendVoiceChunk_(value, finalTranscript);
    }
    if (interimTranscript) {
      value = appendVoiceChunk_(value, interimTranscript);
    }
    return value;
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
    resetNovaPlanningAutoState_();
    atualizarNomeArquivo('novaFoto', 'novaFotoNome');
    appState.newPendenciaStep = 1;
    if (clearContext) {
      appState.formContext = {
        loja: '',
        setor: '',
        tipo: '',
        prioridade: '',
        responsavel: '',
        executor: ''
      };
      saveCache_();
    } else {
      applySavedFormContext_();
    }
    saveCache_();
    applyNovaPendenciaPlanningDefaults_(false);
    renderNovaPendenciaFlow_();
    updateFormPlanningHint_('nova');
  }

  function voltarParaLista() {
    if (appState.navigationStack.length) {
      voltarTelaAnterior();
      return;
    }
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
    indicator.textContent = statusText + ' • ' + CLIENT_BUILD_LABEL;
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
      } else if (displayStatus === 'Aguardando') {
        dashboard.aguardando += 1;
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
      aguardando: 0,
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
      var responsavel = item.responsavel || 'Nao definido';
      dashboard.total += 1;
      dashboard.porLoja[item.loja || 'Sem loja'] = (dashboard.porLoja[item.loja || 'Sem loja'] || 0) + 1;
      dashboard.porSetor[item.setor || 'Sem setor'] = (dashboard.porSetor[item.setor || 'Sem setor'] || 0) + 1;
      dashboard.porResponsavel[responsavel] = (dashboard.porResponsavel[responsavel] || 0) + 1;
      if (displayStatus === 'Vencida') {
        dashboard.vencidas += 1;
      } else if (displayStatus === 'Aberta') {
        dashboard.abertas += 1;
      } else if (displayStatus === 'Aguardando') {
        dashboard.aguardando += 1;
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

  function getFilteredPendencias_(apenasHistorico, ignoreFilters, includeListPreset) {
    var filtros = ignoreFilters ? {} : obterFiltrosTela(!!apenasHistorico);
    var presetKey = includeListPreset ? (appState.listPreset || 'all') : 'all';
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
      if (!matchesFilterSelectionLocal_(item.loja, filtros.loja)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.setor, filtros.setor)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.status, filtros.status)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.responsavel, filtros.responsavel)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.executor, filtros.executor)) {
        return false;
      }
      if (filtros.orcamento === 'Com orcamento' && !safeTrim_(item.id_orcamento_ativo)) {
        return false;
      }
      if (filtros.orcamento === 'Sem orcamento' && !!safeTrim_(item.id_orcamento_ativo)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.prioridade, filtros.prioridade)) {
        return false;
      }
      if (!matchesFilterSelectionLocal_(item.tipo, filtros.tipo)) {
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
      if (presetKey !== 'all' && !matchesListPreset_(item, presetKey)) {
        return false;
      }
      return true;
    }).sort(apenasHistorico ? compareHistoricoPendencias_ : comparePendenciasForWorklist_);
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

  function matchesFilterSelectionLocal_(value, filterValue) {
    var normalizedFilter = normalizeFilterListLocal_(filterValue);
    if (!normalizedFilter.length) {
      return true;
    }
    return normalizedFilter.indexOf(normalizeText_(value)) > -1;
  }

  function normalizeFilterListLocal_(filterValue) {
    if (Array.isArray(filterValue)) {
      return filterValue.map(function(entry) {
        return normalizeText_(entry);
      }).filter(Boolean);
    }
    var normalized = normalizeText_(filterValue);
    return normalized ? [normalized] : [];
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
    if (Object.prototype.hasOwnProperty.call(dados, 'descricao')) {
      item.descricao = dados.descricao || '';
    }
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
    applyWorkflowHeuristicsLocal_(item, dados, 'edit');
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
      var opts = options || {};
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
      if (isAppsScriptHost_() && !opts.skipAppsScriptWait) {
        return waitForAppsScriptBridgeReady_(Math.max(Number(opts.waitForBridgeMs || 0), Number(opts.timeoutMs || 0), 12000)).then(function() {
          return serverCall_(functionName, args || [], {
            timeoutMs: opts.timeoutMs,
            waitForBridgeMs: opts.waitForBridgeMs,
            quietOffline: opts.quietOffline,
            skipAppsScriptWait: true
          });
        });
      }
      return externalBridgeCall_(functionName, args || [], opts);
    }

  function isAppsScriptHost_() {
    var host = (window.location && window.location.host) || '';
    return /script\.google\.com/i.test(host) || /script\.googleusercontent\.com/i.test(host);
  }

  function isServerBridgeReady_() {
    return !!(window.google && google.script && google.script.run) || !!(((window.PWA_CONFIG || {}).appsScriptBridgeUrl || '').trim());
  }

  function waitForAppsScriptBridgeReady_(timeoutMs) {
    var limit = Number(timeoutMs || 2200);
    if (isServerBridgeReady_()) {
      return Promise.resolve();
    }
    return new Promise(function(resolve, reject) {
      var startedAt = Date.now();
      var timer = setInterval(function() {
        if (isServerBridgeReady_()) {
          clearInterval(timer);
          resolve();
          return;
        }
        if (Date.now() - startedAt >= limit) {
          clearInterval(timer);
          reject(new Error('Bridge do Apps Script ainda nao estava pronto.'));
        }
      }, 90);
    });
  }

  function resetNovaPlanningAutoState_() {
    var startField = document.getElementById('novaDataInicio');
    var dueField = document.getElementById('novaPrevisaoEntrega');
    if (startField) {
      startField.dataset.autoPlanning = '1';
    }
    if (dueField) {
      dueField.dataset.autoPlanning = '1';
    }
  }

  function markNovaPlanningFieldManual_(fieldKey) {
    var fieldId = fieldKey === 'previsao' ? 'novaPrevisaoEntrega' : 'novaDataInicio';
    var field = document.getElementById(fieldId);
    if (!field) {
      return;
    }
    field.dataset.autoPlanning = '0';
  }

  function applyNovaPendenciaPlanningDefaults_(forceDueRefresh) {
    var startField = document.getElementById('novaDataInicio');
    var dueField = document.getElementById('novaPrevisaoEntrega');
    var prioridade = getElementValue_('novaPrioridade') || 'Media';
    if (!startField || !dueField) {
      return;
    }
    if (!startField.dataset.autoPlanning) {
      startField.dataset.autoPlanning = startField.value ? '0' : '1';
    }
    if (!dueField.dataset.autoPlanning) {
      dueField.dataset.autoPlanning = dueField.value ? '0' : '1';
    }
    if (!startField.value || startField.dataset.autoPlanning === '1') {
      startField.value = startField.value || toInputDate_(new Date());
      startField.dataset.autoPlanning = '1';
    }
    if (!dueField.value || dueField.dataset.autoPlanning === '1') {
      dueField.value = addDaysToInputDate_(startField.value || toInputDate_(new Date()), getPrioritySlaDaysLocal_(prioridade));
      dueField.dataset.autoPlanning = '1';
      return;
    }
    if (forceDueRefresh && dueField.dataset.autoPlanning === '1') {
      dueField.value = addDaysToInputDate_(startField.value || toInputDate_(new Date()), getPrioritySlaDaysLocal_(prioridade));
    }
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

  function normalizeLabel_(value) {
    var text = safeTrim_(value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!text) {
      return '';
    }
    return text
      .split(' ')
      .map(function(part) {
        return part ? part.charAt(0).toUpperCase() + part.slice(1).toLowerCase() : '';
      })
      .join(' ');
  }

  function safeTrim_(value) {
    return (value || '').toString().trim();
  }

  function truncateText_(value, limit) {
    var text = safeTrim_(value);
    var max = Number(limit || 120);
    if (!text || text.length <= max) {
      return text;
    }
    return text.slice(0, Math.max(0, max - 1)).trim() + '…';
  }

  function parseCurrencyValueClient_(value) {
    if (typeof value === 'number') {
      return value;
    }
    var text = safeTrim_(value);
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

  function formatCurrencyBrClient_(value) {
    var number = parseCurrencyValueClient_(value);
    if (!isFinite(number)) {
      number = 0;
    }
    return number.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    });
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
      if (filtros.responsavel && normalizeText_(item.responsavel) !== normalizeText_(filtros.responsavel)) {
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
