# Frontend — processos do Portal

## Processo: agendamento e monitoramento

Em **Consultas do Connector**, o painel **Agendamento e envio de dados** exibe o último contato do Connector, jobs pendentes, em envio ou com falha e as recorrências do cliente selecionado. Cada consulta pode ser executada uma vez ou repetida diariamente, a cada hora ou em um intervalo de minutos. A recorrência pode ser pausada e reativada no próprio painel.

## Processo: contexto do cliente

O usuário autentica, seleciona o tenant e, quando aplicável, a empresa no
cabeçalho. As chamadas enviam token, `X-Tenant-Id` e `X-Company-Id`. Listagens e
ações ficam restritas ao contexto selecionado e às permissões do usuário.

## Processo: consultas do Connector

Na tela de consultas, o administrador cria versões, habilita a versão aprovada,
seleciona Connector e empresa e inicia a carga inicial. A interface não executa
SQL: ela agenda jobs no backend.

## Processo: acompanhamento da carga

O Portal mostra consultas, versões, Connectors ativos e estado da carga. Após o
Connector transmitir os jobs, a API mantém os registros por tipo de entidade e
o Portal consulta resumo, totais e datas de recebimento.

## Processo: listagem

As telas usam endpoints paginados e filtros declarados pelo backend. Produto,
família, tributação e documento fiscal permanecem como entidades distintas.
Filtros inválidos ou campos fora do contrato são rejeitados pela API.

## Processo: revisão fiscal

O Portal apresenta cadastro, regra esperada e operação observada. Divergências
de NCM, CEST, CST, CFOP, bases, alíquotas ou valores exigem revisão rastreável;
nenhum ajuste fiscal é publicado automaticamente apenas por ter sido extraído.

## Processo: documentação

O link **Documentação** no header leva a `/documentation`, com áreas separadas
para Connector, Frontend e Backend. Os arquivos Markdown podem ser abertos em
uma nova aba e compartilhados diretamente.
