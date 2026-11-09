require('dotenv').config();
const express = require('express');
const path = require('path');
const Core = require('./public/p3-core.js');
const db = require('./db');
const { configIA, configDaRequisicao, chamarIA, statusIA } = require('./ia');
const { montarPromptCoerencia, limparSaidaCoerencia } = require('./coerencia');

const { RUBRICA, ORDEM } = Core;
const app = express();
const PORT = process.env.PORT || 3000;
const IA = configIA();
const APP_USERNAME = process.env.APP_USERNAME || 'professor';
const APP_PASSWORD = process.env.APP_PASSWORD || '';

if (process.env.NODE_ENV === 'production' && !APP_PASSWORD) throw new Error('APP_PASSWORD é obrigatória em produção.');
if (process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL) throw new Error('DATABASE_URL é obrigatória em produção para impedir perda de turmas em armazenamento temporário.');

app.use((req, res, next) => {
  if (!APP_PASSWORD || req.path === '/api/health' || req.path === '/api/version' || !req.path.startsWith('/api/')) return next();
  const header = req.headers.authorization || '';
  let usuario = '', senha = '';
  try { [usuario, senha] = Buffer.from(header.replace(/^Basic\s+/i, ''), 'base64').toString('utf8').split(':'); } catch { /* ignora */ }
  if (usuario === APP_USERNAME && senha === APP_PASSWORD) return next();
  res.set('X-Login-Necessario', '1'); // sem WWW-Authenticate: a janela de login é a do app, não a do navegador
  return res.status(401).send('Autenticação necessária.');
});

