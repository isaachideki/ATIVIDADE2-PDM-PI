# Contrato do Banco de Dados e API — RotuScan (`RotuScanDB`)

Este documento descreve o esquema oficial das coleções no MongoDB Atlas (`RotuScanDB`), as regras de negócio de vínculo Nutricionista ↔ Paciente e as consultas e rotas compartilhadas entre o **App Mobile (Expo / React Native)** e o **Painel Web do Nutricionista (Next.js)**.

---

## 1. Banco Oficial e Padronização de Erros

- **Database**: `RotuScanDB`
- **Variável de ambiente**: `MONGO_URI` (ou `MONGODB_URI`)
- **Formato padrão de erro HTTP (400, 401, 403, 404, 409, 429, 500)**:
  ```json
  {
    "mensagem": "Descrição amigável do erro em português",
    "campos": {
      "nomeDoCampo": "Mensagem específica de validação do campo"
    }
  }
  ```

---

## 2. Coleções Oficiais

### 2.1 `users` (Model `User`)

Armazena os pacientes do aplicativo. Nutricionistas são mantidos pelo Painel Web em `nutricionistas`; campos antigos de CRN/tratamento em documentos de `users` não fazem parte do schema atual e não são apagados por esta mudança.

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `_id` | `ObjectId` | Sim | Auto | Identificador único do usuário |
| `nome` | `String` | Sim (`maxlength: 100`) | — | Nome completo (`trim`) |
| `email` | `String` | Sim (`unique`, `maxlength: 160`) | — | E-mail único (`lowercase`, `trim`) |
| `senha` | `String` | Sim | — | Hash `bcryptjs` (`select: false` nas consultas padrão) |
| `avatar` | `String \| null` | Não | `null` | Data URI Base64 (`data:image/jpeg;base64,...`) ou URL da foto de perfil |
| `role` | `'PACIENTE' \| 'NUTRICIONISTA'` | Sim | `'PACIENTE'` | O cadastro mobile sempre cria `PACIENTE`; `NUTRICIONISTA` permanece apenas para compatibilidade com registros legados |
| `nutricionistaId` | `ObjectId \| null` (`index`) | Não | `null` | Referência (`ref: 'Nutricionista'`) para `nutricionistas._id`; preenchida pelo Web somente após aprovação |
| `vinculadoEm` | `Date \| null` | Não | `null` | Data/hora da aprovação do vínculo no painel Web |
| `consentimentoVinculoEm` | `Date \| null` | Não | `null` | Data/hora do consentimento de compartilhamento de dados com o nutricionista |
| `restricoes` | `Array<'gluten' \| 'lactose' \| 'amendoim'>` | Sim | `[]` | Lista de intolerâncias/alergias ativas do paciente |
| `niveisSensibilidade.gluten` | `0 \| 1 \| 2` | Sim | `1` | `0` = Leve (ignora "pode conter"), `1` = Moderado, `2` = Grave |
| `niveisSensibilidade.lactose` | `0 \| 1 \| 2` | Sim | `1` | `0` = Leve (ignora "pode conter"), `1` = Moderado, `2` = Grave |
| `niveisSensibilidade.amendoim` | `0 \| 1 \| 2` | Sim | `1` | `0` = Leve (ignora "pode conter"), `1` = Moderado, `2` = Grave |
| `restricoesAtualizadasEm` | `Date \| null` | Não | `null` | Data/hora da última alteração nas restrições |
| `restricoesAtualizadasPor` | `'PACIENTE' \| 'NUTRICIONISTA' \| null` | Não | `null` | Quem realizou a última alteração de perfil alimentar |
| `createdAt` | `Date` | Sim | Auto | Data de criação |
| `updatedAt` | `Date` | Sim | Auto | Data da última atualização |

#### Índices de `users`
1. `{ email: 1 }` — `unique: true`
2. `{ nutricionistaId: 1 }` — listagem rápida dos pacientes vinculados a um nutricionista.

> O índice legado de `codigoVinculo`, se já existir no banco, não é removido automaticamente; o código atual não o utiliza.

---

### 2.2 `nutricionistas` (Model `Nutricionista`)

Coleção criada e mantida exclusivamente pelo Painel Web. O mobile faz consultas somente de leitura.

| Campo | Tipo | Descrição |
|---|---|---|
| `_id` | `ObjectId` | Identificador usado em `users.nutricionistaId` e `solicitacoesVinculo.nutricionistaId` |
| `nome` | `String` | Nome exibido ao paciente |
| `email` | `String` | E-mail de autenticação do painel; nunca enviado pelo mobile na busca pública |
| `senha` | `String` | Hash bcrypt; lido pelo servidor somente para conferir login de nutricionista |
| `crn` | `String` | CRN usado para busca normalizada |
| `tratamento` | `String \| null` | Opcional; quando ausente, a interface usa “Nutricionista” |
| `createdAt`, `updatedAt` | `Date` | Timestamps |

