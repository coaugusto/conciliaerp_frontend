# Processos de extração e consulta de dados Consinco

> Documento operacional e técnico do Connector Desktop e da API Concilia ERP.
> Última atualização: 27/08/2026.

## 1. Objetivo e separação de responsabilidades

O fluxo é dividido em processos independentes. Essa separação evita que uma
consulta de família, tributação ou documento fiscal seja tratada como cadastro
de produto.

| Processo | Responsável | Resultado |
| --- | --- | --- |
| Configuração Oracle | Connector Desktop | Sessão Oracle somente leitura |
| Listagem do catálogo | API + Connector | Consultas habilitadas, versionadas e assinadas |
| Agendamento da carga | Portal/API | Um job por consulta e empresa |
| Extração | Connector | Linhas originais retornadas pelo Oracle |
| Transmissão | Connector + API | Lotes idempotentes vinculados ao job |
| Persistência | API | `ConnectorExtractRecord` por entidade e chave de origem |
| Listagem | API/Portal | Resumo, paginação e filtros por tenant/empresa |
| Validação fiscal | API | Confronto entre cadastro, regra fiscal e operação efetiva |

O Connector nunca executa `INSERT`, `UPDATE` ou `DELETE` no Oracle. A API não
recebe credenciais Oracle e não abre conexão com o banco do cliente.

## 2. Processo: configuração e resolução do schema Oracle

### 2.1 Dados configurados localmente

- conteúdo do `TNSNAMES.ORA`;
- alias TNS;
- pasta opcional do Oracle Instant Client para modo Thick;
- usuário e senha de leitura;
- schema dos dados, opcional, por exemplo `CONSINCO`.

Quando o schema dos dados é informado, o Connector abre a conexão e executa:

```sql
ALTER SESSION SET CURRENT_SCHEMA = "CONSINCO"
```

As consultas do catálogo usam nomes sem prefixo, como `MAP_FAMDIVISAO`. Se o
campo ficar vazio, o Oracle resolve o objeto no schema do usuário conectado ou
por synonym. `CURRENT_SCHEMA` não concede permissão: o usuário ainda precisa de
`SELECT` nos objetos consultados.

O nome do schema é convertido para maiúsculas e aceito somente quando corresponde
a um identificador Oracle válido. Essa validação impede injeção no comando de
sessão.

## 3. Processo: listagem e sincronização das consultas

### 3.1 Catálogo no backend

O catálogo fonte fica em `prisma/consinco-query-catalog.ts`. Cada definição tem:

- código estável da entidade;
- descrição;
- SQL somente leitura;
- parâmetros;
- timeout;
- máximo de linhas;
- tamanho do lote.

Ao publicar uma nova versão, o backend calcula SHA-256 sobre o SQL normalizado.
Somente uma versão habilitada por código deve ser sincronizada com cada Connector.

### 3.2 Sincronização pelo Connector

1. O Connector chama `POST /api/v1/connectors/catalog/updates`.
2. A API devolve somente consultas habilitadas para o tenant autenticado.
3. O Connector valida que o SQL contém apenas `SELECT`/`WITH`.
4. O Connector recalcula o SHA-256 e compara com a assinatura recebida.
5. O catálogo validado é armazenado localmente de forma protegida.
6. O heartbeat informa código, versão, hash e estado da capacidade.

O SQL não é aceito diretamente da interface. A execução usa o conteúdo assinado
do catálogo local.

## 4. Processo: carga inicial controlada

### 4.1 Criação dos jobs

Um administrador inicia a carga pelo Portal/API em:

```http
POST /api/v1/connector-initial-loads
```

A API seleciona as versões habilitadas e cria um `ConnectorSyncJob` por consulta.
O job contém tenant, empresa, Connector, código, versão, hash e parâmetros.

### 4.2 Execução local

Ao clicar em **Processar carga inicial**, o Connector não converte as consultas
para `ProductRecord`. Ele usa o protocolo de jobs:

1. busca `GET /api/v1/connectors/jobs/next`;
2. confere código, versão e assinatura contra o catálogo local;
3. abre uma sessão Oracle somente leitura;
4. aplica `CURRENT_SCHEMA`, quando configurado;
5. executa o SQL com os parâmetros autorizados;
6. mantém todas as colunas e linhas originais;
7. divide o resultado conforme `batchSize`;
8. calcula SHA-256 do conteúdo de cada lote;
9. envia o lote para `POST /api/v1/connectors/jobs/{jobId}/batches`;
10. conclui em `POST /api/v1/connectors/jobs/{jobId}/complete`.

O botão processa apenas jobs previamente autorizados. Se não houver job pendente,
o Portal deve iniciar ou retomar a carga.

### 4.3 Idempotência e retomada

Cada lote usa um `batchId` determinístico (`jobId` + número do lote) e um
`payloadHash`. Se o mesmo lote for reenviado:

- mesmo hash: a API reconhece como duplicado;
- hash diferente: a API rejeita o lote;
- lotes já confirmados permanecem gravados.

A conclusão só é aceita quando todos os números de lote esperados existem. Uma
falha registra código e mensagem no job, sem apagar os lotes recebidos.

## 5. Processo: persistência no backend

Após confirmar um lote, a API chama `ConnectorExtractionService.ingest`. Cada
linha vira um `ConnectorExtractRecord` identificado por:

- tenant;
- Connector;
- tipo de entidade;
- chave estável de origem.

O armazenamento usa `upsert`: nova chave cria o registro; chave existente atualiza
payload, datas e job de origem.

| Entidade | Chave de origem |
| --- | --- |
| `MAX_EMPRESA_V1` | `company_number` |
| `MASTER_PRODUCTS_V1` | `product_id` |
| `FAMILY_DIVISION_CATEGORY_V1` | família + divisão + categoria |
| `FAMILY_TAX_PROFILE_V1` | família + divisão + tributação |
| `TAXATION_UF_V1` | tributação + UF empresa + UF contraparte + tipo + regime |
| `FAMILY_UF_DEFAULT_RATE_V1` | família + UF |
| `FAMILY_PACKAGING_V1` | família + quantidade + unidade da embalagem |
| `FAMILY_SUPPLIERS_V1` | família + fornecedor |
| `FISCAL_DOCUMENT_ITEMS_V1` | documento + produto + número do item |

`MAX_EMPRESA_V1` é processada como fonte de identidade. O CNPJ permite associar
os demais registros à empresa correta do tenant.

## 6. Processo: detalhe de cada extração Oracle

### 6.1 Empresas — `MAX_EMPRESA_V1`

Fonte principal: `MAX_EMPRESA`.

Extrai número da empresa, CNPJ, razão social, fantasia, UF e divisão. O CNPJ é
normalizado para 14 dígitos e usado para localizar ou atualizar a empresa na API.

### 6.2 Produtos e classificação fiscal — `MASTER_PRODUCTS_V1`

Fontes: `MAP_PRODUTO` e `MAP_FAMILIA`.

O produto fornece identificador, descrição, referência, situação cadastral e
datas de alteração. A família fornece NCM (`CODNBMSH`), CEST (`CODCEST`), alíquota
de IPI e CST de PIS, Cofins e IPI cadastrados.

Esses valores representam o cadastro. Eles não provam qual tributação foi
efetivamente aplicada em uma nota.

### 6.3 Hierarquia mercadológica — `FAMILY_DIVISION_CATEGORY_V1`

Fontes: `MAP_FAMDIVCATEG`, `MAP_FAMDIVISAO`, `MAP_CATEGORIA` e `MAX_DIVISAO`.

Relacionamentos:

- família e divisão ligam `MAP_FAMDIVCATEG` a `MAP_FAMDIVISAO`;
- categoria e divisão ligam `MAP_FAMDIVCATEG` a `MAP_CATEGORIA`;
- divisão liga a `MAX_DIVISAO`.

O resultado contém família, divisão, categoria, nível, categoria pai, finalidade,
forma de abastecimento e tributação vinculada.

