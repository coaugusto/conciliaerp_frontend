# Connector — consultas autorizadas

## Processo: criação

Toda consulta é criada no Portal com código, descrição, SQL, parâmetros,
timeout, limite de linhas e tamanho de lote. O backend gera uma nova versão e o
SHA-256 do SQL.

## Processo: aprovação

Somente uma versão por código deve permanecer habilitada e sincronizada. Ao
habilitar uma nova versão, as versões anteriores deixam de ser entregues ao
Connector.

## Processo: execução

O Connector executa exclusivamente o SQL assinado recebido da API. Texto SQL
digitado na interface não é executado. Jobs com versão ou hash divergente são
rejeitados.

## Processo: alteração compatível

Mudanças de schema, colunas opcionais ou versões do ERP devem gerar uma nova
versão. Variantes por tenant são usadas quando uma base de teste não possui
campos IBS/CBS, sem retirar esses dados das consultas dos clientes que os têm.