### 2.3 `solicitacoesVinculo` (Model `SolicitacaoVinculo`)

| Campo | Tipo | Descrição |
|---|---|---|
| `pacienteId` | `ObjectId` (`ref: 'User'`) | Paciente que solicitou |
| `nutricionistaId` | `ObjectId` (`ref: 'Nutricionista'`) | Profissional solicitado |
| `status` | `'PENDENTE' \| 'APROVADO' \| 'RECUSADO'` | Estado da solicitação |
| `encerradaEm` | `Date \| null` | Data de cancelamento, aprovação/recusa ou encerramento do vínculo |
| `encerradaPor` | `'PACIENTE' \| 'NUTRICIONISTA' \| null` | Responsável pelo encerramento |
| `createdAt`, `updatedAt` | `Date` | Timestamps |

Índices: índice único parcial `{ pacienteId: 1 }` quando `status: 'PENDENTE'`; índice `{ nutricionistaId: 1, status: 1, createdAt: -1 }` para a fila do painel Web.

### 2.4 `scanlogs` (Model `ScanLog`)

Histórico completo de escaneamentos realizados pelos pacientes (incluindo itens curtidos/favoritos).

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `_id` | `ObjectId` | Sim | Auto | Identificador único do escaneamento |
| `userId` | `ObjectId` | Sim (`index`) | — | Referência (`ref: 'User'`) ao dono do escaneamento |
| `escaneadoPorNome` | `String` | Não | `'Usuário'` | Cópia informativa do nome no momento do scan; `userId` continua sendo a fonte da verdade |
| `nomeProduto` | `String` | Sim (`maxlength: 80`) | `'Produto Seguro'` | Nome automático (ex: `"Produto com Glúten"`) ou nome editado pelo usuário |
| `nomeAutomatico` | `Boolean` | Sim | `true` | `true` enquanto for gerado pelo sistema; `false` após renomeação manual |
| `nomeBusca` | `String` | Não (`maxlength: 120`) | `''` | Campo legado/cache opcional; a busca usa `nomeProduto` e `marca` diretamente e ignora valores desatualizados |
| `marca` | `String \| null` | Não (`maxlength: 60`) | `null` | Marca informada pelo usuário (ex: `"ElmaChips"`) |
| `peso` | `String \| null` | Não (`maxlength: 30`) | `null` | Peso/volume informado pelo usuário (ex: `"100g"`) |
| `marcaPeso` | `String` | Não (`maxlength: 100`) | `''` | Compatibilidade; a API monta o valor da resposta a partir de `marca` e `peso` atuais |
| `imagemThumb` | `String \| null` | Não (`select: false`) | `null` | Miniatura JPEG em data URI (`data:image/jpeg;base64,...`); não é incluída em listagens |
| `imagemUri` | `String \| null` | Não | `null` | Campo legado para miniatura JPEG/data URI |
| `imagemArquivo` | `String \| null` | Não | `null` | Caminho relativo em `server/uploads/` (`scans/<userId>/<logId>.jpg`) |
| `imagemDemo` | `String \| null` | Não | `null` | Nome de arquivo estático de demonstração (quando `seed: true`) |
| `intoleranciaDetectada` | `Array<String>` | Sim | `[]` | Rótulos legíveis das intolerâncias acionadas (ex: `["Glúten", "Lactose"]`) |
| `nivelSensibilidade` | `'Leve' \| 'Moderado' \| 'Grave'` | Sim | `'Moderado'` | Nível de sensibilidade ativo na avaliação |
| `confiancaOcr` | `Number \| null` | Não (`0..100`) | `null` | Confiança média (0 a 100) reportada pelo motor de OCR |
| `motorOcr` | `String` | Sim (`maxlength: 40`) | `'tesseract'` | Identificador do motor de OCR utilizado |
| `textoBruto` | `String` | Sim | `''` | Texto integral extraído pelo OCR |
| `veredito` | `'SEGURO' \| 'PERIGOSO'` | Sim | — | Resultado final para o perfil do usuário no momento da leitura |
| `alergicosDetectados` | `Array<AlergicoDetectado>` | Sim | `[]` | `{ categoria, tipo: 'CONTEM'\|'TRACOS', termo, trecho, aproximado, termos }` |
| `ingredientesDetalhados` | `Array<{ nome, risco, fonte }>` | Sim | `[]` | Ingredientes individuais extraídos, com itens de risco no topo |
| `curtido` | `Boolean` | Sim | `false` | Indica se o produto está nos favoritos ("Itens Curtidos") |
| `seed` | `Boolean` | Sim | `false` | `true` apenas para registros inseridos via `seed-demo.js` |
| `createdAt` | `Date` | Sim | Auto | Data/hora do escaneamento |
| `updatedAt` | `Date` | Sim | Auto | Data/hora da última atualização |

