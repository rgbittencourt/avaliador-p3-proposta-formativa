require('dotenv').config();
const express = require('express');
const path = require('path');
const Core = require('./public/p3-core.js');
const db = require('./db');

const { RUBRICA, ORDEM } = Core;
const app = express();
const PORT = process.env.PORT || 3000;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const APP_USERNAME = process.env.APP_USERNAME || 'professor';
const APP_PASSWORD = process.env.APP_PASSWORD || '';

if (process.env.NODE_ENV === 'production' && !APP_PASSWORD) throw new Error('APP_PASSWORD é obrigatória em produção.');
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória em produção para impedir perda de turmas em armazenamento temporário.');

app.use((req, res, next) => {
  if (!APP_PASSWORD || req.path === '/api/health' || !req.path.startsWith('/api/')) return next();
  const header = req.headers.authorization || '';
  let usuario = '', senha = '';
  try { [usuario, senha] = Buffer.from(header.replace(/^Basic\s+/i, ''), 'base64').toString('utf8').split(':'); } catch { /* ignora */ }
  if (usuario === APP_USERNAME && senha === APP_PASSWORD) return next();
  res.set('WWW-Authenticate', 'Basic realm="Avaliador P3 Proposta Formativa", charset="UTF-8"');
  return res.status(401).send('Autenticação necessária.');
});

