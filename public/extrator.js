/* Extrator do modelo "P3 - Proposta formativa para o seu desafio".
   Trabalha com a POSIÇÃO do texto (colunas da Parte 1 e células da tabela da Parte 2).
   Entrada: páginas = [{ itens: [{ s, x, y, w }] }]  (y cresce para cima, como no pdf.js)
   Funciona no navegador e no Node (testes). */
(function (raiz, fabrica) {
  if (typeof module === 'object' && module.exports) module.exports = fabrica();
  else raiz.P3Extrator = fabrica();
})(typeof self !== 'undefined' ? self : this, function () {

  const RODAPE = /(Instituto Federal de Santa Catarina|Rua:\s*14 de julho|Fone:\s*\(48\)|www\.ifsc\.edu\.br)/i;
  const ROTULOS = [
    ['publicoAlvo', /^P[úu]blico\s*-?\s*alvo/i],
    ['objetivo', /^Objetivo da proposta/i],
    ['conteudos', /^Conte[úu]dos que ser[ãa]o/i],
    ['metodologias', /^Metodologias e estrat/i],
    ['tipo', /^Tipo da proposta/i],
    ['cargaHoraria', /^Carga hor[áa]ria/i],
    ['participantes', /^N[úu]mero de participantes/i],
    ['recursos', /^Recursos e tecnologias/i],
    ['avaliacaoTexto', /^Avalia[çc][ãa]o da aprendizagem/i]
  ];
  const LIMPAR_BORDAS = (s) => String(s || '').replace(/[​­]/g, '').replace(/[ \t]+/g, ' ').trim();

  function mediana(v) { if (!v.length) return 0; const o = [...v].sort((a, b) => a - b); const m = Math.floor(o.length / 2); return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; }

  /* Junta fragmentos de uma linha pela distância real (evita "Públic o", mantém espaço entre palavras) */
  function juntarItens(itens) {
    let out = '';
    itens.forEach((it, i) => {
      let t = String(it.s).normalize('NFC').replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff').replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl');
      if (i > 0) {
        const ant = itens[i - 1];
        const gap = it.x - ant.x2;
        const limiar = Math.max(1.6, (it.h || 10) * 0.17);
        const jaTemEspaco = /\s$/.test(out) || /^\s/.test(t);
        if (gap > limiar && !jaTemEspaco) out += ' ';
      }
      out += t;
    });
    return LIMPAR_BORDAS(out);
  }

  /* Agrupa itens em linhas visuais */
  function montarLinhas(paginas) {
    const linhas = [];
    paginas.forEach((pg, pi) => {
      const itens = (pg.itens || []).filter((i) => String(i.s).length).map((i) => ({ s: i.s, x: i.x, x2: i.x + (i.w || 0), y: i.y, h: i.h || 10 }));
      itens.sort((a, b) => b.y - a.y || a.x - b.x);
      let atual = null;
      for (const it of itens) {
        if (atual && Math.abs(atual.y - it.y) <= 3) { atual.itens.push(it); }
        else { atual = { pagina: pi, y: it.y, itens: [it] }; linhas.push(atual); }
      }
    });
    linhas.forEach((l) => {
      l.itens.sort((a, b) => a.x - b.x);
      l.texto = juntarItens(l.itens);
    });
    return linhas.filter((l) => l.texto && !RODAPE.test(l.texto) && !/^Interno$/i.test(l.texto));
  }

  /* Segmentos de uma linha: itens separados por vão grande formam células diferentes */
  function segmentos(linha, vao = 14) {
    const grupos = []; let cur = null;
    for (const it of linha.itens) {
      if (cur && it.x - cur.x2 < vao) { cur.itens.push(it); cur.x2 = Math.max(cur.x2, it.x2); }
      else { cur = { itens: [it], x: it.x, x2: it.x2 }; grupos.push(cur); }
    }
    return grupos.map((g) => ({ s: juntarItens(g.itens), x: g.x, x2: g.x2 })).filter((g) => g.s);
  }

  function indiceLinha(linhas, regex, de = 0) { for (let i = de; i < linhas.length; i++) if (regex.test(linhas[i].texto)) return i; return -1; }

  function juntarParagrafos(partes) {
    // partes: [{ s, x2 }] em ordem; quebra de parágrafo quando a linha anterior termina bem antes da margem direita
    if (!partes.length) return '';
    const direita = Math.max(...partes.map((p) => p.x2));
    let out = partes[0].s;
    for (let i = 1; i < partes.length; i++) {
      const curta = partes[i - 1].x2 < direita - 45;
      const marcador = /^([•●▪\-–—*]|\d+[.)])\s/.test(partes[i].s);
      out += (curta || marcador ? '\n' : ' ') + partes[i].s;
    }
    return out.replace(/ {2,}/g, ' ').trim();
  }

  /* ---------- Cabeçalho ---------- */
  function extrairCabecalho(linhas) {
    const topo = linhas.slice(0, 40);
    const pega = (re) => { for (const l of topo) { const m = l.texto.match(re); if (m) return LIMPAR_BORDAS(m[1]); } return ''; };
    return {
      nome: pega(/Nome completo:\s*(.*)$/i),
      matricula: pega(/N[úu]mero de matr[íi]cula:\s*(.*)$/i),
      orientador: pega(/Orientador\(a\):\s*(.*)$/i)
    };
  }

  /* ---------- Desafio ---------- */
  function extrairDesafio(linhas) {
    const a = indiceLinha(linhas, /Qual [ée] o seu desafio/i);
    if (a < 0) return '';
    let b = indiceLinha(linhas, /PARTE\s*1/i, a + 1);
    if (b < 0) b = Math.min(linhas.length, a + 12);
    const partes = linhas.slice(a + 1, b).map((l) => ({ s: l.texto, x2: Math.max(...l.itens.map((i) => i.x2)) }));
    return juntarParagrafos(partes).replace(/^[“"'‘]\s*/, '').replace(/\s*[”"'’]\.?$/, '').trim();
  }

  /* ---------- Parte 1 ---------- */
  // Instruções entre parênteses do modelo (quando o aluno as manteve no layout empilhado)
  const PARENTESE_MODELO = /^\(?\s*(Quem ser[ãa]o os alunos|O que os participantes|Lembrando que a proposta|Quais metodologias|Exemplos?:|Lembre-se que proposta|Soma da dura|Estudantes que v[ãa]o|Inclua os materiais|Como voc[êe] pretende)/i;

  function extrairParte1(linhas) {
    const a = indiceLinha(linhas, /PARTE\s*1/i);
    let b = indiceLinha(linhas, /PARTE\s*2/i, a + 1);
    if (a < 0) return {};
    if (b < 0) b = linhas.length;
    const regiao = linhas.slice(a + 1, b);

    // Layout em duas colunas? (rótulo + valor na mesma linha)
    const xs = [];
    for (const l of regiao) {
      const segs = segmentos(l, 18);
      if (segs.length >= 2 && ROTULOS.some(([, re]) => re.test(segs[0].s))) xs.push(segs[1].x);
    }
    const duasColunas = xs.length >= 3;
    const valorX = duasColunas ? mediana(xs) - 6 : 0;

    const campos = {}; ROTULOS.forEach(([k]) => { campos[k] = []; });
    let atual = null;
    const empurra = (chave, itens) => {
      if (!chave || !itens.length) return;
      const txt = juntarItens(itens);
      if (txt) campos[chave].push({ s: txt, x2: Math.max(...itens.map((i) => i.x2)) });
    };
    for (const l of regiao) {
      const segs = segmentos(l, 18);
      const rot = ROTULOS.find(([, re]) => re.test(segs[0] ? segs[0].s : ''));
      if (rot) {
        atual = rot[0];
        // valor na mesma linha do rótulo: itens após o 1º segmento
        const primeiroFim = segs[0].x2;
        empurra(atual, l.itens.filter((i) => i.x > primeiroFim - 1 && (!duasColunas || i.x >= valorX)));
        continue;
      }
      if (duasColunas) {
        empurra(atual, l.itens.filter((i) => i.x >= valorX));
      } else if (!PARENTESE_MODELO.test(l.texto)) {
        empurra(atual, l.itens);
      }
    }
    const out = {};
    for (const [k] of ROTULOS) out[k] = juntarParagrafos(campos[k]);
    return out;
  }

  /* ---------- Parte 2 (tabela) ---------- */
  const LINHA_INSTRUCAO = /(Exemplos?:|Indique que atividades|Indique a dura[çc][ãa]o|O que os alunos fazem|O que o professor faz|Considere a mediação|Se há mais de um professor)/i;
  const ROTULOS_COLUNAS = [
    /^ESPA[ÇC]OS\b/i,
    /^ATIVIDADE\b/i,
    /^DURA[ÇC][ÃA]O\b/i,
    /^PAPEL\s+DO\s+ALUNO\b/i,
    /^(?:PAPEL\s+DO\s+PROFESSOR|O\s+QUE\s+O\s+PROFESSOR)\b/i
  ];

  function ancorasCabecalho(regiao) {
    const linha = regiao.find((l) => /ESPA[ÇC]OS/i.test(l.texto) && /ATIVIDADE/i.test(l.texto));
    if (!linha) return [];
    const achadas = Array(5).fill(null);

    // PDF.js pode devolver os cinco títulos como fragmentos separados ou como
    // um único item de texto. Procure cada rótulo em todos os itens, preservando
    // a posição horizontal real (e não apenas o primeiro rótulo de cada segmento).
    const padroes = [
      /ESPA[ÇC]OS/i,
      /ATIVIDADE/i,
      /DURA[ÇC][ÃA]O/i,
      /PAPEL\s+DO\s+ALUNO/i,
      /PAPEL\s+DO\s+PROFESSOR/i
    ];
    for (const it of [...linha.itens].sort((x, y) => x.x - y.x)) {
      const texto = String(it.s || '').normalize('NFC');
      for (let j = 0; j < padroes.length; j++) {
        if (achadas[j] != null) continue;
        const m = padroes[j].exec(texto);
        if (!m) continue;
        // Quando vários títulos vierem num mesmo item, estima a posição de
        // cada um dentro do fragmento usando sua largura e posição no texto.
        const proporcao = texto.length ? m.index / texto.length : 0;
        achadas[j] = it.x + (it.w || 0) * proporcao;
      }
    }

    // Alguns PDFs quebram "Papel do aluno/professor" em vários itens.
    // Nesse caso, recupere a posição a partir dos segmentos visuais agrupados.
    const partes = segmentos(linha, 4);
    for (const parte of partes) {
      for (let j = 0; j < padroes.length; j++) {
        if (achadas[j] == null && padroes[j].test(parte.s)) achadas[j] = parte.x;
      }
    }
    return achadas.every((x) => x != null) ? achadas : [];
  }

  function extrairParte2(linhas) {
    const a = indiceLinha(linhas, /PARTE\s*2/i);
    if (a < 0) return { dinamica: [], bruto: '' };
    let b = indiceLinha(linhas, /Declara[çc][ãa]o de transpar[êe]ncia/i, a + 1);
    if (b < 0) b = linhas.length;
    let regiao = linhas.slice(a + 1, b);
    regiao = regiao.filter((l) => !(/ESPA[ÇC]OS/i.test(l.texto) && /ATIVIDADE/i.test(l.texto)));
    const bruto = regiao.map((l) => l.texto).join('\n');
    if (!regiao.length) return { dinamica: [], bruto };

    // Remova cabeçalhos e instruções do modelo antes de inferir colunas e linhas.
    // Isso impede que os exemplos do formulário distorçam a posição das células preenchidas.
    const dados = regiao.filter((l) => !LINHA_INSTRUCAO.test(l.texto));
    if (!dados.length) return { dinamica: [], bruto };

    // As posições dos títulos podem estar centralizadas dentro das células.
    // Por isso, use primeiro os inícios reais das células preenchidas no corpo
    // da tabela; os títulos servem apenas como alternativa quando faltarem dados.
    const frequencias = new Map();
    for (const l of dados) {
      for (const seg of segmentos(l, 5)) {
        const x = Math.round(seg.x / 4) * 4;
        frequencias.set(x, (frequencias.get(x) || 0) + 1);
      }
    }
    const colunasCorpo = [...frequencias.entries()]
      .map(([x, n]) => ({ x, n }))
      .sort((p, q) => q.n - p.n)
      .slice(0, 5)
      .sort((p, q) => p.x - q.x)
      .map((c) => c.x);
    let xsColunas = colunasCorpo.length === 5
      ? colunasCorpo
      : ancorasCabecalho(linhas.slice(a + 1, b));
    if (xsColunas.length < 5) {
      const anchors = ancorasCabecalho(linhas.slice(a + 1, b));
      if (anchors.length === 5) xsColunas = anchors;
    }
    if (xsColunas.length < 5) return { dinamica: [], bruto, colunasEncontradas: xsColunas.length };

    const limites = xsColunas.map((x, i) => i === 0 ? -Infinity : (xsColunas[i - 1] + x) / 2);
    const colunaDe = (x) => {
      let c = 0;
      for (let j = 1; j < 5; j++) if (x >= limites[j]) c = j;
      return c;
    };

    // Separe linhas da tabela por intervalos verticais. Como as células da primeira
    // coluna podem ocupar várias linhas, blocos sem espaço continuam o registro anterior.
    const gaps = [];
    for (let i = 1; i < dados.length; i++) if (dados[i].pagina === dados[i - 1].pagina) gaps.push(dados[i - 1].y - dados[i].y);
    const passo = mediana(gaps.filter((g) => g > 0)) || 13;
    const limiar = passo * 1.55;
    const blocos = []; let blk = null;
    dados.forEach((l, i) => {
      const novo = i === 0 || l.pagina !== dados[i - 1].pagina || (dados[i - 1].y - l.y) > limiar;
      if (novo) { blk = { pagina: l.pagina, cel: [[], [], [], [], []] }; blocos.push(blk); }
      for (const seg of segmentos(l, 5)) blk.cel[colunaDe(seg.x)].push({ s: seg.s, x2: seg.x2 });
    });

    const registros = [];
    for (const bl of blocos) {
      const anterior = registros[registros.length - 1];
      const continuidadeEntrePaginas = anterior
        && bl.pagina !== anterior.paginaFim
        && !bl.cel[0].length;
      if (continuidadeEntrePaginas) {
        // No formulário, uma linha pode continuar no topo da página seguinte
        // sem repetir Espaço, Atividade, Duração ou Papel do aluno.
        bl.cel.forEach((c, j) => anterior.cel[j].push(...c));
        anterior.paginaFim = bl.pagina;
      } else {
        bl.paginaFim = bl.pagina;
        registros.push(bl);
      }
    }

    const dinamica = [];
    let instrucaoRemovida = false;
    for (const r of registros) {
      const cel = r.cel.map((c) => juntarParagrafos(c));
      const [espaco, atividade, duracao, papelAluno, papelProfessor] = cel;
      if (cel.some((t) => LINHA_INSTRUCAO.test(t))) { instrucaoRemovida = true; continue; }
      if (cel.some((t) => t)) dinamica.push({ espaco, atividade, duracao, papelAluno, papelProfessor });
    }
    return { dinamica, bruto, instrucaoRemovida };
  }

  /* ---------- Declaração de IA ---------- */
  function extrairIA(linhas) {
    const a = indiceLinha(linhas, /Declara[çc][ãa]o de transpar[êe]ncia/i);
    if (a < 0) return { iaDeclaracao: '', iaDescricao: '' };
    const regiao = linhas.slice(a + 1);
    const iLinha = regiao.findIndex((l) => /teve uso de IA/i.test(l.texto));
    let declaracao = '';
    if (iLinha >= 0) {
      const tx = regiao[iLinha].texto;
      const marc = '[xX×✓✔☒☑■▣]';
      if (new RegExp(`\\(\\s*${marc}\\s*\\)\\s*Sim`).test(tx) || new RegExp(`${marc}\\s*Sim`).test(tx.replace(/\(\s*\)\s*Sim/, ''))) declaracao = 'Sim';
      if (new RegExp(`\\(\\s*${marc}\\s*\\)\\s*N[ãa]o`).test(tx) || new RegExp(`${marc}\\s*N[ãa]o`).test(tx.replace(/\(\s*\)\s*N[ãa]o/, ''))) declaracao = declaracao === 'Sim' ? '' : 'Não';
    }
    let desc = regiao.slice(iLinha >= 0 ? iLinha + 1 : 0);
    // remove o texto instrucional do modelo, se mantido
    const instr = /(^Se sim, descreva|^[●•]\s*quais ferramentas|quais ferramentas foram utilizadas|para quais finalidades|como ocorreu a intera[çc][ãa]o|quais adapta[çc][õo]es, revis[õo]es|foram realizadas por voc[êe];? de que forma|de que forma o uso da IA contribuiu para o resultado final\.?$)/i;
    let i = 0; while (i < desc.length && instr.test(desc[i].texto) && i < 4) i++;
    desc = desc.slice(i);
    const partes = desc.map((l) => ({ s: l.texto, x2: Math.max(...l.itens.map((it) => it.x2)) }));
    return { iaDeclaracao: declaracao, iaDescricao: juntarParagrafos(partes) };
  }

  function extrair(paginas) {
    const linhas = montarLinhas(paginas);
    const cab = extrairCabecalho(linhas);
    const p1 = extrairParte1(linhas);
    const p2 = extrairParte2(linhas);
    const ia = extrairIA(linhas);
    return {
      ...cab,
      desafio: extrairDesafio(linhas),
      ...p1,
      dinamica: p2.dinamica,
      dinamicaBruta: p2.bruto,
      ...ia,
      _avisos: p2.colunasEncontradas !== undefined && !p2.dinamica.length ? [`Tabela da Parte 2 não pôde ser separada em colunas (encontradas: ${p2.colunasEncontradas}).`] : []
    };
  }

  /* Adaptador: conteúdo do pdf.js -> páginas do extrator */
  function paginaDoPdfjs(content) {
    return { itens: content.items.filter((i) => typeof i.str === 'string').map((i) => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width || 0, h: i.height || 10 })) };
  }

  return { extrair, paginaDoPdfjs, montarLinhas };
});