#### Índices de `scanlogs`
1. `{ userId: 1, createdAt: -1 }` — listagem cronológica do histórico por usuário.
2. `{ userId: 1, curtido: 1, createdAt: -1 }` — listagem rápida da aba de favoritos ("Itens Curtidos").

#### Edição manual e campos de referência
- Podem ser editados no Atlas/Compass: `nomeProduto`, `marca` e `peso`. A API lê os valores atuais em cada requisição; `marca`/`peso` ausentes ou `null` são aceitos e a resposta monta `marcaPeso` dinamicamente.
- `escaneadoPorNome` é apenas uma cópia informativa do nome do usuário no instante do scan. Não deve ser usado para relacionar registros; a fonte da verdade é `userId` (`ObjectId`, referência a `users`).
- Não edite `userId`, `_id`, `createdAt` ou `updatedAt` manualmente: eles identificam o dono, o registro e a cronologia. `nomeBusca` pode ficar desatualizado e não participa da busca.
- `imagemThumb` é dado binário codificado (data URI), não um campo de edição manual; sua seleção é explicitamente excluída nas consultas comuns.

#### Identificação do Paciente e Consulta pelo Painel Web
Cada registro em `scanlogs` armazena a referência `userId` (`ObjectId`, `ref: 'User'`). `escaneadoPorNome` pode ser exibido para leitura rápida no Atlas, mas é somente uma fotografia informativa; consultas e permissões devem usar `userId`. Nomes e e-mails atuais continuam sendo obtidos de `users`.

Para obter o nome, e-mail e dados cadastrais do paciente a partir de `scan.userId`, o painel Web (Next.js / Node.js) deve utilizar uma das abordagens oficiais:

1. **Via Mongoose `populate` (Recomendado no backend/rotas)**:
   ```javascript
   const scans = await ScanLog.find(filtro)
     .sort({ createdAt: -1 })
     .populate('userId', 'nome email role avatar')
     .lean();
   // O objeto retornado terá: scan.userId._id, scan.userId.nome, scan.userId.email
   ```

2. **Via Pipeline de Agregação MongoDB (`$lookup`)**:
   ```javascript
   const scans = await db.collection('scanlogs').aggregate([
     { $match: filtro },
     { $sort: { createdAt: -1 } },
     {
       $lookup: {
         from: 'users',
         localField: 'userId',
         foreignField: '_id',
         as: 'paciente',
       },
     },
     { $unwind: { path: '$paciente', preserveNullAndEmptyArrays: true } },
     {
       $project: {
         _id: 1,
         nomeProduto: 1,
         veredito: 1,
         alergicosDetectados: 1,
         createdAt: 1,
         curtido: 1,
         pacienteNome: '$paciente.nome',
         pacienteEmail: '$paciente.email',
       },
     },
   ]).toArray();
   ```

3. **Diagnóstico no Terminal (`npm run scans`)**:
   O script somente leitura `server/scripts/listar-scans.js` (`npm run scans [limite]`) executa a agregação acima no terminal e exibe os últimos scans com os nomes e e-mails resolvidos em tempo real.

---

### 2.5 `allergendictionaries` (Model `AllergenDictionary`)

Dicionário central de sinônimos, derivados químicos e exceções seguras para cada categoria de alérgeno.

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `_id` | `ObjectId` | Sim | Identificador único |
| `categoria` | `'gluten' \| 'lactose' \| 'amendoim'` | Sim (`unique`) | Chave canônica da intolerância |
| `sinonimos` | `Array<String>` | Sim | Termos e derivados buscados pelo motor de OCR |
| `excecoes` | `Array<String>` | Sim | Falsos amigos que não acionam o alérgeno (ex.: `"leite de coco"`, `"trigo sarraceno"`) |
| `createdAt` | `Date` | Sim | Data de criação |
| `updatedAt` | `Date` | Sim | Data da última atualização |

---

### 2.6 `feedbacks` (Model `Feedback`)

Mensagens e feedbacks enviados pelos usuários do aplicativo (simplificado).

| Campo | Tipo | Obrigatório | Padrão | Descrição |
|---|---|---|---|---|
| `_id` | `ObjectId` | Sim | Auto | Identificador único |
| `userId` | `ObjectId` | Sim (`index`) | — | Referência (`ref: 'User'`) ao autor do feedback |
| `mensagem` | `String` | Sim (`3..1000` chars) | — | Conteúdo textual enviado (`trim`) |
| `createdAt` | `Date` | Sim | Auto | Data/hora do envio |
| `updatedAt` | `Date` | Sim | Auto | Data/hora de atualização |

