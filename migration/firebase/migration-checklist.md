# Checklist de Migracao

## Antes de começar

- [ ] Planilha oficial copiada
- [ ] Projeto Apps Script oficial copiado
- [ ] Branch `firebase-migration` criada
- [ ] Projeto Firebase `dev` criado
- [ ] Projeto Firebase `prod` criado
- [ ] Billing Blaze ativado
- [ ] Credencial de acesso preparada

## Exportacao inicial

- [ ] Exportar snapshot da planilha
- [ ] Conferir contagem por aba
- [ ] Conferir inventario de arquivos do Drive
- [ ] Guardar snapshot em local seguro

## Importacao no Firebase

- [ ] Importar `configs`
- [ ] Importar cadastros (`lojas`, `setores`, `usuarios`, `prestadores`)
- [ ] Importar `pendencias`
- [ ] Importar `historico`
- [ ] Importar `orcamentos`
- [ ] Importar `itens` de orcamento
- [ ] Espelhar fotos para Storage
- [ ] Espelhar PDFs para Storage

## Validacao

- [ ] Comparar contagem de documentos por colecao
- [ ] Conferir 10 pendencias com foto
- [ ] Conferir 10 pendencias sem foto
- [ ] Conferir 5 orcamentos com PDF
- [ ] Conferir 5 orcamentos sem PDF
- [ ] Conferir dashboard
- [ ] Conferir filtros
- [ ] Conferir historico
- [ ] Conferir cronograma

## Virada

- [ ] Congelar o legado por janela curta
- [ ] Rodar exportacao delta
- [ ] Rodar importacao delta
- [ ] Validar smoke test
- [ ] Liberar sistema Firebase como principal
- [ ] Manter legado disponivel para rollback

