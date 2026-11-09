# Contexto Unificado do Projeto RotuScan

## 1. O que é o projeto
App de segurança alimentar (TCC) para identificar alérgenos (Glúten, Lactose, Amendoim) em rótulos via processamento de imagem e OCR.
O sistema é dividido em três frentes que compartilham o mesmo banco (`RotuScanDB` no MongoDB Atlas):
- **Mobile (`mobile/`)**: Aplicativo em React Native (Expo) focado na experiência do paciente (leitura de rótulos, alertas e histórico).
- **Server (`server/`)**: API REST em Node.js/Express, OCR (Tesseract + Sharp) e fonte única da verdade das regras e do banco.
- **Web**: Painel do nutricionista em Next.js para gestão de pacientes e restrições, desenvolvido por outra frente em repositório externo (não verificado no workspace local).

## 2. Stack e versões reais
- **Mobile**: Expo SDK 58 (`expo ~58.0.22`), Expo Router `~58.0.29`, React Native `0.88.1`, React `19.3.0`, TypeScript `~6.0.3`.
- **Server**: Node.js `v22.20.0`, Express `^5.3.0` (ES modules), Mongoose `^9.11.4`, Sharp `^0.35.5`, node-tesseract-ocr `^2.2.1`.
- **OCR Engine**: Tesseract OCR `v5.5.0` (`C:\Program Files\Tesseract-OCR\tesseract.exe`) com pacote de idiomas `por` + `eng`.
- **Banco de Dados**: MongoDB Atlas cluster multi-tenant (`RotuScanDB`).
- **Segurança**: JWT (`jsonwebtoken ^9.0.3`), `bcryptjs ^3.0.3`, Rate Limit (`express-rate-limit ^8.7.2`).

