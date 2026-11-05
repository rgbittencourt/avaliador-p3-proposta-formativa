# Passo a passo (publicação do Avaliador P3)

## Parte A. Criar os repositórios no GitHub (2 minutos)
1. Acesse github.com/new com a conta `rgbittencourt`.
2. Repositório 1: nome `avaliador-p3-proposta-formativa`, **Public** (ou Private, como os outros), **sem** README, sem .gitignore e sem licença. Clique em Create repository.
3. Repositório 2: nome `avaliador-p3-proposta-formativa-dados`, **Private**, também vazio (sem README). Create repository.
4. Volte ao Claude e diga: "repositórios criados". Eu peço o acesso de escrita e faço o push dos arquivos que já estão prontos (pasta `avaliador-p3-proposta-formativa` e pasta `p3-dados-repo`).

## Alternativa: subir você mesmo, sem o Claude
No computador, dentro da pasta do app descompactada:
```bash
git init -b main
git add .
git commit -m "Avaliador P3 Proposta Formativa"
git remote add origin https://github.com/rgbittencourt/avaliador-p3-proposta-formativa.git
git push -u origin main
```
Para o repositório de dados, repita dentro da pasta `p3-dados-repo` com o remote `avaliador-p3-proposta-formativa-dados`.
Confira antes: `git status` não deve listar `.env`, `node_modules` nem `data/*.json` (já estão no `.gitignore`).

## Parte B. Banco de dados (Neon)
1. Em neon.tech, crie um projeto (ou use o mesmo dos outros avaliadores, com banco separado) e copie a connection string. Ela será a `DATABASE_URL`.
2. O app cria sozinho a tabela `p3_app_state`.

## Parte C. Token do backup no GitHub
1. GitHub > Settings > Developer settings > Fine-grained tokens > Generate new token.
2. Repository access: **somente** `avaliador-p3-proposta-formativa-dados`. Permissão: Contents = Read and write.
3. Copie o token (será `GITHUB_DATA_TOKEN`). Ele fica só no servidor.

## Parte D. Publicar no Render
1. render.com > New > Blueprint > conecte o repositório `avaliador-p3-proposta-formativa`. O `render.yaml` cria o serviço `avaliador-p3`.
2. Preencha as variáveis:
   - `APP_PASSWORD`: senha de acesso ao app (usuário padrão: `professor`)
   - `DATABASE_URL`: do Neon
   - `OPENAI_API_KEY`: opcional (sem ela o app usa a análise local de completude)
   - `GITHUB_DATA_TOKEN`: do passo C
   (`GITHUB_DATA_OWNER`, `GITHUB_DATA_REPO` e `GITHUB_DATA_BRANCH` já vêm no render.yaml.)
3. Aguarde o deploy e abra `https://avaliador-p3.onrender.com` (ou a URL que o Render mostrar). Teste `/api/health`.

## Parte E. Teste final
1. Abra o app, informe usuário e senha.
2. Importe um PDF de aluno, clique em "Avaliar automaticamente", salve na turma.
3. Clique em "Salvar cópia no GitHub" e confira se apareceu `dados/turmas.json` no repositório de dados.
4. Gere o relatório executivo.
5. No celular, use "Adicionar à tela inicial" para instalar o PWA.

## Cuidados
- Nunca suba PDFs ou dados de alunos para o repositório do app.
- Se o Render (plano free) demorar a responder na primeira visita, é o serviço acordando.
- Pendência de conteúdo: definir C5 do Etevoldo (0 ou 1) e revisar o C5 das avaliações anteriores.