> **Nota de Simplificação**: Os campos legados `tipo`, `plataforma` e `appVersao` foram removidos do schema e das rotas. Documentos legados no banco são limpos via script idempotente `server/scripts/migrate-feedback-clean.js` com `$unset`.

---

## 3. Regras de Vínculo Nutricionista ↔ Paciente e Visibilidade

1. **Busca e solicitação por CRN**:
   - Mobile consulta `GET /api/vinculacoes/nutricionista/:crn` e envia `POST /api/vinculacoes/solicitar` ou `POST /auth/register` com `crnNutricionista`.
   - O CRN é validado e normalizado no servidor. A busca compara uma expressão regular ancorada, construída a partir do CRN validado, com o campo `nutricionistas.crn`.
   - O paciente confirma uma solicitação `PENDENTE`; o servidor grava `consentimentoVinculoEm`, mas não preenche `nutricionistaId` nem `vinculadoEm`.
   - Se um paciente enviar uma solicitação e ainda tiver um `nutricionistaId` legado sem documento correspondente em `nutricionistas`, a transação remove essa referência inválida e `vinculadoEm`; referências reais válidas continuam bloqueando uma nova solicitação.
2. **Aprovação pelo Painel Web**:
   - O Web lista solicitações pendentes pelo próprio `nutricionistaId`; aprova ou recusa apenas solicitações `PENDENTE`.
   - Ao aprovar, grava `users.nutricionistaId` como ObjectId de `nutricionistas._id`, grava `users.vinculadoEm` e altera a solicitação para `APROVADO`. O vínculo ativo é sempre determinado por `users.nutricionistaId`.
   - O mobile considera o paciente vinculado somente quando `nutricionistaId` existe e o profissional correspondente é encontrado. `GET /api/vinculacoes/minha-solicitacao` e `GET /users/perfil` retornam o estado `NENHUM`, `PENDENTE`, `APROVADO` ou `RECUSADO`.
3. **Cancelamento e desvinculação**:
   - O paciente cancela uma solicitação pendente via `DELETE /api/vinculacoes/minha-solicitacao`; ela permanece na coleção como `RECUSADO`, encerrada por `PACIENTE`.
   - O paciente desvincula via `DELETE /users/vinculo`; em transação, o servidor remove `nutricionistaId` e `vinculadoEm` e encerra a solicitação aprovada correspondente, sem apagá-la.
4. **Registros históricos**:
   - `users` mantém `crn` e `tratamento` nulos em alguns documentos antigos. O schema novo não os lê nem os remove; `nutricionistas` é a fonte oficial dos dados do profissional.
5. **Regra de Privacidade e Visibilidade Temporal (`FILTRAR_HISTORICO_DESDE_VINCULO = true`)**:
   - O nutricionista **somente visualiza** os escaneamentos realizados pelo paciente **a partir da data/hora do vínculo** (`ScanLog.createdAt >= paciente.vinculadoEm`).
   - Escaneamentos anteriores ao vínculo permanecem privados para o paciente e não aparecem em `GET /nutri/pacientes`, `GET /nutri/pacientes/:id/historico` nem em `GET /nutri/pacientes/:id/historico/:logId/imagem`.
   - Caso o painel Web consulte diretamente o MongoDB via Mongoose/Driver, **deve sempre aplicar o filtro**:
     ```js
     const filtroScansPaciente = {
       userId: paciente._id,
       ...(paciente.vinculadoEm ? { createdAt: { $gte: paciente.vinculadoEm } } : {}),
     };
     ```
6. **Atualização de Restrições pelo Nutricionista**:
   - Ao alterar as restrições ou níveis de sensibilidade de um paciente (`PUT /nutri/pacientes/:id/restricoes` ou via Web), grava-se:
     - `restricoesAtualizadasPor: 'NUTRICIONISTA'`
     - `restricoesAtualizadasEm: new Date()`
   - Quando o paciente abre a Home no aplicativo mobile e `restricoesAtualizadasEm` é mais recente que `@restricoes_vistas_em`, o app exibe um banner avisando: *"Seu nutricionista atualizou suas restrições"*.
7. **Exclusão de Conta (`DELETE /users/me`)**:
   - **Paciente**: remove permanentemente seus `scanlogs`, `feedbacks`, `helpquestions`, pasta de imagens (`server/uploads/scans/<userId>`) e o documento em `users`.
   - **Nutricionista**: **não apaga** nenhuma conta de paciente; limpa `nutricionistaId: null, vinculadoEm: null, consentimentoVinculoEm: null` de todos os pacientes vinculados antes de remover o documento do nutricionista.