app.use(express.json({ limit: '6mb' }));
app.use((req,_res,next)=>{req.ia=configDaRequisicao(req);next();});
const chamarIAReq=(req,prompt,temperatura)=>chamarIA(prompt,temperatura,{config:req.ia});
app.get('/', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/api/health', (_req, res) => res.json({ ok: true, openaiConfigurada: IA.configurada, ...statusIA(IA) }));
app.get('/api/version', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  const commit = process.env.RENDER_GIT_COMMIT || 'local';
  res.json({ version: require('./package.json').version, commit, commitCurto: commit.slice(0, 7) });
});
app.use(express.static(path.join(__dirname, 'public')));

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
  return `Você auxilia um professor a avaliar a atividade P3, Seu desafio como proposta formativa, do TEDPRO/IFSC. Aplique SOMENTE a rubrica oficial e escolha exatamente um valor previsto em cada critério.

RIGOR E CONSISTÊNCIA
- Avalie o mérito e a qualidade pedagógica, não apenas se os campos estão preenchidos. Não conceda pontuação máxima por completude formal.
- Compare evidências específicas entre desafio, público-alvo, objetivos, conteúdos, metodologias, dinâmica, tecnologias e avaliação. Verifique se a sequência de atividades pode de fato levar aos resultados pretendidos.
- Para a dinâmica, examine concretude das atividades, adequação dos espaços, participação dos estudantes, papel do professor, duração e coerência com a carga horária. A soma de durações é um indício, não substitui a análise pedagógica.
- Para tecnologias, identifique a função de cada recurso na aprendizagem; citar nomes de ferramentas sem explicar seu uso não basta para a pontuação máxima.
- Para avaliação, verifique se a estratégia e as produções previstas se relacionam aos objetivos e às atividades. Não exija rubrica própria, pesos, instrumentos detalhados ou indicadores formais quando o descritor não os exigir.
- Adote rigor equilibrado e proporcional ao descritor. Uma proposta consistente pode obter o máximo mesmo sendo sintética e tendo oportunidades de aprofundamento. Pontuação máxima significa atendimento ao descritor, não perfeição ou planejamento exaustivo.
- Leia o documento como um conjunto: uma informação na dinâmica pode esclarecer o planejamento e vice-versa. Não penalize por não repetir informações em todos os campos.
- Antes de reduzir um critério, identifique a evidência concreta e explique qual elemento do descritor ficou comprometido. Distinga uma lacuna relevante de uma sugestão opcional de enriquecimento. Sugestões opcionais não justificam desconto.
- Reserve níveis baixos para ausências, incoerências ou limitações efetivas. Um ajuste pontual em uma dinâmica globalmente coerente corresponde ao nível imediatamente inferior quando realmente compromete a clareza; não transforme esse ajuste em avaliação de proposta superficial.
- Não desconte a mesma lacuna em vários critérios, salvo impactos distintos demonstráveis. Não exija inovação excepcional, detalhamento de cada intervenção docente ou mediação síncrona em toda atividade de leitura.
- Não invente ausências: duração declarada é duração definida; só questione o caráter prévio/assíncrono se a ambiguidade realmente comprometer a sequência. Uma declaração breve de IA com ferramenta e finalidade pode atender integralmente ao critério.
- Não busque uma nota-alvo, não aplique bônus e não force uma distribuição de notas. Escolha os níveis sustentados pelas evidências e pela rubrica.
- O critério ia é binário (0 ou 1): vale 1 quando o estudante declara claramente o uso ou não uso de IA e, havendo uso, informa as ferramentas e sua contribuição. Uma declaração breve, mas clara, satisfaz o critério; não exija detalhes adicionais para conceder o ponto.

TOM DOS FEEDBACKS
- Escreva em português brasileiro natural, acolhedor e direto, como um professor falando com a estudante. Personalize a justificativa com evidências que realmente aparecem na proposta.
- Evite linguagem burocrática, frases genéricas, excesso de termos da rubrica e cópia literal dos descritores. Prefira explicar com clareza o que funciona e, quando a nota não for máxima, qual ajuste concreto fortaleceria a proposta.
- Seja respeitoso e encorajador sem esconder problemas nem exagerar elogios. Não repita a mesma fórmula de justificativa em todos os critérios.
- Para cada critério, escreva um parágrafo com começo, desenvolvimento e fechamento, em geral de 60 a 120 palavras quando houver desconto e de 35 a 70 palavras quando houver atendimento pleno. Use a extensão necessária para explicar, sem preencher espaço.
- Fale diretamente com a pessoa usando "você" e "sua proposta". Cite escolhas concretas e explique seu valor pedagógico. Quando houver desconto, reconheça o que funciona, situe a limitação e ofereça um ajuste viável, como em uma conversa de orientação.
- Evite elogios prontos como "é nítido o esforço", "base importante", "jornada de aprendizagem" e "parabéns pela dedicação" sem ligação com o trabalho. Evite listas burocráticas de faltas e palavras como "robustez" e "operacionalização" quando houver expressão mais simples.
- Produza também mensagemInicial: um parágrafo personalizado de 60 a 100 palavras, reconhecendo qualidades reais da proposta sem exagero e sem repetir a pergunta-desafio, a saudação ou a nota.
- Produza mensagemFinal: um parágrafo personalizado de 45 a 80 palavras que retome uma força concreta e situe a dimensão dos ajustes. Se houver apenas uma limitação pequena, diga isso com proporcionalidade. Não repita toda a análise nem inclua despedida.
- Esses parágrafos não devem introduzir novas críticas a critérios que receberam nota máxima. Não acrescente recomendações fora do escopo da rubrica.
- A justificativa da rubrica deve explicar a pontuação de todos os critérios. Se a pontuação for máxima, registre evidências concretas de atendimento ao descritor e não acrescente ressalvas, recomendações ou sugestões de melhoria. Se ficar abaixo do máximo, reconheça o que já funciona e indique com delicadeza um ajuste concreto.
- O feedback final é montado pelo aplicativo: nele devem aparecer somente os critérios abaixo da pontuação máxima e a nota final. Nunca inclua lista de notas por critério nesse texto; critérios com nota máxima ficam fora do feedback final.
- Nunca invente evidências. Se os dados não permitirem concluir algo, diga isso com clareza e pontue conforme o que está documentado.
- NUNCA use travessão (—) nem meia-risca (–) no texto.

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
{"pontuacoes":{"coerencia":{"pontos":0,"justificativa":""},"dinamica":{"pontos":0,"justificativa":""},"tecnologias":{"pontos":0,"justificativa":""},"avaliacao":{"pontos":0,"justificativa":""},"ia":{"pontos":0,"justificativa":""}},"mensagemInicial":"","mensagemFinal":"","alertas":[""]}`;
}

function limparAvaliacao(resultado = {}) {
  const pontuacoes = {};
  for (const k of ORDEM) {
    const item = resultado.pontuacoes?.[k] || {};
    pontuacoes[k] = { pontos: Core.pontoValido(k, item.pontos), justificativa: Core.semTravessao(String(item.justificativa || '').trim()) };
  }
  return { pontuacoes, mensagemInicial: Core.semTravessao(String(resultado.mensagemInicial || '').trim()), mensagemFinal: Core.semTravessao(String(resultado.mensagemFinal || '').trim()), alertas: (Array.isArray(resultado.alertas) ? resultado.alertas : []).map(String).filter(Boolean).map(Core.semTravessao) };
}

