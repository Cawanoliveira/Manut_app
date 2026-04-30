# Sistema de Controle de Melhorias e Pendencias

## Arquitetura rapida

- `Code.gs`: entrada do Web App e carregamento inicial.
- `Database.gs`: setup da planilha, abas, cabecalhos, dados iniciais e leituras basicas.
- `ConfigService.gs`: configuracoes e combos de apoio para o front-end.
- `DriveService.gs`: pasta de fotos, upload em base64 e preview privado da imagem.
- `PendenciasService.gs`: regras de negocio, CRUD, dashboard e historico de status.
- `TriggerService.gs`: limpeza automatica de fotos e gatilho diario.
- `Utils.gs`: constantes, validacoes, datas, IDs e logs.
- `Index.html`, `Styles.html`, `Scripts.html`: SPA responsiva para tablet, celular e desktop.

## Estrutura criada pelo `setupSistema()`

- `CONFIG`: `chave | valor | descricao`
- `LOJAS`: `id_loja | nome_loja | cidade | status | data_cadastro`
- `SETORES`: `id_setor | nome_setor | status | data_cadastro`
- `USUARIOS`: `id_usuario | nome | email | perfil | status | data_cadastro`
- `PENDENCIAS`: `id_pendencia | data_abertura | hora_abertura | loja | setor | tipo | prioridade | descricao | observacao | solicitante | responsavel | data_inicio | previsao_entrega | status | data_conclusao | hora_conclusao | link_foto | id_arquivo_drive | excluir_foto_em | foto_excluida | ultima_atualizacao | atualizado_por`
- `HISTORICO_STATUS`: `id_historico | id_pendencia | data | hora | status_anterior | status_novo | usuario | observacao`
- `LOGS`: `id_log | data | hora | tipo | mensagem | detalhe | usuario`
- `DASHBOARD_BASE`: `indicador | valor | ultima_atualizacao`

## Passo a passo de instalacao no Apps Script

1. Crie uma nova planilha Google em branco.
2. Abra `Extensoes > Apps Script`.
3. Apague os arquivos padrao do projeto.
4. Crie no Apps Script os arquivos com estes mesmos nomes:
   - `Code.gs`
   - `Database.gs`
   - `DriveService.gs`
   - `PendenciasService.gs`
   - `ConfigService.gs`
   - `TriggerService.gs`
   - `Utils.gs`
   - `Index.html`
   - `Styles.html`
   - `Scripts.html`
   - `appsscript.json`
5. Copie o conteudo de cada arquivo deste pacote para o arquivo correspondente no Apps Script.
6. Salve o projeto.

## Como rodar o setup inicial

1. No editor do Apps Script, selecione a funcao `setupSistema`.
2. Clique em `Executar`.
3. Autorize o script quando solicitado.
4. Volte para a planilha e confirme que as abas foram criadas.
5. Cadastre as lojas na aba `LOJAS`.
6. Cadastre usuarios na aba `USUARIOS` se quiser usar responsaveis em lista.

## Como publicar como Web App

1. No Apps Script, clique em `Implantar > Nova implantacao`.
2. Escolha `Aplicativo da web`.
3. Em `Executar como`, use `Voce`.
4. Em `Quem tem acesso`, escolha `Usuarios do dominio` ou ajuste conforme a sua politica interna.
5. Clique em `Implantar`.
6. Copie a URL gerada e abra no navegador do tablet, celular ou computador.

## Como criar o gatilho de limpeza de fotos

1. Rode a funcao `criarTriggerLimpezaFotos` uma vez no editor do Apps Script.
2. Autorize as permissoes.
3. O script criara um gatilho diario para executar `limparFotosConcluidas()` por volta das 03h.
4. Se precisar testar manualmente, execute `limparFotosConcluidas()`.

## Seguranca e permissoes

- O projeto precisa de acesso a `Sheets`, `Drive`, `Triggers` e `email do usuario`.
- O script foi pensado para ficar vinculado a planilha principal do sistema.
- As fotos ficam privadas no Drive do implantador e o app carrega o preview via backend, sem precisar abrir o arquivo publicamente.
- Se varias pessoas forem usar o app, publique o Web App executando como o usuario que fara a gestao central do sistema.
- O acesso atual da versao 1 esta aberto a todos os usuarios do Web App; a base `USUARIOS` ja prepara a evolucao para permissoes por perfil.

## Melhorias futuras sugeridas

- Controle real de permissao por perfil (`Admin`, `Gestor`, `Consulta`).
- Cadastro e manutencao de lojas e usuarios diretamente pelo app.
- Filtros salvos por usuario.
- Comentarios operacionais independentes do historico de status.
- Exportacao de relatorios por loja, setor, periodo e responsavel.
- Indicadores graficos no dashboard.
- Notificacoes por email quando houver troca de status ou vencimento.
