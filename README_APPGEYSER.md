# AppGeyser

## URL base do app

- PWA / GitHub Pages:
  - `https://cawanoliveira.github.io/Manut_app/`
- Bridge Apps Script:
  - `https://script.google.com/macros/s/AKfycbzeEa4Fs6TppJeIwYL1wPshRJdw64Brclwz_iX99a3H_2NlH_YKhhXqybpK9Fymr8HlIQ/exec`

## O que usar no AppGeyser

Use o template de `Website app` / `Website to app`.

Fonte oficial:
- `https://support.appsgeyser.com/hc/en-us/articles/8892478887196-Convert-your-website-into-an-app`

## Campo principal

No campo de URL do site, usar:

`https://cawanoliveira.github.io/Manut_app/`

## Nome sugerido

- `Aplicacoes Manutencao`

## Resumo importante sobre offline

- O offline vem da PWA, nao do AppGeyser sozinho.
- O usuario precisa abrir o app com internet pelo menos uma vez para preencher o cache.
- Depois disso, o app consegue operar offline com os dados locais e sincronizar quando a internet voltar.

## Configuracoes recomendadas no AppGeyser

Se essas opcoes aparecerem no editor:

- `Screen orientation`: portrait
- `Action bar`: manter simples
- `Bottom menu / Tabs`: opcional
- `URL interception`: habilitar se disponivel
- `Cookies settings`: permitir
- `Sleep mode`: desativar se houver opcao para evitar pausa agressiva
- `Loading files action`: abrir dentro do app quando possivel

## Fluxo recomendado de teste

1. Gerar o app no AppGeyser usando a URL acima.
2. Baixar o APK.
3. Instalar no Android.
4. Abrir com internet.
5. Navegar pelas abas e deixar o app carregar completamente.
6. Fechar e abrir de novo offline.
7. Testar:
   - troca de abas
   - criacao de pendencia
   - edicao
   - cronograma
   - retorno da internet e sincronizacao

## Limites importantes

- AppGeyser e focado principalmente em Android.
- No iPhone/iPad, o melhor caminho continua sendo instalar a PWA pela tela inicial do Safari.
- Se o usuario limpar os dados do app/webview, o cache offline local pode ser perdido.
