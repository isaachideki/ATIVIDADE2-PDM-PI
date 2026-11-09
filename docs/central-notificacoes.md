# Central de notificações (ATV2 — PDM)

Funcionalidade de autoria própria do app mobile. **Nenhuma alteração foi feita no backend.**

## Como funciona

O backend não tem coleção de notificações. O app monta o feed a partir de eventos reais devolvidos pela API:

| Tipo | Origem (API) | Toque leva para |
| --- | --- | --- |
| `RISCO` | `GET /users/historico?filtro=Risco&limit=30` (scans `PERIGOSO`) | `/resultado` com `id` do scan |
| `RESTRICOES` | `GET /users/perfil` → `restricoesAtualizadasPor === "NUTRICIONISTA"` e `restricoesAtualizadasEm` | `/editar-perfil` |
| `VINCULO` | `GET /users/perfil` → `vinculo.estado` (`PENDENTE`, `APROVADO`, `RECUSADO`) | `/perfil` ou `/vincular-nutricionista` |
| `DICA` | Dica do dia (`obterDicaDoDia` em `utils/datas.ts`) | — |

Leituras inconclusivas do OCR **não** viram notificação, pois o servidor não grava `INCONCLUSIVO` no histórico (o enum de `ScanLog.veredito` só tem `SEGURO` e `PERIGOSO`).

Somente o estado **lida / dispensada** é salvo no aparelho (`AsyncStorage`, chave `@notificacoes_estado:<idDoUsuario>`), separado por usuário.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `mobile/services/notificacoes.ts` | Consulta a API (Axios), normaliza os eventos em `Notificacao[]` e persiste lidas/ocultas |
| `mobile/context/NotificacoesContext.tsx` | Estado global: lista, contador de não lidas, loading, erro, `recarregar`, `marcarComoLida`, `marcarTodasComoLidas`, `dispensar` |
| `mobile/components/NotificacaoItem.tsx` | Componente reutilizável com Props (`tipo`, `titulo`, `descricao`, `data`, `lida`, `onPress`, `onDispensar`) |
| `mobile/app/notificacoes.tsx` | Tela própria (rota `/notificacoes`) com `SectionList` |
| `mobile/components/Header/AppHeader.tsx` | Sino com badge de não lidas em todas as telas que usam o cabeçalho |
| `mobile/components/Drawer/DrawerMenu.tsx` | Item "Notificações" no menu lateral, também com badge |
| `mobile/utils/datas.ts` | `formatarTempoRelativo` e `secaoDaData` |

## Requisitos da atividade

| Requisito | Onde aparece |
| --- | --- |
| Interface (StyleSheet + Flexbox) | `notificacoes.tsx`, `NotificacaoItem.tsx` |
| Navegação (Expo Router) | rota `/notificacoes`; toque na notificação navega para outras telas com `router.push` e parâmetros |
| Consumo de API (Axios) | `services/notificacoes.ts` (`Promise.allSettled` com duas rotas) |
| Exibição com SectionList | `notificacoes.tsx` (seções Hoje / Esta semana / Anteriores) |
| `useState` e `useEffect` | `notificacoes.tsx` e `NotificacoesContext.tsx` (+ `useFocusEffect`, `useMemo`, `useCallback`) |
| Componentes com Props | `NotificacaoItem` |
| Carregamento e erros | spinner no primeiro carregamento, banner de erro com "Tentar novamente", estado vazio, pull-to-refresh |

## Roteiro sugerido para o vídeo

1. Mostrar o sino com badge no cabeçalho e abrir a tela de notificações.
2. Explicar de onde vem cada tipo (tabela acima) e mostrar o código de `buscarNotificacoes`.
3. Tocar em um alerta de risco: marca como lida e abre o resultado do scan.
4. Mostrar filtro "Não lidas", "Marcar todas como lidas" e dispensar (X).
5. Puxar para atualizar; desligar o servidor para mostrar o tratamento de erro.
6. Fazer um novo scan, voltar e mostrar a nova notificação e o badge atualizado.
7. Explicar o `NotificacoesContext` (limite de 30 s entre buscas, atualização ao focar a tela e ao voltar para o app).
8. Deixar claro o que foi implementado individualmente: todos os arquivos listados acima.