### 6.4 Perfil tributário da família — `FAMILY_TAX_PROFILE_V1`

Fontes: `MAP_FAMDIVISAO` e `MAP_TRIBUTACAO`.

`MAP_FAMDIVISAO.NROTRIBUTACAO` liga a família/divisão ao perfil de
`MAP_TRIBUTACAO`. São extraídos origem, substituição tributária, tratamento de
IPI, DIFAL e situação do perfil.

### 6.5 Tributação por UF e regime — `TAXATION_UF_V1`

Fontes: `MAP_TRIBUTACAOUF`, `MAP_TRIBUTACAO` e `MAP_REGIMETRIBUTACAO`.

A chave fiscal considera:

- número da tributação;
- UF da empresa;
- UF do cliente/fornecedor;
- tipo de tributação;
- regime tributário.

Da regra são extraídos CST de ICMS, PIS, Cofins e IPI, alíquota e composição de
base do ICMS, ICMS-ST/MVA, FCP e DIFAL. Essa consulta descreve o que está
cadastrado para a combinação fiscal, não o valor efetivamente calculado na nota.

### 6.6 Alíquota padrão por UF — `FAMILY_UF_DEFAULT_RATE_V1`

Fonte: `MAP_FAMALIQPADRAOUF`.

Extrai alíquota padrão de ICMS/FEM e percentual tributado interestadual por
família e UF.

### 6.7 Embalagens — `FAMILY_PACKAGING_V1`

Fonte: `MAP_FAMEMBALAGEM`.

Extrai unidade, quantidade, fator de conversão, pesos, volume, dimensões e
conversão usada na NF-e.

### 6.8 Fornecedores — `FAMILY_SUPPLIERS_V1`

Fontes: `MAP_FAMFORNEC` e `GE_PESSOA`.

Relaciona família e fornecedor, indicando fornecedor principal, tipo, embalagem
de compra, conversão do XML, nome, CNPJ e UF.

### 6.9 Tributação efetiva da nota — `FISCAL_DOCUMENT_ITEMS_V1`

Fontes atuais: `RF_NOTAMESTRE`, `RF_NOTAITEM`, `MAP_PRODUTO`, `MAP_FAMILIA` e
`MAX_EMPRESA`.

O cabeçalho fornece chave/número da nota, emissão, entrada/saída e empresa. O item
fornece produto, CFOP, CST e valores efetivamente calculados:

- `RF_NOTAITEM.CFOP` → `cfop`;
- `RF_NOTAITEM.CODSTF` → `icms_cst`;
- bases, alíquotas e valores de ICMS e ICMS-ST;
- CST, bases, alíquotas e valores de PIS e Cofins;
- CST, base, alíquota e valor de IPI;
- FCP e DIFAL;
- IBS/CBS e classificação tributária quando disponíveis na versão do ERP.

NCM e CEST vêm da família do produto. A chave da linha é documento + produto +
número do item, portanto itens diferentes do mesmo produto não são agrupados.

#### CGO e tributação vinculada

A estrutura compartilhada confirma os campos:

- `RF_NOTAMESTRE.CGO`: Código Geral de Operação do cabeçalho;
- `RF_NOTAITEM.CFOP`: CFOP efetivamente gravado no item;
- `RF_NOTAITEM.CODSTF`: CST efetivamente gravado no item;
- `RF_NOTAITEM.CODTRIBUTACAO`: tributação utilizada no item.

O catálogo oficial atual ainda não expõe `CGO` e `CODTRIBUTACAO` na entidade
`FISCAL_DOCUMENT_ITEMS_V1`. Portanto, hoje a API confronta o CFOP/CST efetivo do
item com o cadastro da família e as regras de `TAXATION_UF_V1`, mas não afirma um
vínculo explícito CFOP → CGO. Para implementar esse confronto, a consulta deve
passar a entregar `cgo` e `taxation_id`; a chave de tributação deve então ser
complementada por UF, tipo e regime para evitar junções duplicadas.

