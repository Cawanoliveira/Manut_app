var BRIDGE_ALLOWED_FUNCTIONS = {
  getAppInitData: getAppInitData,
  listarPendencias: listarPendencias,
  buscarPendenciaPorId: buscarPendenciaPorId,
  criarPendencia: criarPendencia,
  atualizarPendencia: atualizarPendencia,
  alterarStatusPendencia: alterarStatusPendencia,
  concluirPendencia: concluirPendencia,
  excluirPendencia: excluirPendencia,
  obterFotoPreviewPendencia: obterFotoPreviewPendencia,
  salvarPrestador: salvarPrestador,
  salvarConfiguracoesSimples: salvarConfiguracoesSimples,
  setupSistema: setupSistema,
  criarTriggerLimpezaFotos: criarTriggerLimpezaFotos
};

function doGet(e) {
  if (e && e.parameter && e.parameter.bridge === '1') {
    return handleBridgeRequest_(e.parameter);
  }
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Controle de Pendencias - Lojas')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1');
}

function doPost(e) {
  var params = (e && e.parameter) || {};
  if (params.bridge === '1') {
    return handleBridgeRequest_(params);
  }
  return HtmlService.createHtmlOutput('Bridge request invalido.')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppInitData() {
  try {
    setupSistema();
    return createSuccessResponse_('Dados iniciais carregados.', {
      dashboard: getDashboardData(),
      combos: getFormSupportData(),
      config: listarConfiguracoes(),
      versao: getConfig('VERSAO_SISTEMA') || '1.0'
    });
  } catch (error) {
    registrarLog('ERRO', 'Falha ao carregar dados iniciais do app.', getErrorStack_(error));
    return createErrorResponse_('Nao foi possivel carregar o sistema.', error);
  }
}

function handleBridgeRequest_(params) {
  var origin = safeString_(params.origin) || '*';
  var requestId = safeString_(params.requestId) || gerarId('REQ');
  var functionName = safeString_(params.functionName);
  var args = [];
  var response;

  try {
    if (!functionName || !BRIDGE_ALLOWED_FUNCTIONS[functionName]) {
      throw new Error('Funcao nao permitida para bridge externa: ' + functionName);
    }
    if (params.args) {
      args = JSON.parse(params.args);
      if (!Array.isArray(args)) {
        args = [];
      }
    }
    response = BRIDGE_ALLOWED_FUNCTIONS[functionName].apply(null, args);
  } catch (error) {
    registrarLog('ERRO', 'Falha no bridge externo.', functionName + ' | ' + getErrorStack_(error), 'bridge_externo');
    response = createErrorResponse_('Falha ao processar requisicao externa.', error);
  }

  return buildBridgeHtmlResponse_(origin, requestId, response);
}

function buildBridgeHtmlResponse_(origin, requestId, response) {
  var payload = JSON.stringify({
    source: 'apps-script-bridge',
    requestId: requestId,
    response: response
  });
  var html = [
    '<!DOCTYPE html><html><head><base target="_top"><meta charset="utf-8"></head><body>',
    '<script>',
    '(function(){',
    'var message=', payload, ';',
    'var targetOrigin=', JSON.stringify(origin), ';',
    'function safePost(target){',
    '  try{ if(target && target.postMessage){ target.postMessage(message,targetOrigin); } }catch(err){}',
    '}',
    'safePost(window.parent);',
    'safePost(window.top);',
    'try{ safePost(window.top.parent); }catch(err){}',
    'safePost(window.opener);',
    'setTimeout(function(){',
    '  safePost(window.parent);',
    '  safePost(window.top);',
    '  try{ safePost(window.top.parent); }catch(err){}',
    '  safePost(window.opener);',
    '}, 250);',
    '})();',
    '</script>',
    '</body></html>'
  ].join('');
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
