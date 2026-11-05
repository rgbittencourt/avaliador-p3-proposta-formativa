/* Núcleo da avaliação da P3 (TEDPRO/IFSC): rubrica, alertas, sugestão local e feedback.
   Arquivo único, carregado pelo navegador (<script>) e pelo servidor (require).
   Se a rubrica mudar, edite SOMENTE aqui. */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.P3Core = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {

  const ORIENTADOR_CORRETO = 'Prof. Rogério Gonçalves Bittencourt';

  const RUBRICA = {
    coerencia: {
      label: 'Coerência da proposta com os objetivos de aprendizagem', curto: 'Coerência', max: 2,
      niveis: [
        { pontos: 0, desc: 'A proposta não apresenta relação clara entre objetivos, conteúdos e atividades; ou a atividade não foi desenvolvida.' },
        { pontos: 1, desc: 'Há relação parcial entre objetivos, conteúdos e atividades, com algumas inconsistências no planejamento.' },
        { pontos: 2, desc: 'Os objetivos, conteúdos e atividades estão claramente articulados e favorecem o alcance dos resultados de aprendizagem pretendidos.' }
      ]
    },
    dinamica: {
      label: 'Dinâmica da experiência de aprendizagem: atividades, espaços e papéis dos participantes', curto: 'Dinâmica', max: 3,
      niveis: [
        { pontos: 0, desc: 'A dinâmica não foi descrita ou apresenta incoerências significativas entre atividades, espaços e participação dos envolvidos.' },
        { pontos: 1, desc: 'A dinâmica foi descrita de forma superficial ou com pouca articulação entre atividades, espaços e papéis.' },
        { pontos: 2, desc: 'A dinâmica apresenta coerência geral, mas alguns elementos poderiam estar mais bem detalhados ou articulados.' },
        { pontos: 3, desc: 'A dinâmica está claramente estruturada, com descrição consistente das atividades, uso adequado dos espaços de aprendizagem (presenciais e/ou digitais) e definição coerente dos papéis do professor e dos estudantes, favorecendo a participação e o engajamento.' }
      ]
    },
    tecnologias: {
      label: 'Integração das tecnologias digitais ao processo de aprendizagem', curto: 'Tecnologias', max: 2,
      niveis: [
        { pontos: 0, desc: 'As tecnologias digitais não são utilizadas ou não possuem finalidade pedagógica identificável.' },
        { pontos: 1, desc: 'As tecnologias são utilizadas, mas sua contribuição para a aprendizagem é limitada ou pouco justificada.' },
        { pontos: 2, desc: 'As tecnologias digitais estão integradas de forma significativa e intencional, contribuindo para a aprendizagem, interação, produção, colaboração ou acompanhamento dos estudantes.' }
      ]
    },
    avaliacao: {
      label: 'Adequação da avaliação aos objetivos e à proposta formativa', curto: 'Avaliação', max: 2,
      niveis: [
        { pontos: 0, desc: 'Não apresenta estratégia de avaliação ou ela não possui relação com a proposta desenvolvida.' },
        { pontos: 1, desc: 'Apresenta estratégia de avaliação parcialmente coerente com os objetivos e atividades planejadas.' },
        { pontos: 2, desc: 'Apresenta estratégia de avaliação clara e coerente com os objetivos, atividades e resultados de aprendizagem esperados.' }
      ]
    },
    ia: {
      label: 'Transparência no uso de Inteligência Artificial', curto: 'IA', max: 1,
      niveis: [
        { pontos: 0, desc: 'Não informa se utilizou IA ou não.' },
        { pontos: 1, desc: 'Declara claramente o uso ou não uso de IA e, quando utilizada, informa as ferramentas empregadas e sua contribuição para o desenvolvimento da atividade.' }
      ]
    }
  };
  const ORDEM = ['coerencia', 'dinamica', 'tecnologias', 'avaliacao', 'ia'];
  const NOTA_MAXIMA = ORDEM.reduce((n, k) => n + RUBRICA[k].max, 0); // 10

  /* ---------- utilidades ---------- */
  const t = (v) => String(v == null ? '' : v).trim();
  const semAcento = (s) => t(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function pontoValido(chave, pontos) {
    const n = Number(pontos);
    const niveis = RUBRICA[chave].niveis;
    if (niveis.some((x) => x.pontos === n)) return n;
    return niveis.reduce((m, x) => (Math.abs(x.pontos - n) < Math.abs(m - n) ? x.pontos : m), niveis[0].pontos);
  }

  /* Regra permanente do professor: nunca usar travessão nos textos. */
  function semTravessao(texto) {
    return String(texto == null ? '' : texto)
      .replace(/\s+[—–]\s+/g, ', ')
      .replace(/[—–]/g, '-');
  }

  function primeiroNome(nome) {
    const p = t(nome).split(/\s+/)[0] || 'estudante';
    return p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1).toLocaleLowerCase('pt-BR');
  }

  function formatarNota(n) {
    return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }

  /* ---------- duração ---------- */
  // Converte textos como "2 horas", "1h30", "40 minutos", "20 min" em minutos. Retorna null se não houver número de tempo.
  function paraMinutos(texto) {
    const s = semAcento(texto).replace(/,/g, '.');
    if (!s) return null;
    let total = 0, achou = false;
    const compostos = [...s.matchAll(/(\d+)\s*h\s*(\d{1,2})(?!\d)\s*(?:min\w*)?/g)];
    let restante = s;
    for (const m of compostos) { total += Number(m[1]) * 60 + Number(m[2]); achou = true; restante = restante.replace(m[0], ' '); }
    for (const m of restante.matchAll(/(\d+(?:\.\d+)?)\s*(horas?|hrs?|h)\b/g)) { total += parseFloat(m[1]) * 60; achou = true; }
    for (const m of restante.matchAll(/(\d+(?:\.\d+)?)\s*(minutos?|mins?|min|m)\b/g)) { total += parseFloat(m[1]); achou = true; }
    if (!achou) {
      const solto = s.match(/^\s*(\d+(?:\.\d+)?)\s*$/);
      if (solto) return null; // número sem unidade: ambíguo
      return null;
    }
    return Math.round(total);
  }

  function formatarMinutos(min) {
    if (min == null) return '';
    const h = Math.floor(min / 60), m = min % 60;
    if (h && m) return `${h}h${String(m).padStart(2, '0')}`;
    if (h) return `${h}h`;
    return `${m} min`;
  }

  /* ---------- validações de cadastro ---------- */
  function orientadorCorreto(texto) {
    const s = semAcento(texto);
    return s.includes('rogerio') && s.includes('bittencourt');
  }
  function orientadorVazio(texto) {
    const s = semAcento(texto);
    return !s || s === 'selecione' || /^selecione/.test(s);
  }
  function matriculaValida(texto) { return /^\d{6,}$/.test(t(texto).replace(/\D/g, '')) && !/[a-z]/i.test(t(texto)); }
  function matriculaPlaceholder(texto) { const s = semAcento(texto); return !s || s === 'matricula' || s === 'seu numero' || /^numero de matricula$/.test(s); }
  function nomePlaceholder(texto) { const s = semAcento(texto); return !s || s === 'seu nome'; }
  const TEXTO_MODELO_DESAFIO = /descreva aqui somente a sua pergunta/i;
  function desafioTemTextoDoModelo(texto) { return TEXTO_MODELO_DESAFIO.test(semAcento(texto).length ? String(texto) : ''); }
  function limparDesafio(texto) {
    return t(texto)
      .replace(/Descreva aqui somente a sua pergunta desafio,?\s*aquela que inicia com\s*[“"']?Como podemos[….\.]*[”"']?\.?/gi, '')
      .replace(/\s{2,}/g, ' ').trim();
  }
  function desafioComecaCorreto(texto) { return /^\s*como podemos\b/i.test(limparDesafio(texto)); }

  /* ---------- declaração de IA ---------- */
  const FERRAMENTAS_IA = /(chat\s*gpt|gpt|gemini|copilot|claude|manus|deepseek|perplexity|notebooklm|canva|grok|llama|bard|meta ai|co-?pilot|maritaca|le chat|mistral)/i;
  function analisarDeclaracaoIA(d) {
    const uso = t(d.iaDeclaracao); // 'Sim' | 'Não' | ''
    const desc = t(d.iaDescricao);
    const nomeouFerramenta = FERRAMENTAS_IA.test(desc);
    const sucinta = uso === 'Sim' && (desc.length < 180 || !nomeouFerramenta);
    return { uso, desc, nomeouFerramenta, sucinta };
  }

  /* ---------- alertas automáticos ---------- */
  function alertasAutomaticos(d) {
    const out = [];
    const add = (nivel, codigo, texto) => out.push({ nivel, codigo, texto });

    if (nomePlaceholder(d.nome)) add('erro', 'nome', 'Nome do aluno não preenchido (ou mantido como "SEU NOME").');
    if (matriculaPlaceholder(d.matricula)) add('erro', 'matricula', 'Número de matrícula não preenchido (consta o texto do modelo).');
    else if (!matriculaValida(d.matricula)) add('aviso', 'matricula', `Número de matrícula com formato incomum: "${t(d.matricula)}".`);

    if (orientadorVazio(d.orientador)) add('erro', 'orientador', 'Orientador(a) não selecionado(a) (consta "selecione" ou campo vazio).');
    else if (!orientadorCorreto(d.orientador)) add('erro', 'orientador', `Orientador(a) incorreto(a): consta "${t(d.orientador)}". O correto é ${ORIENTADOR_CORRETO}.`);

    if (!t(d.desafio)) add('erro', 'desafio', 'Pergunta-desafio ausente.');
    else {
      if (desafioTemTextoDoModelo(d.desafio)) add('erro', 'desafio-modelo', 'O campo "Qual é o seu desafio?" mantém o texto instrucional do modelo.');
      if (!desafioComecaCorreto(d.desafio)) add('aviso', 'desafio-formato', 'A pergunta-desafio não começa com "Como podemos...".');
    }

    const campos = [
      ['publicoAlvo', 'Público-alvo'], ['objetivo', 'Objetivo da proposta'], ['conteudos', 'Conteúdos'],
      ['metodologias', 'Metodologias e estratégias'], ['tipo', 'Tipo da proposta formativa'], ['cargaHoraria', 'Carga horária'],
      ['participantes', 'Número de participantes'], ['recursos', 'Recursos e tecnologias'], ['avaliacaoTexto', 'Avaliação da aprendizagem']
    ];
    const vazios = campos.filter(([k]) => !t(d[k])).map(([, nome]) => nome);
    if (vazios.length) add('erro', 'parte1', `Campos da Parte 1 sem resposta: ${vazios.join('; ')}.`);

    if (t(d.participantes) && !/\d/.test(d.participantes)) add('aviso', 'participantes', `Número de participantes sem valor numérico: "${t(d.participantes)}".`);

    const linhas = Array.isArray(d.dinamica) ? d.dinamica : [];
    if (!linhas.length) add('erro', 'dinamica-vazia', 'A tabela da Parte 2 (dinâmica) não foi identificada ou está vazia.');
    else {
      const incompletas = [];
      linhas.forEach((l, i) => {
        const faltam = [['espaco', 'espaço'], ['atividade', 'atividade'], ['duracao', 'duração'], ['papelAluno', 'papel do aluno'], ['papelProfessor', 'papel do professor']]
          .filter(([k]) => !t(l[k])).map(([, n]) => n);
        if (faltam.length) incompletas.push(`linha ${i + 1} (sem ${faltam.join(', ')})`);
      });
      if (incompletas.length) add('aviso', 'dinamica-incompleta', `Parte 2 com campos em branco: ${incompletas.join('; ')}.`);

      const semTempo = linhas.map((l, i) => ({ l, i })).filter(({ l }) => t(l.duracao) && paraMinutos(l.duracao) == null);
      if (semTempo.length) add('aviso', 'duracao-indefinida', `Duração sem tempo definido na Parte 2: ${semTempo.map(({ l, i }) => `linha ${i + 1} ("${t(l.duracao)}")`).join('; ')}.`);

      const soma = linhas.reduce((n, l) => n + (paraMinutos(l.duracao) || 0), 0);
      const carga = paraMinutos(d.cargaHoraria);
      if (carga != null && soma > 0 && Math.abs(soma - carga) > 5) {
        add('aviso', 'carga-horaria', `A soma das durações da Parte 2 (${formatarMinutos(soma)}) difere da carga horária informada (${formatarMinutos(carga)}).`);
      } else if (carga == null && t(d.cargaHoraria)) {
        add('aviso', 'carga-horaria', `Não foi possível interpretar a carga horária: "${t(d.cargaHoraria)}".`);
      }
      if (/^exemplos?:|indique que atividades/i.test(t(linhas[0] && linhas[0].espaco)) || linhas.some((l) => /indique a dura[cç][aã]o|o que os alunos fazem|o que o professor faz/i.test(`${l.duracao} ${l.papelAluno} ${l.papelProfessor}`))) {
        add('erro', 'dinamica-modelo', 'A Parte 2 parece conter o texto instrucional do modelo.');
      }
    }

    const ia = analisarDeclaracaoIA(d);
    if (!ia.uso) add('erro', 'ia', 'Declaração de uso de IA não marcada (Sim/Não).');
    else if (ia.uso === 'Sim' && !ia.desc) add('erro', 'ia', 'Declarou uso de IA, mas não descreveu ferramentas, finalidades e contribuição.');
    else if (ia.sucinta) add('aviso', 'ia-sucinta', ia.nomeouFerramenta
      ? 'Declaração de IA sucinta: oriente o aluno a detalhar finalidades, interação, adaptações/validações e contribuição ao resultado.'
      : 'Declaração de IA sem ferramenta identificada: oriente o aluno a nomear as ferramentas utilizadas.');
    return out;
  }

  /* ---------- sugestão local (conservadora; sempre um rascunho) ---------- */
  function sugestaoLocal(d) {
    const linhas = Array.isArray(d.dinamica) ? d.dinamica : [];
    const preenchido = (...ks) => ks.every((k) => t(d[k]).length > 8);
    const p = {};

    const base = ['publicoAlvo', 'objetivo', 'conteudos', 'metodologias'].filter((k) => t(d[k]).length > 8).length;
    if (!t(d.objetivo) && !t(d.conteudos) && !linhas.length) p.coerencia = { pontos: 0, justificativa: 'Objetivos, conteúdos e atividades não foram preenchidos.' };
    else if (base === 4 && linhas.length >= 2) p.coerencia = { pontos: 2, justificativa: 'Público, objetivo, conteúdos, metodologias e dinâmica estão preenchidos. Confirme a articulação semântica entre eles.' };
    else p.coerencia = { pontos: 1, justificativa: 'Há elementos preenchidos, mas o planejamento parece incompleto. Confirme a articulação entre objetivo, conteúdos e atividades.' };

    const celulasVazias = linhas.reduce((n, l) => n + ['espaco', 'atividade', 'duracao', 'papelAluno', 'papelProfessor'].filter((k) => !t(l[k])).length, 0);
    const semTempo = linhas.filter((l) => paraMinutos(l.duracao) == null).length;
    const soma = linhas.reduce((n, l) => n + (paraMinutos(l.duracao) || 0), 0);
    const carga = paraMinutos(d.cargaHoraria);
    const confere = carga == null || soma === 0 || Math.abs(soma - carga) <= 5;
    if (!linhas.length) p.dinamica = { pontos: 0, justificativa: 'A tabela da dinâmica não foi identificada ou está vazia.' };
    else if (linhas.length >= 2 && celulasVazias === 0 && semTempo === 0 && confere) p.dinamica = { pontos: 3, justificativa: `${linhas.length} espaços/momentos descritos, todos os campos preenchidos, durações definidas e coerentes com a carga horária.` };
    else if (linhas.length >= 2 && celulasVazias <= 2) p.dinamica = { pontos: 2, justificativa: 'Dinâmica coerente, mas com pequenos pontos a detalhar (campos em branco, duração indefinida ou soma diferente da carga horária).' };
    else p.dinamica = { pontos: 1, justificativa: 'Dinâmica superficial: poucos espaços/momentos ou vários campos em branco.' };

    const rec = t(d.recursos);
    const mencionaTec = /(moodle|classroom|ava\b|ambiente virtual|teams|zoom|meet|padlet|kahoot|quizizz|canva|geogebra|desmos|youtube|whatsapp|forms|drive|plataforma|aplicativo|app\b|software|ia\b|chatgpt|gemini|v[ií]deo|podcast|h5p|miro|mural|notebook|computador|tablet)/i.test(rec);
    if (!rec) p.tecnologias = { pontos: 0, justificativa: 'Recursos e tecnologias não informados.' };
    else if (mencionaTec && rec.length > 80 && linhas.length) p.tecnologias = { pontos: 2, justificativa: 'Há tecnologias nomeadas com funções descritas. Confirme se estão ligadas à aprendizagem nas atividades da Parte 2.' };
    else p.tecnologias = { pontos: 1, justificativa: 'Tecnologias citadas de forma genérica ou com pouca justificativa pedagógica.' };

    const av = t(d.avaliacaoTexto);
    if (!av) p.avaliacao = { pontos: 0, justificativa: 'Estratégia de avaliação não informada.' };
    else if (av.length > 140) p.avaliacao = { pontos: 2, justificativa: 'Estratégia de avaliação detalhada. Confirme a coerência com objetivos e atividades.' };
    else p.avaliacao = { pontos: 1, justificativa: 'Estratégia de avaliação sintética ou pouco relacionada aos objetivos.' };

    const ia = analisarDeclaracaoIA(d);
    if (!ia.uso) p.ia = { pontos: 0, justificativa: 'Não informa se utilizou IA ou não.' };
    else if (ia.uso === 'Sim' && !ia.desc) p.ia = { pontos: 0, justificativa: 'Declarou uso, mas não informou ferramentas nem contribuição.' };
    else p.ia = { pontos: 1, justificativa: ia.uso === 'Não' ? 'Declara explicitamente que não utilizou IA.' : 'Declara o uso de IA e identifica o que foi feito.' + (ia.sucinta ? ' A descrição é sucinta; registrar como orientação, sem penalizar.' : '') };
    return p;
  }

  /* ---------- totais ---------- */
  function total(pontuacoes) {
    return ORDEM.reduce((n, k) => n + (Number(pontuacoes && pontuacoes[k] && pontuacoes[k].pontos) || 0), 0);
  }
  function ordemNaoMaxima(pontuacoes) {
    return ORDEM.filter((k) => pontuacoes && pontuacoes[k] && pontuacoes[k].pontos != null && Number(pontuacoes[k].pontos) < RUBRICA[k].max);
  }

  /* ---------- feedback no padrão do Prof. Rogério ---------- */
  function feedbackLocal(d, pontuacoes, observacoes, justificativas) {
    const obs = observacoes || {};
    const just = justificativas || {};
    const nome = primeiroNome(d.nome);
    const linhas = [];
    linhas.push(`Olá ${nome},`);
    linhas.push('Obrigado por compartilhar a sua proposta formativa. É nítido o esforço de transformar o seu desafio em uma jornada de aprendizagem pensada para o público que você pretende formar. Parabéns pelo trabalho e pela dedicação!');

    const avisos = [];
    if (orientadorVazio(d.orientador)) avisos.push('observei que o campo Orientador(a) do seu documento não foi selecionado. Sou eu, Prof. Rogério Gonçalves Bittencourt, o seu orientador. Por favor, preencha esse dado antes da entrega final.');
    else if (!orientadorCorreto(d.orientador)) avisos.push(`observei que o campo Orientador(a) do seu documento está preenchido com o nome "${t(d.orientador)}". Sou eu, Prof. Rogério Gonçalves Bittencourt, o seu orientador. Por favor, corrija esse dado antes da entrega final.`);
    if (matriculaPlaceholder(d.matricula)) avisos.push('o campo Número de matrícula do seu documento não foi preenchido com o número real. Por favor, corrija esse dado antes da entrega final.');
    if (desafioTemTextoDoModelo(d.desafio)) avisos.push('o campo "Qual é o seu desafio?" manteve o texto instrucional do modelo junto com a sua pergunta. Por favor, retire esse trecho e mantenha apenas a pergunta desafio.');
    avisos.forEach((a) => linhas.push(`Atenção: ${a}`));

    linhas.push(`Tema/Assunto: ${limparDesafio(d.desafio) || '(pergunta-desafio não identificada)'}`);

    const iaInfo = analisarDeclaracaoIA(d);
    for (const k of ordemNaoMaxima(pontuacoes)) {
      const c = RUBRICA[k];
      const pts = Number(pontuacoes[k].pontos);
      let texto = t(obs[k]) || t(just[k]);
      if (!texto) {
        if (k === 'ia' && pts === 1) texto = '';
        else texto = c.niveis.find((n) => n.pontos === pts).desc;
      }
      linhas.push(`Critério ${ORDEM.indexOf(k) + 1}: ${c.label}\n(máximo: ${c.max} ${c.max === 1 ? 'ponto' : 'pontos'} | obtido: ${formatarNota(pts).replace(',0', '').replace('.0', '')} ${pts === 1 ? 'ponto' : 'pontos'})\n${texto}`);
    }
    const soma = total(pontuacoes);
    linhas.push(`Nota final: ${formatarNota(soma)} de ${formatarNota(NOTA_MAXIMA)}`);

    const pendentes = ordemNaoMaxima(pontuacoes);
    linhas.push(pendentes.length
      ? `${nome}, sua proposta tem uma base consistente e os pontos de melhoria são pontuais. Com os ajustes indicados, ela fica ainda mais completa. Continue com essa dedicação!`
      : `${nome}, sua proposta é completa, coerente e bem estruturada. Parabéns pela qualidade do trabalho e pela dedicação!`);
    linhas.push('Um abraço,\nProf. Rogério');
    return semTravessao(linhas.join('\n\n'));
  }

  return {
    ORIENTADOR_CORRETO, RUBRICA, ORDEM, NOTA_MAXIMA,
    pontoValido, semTravessao, primeiroNome, formatarNota, paraMinutos, formatarMinutos,
    orientadorCorreto, orientadorVazio, matriculaValida, matriculaPlaceholder, nomePlaceholder,
    desafioTemTextoDoModelo, limparDesafio, desafioComecaCorreto, analisarDeclaracaoIA,
    alertasAutomaticos, sugestaoLocal, total, ordemNaoMaxima, feedbackLocal
  };
});
