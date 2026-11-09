# Avaliador P3 · Proposta Formativa (TEDPRO/IFSC)

App web (PWA) para avaliar a atividade P3, "Seu desafio como proposta formativa", com a rubrica oficial (C1 0 a 2, C2 0 a 3, C3 0 a 2, C4 0 a 2, C5 0 ou 1; total 10).

## Recursos
- Importa o PDF do modelo P3 (lido no navegador com pdf.js, por posição do texto) e preenche os campos, incluindo a tabela da Parte 2.
- Correção semântica opcional da extração e sugestão de notas com IA, pela OpenAI ou pela Anthropic (Claude), escolhida em `IA_PROVEDOR`; sem chave, usa análise local de completude. A chamada fica toda em `ia.js`.
- Alertas automáticos: nome, matrícula, orientador incorreto/vazio, texto do modelo no desafio, campos vazios, soma das durações x carga horária, declaração de IA.
- Feedback no padrão do Prof. Rogério (Olá..., Tema/Assunto, só critérios abaixo do máximo, Um abraço), sem travessões.
- Turmas, duplicidade, status das correções solicitadas, exportação JSON/CSV, backup no GitHub e relatório executivo imprimível com 4 gráficos.

## Rodar localmente
```bash
npm install
cp .env.example .env
npm start      # http://localhost:3000
npm test
```
Sem `DATABASE_URL`, as turmas ficam em `data/turmas.json` (ignorado pelo git).

## Dados dos alunos
PDFs e dados de alunos NÃO devem ser versionados. O backup vai apenas para o repositório privado `avaliador-p3-proposta-formativa-dados`.

Veja `DEPLOY.md` para publicar no Render.

## Seletor de IA

Com as duas chaves configuradas (`OPENAI_API_KEY` e `ANTHROPIC_API_KEY`), a janela de login do app tem o campo **Inteligência artificial** (OpenAI ou Claude), e o topo da página tem o seletor **IA** para trocar a qualquer momento. A escolha fica salva no navegador. `IA_PROVEDOR` define só a opção inicial. A janela de login agora é do próprio app (o servidor envia `X-Login-Necessario` em vez de `WWW-Authenticate`).