app.use(express.json({ limit: '6mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('/api/health', (_req, res) => res.json({ ok: true, openaiConfigurada: Boolean(OPENAI_API_KEY) }));

const rota = (fn, cod = 400) => async (req, res) => { try { await fn(req, res); } catch (e) { res.status(cod).json({ erro: e.message }); } };
app.get('/api/turmas', rota(async (_q, r) => r.json(await db.listarTurmas()), 500));
app.post('/api/turmas', rota(async (q, r) => r.status(201).json(await db.criarTurma(q.body?.nome))));
app.patch('/api/turmas/:id', rota(async (q, r) => r.json(await db.renomearTurma(q.params.id, q.body?.nome))));
app.delete('/api/turmas/:id', rota(async (q, r) => r.json(await db.excluirTurma(q.params.id, q.body?.confirmarNome))));
app.get('/api/turmas/:id/avaliacoes', rota(async (q, r) => r.json(await db.listarAvaliacoes(q.params.id)), 404));
app.put('/api/turmas/:id/avaliacoes/:avaliacaoId', rota(async (q, r) => r.json(await db.upsertAvaliacao(q.params.id, q.params.avaliacaoId, q.body)), 500));
app.post('/api/importar-turma', rota(async (q, r) => r.json(await db.importarTurma(q.body || {}))));
app.delete('/api/turmas/:id/avaliacoes/:avaliacaoId', rota(async (q, r) => { await db.removerAvaliacao(q.params.id, q.params.avaliacaoId); r.json({ ok: true }); }, 500));
app.delete('/api/turmas/:id/avaliacoes', rota(async (q, r) => { await db.limparAvaliacoes(q.params.id); r.json({ ok: true }); }, 500));
app.get('/api/backup/github', (_q, r) => r.json(db.statusBackupGitHub()));
app.post('/api/backup/github', async (_q, r) => { try { r.json(await db.sincronizarBackupGitHub()); } catch (e) { r.status(503).json({ erro: e.message, ...db.statusBackupGitHub() }); } });

const txt = (v) => { const s = String(v || '').trim(); return s || '(não preenchido)'; };

function tabelaTexto(d) {
  const l = Array.isArray(d.dinamica) ? d.dinamica : [];
  if (!l.length) return '(tabela vazia)';
  return l.map((x, i) => `${i + 1}. Espaço: ${x.espaco || '-'} | Atividade: ${x.atividade || '-'} | Duração: ${x.duracao || '-'} | Papel do aluno: ${x.papelAluno || '-'} | Papel do professor: ${x.papelProfessor || '-'}`).join('\n');
}

function montarPrompt(d = {}) {
  const rubrica = ORDEM.map((k) => `${k}: ${RUBRICA[k].label} (máximo ${RUBRICA[k].max})\n${RUBRICA[k].niveis.map((n) => `- ${n.pontos}: ${n.desc}`).join('\n')}`).join('\n\n');
  return `Você auxilia um professor a avaliar a atividade P3, Seu desafio como proposta formativa, do TEDPRO/IFSC. Aplique SOMENTE a rubrica oficial e escolha exatamente um valor previsto em cada critério. O critério ia é binário (0 ou 1): vale 1 quando o estudante declara claramente o uso ou não uso de IA e, havendo uso, cita ferramentas e contribuição. Uma declaração breve, mas clara, vale 1 e pode ser acompanhada de orientação. Faça análise crítica: compare o desafio com objetivos, conteúdos, metodologias, atividades da dinâmica, tecnologias e avaliação. Verifique se a soma das durações bate com a carga horária. Justifique citando evidências concretas. NUNCA use travessão (—) nem meia-risca (–) no texto.

RUBRICA OFICIAL
${rubrica}

DADOS DO ESTUDANTE
Nome: ${txt(d.nome)}
Matrícula: ${txt(d.matricula)}
Orientador(a): ${txt(d.orientador)}
Desafio: ${txt(d.desafio)}
Público-alvo: ${txt(d.publicoAlvo)}
Objetivo da proposta: ${txt(d.objetivo)}
Conteúdos: ${txt(d.conteudos)}
Metodologias e estratégias: ${txt(d.metodologias)}
Tipo da proposta: ${txt(d.tipo)}
Carga horária: ${txt(d.cargaHoraria)}
Número de participantes: ${txt(d.participantes)}
Recursos e tecnologias: ${txt(d.recursos)}
Avaliação da aprendizagem: ${txt(d.avaliacaoTexto)}
Dinâmica (Parte 2):
${tabelaTexto(d)}
Declaração de IA: ${txt(d.iaDeclaracao)}
Descrição do uso de IA: ${txt(d.iaDescricao)}

Responda APENAS em JSON válido:
{"pontuacoes":{"coerencia":{"pontos":0,"justificativa":""},"dinamica":{"pontos":0,"justificativa":""},"tecnologias":{"pontos":0,"justificativa":""},"avaliacao":{"pontos":0,"justificativa":""},"ia":{"pontos":0,"justificativa":""}},"alertas":[""]}`;
}

function limparAvaliacao(resultado = {}) {
  const pontuacoes = {};
  for (const k of ORDEM) {
    const item = resultado.pontuacoes?.[k] || {};
    pontuacoes[k] = { pontos: Core.pontoValido(k, item.pontos), justificativa: Core.semTravessao(String(item.justificativa || '').trim()) };
  }
  return { pontuacoes, alertas: (Array.isArray(resultado.alertas) ? resultado.alertas : []).map(String).filter(Boolean).map(Core.semTravessao) };
}

async function chamarOpenAI(prompt, temperatura = 0.2) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST', headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: OPENAI_MODEL, response_format: { type: 'json_object' }, temperature: temperatura, messages: [{ role: 'user', content: prompt }] })
  });
  if (!r.ok) { console.error('OpenAI', r.status, await r.text().catch(() => '')); throw new Error(`A API da OpenAI recusou a análise (${r.status}).`); }
  const data = await r.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}

function avaliarLocalmente(d = {}) {
  const s = Core.sugestaoLocal(d);
  return { ...limparAvaliacao({ pontuacoes: s, alertas: ['Sugestão local de completude, sem juízo de mérito: revise a articulação semântica antes de confirmar as notas.'] }), modo: 'local' };
}