function avaliarLocalmente(d = {}) {
  const s = Core.sugestaoLocal(d);
  return { ...limparAvaliacao({ pontuacoes: s, alertas: ['Sugestão local de completude, sem juízo de mérito: revise a articulação semântica antes de confirmar as notas.'] }), modo: 'local' };
}

app.post('/api/avaliar', async (req, res) => {
  const d = req.body || {};
  if (!req.ia.configurada) return res.json(avaliarLocalmente(d));
  try { res.json({ ...limparAvaliacao(await chamarIAReq(req,montarPrompt(d))), modo: req.ia.provedor }); }
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
  if (!req.ia.configurada) return res.status(401).json({ erro: `${req.ia.variavelChave} não configurada no servidor.` });
  try { res.json(limparExtracao(await chamarIAReq(req,montarPromptExtracao(req.body || {}), 0))); }
  catch (e) { res.status(502).json({ erro: e.message }); }
});

// ---------- Coerência (complementar, sem pontuação) ----------
const ASSINATURA_COERENCIA = () => 'Prof. Rogério';
function atividadeCoerencia(c = {}) {
  const dinamica = (Array.isArray(c.dinamica) ? c.dinamica : []).map((l, i) =>
    `Linha ${i + 1}: espaço "${l.espaco || ''}" | atividade "${l.atividade || ''}" | duração "${l.duracao || ''}" | papel do aluno "${l.papelAluno || ''}" | papel do professor "${l.papelProfessor || ''}"`).join('\n');
  return {
    nome: 'P3 - Proposta formativa para o seu desafio',
    produto: 'proposta formativa (planejamento e dinâmica das atividades) para enfrentar o desafio',
    cadeia: 'desafio -> público-alvo -> objetivo -> conteúdos -> metodologias e dinâmica das atividades -> recursos -> avaliação da aprendizagem -> contribuição para o desafio',
    criterios: [
      'Pergunte se, realizada como planejada, a proposta mudaria algo para aquele público no desafio declarado, ou se é uma formação correta, mas genérica.',
      'Verifique se objetivo, conteúdos e metodologias respondem ao desafio, e se a dinâmica (tempos, papéis, espaços) é viável e adequada ao público e à carga horária.',
      'Verifique se a avaliação da aprendizagem mostraria se a proposta de fato ajudou no desafio.'
    ],
    evidencia: 'Trata-se de uma proposta ainda não aplicada: escreva "a proposta prevê", nunca "na formação você fez".',
    campos: [
      ['Nome', c.nome], ['Desafio', c.desafio], ['Público-alvo', c.publicoAlvo], ['Objetivo', c.objetivo],
      ['Conteúdos', c.conteudos], ['Metodologias e estratégias', c.metodologias], ['Tipo da proposta', c.tipo],
      ['Carga horária', c.cargaHoraria], ['Número de participantes', c.participantes], ['Recursos e tecnologias', c.recursos],
      ['Avaliação da aprendizagem', c.avaliacaoTexto], ['Dinâmica das atividades (Parte 2)', dinamica ? '\n' + dinamica : '']
    ]
  };
}
app.post('/api/analisar-coerencia', async (req, res) => {
  if (!req.ia.configurada) return res.status(401).json({ erro: `${req.ia.variavelChave} não configurada no servidor. A análise de coerência precisa de IA.` });
  const campos = req.body || {};
  try { res.json(limparSaidaCoerencia(await chamarIAReq(req, montarPromptCoerencia(atividadeCoerencia(campos)), 0.25), ASSINATURA_COERENCIA(campos))); }
  catch (e) { res.status(e.status || 502).json({ erro: e.message }); }
});

app.use((err, _req, res, _next) => res.status(500).json({ erro: err.message || 'Erro interno.' }));

if (require.main === module) app.listen(PORT, () => console.log(`Avaliador P3 em http://localhost:${PORT}`));
module.exports = { atividadeCoerencia, app, montarPrompt, montarPromptExtracao, limparExtracao, limparAvaliacao, avaliarLocalmente };
