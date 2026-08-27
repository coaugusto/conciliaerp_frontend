# Connector — processos operacionais

## Processo: configuração Oracle

1. Informar TNSNAMES, alias, usuário e senha de leitura.
2. Informar opcionalmente o schema dos dados, como `CONSINCO`.
3. O Connector executa `ALTER SESSION SET CURRENT_SCHEMA` quando o schema está configurado.
4. Testar a conexão antes de sincronizar consultas.

O schema altera a resolução dos nomes, mas não concede privilégios. O usuário
Oracle precisa de `SELECT` nos objetos utilizados.

## Processo: sincronização do catálogo

1. Autenticar o Connector por sua identidade persistente.
2. Buscar as consultas habilitadas na API.
3. validar que cada SQL contém somente `SELECT`/`WITH`.
4. Recalcular e conferir o SHA-256.
5. Armazenar o catálogo localmente de forma protegida.
6. Informar versões e hashes no heartbeat.

## Processo: carga inicial

1. O Portal cria um job por consulta habilitada.
2. O Connector busca o próximo job autorizado.
3. Executa a consulta no Oracle em modo somente leitura.
4. Preserva todas as colunas do resultado.
5. Divide as linhas conforme o tamanho autorizado do lote.
6. Calcula o hash e envia cada lote à API.
7. Marca o job como concluído somente após todos os lotes.

Consultas de família, tributação e documentos não passam pela fila legada de
produtos. A execução individual local é reservada ao cadastro mestre de produtos.

## Processo: retomada

Cada lote possui identificador e hash. Um lote já confirmado com o mesmo hash é
tratado como duplicado válido. Uma falha não remove os lotes recebidos; a carga
continua do estado registrado no backend.

## Processo: diagnóstico

- `ORA-00942`: validar schema, objeto e permissão de leitura.
- `ORA-00904`: validar se a coluna existe na versão do ERP.
- hash divergente: sincronizar o catálogo novamente.
- nenhum job pendente: iniciar ou retomar a carga no Portal.
- resposta `{ success, data }`: versões atuais do Connector extraem `data` antes do processamento.