app.post('/api/avaliar', async (req, res) => {
  const d = req.body || {};
  if (!OPENAI_API_KEY) return res.json(avaliarLocalmente(d));
  try { res.json({ ...limparAvaliacao(await chamarOpenAI(montarPrompt(d))), modo: 'openai' }); }
  catch (e) {
    const f = avaliarLocalmente(d); f.modo = 'local-fallback';
    f.alertas.unshift(`A análise com IA não pôde ser concluída (${e.message}). Usei a sugestão local; revise as notas.`);
    res.json(f);
  }
});

const CAMPOS_EXTRACAO = ['nome', 'matricula', 'orientador', 'desafio', 'publicoAlvo', 'objetivo', 'conteudos', 'metodologias', 'tipo', 'cargaHoraria', 'participantes', 'recursos', 'avaliacaoTexto', 'iaDeclaracao', 'iaDescricao'];

function montarPromptExtracao({ paginas = [], camposPreliminares = {} } = {}) {
  const texto = (Array.isArray(paginas) ? paginas : []).slice(0, 20).map((p, i) => `\n===== PÁGINA ${i + 1} =====\n${String(p || '').slice(0, 30000)}`).join('\n');
  return `Extraia fielmente as respostas de um formulário preenchido da atividade P3, Proposta formativa para o seu desafio (TEDPRO/IFSC). Corrija uma extração automática que pode ter misturado rótulos, instruções do modelo, rodapés e colunas. NÃO resuma, NÃO melhore e NÃO invente.

REGRAS
- Devolva só o que o estudante escreveu. Exclua títulos, perguntas, instruções entre parênteses do modelo, "Exemplos:", cabeçalhos e rodapés institucionais.
- "desafio" é o texto após "Qual é o seu desafio?", sem as aspas externas. Se ainda for o texto-modelo, devolva o texto como está.
- "orientador": copie exatamente o que está no campo (pode ser "selecione").
- "dinamica" é a tabela da Parte 2: uma entrada por linha da tabela, com espaco, atividade, duracao, papelAluno, papelProfessor. Ignore a linha de instruções do modelo. Não misture células de linhas diferentes.
- "iaDeclaracao" exatamente "Sim", "Não" ou "" quando não houver marcação identificável.
- Campo ausente ou só com texto do modelo vale "".

PRÉ-EXTRAÇÃO (pode estar errada, use como pista)
${JSON.stringify(camposPreliminares)}

TEXTO POR PÁGINA
${texto}

Responda APENAS com JSON: {${CAMPOS_EXTRACAO.map((c) => `"${c}":""`).join(',')},"dinamica":[{"espaco":"","atividade":"","duracao":"","papelAluno":"","papelProfessor":""}]}`;
}

function limparExtracao(r = {}) {
  const out = {};
  for (const c of CAMPOS_EXTRACAO) out[c] = String(r?.[c] || '').trim();
  if (!['Sim', 'Não'].includes(out.iaDeclaracao)) out.iaDeclaracao = '';
  out.dinamica = (Array.isArray(r?.dinamica) ? r.dinamica : []).map((l) => ({
    espaco: String(l?.espaco || '').trim(), atividade: String(l?.atividade || '').trim(), duracao: String(l?.duracao || '').trim(),
    papelAluno: String(l?.papelAluno || '').trim(), papelProfessor: String(l?.papelProfessor || '').trim()
  })).filter((l) => Object.values(l).some(Boolean));
  return out;
}

app.post('/api/extrair-relatorio', async (req, res) => {
  if (!OPENAI_API_KEY) return res.status(401).json({ erro: 'OPENAI_API_KEY não configurada no servidor.' });
  try { res.json(limparExtracao(await chamarOpenAI(montarPromptExtracao(req.body || {}), 0))); }
  catch (e) { res.status(502).json({ erro: e.message }); }
});

app.use((err, _req, res, _next) => res.status(500).json({ erro: err.message || 'Erro interno.' }));

if (require.main === module) app.listen(PORT, () => console.log(`Avaliador P3 em http://localhost:${PORT}`));
module.exports = { app, montarPrompt, montarPromptExtracao, limparExtracao, limparAvaliacao, avaliarLocalmente };