## 3. Mapa do código
| Onde fica | O que faz |
| :--- | :--- |
| `server/server.js` | Ponto central da API Express, rotas HTTP, conexão Mongoose e inicialização do servidor. |
| `server/models/User.js` | Schema Mongoose de usuários (pacientes e nutricionistas, roles, restrições, níveis e vínculo). |
| `server/models/ScanLog.js` | Schema de histórico de escaneamentos, vereditos, alérgenos detectados e metadados de produto. |
| `server/models/AllergenDictionary.js` | Dicionário de termos diretos, derivados e frases de contaminação cruzada por alérgeno. |
| `server/models/Feedback.js` | Schema de feedbacks de usuários com categoria, avaliação e plataforma. |
| `server/models/HelpQuestion.js` | Schema para FAQ e dúvidas frequentes do app. |
| `server/models/Usuario.js` | Schema da coleção legada `usuarios` (mantido para migração). |
| `server/services/ocrAnalyzer.js` | Motor analítico que cruza texto OCR com dicionário e perfis de sensibilidade. |
| `server/services/ocr/extractText.js` | Extração de texto via Sharp (pré-processamento) e Tesseract OCR. |
| `server/utils/texto.js` | Funções de normalização, higienização e remoção de acentos/ruídos. |
| `server/seeds/dicionarioPadrao.js` | Carga inicial do dicionário de alérgenos padronizado no MongoDB. |
| `server/scripts/smoke-test.js` | Teste de fumaça de ponta a ponta (15 etapas cobrindo autenticação, vínculo, OCR e exclusão). |
| `server/scripts/verify-db.js` | Script de diagnóstico e contagem de documentos no banco. |
| `server/scripts/backup.js` | Exportação de segurança (JSON) das coleções sem alterar dados. |
| `server/scripts/migrate-usuarios-to-users.js` | Migração gradual de `usuarios` para `users` (modo `--dry-run` por padrão). |
| `server/scripts/cleanupDb.js` | Remoção de dados órfãos e coleções legadas (destrutivo, requer `--confirm`). |
| `mobile/app/index.tsx` | Splash screen com validação de token JWT e redirecionamento de sessão. |
| `mobile/app/login.tsx` | Tela de autenticação por e-mail e senha. |
| `mobile/app/cadastro.tsx` | Tela de cadastro de paciente com código opcional de nutricionista. |
| `mobile/app/vincular-nutricionista.tsx` | Consulta e validação prévia de código de nutricionista (formato `XXXX-XXXX`). |
| `mobile/app/selectIntolerancia.tsx` | Onboarding de seleção inicial de intolerâncias no primeiro acesso pós-cadastro. |
| `mobile/app/home.tsx` | Tela inicial com chips de intolerâncias ativas, progresso, atalhos e últimos scans. |
| `mobile/app/scanner.tsx` | Captura de foto via câmera ou galeria e envio multipart para análise OCR. |
| `mobile/app/resultado.tsx` | Exibição detalhada do veredito (SEGURO/PERIGOSO/INCONCLUSIVO) e lista de ingredientes. |
| `mobile/app/historico.tsx` | Histórico de escaneamentos com busca textual e filtros (Todos, Risco, Seguro). |
| `mobile/app/itensCurtidos.tsx` | Listagem de produtos favoritados pelo paciente. |
| `mobile/app/perfil.tsx` | Dados do usuário, foto/avatar, status do vínculo com nutricionista e atalhos da conta. |
| `mobile/app/editar-perfil.tsx` | Edição de restrições alimentares com dirty state e validação de intolerância mínima. |
| `mobile/app/dados-pessoais.tsx` | Atualização cadastral de nome, e-mail e alteração de senha. |
| `mobile/app/notificacoes.tsx` | Central de notificações: `SectionList` por período (Hoje, Esta semana, Anteriores), filtro Todas/Não lidas, marcar todas como lidas e dispensar. |
| `mobile/context/NotificacoesContext.tsx` | Estado global das notificações (feed, lidas, ocultas, contador de não lidas), com atualização ao focar telas e ao voltar para o app. |
| `mobile/services/notificacoes.ts` | Monta o feed a partir de `GET /users/perfil` e `GET /users/historico?filtro=Risco`; persiste lidas/ocultas por usuário no AsyncStorage. |
| `mobile/components/NotificacaoItem.tsx` | Item reutilizável (Props) de notificação, com ícone/cor por tipo e indicador de não lida. |
| `mobile/app/alertas.tsx` | Configuração de alertas de traços ("Pode conter...") e sensibilidade por alérgeno. |
| `mobile/app/ajuda.tsx` | Central de ajuda, FAQ e envio de feedback com limite de envios. |
| `mobile/app/configuracoes.tsx` | Ajustes do app, termos de privacidade e controle de sessão. |
| `mobile/context/AuthContext.tsx` | Contexto de autenticação, estado global do usuário e sincronização atômica com AsyncStorage. |
| `mobile/services/api.ts` | Instância Axios com baseURL configurável via `EXPO_PUBLIC_API_URL` e interceptor JWT. |
| `mobile/components/Header/AppHeader.tsx` | Cabeçalho unificado com logo RotuScan, menu lateral, sino de notificações com badge e avatar. |
| `mobile/components/Drawer/DrawerMenu.tsx` | Menu lateral com navegação das principais rotas do aplicativo. |
| `mobile/components/TabBar/indexTab.tsx` | Barra inferior de abas (Início, Histórico, Scanner central, Favoritos, Perfil). |
| `mobile/components/SensitivitySlider.tsx` | Componente de slider interativo de 3 níveis (Leve, Moderado, Grave). |
| `mobile/components/ConfirmModal.tsx` | Modal padronizado para confirmações e ações destrutivas/descarte. |
| `mobile/components/ScanThumb.tsx` | Renderizador seguro de miniaturas de produtos com fallback de ícone. |

## 4. Banco (RotuScanDB)
Detalhes completos em `docs/contrato-banco.md`.
- **Coleções**: `users` (usuários), `scanlogs` (scans), `allergen_dictionaries` (dicionário OCR), `feedbacks` (avaliações), `helpquestions` (FAQ), `usuarios` (legado).
- **Campos-chave em `users`**: `role` (`'PACIENTE'|'NUTRICIONISTA'`), `restricoes` (`['gluten','lactose','amendoim']`), `niveisSensibilidade`, `codigoNutricionista` (8 chars alfanuméricos), `nutricionistaId` (ObjectId), `vinculadoEm` (Date), `restricoesAtualizadasPor` (`'PACIENTE'|'NUTRICIONISTA'`).
- **Níveis de Sensibilidade**:
  - `0 - Leve`: Alerta apenas ingredientes diretos; avisos de traços ("Pode conter...") são ignorados.
  - `1 - Moderado`: Alerta ingredientes diretos e avisos de traços/contaminação cruzada.
  - `2 - Grave`: Alerta com tolerância zero; qualquer presença ou traço gera status crítico.

