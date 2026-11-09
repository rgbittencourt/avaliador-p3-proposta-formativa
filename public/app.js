/* Avaliador P3 · Proposta Formativa (TEDPRO/IFSC) */
(function () {
  'use strict';
  const C = window.P3Core;
  const X = window.P3Extrator;
  const $ = (id) => document.getElementById(id);
  const CAMPOS = ['nome', 'matricula', 'orientador', 'desafio', 'publicoAlvo', 'objetivo', 'conteudos', 'metodologias', 'tipo', 'cargaHoraria', 'participantes', 'recursos', 'avaliacaoTexto', 'iaDeclaracao', 'iaDescricao'];

  const estado = {
    turmas: [], turmaId: null, avaliacoes: [], avaliacaoId: null,
    pontuacoes: {}, observacoes: {}, justificativas: {}, dinamica: [],
    feedbackEditado: false, textoPaginas: [], extracaoBruta: null, modo: ''
  };

  /* ---------- API ---------- */
  let auth = '';
  try { auth = sessionStorage.getItem('p3auth') || ''; } catch (e) { /* sem storage */ }
  async function api(url, opcoes = {}, tentativa = 0) {
    const h = { ...(opcoes.headers || {}), ...(window.SeletorIA ? SeletorIA.cabecalho() : {}) };
    if (opcoes.body && !h['Content-Type']) h['Content-Type'] = 'application/json';
    if (auth) h.Authorization = auth;
    const r = await fetch(url, { ...opcoes, headers: h });
    if (r.status === 401 && tentativa < 2 && !(await r.clone().json().catch(() => ({}))).erro) {
      if (tentativa > 0) SeletorIA.esquecerLogin();
      const login = await SeletorIA.pedirLogin('professor');
      if (!login) throw new Error('Autenticação cancelada.');
      auth = SeletorIA.basic(login.usuario, login.senha);
      try { sessionStorage.setItem('p3auth', auth); } catch (e) { /* ok */ }
      return api(url, opcoes, tentativa + 1);
    }
    const dados = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(dados.erro || `Erro ${r.status}`);
    return dados;
  }

  /* ---------- utilitários ---------- */
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const nota = (n) => C.formatarNota(n);
  const novoId = () => 'av_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  function dados() {
    const d = {};
    CAMPOS.forEach((c) => { d[c] = $(c).value; });
    d.dinamica = estado.dinamica.map((l) => ({ ...l }));
    return d;
  }
  function preencher(d) {
    CAMPOS.forEach((c) => { $(c).value = d[c] || ''; });
    estado.dinamica = (d.dinamica || []).map((l) => ({ espaco: l.espaco || '', atividade: l.atividade || '', duracao: l.duracao || '', papelAluno: l.papelAluno || '', papelProfessor: l.papelProfessor || '' }));
    desenharDinamica();
  }

  /* ---------- Parte 2 editável ---------- */
  function desenharDinamica() {
    const tb = $('dinBody');
    tb.innerHTML = '';
    estado.dinamica.forEach((l, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = ['espaco', 'atividade', 'duracao', 'papelAluno', 'papelProfessor'].map((k) => `<td><textarea data-i="${i}" data-k="${k}" rows="2">${esc(l[k])}</textarea></td>`).join('') +
        `<td><button type="button" class="btn danger" data-del="${i}" style="margin:0;padding:4px 8px;font-size:0.72rem;">Remover</button></td>`;
      tb.appendChild(tr);
    });
    const soma = estado.dinamica.reduce((n, l) => n + (C.paraMinutos(l.duracao) || 0), 0);
    $('dinInfo').textContent = estado.dinamica.length ? `${estado.dinamica.length} linha(s) · soma das durações identificadas: ${C.formatarMinutos(soma)}` : 'Nenhuma linha identificada. Adicione manualmente ou corrija com IA.';
  }
  $('dinBody').addEventListener('input', (e) => {
    const t = e.target; if (t.dataset.i == null) return;
    estado.dinamica[Number(t.dataset.i)][t.dataset.k] = t.value; recalcular(false);
  });
  $('dinBody').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]'); if (!b) return;
    estado.dinamica.splice(Number(b.dataset.del), 1); desenharDinamica(); recalcular(true);
  });
  $('btnAddLinha').addEventListener('click', () => { estado.dinamica.push({ espaco: '', atividade: '', duracao: '', papelAluno: '', papelProfessor: '' }); desenharDinamica(); });

  /* ---------- Rubrica ---------- */
  function desenharRubrica() {
    const box = $('rubricaContainer'); box.innerHTML = '';
    C.ORDEM.forEach((k, idx) => {
      const c = C.RUBRICA[k];
      const fs = document.createElement('fieldset'); fs.className = 'criterio';
      fs.innerHTML = `<legend>Critério ${idx + 1}: ${esc(c.label)} (0 a ${c.max})</legend>` +
        c.niveis.map((n) => `<label class="nivel"><input type="radio" name="r_${k}" value="${n.pontos}"><span class="pts">${n.pontos} ${n.pontos === 1 ? 'ponto' : 'pontos'}</span><span class="txt">${esc(n.desc)}</span></label>`).join('') +
        `<div class="just" id="just_${k}" role="status" aria-live="polite"></div>` +
        `<textarea class="nota-obs" id="obs_${k}" placeholder="Observação para o feedback deste critério (opcional, usada apenas se a nota não for máxima)"></textarea>`;
      box.appendChild(fs);
      fs.querySelectorAll('input[type=radio]').forEach((r) => r.addEventListener('change', () => { estado.pontuacoes[k] = Number(r.value); recalcular(true); }));
      fs.querySelector('textarea').addEventListener('input', (e) => { estado.observacoes[k] = e.target.value; recalcular(true); });
    });
  }
  function marcarRubrica() {
    C.ORDEM.forEach((k) => {
      document.querySelectorAll(`input[name=r_${k}]`).forEach((r) => { r.checked = estado.pontuacoes[k] != null && Number(r.value) === Number(estado.pontuacoes[k]); });
      $('obs_' + k).value = estado.observacoes[k] || '';
      $('just_' + k).textContent = estado.justificativas[k] ? 'Análise do critério: ' + estado.justificativas[k] : 'A análise individual será exibida aqui após a avaliação automática.';
    });
  }

  /* ---------- Alertas, nota, feedback ---------- */
  function pontosObj() {
    const o = {}; C.ORDEM.forEach((k) => { if (estado.pontuacoes[k] != null) o[k] = { pontos: estado.pontuacoes[k] }; }); return o;
  }
  function alertasAtuais() { return C.alertasAutomaticos(dados()); }

  const NOME_IA = { openai: 'OpenAI', anthropic: 'Claude' };
  const modoIA = (m) => Object.prototype.hasOwnProperty.call(NOME_IA, m);

  function desenharNota() {
    const po = pontosObj();
    $('totalNota').textContent = nota(C.total(po));
    $('scoreTable').innerHTML = C.ORDEM.map((k) => {
      const p = estado.pontuacoes[k]; const max = C.RUBRICA[k].max;
      const cls = p == null ? 'b-zero' : p >= max ? 'b-max' : p > 0 ? 'b-mid' : 'b-zero';
      return `<tr><td>${esc(C.RUBRICA[k].curto)}</td><td style="text-align:right;"><span class="badge ${cls}">${p == null ? '-' : nota(p)} / ${max}</span></td></tr>`;
    }).join('');
    $('modoTag').textContent = modoIA(estado.modo) ? `Sugestão: IA (${NOME_IA[estado.modo]})` : estado.modo ? 'Sugestão: análise local' : '';
    const al = alertasAtuais();
    $('alertsBox').innerHTML = al.length ? al.map((a) => `<div class="alert ${a.nivel === 'erro' ? '' : 'info'}">${esc(a.texto)}</div>`).join('') : '<div class="no-alert">Nenhum alerta automático.</div>';
  }
  function recalcular(atualizarFeedback) {
    desenharNota();
    if (atualizarFeedback && !estado.feedbackEditado && Object.keys(estado.pontuacoes).length === C.ORDEM.length) gerarFeedback(true);
  }
  function gerarFeedback(silencioso) {
    if (Object.keys(estado.pontuacoes).length < C.ORDEM.length) { $('feedbackStatus').textContent = 'Preencha todos os critérios da rubrica para gerar o feedback.'; return; }
    $('feedbackOut').value = C.feedbackLocal(dados(), pontosObj(), estado.observacoes, estado.justificativas);
    estado.feedbackEditado = false;
    if (!silencioso) $('feedbackStatus').textContent = 'Feedback atualizado conforme a avaliação.';
  }
  $('btnFeedback').addEventListener('click', () => gerarFeedback(false));
  $('feedbackOut').addEventListener('input', () => { estado.feedbackEditado = true; });
  $('btnCopiar').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('feedbackOut').value); $('feedbackStatus').textContent = 'Texto copiado.'; } catch (e) { $('feedbackOut').select(); $('feedbackStatus').textContent = 'Selecione e copie manualmente.'; }
  });
  CAMPOS.forEach((c) => $(c).addEventListener('input', () => { recalcular(true); if (c === 'nome' || c === 'matricula') verificarDuplicidade(); }));
  $('alertasManuais').addEventListener('input', () => { });

  function verificarDuplicidade() {
    const n = norm($('nome').value); const m = String($('matricula').value).replace(/\D/g, '');
    const outro = estado.avaliacoes.find((a) => a.id !== estado.avaliacaoId && ((n && norm(a.nome) === n) || (m.length > 5 && String(a.matricula).replace(/\D/g, '') === m)));
    const box = $('duplicidadeStatus');
    if (outro) { box.style.display = ''; box.textContent = `Já existe na turma uma avaliação para "${outro.nome}" (matrícula ${outro.matricula}). Ao salvar, escolha atualizar ou criar outra.`; }
    else box.style.display = 'none';
    return outro;
  }

  /* ---------- Avaliação automática ---------- */
  $('btnAutoAvaliar').addEventListener('click', async () => {
    const st = $('autoStatus'); st.textContent = 'Analisando a proposta...';
    $('btnAutoAvaliar').disabled = true;
    try {
      const r = await api('/api/avaliar', { method: 'POST', body: JSON.stringify(dados()) });
      C.ORDEM.forEach((k) => {
        const item = r.pontuacoes?.[k] || {};
        estado.pontuacoes[k] = C.RUBRICA[k].niveis.some((n) => n.pontos === Number(item.pontos)) ? Number(item.pontos) : C.RUBRICA[k].niveis[0].pontos;
        const nivel = C.RUBRICA[k].niveis.find((n) => n.pontos === estado.pontuacoes[k]);
        estado.justificativas[k] = String(item.justificativa || nivel?.desc || '');
      });
      estado.justificativas.abertura = String(r.mensagemInicial || '');
      estado.justificativas.encerramento = String(r.mensagemFinal || '');
      estado.modo = r.modo || 'local';
      marcarRubrica();
      if (r.alertas && r.alertas.length) $('alertasManuais').value = r.alertas.join('\n');
      estado.feedbackEditado = false; recalcular(true);
      st.textContent = modoIA(r.modo) ? `Sugestão da IA (${NOME_IA[r.modo]}) aplicada. Revise as notas e as observações.` : 'Sugestão local aplicada (verifica o preenchimento). Revise as notas e as observações.';
    } catch (e) { st.textContent = 'Falha: ' + e.message; }
    $('btnAutoAvaliar').disabled = false;
  });

  /* ---------- PDF ---------- */
  let pdfPreviewData = null;
  async function lerPdf(arquivo) {
    const buf = new Uint8Array(await arquivo.arrayBuffer());
    const previewData = buf.slice();
    const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
    const paginas = []; const textos = []; const miniaturas = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const content = await pg.getTextContent();
      paginas.push(X.paginaDoPdfjs(content));
      textos.push(content.items.map((it) => it.str).join(' '));
      if (i <= 6) {
        const vp = pg.getViewport({ scale: 0.35 }); const cv = document.createElement('canvas');
        cv.width = vp.width; cv.height = vp.height;
        await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        miniaturas.push(cv.toDataURL('image/png'));
      }
    }
    return { paginas, textos, miniaturas, n: pdf.numPages, previewData };
  }

  async function abrirPaginaPdf(numero) {
    if (!pdfPreviewData) return;
    const modal = $('pdfModal'); const canvas = $('pdfPaginaGrande'); const status = $('pdfModalStatus');
    modal.hidden = false; document.body.style.overflow = 'hidden'; status.textContent = `Carregando página ${numero}...`;
    try {
      const pdf = await pdfjsLib.getDocument({ data: pdfPreviewData.slice() }).promise;
      const pg = await pdf.getPage(numero);
      const original = pg.getViewport({ scale: 1 });
      const scale = Math.min(2.2, (window.innerWidth - 48) / original.width, (window.innerHeight - 120) / original.height);
      const viewport = pg.getViewport({ scale: Math.max(0.35, scale) });
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await pg.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      status.textContent = `Página ${numero}`;
    } catch (e) { status.textContent = 'Não foi possível ampliar esta página: ' + e.message; }
  }
  function fecharPaginaPdf() { $('pdfModal').hidden = true; document.body.style.overflow = ''; }
  $('paginasPdf').addEventListener('click', (e) => {
    const thumb = e.target.closest('[data-pdf-page]'); if (thumb) abrirPaginaPdf(Number(thumb.dataset.pdfPage));
  });
  $('pdfModalClose').addEventListener('click', fecharPaginaPdf);
  $('pdfModal').addEventListener('click', (e) => { if (e.target === $('pdfModal')) fecharPaginaPdf(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('pdfModal').hidden) fecharPaginaPdf(); });

  $('arquivoPdf').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const st = $('importStatus'); st.textContent = 'Lendo o PDF...';
    try {
      const { paginas, textos, miniaturas, n, previewData } = await lerPdf(f);
      const r = X.extrair(paginas);
      novaAvaliacao(true);
      preencher(r);
      estado.textoPaginas = textos; estado.extracaoBruta = r; pdfPreviewData = previewData;
      $('paginasPdf').innerHTML = miniaturas.map((m, i) => `<button type="button" class="pagina-thumb" data-pdf-page="${i + 1}" aria-label="Ampliar página ${i + 1}" title="Clique para ampliar"><img src="${m}" alt="Página ${i + 1}"></button>`).join('');
      st.textContent = `PDF lido (${n} página(s)): ${r.dinamica.length} linha(s) na dinâmica. Revise os campos antes de avaliar.`;
      recalcular(true); verificarDuplicidade();
    } catch (err) { st.textContent = 'Não foi possível ler o PDF: ' + err.message; }
  });
  $('btnCorrigirIA').addEventListener('click', async () => {
    const st = $('importStatus');
    if (!estado.textoPaginas.length) { st.textContent = 'Importe um PDF primeiro.'; return; }
    st.textContent = 'Corrigindo a extração com IA...';
    try {
      const r = await api('/api/extrair-relatorio', { method: 'POST', body: JSON.stringify({ paginas: estado.textoPaginas, camposPreliminares: dados() }) });
      preencher(r); st.textContent = 'Extração corrigida pela IA. Revise os campos.'; recalcular(true);
    } catch (e) { st.textContent = 'Falha: ' + e.message; }
  });

  /* ---------- Turmas ---------- */
  async function carregarTurmas() {
    estado.turmas = await api('/api/turmas');
    if (!estado.turmas.length) { await api('/api/turmas', { method: 'POST', body: JSON.stringify({ nome: 'Turma 1' }) }); estado.turmas = await api('/api/turmas'); }
    if (!estado.turmaId || !estado.turmas.some((t) => t.id === estado.turmaId)) estado.turmaId = estado.turmas[0].id;
    $('turmaSelect').innerHTML = estado.turmas.map((t) => `<option value="${esc(t.id)}">${esc(t.nome)}</option>`).join('');
    $('turmaSelect').value = estado.turmaId;
    await carregarAvaliacoes();
  }
  async function carregarAvaliacoes() {
    estado.avaliacoes = await api(`/api/turmas/${estado.turmaId}/avaliacoes`);
    desenharRoster();
  }
  $('turmaSelect').addEventListener('change', async (e) => { estado.turmaId = e.target.value; await carregarAvaliacoes(); });
  $('btnNovaTurma').addEventListener('click', async () => {
    const nome = prompt('Nome da nova turma:'); if (!nome) return;
    try { const t = await api('/api/turmas', { method: 'POST', body: JSON.stringify({ nome }) }); estado.turmaId = t.id; await carregarTurmas(); } catch (e) { alert(e.message); }
  });
  $('btnRenomear').addEventListener('click', async () => {
    const atual = estado.turmas.find((t) => t.id === estado.turmaId); const nome = prompt('Novo nome da turma:', atual && atual.nome); if (!nome) return;
    try { await api(`/api/turmas/${estado.turmaId}`, { method: 'PATCH', body: JSON.stringify({ nome }) }); await carregarTurmas(); } catch (e) { alert(e.message); }
  });
  $('btnExcluirTurma').addEventListener('click', async () => {
    const atual = estado.turmas.find((t) => t.id === estado.turmaId);
    const conf = prompt(`Para excluir a turma inteira, digite o nome exato: ${atual.nome}`); if (conf == null) return;
    try { await api(`/api/turmas/${estado.turmaId}`, { method: 'DELETE', body: JSON.stringify({ confirmarNome: conf }) }); estado.turmaId = null; await carregarTurmas(); } catch (e) { alert(e.message); }
  });
  $('btnLimpar').addEventListener('click', async () => {
    if (!confirm('Remover todas as avaliações desta turma?')) return;
    await api(`/api/turmas/${estado.turmaId}/avaliacoes`, { method: 'DELETE' }); await carregarAvaliacoes();
  });

  function montarRegistro() {
    const d = dados(); const po = pontosObj();
    return {
      ...d, id: estado.avaliacaoId || novoId(),
      pontuacoes: { ...estado.pontuacoes }, observacoes: { ...estado.observacoes }, justificativas: { ...estado.justificativas },
      total: C.total(po), alertas: alertasAtuais().map((a) => a.texto), alertasManuais: $('alertasManuais').value,
      feedback: $('feedbackOut').value, feedbackEditado: estado.feedbackEditado, statusCorrecao: $('statusCorrecao').value,
      ...(window.CoerenciaUI ? CoerenciaUI.valores() : {}),
      orientadorOk: C.orientadorCorreto(d.orientador), salvoEm: new Date().toISOString()
    };
  }
  $('btnSalvar').addEventListener('click', async () => {
    if (!$('nome').value.trim()) { alert('Informe o nome do aluno.'); return; }
    if (Object.keys(estado.pontuacoes).length < C.ORDEM.length && !confirm('A rubrica está incompleta. Salvar mesmo assim?')) return;
    const outro = verificarDuplicidade();
    if (outro) {
      if (confirm(`Já existe "${outro.nome}" na turma. OK para ATUALIZAR essa avaliação, Cancelar para criar outra.`)) estado.avaliacaoId = outro.id;
      else estado.avaliacaoId = null;
    }
    const reg = montarRegistro(); estado.avaliacaoId = reg.id;
    try { await api(`/api/turmas/${estado.turmaId}/avaliacoes/${reg.id}`, { method: 'PUT', body: JSON.stringify(reg) }); $('turmaStatus').innerHTML = `<span class="no-alert">Avaliação de ${esc(reg.nome)} salva.</span>`; await carregarAvaliacoes(); }
    catch (e) { $('turmaStatus').innerHTML = `<div class="alert">${esc(e.message)}</div>`; }
  });

  function novaAvaliacao(silencioso) {
    estado.avaliacaoId = null; estado.pontuacoes = {}; estado.observacoes = {}; estado.justificativas = {}; estado.feedbackEditado = false; estado.modo = '';
    preencher({}); $('feedbackOut').value = ''; $('alertasManuais').value = ''; if (window.CoerenciaUI) CoerenciaUI.limpar(); $('statusCorrecao').value = 'nenhuma';
    $('autoStatus').textContent = ''; $('feedbackStatus').textContent = ''; $('paginasPdf').innerHTML = '';
    marcarRubrica(); desenharNota();
    if (!silencioso) { $('arquivoPdf').value = ''; $('importStatus').textContent = ''; estado.textoPaginas = []; pdfPreviewData = null; }
  }
  $('btnNova').addEventListener('click', () => novaAvaliacao(false));

  // Bloco de coerência (complementar), logo abaixo do Feedback gerado.
  if (window.CoerenciaUI) CoerenciaUI.montar({ depoisDe: $('feedbackOut').closest('.card'), tagCard: 'div', coletar: () => dados(), api,
    titulo: 'Coerência da proposta formativa', produto: 'da proposta formativa',
    oQue: 'Da <b>proposta formativa</b> planejada pelo estudante: objetivo, conteúdos, metodologias, dinâmica das atividades (Parte 2), recursos e avaliação.',
    comOQue: 'Com o <b>desafio</b> que ele definiu e com o <b>público-alvo</b> indicado na proposta.',
    aspectos: ['se objetivo, conteúdos e metodologias respondem ao desafio, e não só ao tema;', 'se a dinâmica (tempos, papéis e espaços) é viável e adequada ao público e à carga horária;', 'se a avaliação da aprendizagem mostraria se a proposta de fato ajudou no desafio.'] });

  function abrirAvaliacao(id) {
    const a = estado.avaliacoes.find((x) => x.id === id); if (!a) return;
    novaAvaliacao(true); estado.avaliacaoId = a.id; preencher(a);
    estado.pontuacoes = { ...(a.pontuacoes || {}) }; estado.observacoes = { ...(a.observacoes || {}) }; estado.justificativas = { ...(a.justificativas || {}) };
    $('alertasManuais').value = a.alertasManuais || ''; $('feedbackOut').value = a.feedback || ''; estado.feedbackEditado = Boolean(a.feedbackEditado);
    $('statusCorrecao').value = a.statusCorrecao || 'nenhuma';
    if (window.CoerenciaUI) CoerenciaUI.definir(a);
    marcarRubrica(); desenharNota(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function badgeCorrecao(a) {
    const s = a.statusCorrecao || 'nenhuma';
    if (s === 'aguardando') return '<span class="badge badge-pend">Aguardando</span>';
    if (s === 'corrigido') return '<span class="badge badge-ok">Corrigido</span>';
    return '<span class="muted">-</span>';
  }
  function desenharRoster() {
    const tb = $('rosterBody');
    const lista = [...estado.avaliacoes].sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));
    tb.innerHTML = lista.map((a) => `<tr>
      <td>${esc(a.nome)}</td><td>${esc(a.matricula)}</td><td><b>${nota(a.total || 0)}</b></td>
      <td>${C.orientadorCorreto(a.orientador) ? '<span class="badge badge-ok">OK</span>' : '<span class="badge badge-err">Corrigir</span>'}</td>
      <td>${badgeCorrecao(a)}</td>
      <td class="acoes"><button class="btn secondary" data-abrir="${esc(a.id)}">Abrir</button><button class="btn danger" data-rem="${esc(a.id)}">Excluir</button></td></tr>`).join('');
    $('rosterEmpty').style.display = lista.length ? 'none' : '';
  }
  $('rosterBody').addEventListener('click', async (e) => {
    const ab = e.target.closest('[data-abrir]'); const rm = e.target.closest('[data-rem]');
    if (ab) abrirAvaliacao(ab.dataset.abrir);
    if (rm && confirm('Excluir esta avaliação?')) { await api(`/api/turmas/${estado.turmaId}/avaliacoes/${rm.dataset.rem}`, { method: 'DELETE' }); await carregarAvaliacoes(); }
  });

  /* ---------- Exportar / importar / backup ---------- */
  function baixar(nome, tipo, conteudo) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([conteudo], { type: tipo })); a.download = nome; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const nomeTurma = () => (estado.turmas.find((t) => t.id === estado.turmaId) || {}).nome || 'turma';
  $('btnJson').addEventListener('click', () => baixar(`p3-${nomeTurma()}.json`, 'application/json', JSON.stringify({ turma: nomeTurma(), avaliacoes: estado.avaliacoes }, null, 2)));
  $('btnCsv').addEventListener('click', () => {
    const cab = ['Nome', 'Matrícula', 'Orientador indicado', 'Coerência', 'Dinâmica', 'Tecnologias', 'Avaliação', 'IA', 'Total', 'Correções', 'Alertas'];
    const lin = estado.avaliacoes.map((a) => [a.nome, a.matricula, a.orientador, ...C.ORDEM.map((k) => (a.pontuacoes || {})[k]), a.total, a.statusCorrecao || 'nenhuma', (a.alertas || []).join(' | ')]);
    const csv = [cab, ...lin].map((l) => l.map((v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`).join(';')).join('\n');
    baixar(`p3-${nomeTurma()}.csv`, 'text/csv;charset=utf-8', '﻿' + csv);
  });
  $('arquivoJson').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return; const st = $('importJsonStatus');
    try {
      const j = JSON.parse(await f.text());
      const lista = Array.isArray(j) ? j : Array.isArray(j.avaliacoes) ? j.avaliacoes : [j];
      for (const a of lista) { const id = a.id || novoId(); await api(`/api/turmas/${estado.turmaId}/avaliacoes/${id}`, { method: 'PUT', body: JSON.stringify({ ...a, id }) }); }
      await carregarAvaliacoes(); st.textContent = `${lista.length} avaliação(ões) importada(s).`;
    } catch (err) { st.textContent = 'Arquivo inválido: ' + err.message; }
  });
  $('btnGit').addEventListener('click', async () => {
    const st = $('githubStatus'); st.textContent = 'Enviando cópia para o GitHub...';
    try { const r = await api('/api/backup/github', { method: 'POST' }); st.textContent = r.mensagem || 'Cópia enviada.'; } catch (e) { st.textContent = 'Backup indisponível: ' + e.message; }
  });

  /* ---------- Relatório executivo ---------- */
  function svgBarrasH(itens, largura = 900) {
    const h = 34 * itens.length + 20;
    const linhas = itens.map((it, i) => {
      const y = 10 + i * 34; const w = Math.round((largura - 420) * (it.valor / (it.max || 1)));
      return `<text x="0" y="${y + 18}" font-size="12" fill="#212F3C">${esc(it.rotulo)}</text><rect x="200" y="${y}" width="${largura - 260}" height="22" fill="#D6EAF8"/><rect x="200" y="${y}" width="${w}" height="22" fill="${it.cor || '#1B6B93'}"/><text x="${200 + largura - 410}" y="${y + 16}" font-size="12" fill="#212F3C">${esc(it.texto)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${largura} ${h}" width="100%" role="img">${linhas}</svg>`;
  }
  function svgColunas(itens, altura = 190) {
    const largura = Math.max(420, itens.length * 44 + 40); const base = altura - 40; const max = Math.max(1, ...itens.map((i) => i.valor));
    const barras = itens.map((it, i) => {
      const x = 30 + i * ((largura - 40) / itens.length); const w = ((largura - 40) / itens.length) - 10; const h = Math.round((base - 20) * it.valor / max);
      return `<rect x="${x}" y="${base - h}" width="${w}" height="${h}" fill="${it.cor || '#1B6B93'}"/><text x="${x + w / 2}" y="${base - h - 4}" font-size="11" text-anchor="middle" fill="#212F3C">${esc(it.texto == null ? it.valor : it.texto)}</text><text x="${x + w / 2}" y="${base + 14}" font-size="10" text-anchor="middle" fill="#34495E">${esc(it.rotulo)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${largura} ${altura}" width="100%" role="img"><line x1="24" y1="${base}" x2="${largura}" y2="${base}" stroke="#D5DBDB"/>${barras}</svg>`;
  }
  function gerarRelatorioExecutivo() {
    const av = [...estado.avaliacoes].sort((a, b) => (b.total || 0) - (a.total || 0));
    if (!av.length) { alert('Salve ao menos uma avaliação na turma.'); return; }
    const n = av.length; const tot = av.map((a) => a.total || 0); const media = tot.reduce((x, y) => x + y, 0) / n;
    const aprov = av.filter((a) => (a.total || 0) >= 7).length;
    const cor = (v) => (v >= 7 ? '#1E8449' : v >= 5 ? '#B7950B' : '#922B21');
    const criterios = C.ORDEM.map((k) => {
      const max = C.RUBRICA[k].max; const soma = av.reduce((s, a) => s + (Number((a.pontuacoes || {})[k]) || 0), 0);
      const cheios = av.filter((a) => Number((a.pontuacoes || {})[k]) >= max).length;
      return { k, rotulo: C.RUBRICA[k].curto, pct: soma / (max * n), cheios, media: soma / n, max };
    });
    const faixas = [['0 a 4,9', 0, 4.99], ['5 a 6,9', 5, 6.99], ['7 a 8,4', 7, 8.49], ['8,5 a 10', 8.5, 10]].map(([r, a, b], i) => ({ rotulo: r, valor: av.filter((x) => (x.total || 0) >= a && (x.total || 0) <= b).length, cor: ['#922B21', '#B7950B', '#1B6B93', '#1E8449'][i] }));
    const orientErro = av.filter((a) => !C.orientadorCorreto(a.orientador));
    const matErro = av.filter((a) => C.matriculaPlaceholder(a.matricula) || !C.matriculaValida(a.matricula));
    const aguardando = av.filter((a) => a.statusCorrecao === 'aguardando').length; const corrigido = av.filter((a) => a.statusCorrecao === 'corrigido').length;
    const pend = [
      { rotulo: 'Orientador', valor: orientErro.length, cor: '#922B21' }, { rotulo: 'Matrícula', valor: matErro.length, cor: '#B7950B' },
      { rotulo: 'Aguardando', valor: aguardando, cor: '#B7950B' }, { rotulo: 'Corrigido', valor: corrigido, cor: '#1E8449' }
    ];
    const linhaNotas = av.map((a, i) => `<tr><td>${i + 1}</td><td>${esc(a.nome)}</td><td>${esc(a.matricula)}</td>${C.ORDEM.map((k) => `<td>${nota((a.pontuacoes || {})[k] || 0)}</td>`).join('')}<td><b>${nota(a.total || 0)}</b></td><td>${C.orientadorCorreto(a.orientador) ? 'OK' : esc(a.orientador || 'vazio')}</td><td>${esc(({ aguardando: 'Aguardando', corrigido: 'Corrigido' })[a.statusCorrecao] || '-')}</td></tr>`).join('');
    const linhaPend = av.filter((a) => (a.alertas || []).length || a.statusCorrecao === 'aguardando').map((a) => `<tr><td>${esc(a.nome)}</td><td>${(a.alertas || []).map(esc).join('<br>') || '-'}</td><td>${esc(({ aguardando: 'Aguardando', corrigido: 'Corrigido' })[a.statusCorrecao] || 'Sem pedido')}</td><td class="chk">☐ Verificado</td></tr>`).join('');
    const hoje = new Date().toLocaleDateString('pt-BR');
    const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório Executivo P3 · ${esc(nomeTurma())}</title><style>
      body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#212F3C;margin:0;background:#F4F6F7}
      .pag{max-width:1000px;margin:0 auto;padding:28px}
      h1{color:#1B4F72;margin:0}h2{color:#1B6B93;border-bottom:2px solid #D6EAF8;padding-bottom:6px;margin-top:30px}
      .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:16px 0}.kpi{background:#fff;border:1px solid #D5DBDB;border-radius:8px;padding:12px}.kpi b{display:block;font-size:1.6rem;color:#1B4F72}
      table{width:100%;border-collapse:collapse;font-size:0.82rem;background:#fff}th{background:#1B6B93;color:#fff;text-align:left;padding:6px}td{padding:6px;border-bottom:1px solid #D5DBDB;vertical-align:top}tr:nth-child(even) td{background:#EAF3FA}
      .graf{background:#fff;border:1px solid #D5DBDB;border-radius:8px;padding:12px;margin:10px 0}.nota{font-size:0.8rem;color:#7B8794}
      button{background:#1B6B93;color:#fff;border:0;padding:9px 16px;border-radius:6px;cursor:pointer}
      @media print{body{background:#fff}button{display:none}.pag{padding:0}h2{break-after:avoid}.graf,table{break-inside:avoid}}
    </style></head><body><div class="pag">
      <button onclick="window.print()">Imprimir / salvar em PDF</button>
      <h1>Relatório Executivo · P3 Proposta Formativa</h1>
      <div class="nota">TEDPRO · IFSC Campus Florianópolis-Continente · Turma: ${esc(nomeTurma())} · Emitido em ${hoje}</div>
      <h2>1. Visão geral</h2>
      <div class="kpis"><div class="kpi">Avaliações<b>${n}</b></div><div class="kpi">Média da turma<b>${nota(media)}</b></div><div class="kpi">Nota 7 ou mais<b>${aprov} (${Math.round(100 * aprov / n)}%)</b></div><div class="kpi">Maior / menor<b>${nota(Math.max(...tot))} / ${nota(Math.min(...tot))}</b></div></div>
      <h2>2. Notas finais por aluno</h2>
      <table><thead><tr><th>#</th><th>Aluno</th><th>Matrícula</th>${C.ORDEM.map((k) => `<th>${esc(C.RUBRICA[k].curto)} (${C.RUBRICA[k].max})</th>`).join('')}<th>Total</th><th>Orientador</th><th>Correções</th></tr></thead><tbody>${linhaNotas}</tbody></table>
      <h2>3. Aproveitamento por critério</h2>
      <div class="graf">${svgBarrasH(criterios.map((c) => ({ rotulo: c.rotulo, valor: c.pct, max: 1, texto: `${Math.round(c.pct * 100)}% · ${c.cheios}/${n} com nota máxima`, cor: c.pct >= 0.7 ? '#1E8449' : c.pct >= 0.5 ? '#B7950B' : '#922B21' })))}</div>
      <h2>4. Notas individuais</h2>
      <div class="graf">${svgColunas(av.map((a) => ({ rotulo: C.primeiroNome(a.nome).slice(0, 7), valor: a.total || 0, texto: nota(a.total || 0), cor: cor(a.total || 0) })))}</div>
      <h2>5. Distribuição por faixa de nota</h2>
      <div class="graf">${svgColunas(faixas)}</div>
      <h2>6. Pendências e correções solicitadas</h2>
      <div class="graf">${svgColunas(pend)}</div>
      <table><thead><tr><th>Aluno</th><th>Pendências identificadas</th><th>Situação</th><th>Acompanhamento</th></tr></thead><tbody>${linhaPend || '<tr><td colspan="4">Nenhuma pendência.</td></tr>'}</tbody></table>
      <h2>7. Orientador a corrigir</h2>
      <table><thead><tr><th>Aluno</th><th>Indicado no documento</th><th>Situação</th></tr></thead><tbody>${orientErro.map((a) => `<tr><td>${esc(a.nome)}</td><td>${esc(a.orientador || '(vazio)')}</td><td>${esc(({ aguardando: 'Aguardando', corrigido: 'Corrigido' })[a.statusCorrecao] || 'Sem pedido')}</td></tr>`).join('') || '<tr><td colspan="3">Todos corretos.</td></tr>'}</tbody></table>
      <p class="nota">Orientador correto: ${esc(C.ORIENTADOR_CORRETO)}.</p>
    </div></body></html>`;
    const w = window.open('', '_blank'); if (!w) { alert('Permita pop-ups para abrir o relatório.'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  }
  $('btnRelatorio').addEventListener('click', gerarRelatorioExecutivo);

  /* ---------- início ---------- */
  desenharRubrica(); preencher({}); desenharNota();
  carregarTurmas().catch((e) => { $('turmaStatus').innerHTML = `<div class="alert">Falha ao carregar turmas: ${esc(e.message)}</div>`; });
  window.__p3 = { estado, dados, preencher, abrirAvaliacao, gerarRelatorioExecutivo };
})();
