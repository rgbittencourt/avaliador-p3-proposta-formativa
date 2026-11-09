/* Bloco "Coerência da proposta" (complementar, sem pontuação), no modelo do Avaliador P4.
   Uso no app:
     CoerenciaUI.montar({ depoisDe, tagCard: 'section'|'div', coletar, api,
                          titulo, produto, oQue, comOQue, aspectos: [..] })
       titulo:   ex. "Coerência do roteiro e do vídeo"
       produto:  ex. "do roteiro e do vídeo" (usado nos subtítulos)
       oQue / comOQue / aspectos: explicação "coerência de quê, com quê" mostrada no bloco
     CoerenciaUI.valores()   -> { analiseCoerencia, feedbackCoerencia }  (para salvar)
     CoerenciaUI.definir(av) -> carrega textos salvos
     CoerenciaUI.limpar()    -> nova avaliação */
(function () {
  'use strict';
  let cfg = null;
  const el = (id) => document.getElementById(id);
  const temTexto = (v) => Boolean(String(v == null ? '' : v).trim());

  function estilos() {
    if (el('coerenciaEstilos')) return;
    const s = document.createElement('style');
    s.id = 'coerenciaEstilos';
    s.textContent = `
      .coerencia-card{border-top:4px solid #1B6B93;}
      .coerencia-card .coerencia-sub{font-size:.78rem;font-weight:600;opacity:.75;}
      .coerencia-card textarea{width:100%;min-height:190px;font-size:.84rem;line-height:1.55;box-sizing:border-box;}
      .coerencia-bloco{margin-top:16px;padding-top:14px;border-top:1px dashed #c9d6df;}
      .coerencia-bloco h3{margin:0 0 4px;color:#1B4F72;font-size:.92rem;}
      .coerencia-status{margin-top:6px;font-size:.82rem;}
      .coerencia-explica{background:#F2F7FB;border:1px solid #D6EAF8;border-radius:10px;padding:10px 12px;margin:8px 0 6px;font-size:.84rem;line-height:1.5;display:flex;flex-direction:column;gap:5px;}
      .coerencia-explica ul{margin:3px 0 0;padding-left:18px;}
      .coerencia-explica li{margin:1px 0;}
      .coerencia-pergunta{font-style:italic;color:#1B4F72;}`;
    document.head.appendChild(s);
  }

  function montar(opcoes) {
    cfg = opcoes || {};
    if (!cfg.depoisDe || el('coerenciaCard')) return;
    estilos();
    const card = document.createElement(cfg.tagCard || 'section');
    card.className = 'card coerencia-card no-print';
    card.id = 'coerenciaCard';
    const titulo = cfg.titulo || 'Coerência da proposta';
    const produto = cfg.produto || 'da proposta';
    const aspectos = (cfg.aspectos || []).map((a) => `<li>${a}</li>`).join('');
    card.innerHTML = `
      <h2>${titulo} <span class="coerencia-sub">(complementar, sem pontuação)</span></h2>
      <div class="coerencia-explica">
        <div><b>Coerência de quê?</b> ${cfg.oQue || 'Do que o estudante produziu.'}</div>
        <div><b>Com o quê?</b> ${cfg.comOQue || 'Com o desafio definido pelo estudante e com o público-alvo indicado.'}</div>
        ${aspectos ? `<div><b>O que a análise observa:</b><ul>${aspectos}</ul></div>` : ''}
        <div class="coerencia-pergunta">Pergunta central: além de bem-feito, isso é realmente útil para enfrentar o desafio, para aquele público?</div>
      </div>
      <div class="hint">Não altera a rubrica, a nota nem o feedback da avaliação.</div>
      <div class="toolbar"><button type="button" class="btn" id="btnAnalisarCoerencia">Analisar coerência</button></div>
      <div id="coerenciaStatus" class="hint coerencia-status"></div>
      <div class="coerencia-bloco">
        <h3>Análise de coerência ${produto}</h3>
        <div class="hint">Parecer técnico destinado ao professor. Totalmente editável.</div>
        <div class="toolbar"><button type="button" class="btn secondary" data-copiar="analiseCoerenciaOut">Copiar análise</button></div>
        <textarea id="analiseCoerenciaOut" placeholder="O parecer técnico aparecerá aqui."></textarea>
      </div>
      <div class="coerencia-bloco">
        <h3>Feedback sobre a coerência ${produto}</h3>
        <div class="hint">Mensagem pedagógica dirigida ao estudante. Totalmente editável.</div>
        <div class="toolbar"><button type="button" class="btn secondary" data-copiar="feedbackCoerenciaOut">Copiar feedback de coerência</button></div>
        <textarea id="feedbackCoerenciaOut" placeholder="O feedback de coerência aparecerá aqui."></textarea>
      </div>`;
    cfg.depoisDe.insertAdjacentElement('afterend', card);
    el('btnAnalisarCoerencia').addEventListener('click', analisar);
    card.querySelectorAll('[data-copiar]').forEach((b) => b.addEventListener('click', () => copiar(b)));
  }

  function status(texto, cor) {
    const s = el('coerenciaStatus'); if (!s) return;
    s.textContent = texto; s.style.color = cor || '';
  }

  async function copiar(botao) {
    const alvo = el(botao.dataset.copiar); if (!alvo) return;
    try { await navigator.clipboard.writeText(alvo.value); }
    catch (e) { alvo.select(); document.execCommand('copy'); }
    const original = botao.textContent; botao.textContent = 'Copiado!';
    setTimeout(() => { botao.textContent = original; }, 1400);
  }

  async function analisar() {
    if (!cfg) return;
    const campos = cfg.coletar ? cfg.coletar() : {};
    if (!temTexto(campos.desafio)) { status('Preencha ou importe ao menos o desafio do estudante antes de analisar.', '#922B21'); return; }
    const atuais = temTexto(el('analiseCoerenciaOut').value) || temTexto(el('feedbackCoerenciaOut').value);
    if (atuais && !confirm('Gerar novamente substituirá os textos de coerência atuais. Continuar?')) return;
    const botao = el('btnAnalisarCoerencia'); botao.disabled = true;
    status('Analisando se o produto é útil para o desafio e para o público-alvo...');
    try {
      const r = await cfg.api('/api/analisar-coerencia', { method: 'POST', body: JSON.stringify(campos) });
      el('analiseCoerenciaOut').value = r.analise_coerencia || '';
      el('feedbackCoerenciaOut').value = r.feedback_coerencia || '';
      status('✔ Análise e feedback gerados a partir da mesma base semântica. Revise e edite livremente antes de salvar.', '#1E8449');
    } catch (e) {
      status(`Não foi possível analisar a coerência (${e.message}).`, '#922B21');
    } finally { botao.disabled = false; }
  }

  function valores() {
    return {
      analiseCoerencia: el('analiseCoerenciaOut') ? el('analiseCoerenciaOut').value.trim() : '',
      feedbackCoerencia: el('feedbackCoerenciaOut') ? el('feedbackCoerenciaOut').value.trim() : ''
    };
  }
  function definir(av) {
    if (!el('analiseCoerenciaOut')) return;
    const a = av || {};
    el('analiseCoerenciaOut').value = a.analiseCoerencia || '';
    el('feedbackCoerenciaOut').value = a.feedbackCoerencia || '';
    status(temTexto(a.analiseCoerencia) || temTexto(a.feedbackCoerencia) ? 'Textos de coerência salvos carregados para edição.' : '');
  }
  function limpar() { definir({}); }

  window.CoerenciaUI = { montar, valores, definir, limpar };
})();
