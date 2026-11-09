# Metodologia de OCR e Análise de Ingredientes — RotuScan

Este documento detalha o pipeline técnico de reconhecimento óptico de caracteres (OCR) e classificação de risco alimentar implementado em [`server/services/ocrAnalyzer.js`](file:///C:/Users/guilherme/Desktop/rotuscan-mobile/server/services/ocrAnalyzer.js).

---

## 1. Pré-processamento de Imagem (`sharp`)

Fotos de rótulos tiradas pelo celular frequentemente apresentam variações de iluminação, inclinação (EXIF), sombras e resolução excessiva que prejudicam tanto a velocidade quanto a acurácia do OCR. Antes de enviar a imagem ao Tesseract, aplicamos o seguinte pipeline com `sharp`:

1. **Correção de orientação EXIF (`.rotate()`)**: garante que fotos tiradas em modo retrato no iOS/Android fiquem na orientação correta de leitura.
2. **Redimensionamento proporcional (`.resize({ width: 1200, withoutEnlargement: true })`)**: padroniza a largura máxima em `1200px` sem ampliar imagens menores, reduzindo o tempo de processamento e preservando a nitidez tipográfica.
3. **Conversão para escala de cinza (`.grayscale()`)**: remove ruído cromático de embalagens coloridas.
4. **Normalização de contraste (`.normalize()`)**: expande o histograma de luminância para destacar o texto escuro sobre o fundo claro (ou vice-versa).

Paralelamente, quando o veredito é conclusivo (`SEGURO` ou `PERIGOSO`), o servidor gera uma miniatura leve (`width: 480`, JPEG `quality: 70`) em `server/uploads/scans/<userId>/<logId>.jpg` e remove imediatamente o arquivo bruto temporário em `finally`.

---

## 2. Extração de Texto (`node-tesseract-ocr`)

- **Idioma (`lang`)**: `'por'` (Português)
- **Engine Mode (`oem`)**: `1` (LSTM Neural Net apenas)
- **Page Segmentation Mode (`psm`)**: `3` (Segmentação automática de página)
- **Tratamento de falha**: Caso o binário do Tesseract não esteja instalado no sistema operacional, a API **nunca simula nem inventa resultados**; retorna HTTP `500` (`"OCR indisponível no servidor"`) com instruções de instalação no Windows.

---

## 3. Validação de Qualidade da Leitura (`INCONCLUSIVO`)

Se o texto extraído tiver menos de **40 caracteres úteis** (ou menos de 25 letras), o sistema classifica a leitura como `INCONCLUSIVO`.
- **Motivo de segurança alimentar**: uma foto borrada, escura ou apontada para fora da lista de ingredientes não pode jamais retornar `"PRODUTO SEGURO"` por ausência de palavras-chave.
- Leituras `INCONCLUSIVO` não são salvas no histórico (`ScanLog`) e exibem um aviso âmbar orientando o usuário a tentar novamente com mais luz e foco.

---

## 4. Normalização e Separação de Seções

1. **Normalização Unicode (`normalizar`)**:
   - Decomposição canônica `NFD` seguida de remoção de diacríticos (`\p{M}`).
   - Conversão para minúsculas e colapso de múltiplos espaços.
   - Um mapa de índices (`normalizarMantendoIndices`) preserva a correspondência entre posições no texto normalizado e no texto original.
2. **Separação da seção de contaminação cruzada (`separarSecaoTracos`)**:
   - Expressão regular identifica trechos iniciados por `"pode conter..."` ou `"alérgicos: pode conter..."` até o ponto final (`.`).
   - O texto é dividido em:
     - **`textoPrincipal`**: lista de ingredientes e declarações diretas (`"CONTÉM GLÚTEN"`, `"CONTÉM LACTOSE"`).
     - **`textoTracos`**: avisos de possível contaminação cruzada (`"PODE CONTER LEITE, SOJA E TRIGO"`).

---

## 5. Casamento com Dicionário, Exceções e Negação (Lookbehind)

1. **Ordenação por comprimento decrescente**:
   - Os sinônimos de cada categoria (`AllergenDictionary`) são ordenados do termo mais longo para o mais curto (ex: `"farinha de trigo"` é avaliado antes de `"trigo"`), evitando duplicidade de intervalos.
2. **Máscara de exceções seguras**:
   - Compostos cujo nome contém radical parecido mas **não** possuem o alérgeno são mascarados antes da varredura:
     - `leite de coco`, `leite de amêndoas`, `leite de soja`, `leite de aveia`, `leite de arroz`, `leite de castanha`, `leite vegetal`, `manteiga de cacau`, `ácido láctico`, `lactato de sódio`, `lactato de cálcio`, `trigo sarraceno`.
3. **Fronteira de palavra (`\b`) e Lookbehind Negativo**:
   - Cada termo normalizado e escapado (`escaparRegex`) é avaliado com:
     ```regex
     (?<!nao\s+contem\s+)(?<!sem\s+)(?<!zero\s+)(?<!0%\s+)(?<!nem\s+)(?<!isento\s+de\s+)(?<!livre\s+de\s+)\btermo\b
     ```
   - Além do lookbehind imediato, a função `possuiNegacaoAntes` inspeciona a janela precedente para cobrir construções compostas como `"não contém glúten e lactose"` ou `"sem adição de leite ou derivados"`.

---

## 6. Níveis de Sensibilidade e Classificação (`CONTEM` vs `TRACOS`)

O servidor busca sempre o perfil atualizado do usuário no MongoDB (`User.findById(req.userId)`):

- **Encontrado no `textoPrincipal`** -> registrado como `tipo: 'CONTEM'` (sempre gera veredito `PERIGOSO` para qualquer nível de sensibilidade daquela restrição ativa).
- **Encontrado apenas no `textoTracos` ("pode conter")**:
  - **Nível `0` (Leve)**: o aviso de `"pode conter"` é **ignorado** para aquela categoria.
  - **Nível `1` (Moderado) ou `2` (Grave)**: registrado como `tipo: 'TRACOS'` e gera veredito `PERIGOSO`.

---

## 7. Detalhamento de Ingredientes e Nome Automático

- **Extração de ingredientes (`extrairIngredientesDetalhados`)**:
  - Isola o trecho após `"Ingredientes:"` até o ponto final antes dos alertas alérgicos, divide por vírgulas/ponto-e-vírgula respeitando parênteses e classifica cada item individualmente (`risco: true/false`, `fonte: "Fonte de Glúten" | "Fonte de Lactose" | "Fonte de Amendoim"`).
  - Ingredientes com `risco: true` são posicionados no topo da lista.
- **Nome automático (`nomeAutomatico: true`)**:
  - `PERIGOSO` com `CONTEM`: `"Produto com Glúten"` / `"Produto com Glúten e Lactose"`.
  - `PERIGOSO` apenas com `TRACOS`: `"Produto com traços de Lactose"`.
  - `SEGURO`: `"Produto sem Glúten e Lactose"` (listando as restrições ativas do perfil do usuário).