## 5. API
| Método | Rota | Quem acessa | Finalidade |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/register` | Pública | Cadastro de paciente (ignora role adulterado no payload). |
| `POST` | `/auth/register-nutricionista` | Pública | Cadastro de nutricionista com geração de código único. |
| `POST` | `/auth/login` | Pública | Autenticação com e-mail/senha e emissão de JWT. |
| `GET` | `/vinculo/nutricionista/:codigo` | Pública | Consulta prévia de nutricionista por código (com rate limit). |
| `GET` | `/users/perfil` | Autenticado | Dados do perfil logado, restrições e nutricionista vinculado. |
| `PUT` | `/users/perfil` | Autenticado | Atualização de dados cadastrais e avatar (base64). |
| `PUT` | `/users/restricoes` | Paciente | Atualiza restrições e níveis (`$set`), gravando atualizadoPor='PACIENTE'. |
| `POST` | `/users/vinculo` | Paciente | Vincula paciente ao nutricionista via código e grava `vinculadoEm`. |
| `DELETE` | `/users/vinculo` | Paciente | Desvincula o nutricionista atual da conta do paciente. |
| `DELETE` | `/users/me` | Autenticado | Exclusão de conta (limpa dados do paciente; desassocia pacientes se for nutri). |
| `POST` | `/scanner` | Paciente | Envio multipart de imagem do rótulo para OCR e geração de log. |
| `GET` | `/users/historico` | Paciente | Listagem paginada do histórico do paciente com filtros e busca. |
| `GET` | `/users/historico/:id` | Paciente | Detalhes de um escaneamento específico do paciente. |
| `GET` | `/users/historico/:id/imagem` | Paciente/Nutri | Imagem processada da miniatura do scan em disco. |
| `PATCH` | `/users/historico/:id` | Paciente | Edição de nome, marca e peso do produto escaneado. |
| `PATCH` | `/users/historico/:id/curtir` | Paciente | Alterna status de favorito (`curtido: true/false`). |
| `GET` | `/nutri/pacientes` | Nutricionista | Lista pacientes vinculados ao nutricionista logado. |
| `GET` | `/nutri/pacientes/:id` | Nutricionista | Detalhes do paciente vinculado. |
| `GET` | `/nutri/pacientes/:id/historico`| Nutricionista | Scans do paciente realizados **após** a data do vínculo (`createdAt >= vinculadoEm`). |
| `PUT` | `/nutri/pacientes/:id/restricoes`| Nutricionista | Nutricionista altera restrições do paciente (`atualizadoPor='NUTRICIONISTA'`). |
| `DELETE` | `/nutri/pacientes/:id/vinculo` | Nutricionista | Nutricionista desvincula o paciente de sua carteira. |
| `POST` | `/feedback` | Autenticado | Envio de feedback (rate limit de 5 envios por hora). |
| `GET` | `/users/ajuda` | Autenticado | Retorna lista de dúvidas frequentes cadastradas. |

## 6. Pipeline do OCR
Detalhes em `docs/metodologia-ocr.md`.
1. **Recepção**: `multer` valida upload de imagem (máximo 12MB).
2. **Pré-processamento (`sharp`)**: Auto-orientação EXIF, escala de cinza, ajuste de contraste, binarização e resize.
3. **Extração de Texto**: `node-tesseract-ocr` em português (`por` + `eng`) ou fallback no Windows para binário nativo.
4. **Higienização de Texto**: Normalização via `server/utils/texto.js` (remoção de caracteres espúrios e pontuação ruidosa).
5. **Classificação e Cruzamento**:
   - Detecção das seções `"INGREDIENTES"` e `"ALÉRGICOS"`.
   - Busca de termos diretos e sinônimos no `AllergenDictionary`.
   - Filtragem estrita baseada nas `user.restricoes` ativas no MongoDB.
   - Aplicação de tolerância a traços ("PODE CONTER") pelo nível de sensibilidade (0 Leve ignora; 1 e 2 disparam risco).
6. **Vereditos**:
   - `SEGURO`: Nenhum alérgeno restrito ao usuário detectado.
   - `PERIGOSO`: Alérgeno ou traço relevante detectado conforme o perfil.
   - `INCONCLUSIVO`: Imagem ilegível, sem lista de ingredientes identificável ou menos de 15 caracteres válidos.
7. **Persistência**: Miniatura comprimida salva em `uploads/scans/<userId>/<logId>.jpg` e registro gravado em `ScanLog`.

## 7. Regras de negócio e decisões importantes
- **Fonte Única da Verdade**: O backend valida todas as restrições com base no MongoDB Atlas via token JWT.
- **Vínculo com Código**: Códigos de 8 caracteres alfanuméricos gerados no formato `XXXX-XXXX` (maiúsculos/minúsculos tolerados).
- **Privacidade Temporal do Vínculo**: O nutricionista só tem acesso aos escaneamentos feitos **a partir da data de vínculo** (`createdAt >= vinculadoEm`). Scans antigos do paciente são privados.
- **Miniaturas Locais no Servidor**: Miniaturas ficam em `server/uploads/scans/` e são servidas por stream autenticado via rota segura (nunca diretório público).
- **Conservadorismo no OCR**: Na dúvida de leitura ou baixa legibilidade, o veredito é `INCONCLUSIVO` para proteger a saúde do usuário.
- **Validação de Edição**: O usuário deve manter ao menos 1 intolerância ativa ao salvar o perfil, mas a interface permite ligar a nova antes de desligar a antiga sem bloqueios prematuros.

## 8. Convenções
- **Código**: JavaScript moderno (ES Modules `import/export`) no servidor e TypeScript estrito no mobile.
- **Formato de Erro**: Sempre JSON `{ "sucesso": false, "mensagem": "Texto em português", "erros": {} }`.
- **AsyncStorage**: Apenas chaves oficiais `@rotuscan_token`, `@usuario_id`, `@usuario_nome`, `@usuario_email`, `@usuario_avatar`, `@usuario_restricoes`, `@usuario_niveis`. Proibido ler chaves legadas soltas.
- **Navegação Expo**: Sem dependência de `@react-navigation/drawer` DrawerItem nativo com bugs conhecidos; navegação via modal customizado `DrawerMenu.tsx` com Expo Router.
- **Segurança de Banco**: Proibido comandos destrutivos (`dropDatabase`, `deleteMany` sem filtro restrito). Scripts devem ter `--dry-run` por padrão.

## 9. Comandos úteis
- **Server**:
  - `npm start`: Inicia o servidor Express (`node server.js`).
  - `npm run smoke`: Roda a bateria automatizada de 15 testes de fumaça (cria e remove apenas suas próprias contas de teste).
  - `npm run verify-db`: Inspeção somente-leitura das coleções do banco de dados.
  - `npm run backup`: Gera snapshot JSON em `server/backups/` (somente leitura).
  - `npm run migrate`: Migra dados de `usuarios` para `users` (modo `--dry-run` padrão).
  - `npm run cleanup`: **(DESTRUTIVO)** Remove documentos obsoletos e coleções legadas (requer `--confirm`).
  - `npm run seed:demo`: Popula usuários e scans de demonstração no banco.
  - `npm run seed:demo:clear`: **(DESTRUTIVO)** Remove apenas os dados criados pelo script de demonstração.
- **Mobile**:
  - `npx expo start`: Inicia o Metro Bundler.
  - `npx tsc --noEmit`: Checagem completa de tipos TypeScript no app mobile.

## 10. Estado atual
- **Pronto e Testado**:
  - Fluxo de vínculo por CRN: consulta pública, solicitação pendente, aprovação/recusa pelo Painel Web no banco compartilhado, cancelamento e desvinculação.
  - O mobile atualiza o vínculo ao abrir as telas, voltar ao app e, enquanto há solicitação pendente, periodicamente. O vínculo só fica ativo após aprovação, quando `users.nutricionistaId` aponta para `nutricionistas._id`.
  - Backend validado pelo smoke test CRN (14 verificações, inclusive autenticação, rate limits e recuperação de referências legadas inválidas). O Web não está no workspace; precisa consumir o contrato em `docs/contrato-banco.md`.
  - Histórico de scans e Curtidos com recarregamento reativo no foco (`useFocusEffect`), filtro seguro de `userId` (ObjectId/$in), gravação única via `ScanLog` em `scanlogs`, miniatura JPEG no documento e busca sem depender de `nomeBusca`.
  - Alertas de contaminação cruzada e sensibilidade interativa por níveis (0, 1 e 2).
  - Feedback simplificado: formulário com mensagem (3..1000) e botão de envio; listagem com mensagem e data/hora; schema e rotas sem tipo/plataforma/versão; rate limit de 5/h mantido.
  - Persistência e dirty state na edição de intolerâncias (`editar-perfil.tsx`) com reflexo instantâneo no `AuthContext` e na `Home`.
  - Verificação somente-leitura do banco encontrou 2 referências `users.nutricionistaId` sem documento correspondente em `nutricionistas`; nenhum dado real foi alterado. O app permite recuperar a referência ao paciente solicitar outro CRN.
  - Estrutura observada em 7 `scanlogs`: `imagemUri` e `imagemArquivo` são `null` em 2 e `string` em 5; `imagemThumb` é `string` em 2 e está ausente em 5. Manter esses campos opcionais no Web.
- **Parcial**:
  - FAQ/Ajuda: telas funcionais, base de perguntas no banco alimentada por seed básico.
- **Bugs conhecidos / Pontos de atenção**:
  - Tela Splash no iOS/Android: monitorar transição para ocultar a imagem nativa do Expo antes da animação React Native para evitar sobreposição transitória.

## 11. Histórico resumido
| Data | Marco / O que foi feito | Arquivos principais |
| :--- | :--- | :--- |
| 2026-11-05 | Migração do vínculo para solicitação por CRN com aprovação Web, atualização das telas mobile, contrato do banco e smoke test. | `server/server.js`, `server/models/SolicitacaoVinculo.js`, `mobile/services/vinculo.ts`, `docs/contrato-banco.md` |
| 2026-11-01 | Unificação do banco `RotuScanDB`, refatoração de models e scripts de diagnóstico. | `server/server.js`, `server/models/User.js`, `server/models/ScanLog.js` |
| 2026-11-01 | Implementação do fluxo de vínculo nutricionista ↔ paciente com restrição de escopo temporal. | `server/server.js`, `mobile/app/vincular-nutricionista.tsx` |
| 2026-11-01 | Pipeline completo de OCR com Tesseract, pré-processamento Sharp e persistência de thumbnails. | `server/services/ocrAnalyzer.js`, `server/services/ocr/extractText.js` |
| 2026-11-02 | Refinamento de UI: Drawer Menu customizado, navegação corrigida e filtros do histórico. | `mobile/components/Drawer/DrawerMenu.tsx`, `mobile/app/historico.tsx` |
| 2026-11-02 | Correção da persistência de intolerâncias: `AuthContext`, dirty state em `editar-perfil` e sincronização reativa com a `Home`. | `mobile/context/AuthContext.tsx`, `mobile/app/editar-perfil.tsx`, `mobile/app/home.tsx` |
| 2026-11-02 | Expansão do `smoke-test.js` cobrindo troca de intolerâncias no banco e reflexo direto no veredito do OCR. | `server/scripts/smoke-test.js` |
| 2026-11-02 | Simplificação de Feedback: remoção de tipo/plataforma/appVersao na tela, schema e rotas; script de migração $unset; contrato e smoke test atualizados. | `server/models/Feedback.js`, `server/server.js`, `mobile/app/ajuda.tsx`, `server/scripts/migrate-feedback-clean.js` |
| 2026-11-02 | Correção do Histórico/Curtidos: recarregamento dinâmico no foco, compatibilidade de userId (ObjectId), fuso e script `npm run scans`. | `server/server.js`, `mobile/app/historico.tsx`, `mobile/app/itensCurtidos.tsx`, `server/scripts/listar-scans.js` |
| 2026-11-02 | Diagnóstico e correção do scanner: inconclusivos respondem sem gravar; gravação concludente confirmada em `scanlogs`, thumbnail no documento, busca dinâmica e migração legada em dry-run. | `server/server.js`, `server/models/ScanLog.js`, `server/scripts/smoke-test.js`, `server/scripts/migrate-historicos-to-scanlogs.js`, `docs/contrato-banco.md` |

## 12. Não ler (ignorar para economizar tokens)
- `node_modules/` (server e mobile)
- `server/uploads/` (miniaturas de fotos de scans)
- `server/backups/` (arquivos de despejo de banco)
- `docs/figma/` (arquivos e imagens de telas)
- Arquivos de lock (`package-lock.json`), builds e pastas `.expo/`
- Ler apenas quando expressamente solicitado pelo usuário.

## 13. Como atualizar este arquivo
Ao concluir uma tarefa, edite cirurgicamente apenas as seções **10. Estado atual** e **11. Histórico resumido**. Mantenha o formato conciso em tópicos e linhas de tabela sem reescrever o restante do documento.