Essa limitação deve permanecer visível até a nova versão da query ser validada
contra as versões de banco dos clientes.

#### Compatibilidade da Reforma Tributária

Algumas bases de teste não possuem as colunas IBS/CBS. O seed aceita:

```env
CONSINCO_WITHOUT_TAX_REFORM_TENANTS=c5teste
```

Para esses tenants, a query mantém os aliases e envia `NULL` tipado. Os demais
tenants continuam consultando os campos reais. Não se deve aplicar a variante
sem IBS/CBS a clientes que já possuam essas informações.

## 7. Processo: listagem dos dados extraídos

### 7.1 Resumo

```http
GET /api/v1/connector-data/summary
```

Retorna, por entidade, quantidade, último recebimento e última alteração na fonte.
O resumo permite detectar uma consulta sem registros após a carga.

### 7.2 Listagem paginada

```http
GET /api/v1/connector-data/{entityType}?page=1&pageSize=50
```

Resposta padronizada da API:

```json
{
  "success": true,
  "data": {
    "items": [],
    "total": 0,
    "page": 1,
    "pageSize": 50,
    "totalPages": 0
  },
  "error": null
}
```

O Connector também desembrulha respostas `{ success, data }` nas chamadas de
normalização, regras tributárias e importação.

### 7.3 Filtros

Filtros são enviados como JSON no parâmetro `filters`. Exemplos:

```http
GET /api/v1/connector-data/MASTER_PRODUCTS_V1?filters={"ncm":"2203"}
GET /api/v1/connector-data/TAXATION_UF_V1?filters={"ufEmpresa":"SP","cstIcms":"00"}
GET /api/v1/connector-data/FISCAL_DOCUMENT_ITEMS_V1?filters={"cfop":"5102"}
```

Somente campos declarados no backend são aceitos. A API sempre restringe a
consulta ao tenant e, para analistas, às empresas autorizadas.

## 8. Processo: confronto fiscal

A validação deve diferenciar três camadas:

1. **Cadastro do produto/família:** NCM, CEST e CST cadastrais.
2. **Regra esperada:** tributação por UF, regime, contraparte e tipo.
3. **Operação observada:** CFOP, CST, bases, alíquotas e valores da nota.

O backend correlaciona registros por `family_id`, `division_id`, `taxation_id`,
UF e empresa. Divergências não sobrescrevem automaticamente o cadastro; elas
geram evidência para revisão.

Para CFOP, os prefixos 1/2/3 indicam entrada e 5/6/7 indicam saída. CST/CSOSN é
validado conforme o regime. PIS e Cofins são confrontados com a direção da
operação e com as regras publicadas.

## 9. Processo: erros e diagnóstico

| Erro/sintoma | Verificação |
| --- | --- |
| `ORA-00942` | schema, nome do objeto e `GRANT SELECT` |
| `ORA-00904` | coluna inexistente na versão do ERP |
| consulta com zero registros | `/connector-data/summary`, job e parâmetros incrementais |
| lote ausente | números gravados em `ConnectorSyncBatch` |
| hash divergente | versão do catálogo e heartbeat do Connector |
| `results.filter is not a function` | cliente antigo sem tratamento do envelope `{ success, data }` |

Consultas estruturadas não devem ser enviadas pela fila legada de produtos. A
execução individual local é reservada a `MASTER_PRODUCTS_V1`; as demais usam
obrigatoriamente jobs controlados.

## 10. Checklist operacional

1. Configurar TNS, credenciais e schema opcional.
2. Testar a conexão Oracle.
3. Habilitar uma única versão de cada consulta no tenant correto.
4. Sincronizar o catálogo e verificar hashes/capacidades.
5. Iniciar a carga inicial no Portal para a empresa correta.
6. Processar a carga no Connector.
7. Conferir jobs concluídos e lotes recebidos.
8. Conferir `/connector-data/summary` para todas as entidades esperadas.
9. Abrir as listagens e validar amostras, chaves e campos fiscais.
10. Submeter divergências à revisão antes de qualquer publicação no ERP.

