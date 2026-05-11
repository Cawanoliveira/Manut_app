# Zelo Hub Android

Projeto base do aplicativo Android nativo para o sistema `Zelo Hub`, usando:

- `WebView` para carregar a interface web existente
- bridge `JavaScriptInterface` para integrar recursos nativos
- `SpeechRecognizer` nativo para ditado
- tela nativa de escrita para `S Pen`

## Estrutura

- `MainActivity`: hospeda o `WebView`
- `WebAppBridge`: expõe métodos nativos ao JavaScript
- `VoiceRecognitionManager`: gerencia o reconhecimento de voz nativo
- `NativeSpenActivity`: tela nativa de escrita

## URL carregada

O app aponta para:

- `https://cawanoliveira.github.io/Manut_app/`

Essa URL fica em `BuildConfig.APP_URL` dentro de `app/build.gradle.kts`.

## Recursos nativos expostos ao web

O JavaScript do sistema já foi preparado para usar:

- `startVoiceSession(targetId, baseValue)`
- `stopVoiceSession()`
- `openSpenEditor(targetId, title, value)`

E o app retorna dados ao web por:

- `window.handleNativeVoiceEvent(payload)`
- `window.handleNativeSpenResult(payload)`

## Como abrir no Android Studio

1. Abra o Android Studio
2. Escolha `Open`
3. Selecione a pasta:
   - `C:\Users\cawan.oliveira\Documents\Codex\2026-04-26-Manut\android-zelo-hub`
4. Aguarde o sync do Gradle
5. Rode no tablet Android

## Observações

- O ditado offline depende de o dispositivo ter reconhecimento local disponível
- A activity da S Pen foi feita para travar toques de dedo quando o cadeado estiver fechado
- O `WebView` foi configurado para carregar apenas a interface do sistema e abrir links externos fora dele
