# Deploy (Render + Neon)

1. Crie os repositórios `avaliador-p3-proposta-formativa` (app) e `avaliador-p3-proposta-formativa-dados` (privado, backup).
2. Crie um banco no Neon e copie a `DATABASE_URL`.
3. No Render: New > Blueprint apontando para este repositório (usa `render.yaml`).
4. Variáveis obrigatórias: `APP_PASSWORD`, `DATABASE_URL`. Opcionais: `OPENAI_API_KEY`, `OPENAI_MODEL`, `GITHUB_DATA_TOKEN` (token com acesso de escrita ao repositório de dados, guardado só no servidor).
5. Teste `/api/health`. O app exige senha (usuário `professor`, ou `APP_USERNAME`).
