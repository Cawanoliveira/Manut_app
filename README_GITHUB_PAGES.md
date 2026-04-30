# PWA no GitHub Pages

## O que foi gerado

- `docs/index.html`: versao estatica do app para GitHub Pages
- `docs/styles.css`: estilos da PWA
- `docs/app.js`: logica offline-first e sincronizacao
- `docs/config.js`: configuracao do endereco do Apps Script
- `docs/manifest.webmanifest`: manifesto instalavel
- `docs/sw.js`: service worker para cache offline
- `docs/icon-192.png` e `docs/icon-512.png`: icones da PWA

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie o conteudo desta pasta para o repositório.
3. Mantenha a pasta `docs/` no repositório.
4. No GitHub, abra:
   - `Settings > Pages`
5. Em `Build and deployment`:
   - `Source`: `Deploy from a branch`
   - `Branch`: `main`
   - `Folder`: `/docs`
6. Salve.
7. O GitHub vai gerar uma URL parecida com:
   - `https://SEU-USUARIO.github.io/NOME-DO-REPO/`

## Como apontar para o Apps Script

1. No Apps Script, abra:
   - `Deploy > Manage deployments`
2. Crie ou atualize uma implantação do tipo `Web app`.
3. Copie a URL `exec` da implantação.
4. Edite `docs/config.js`.
5. Preencha assim:

```javascript
window.PWA_CONFIG = {
  appsScriptBridgeUrl: 'COLE_AQUI_A_URL_EXEC_DO_WEB_APP'
};
```

6. Salve e envie novamente para o GitHub.

## Como instalar no celular

1. Abra a URL do GitHub Pages no celular com internet.
2. Aguarde o carregamento completo.
3. No navegador, use `Adicionar a tela inicial` ou `Instalar aplicativo`.
4. Abra o app instalado pelo menos uma vez online para o cache inicial ser gravado.

## Como o offline funciona

- Depois da primeira carga, a interface, estilos e scripts ficam em cache.
- Os dados recentes tambem ficam armazenados no navegador.
- Sem internet, o usuario ainda consegue:
  - abrir o app ja instalado/cacheado
  - criar pendencias
  - editar
  - concluir
  - excluir
  - navegar e filtrar dados locais
- Quando a internet volta:
  - o app sincroniza automaticamente
  - tambem existe o botao `Sincronizar`

## Limites importantes

- A primeira abertura da PWA precisa de internet.
- O GitHub Pages nao substitui o banco do Google Sheets; ele hospeda apenas o front-end.
- Se o usuario limpar os dados do navegador, o cache offline e a fila local podem ser perdidos.
- Fotos muito grandes podem consumir bastante armazenamento local antes da sincronizacao.
