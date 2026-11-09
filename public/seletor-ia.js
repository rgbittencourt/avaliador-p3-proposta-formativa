/* Janela de login com seletor de IA (OpenAI ou Claude) + seletor no topo do app.
   - Mostra só os provedores com chave configurada no servidor (/api/health).
   - Lembra a escolha neste navegador.
   - window.SeletorIA.pedirLogin() abre a janela de usuário, senha e IA.
   - As chamadas à API enviam a escolha no cabeçalho X-IA-Provedor
     (ver window.SeletorIA.cabecalho(), usado pela função api() do app). */
(function () {
  'use strict';
  const CHAVE = 'iaProvedorEscolhido';
  const NOMES = { openai: 'OpenAI', anthropic: 'Claude' };
  let escolhido = '';
  try { escolhido = localStorage.getItem(CHAVE) || ''; } catch (e) { /* sem storage */ }

  let statusPromessa = null;
  let loginPendente = null;
  let ultimoLogin = null; // {cred, quando}: reaproveitado por chamadas que já estavam em andamento

  function salvar(valor) {
    escolhido = valor;
    try { localStorage.setItem(CHAVE, valor); } catch (e) { /* sem storage */ }
    const topo = document.getElementById('seletorIA');
    if (topo && !topo.disabled && topo.value !== valor) topo.value = valor;
  }

  function carregarStatus() {
    if (!statusPromessa) {
      statusPromessa = fetch('/api/health', { cache: 'no-store' })
        .then((r) => r.json()).catch(() => ({}));
    }
    return statusPromessa;
  }

  function opcoesIA(sel, status) {
    const disp = Array.isArray(status.iaDisponiveis) ? status.iaDisponiveis : [];
    if (!disp.length) {
      sel.add(new Option('Análise local (sem chave de IA)', ''));
      sel.disabled = true;
      return '';
    }
    disp.forEach((p) => {
      const o = new Option(`${NOMES[p.id] || p.nome} · ${p.modelo}`, p.id);
      o.style.color = '#1b2a33';
      sel.add(o);
    });
    const ids = disp.map((p) => p.id);
    const atual = ids.includes(escolhido) ? escolhido : (ids.includes(status.iaProvedor) ? status.iaProvedor : ids[0]);
    sel.value = atual;
    if (disp.length === 1) sel.disabled = true;
    return atual;
  }

  // Janela de login: resolve {usuario, senha} ou null (cancelado).
  function pedirLogin(usuarioPadrao = 'professor') {
    if (loginPendente) return loginPendente;
    if (ultimoLogin && Date.now() - ultimoLogin.quando < 5000) return Promise.resolve(ultimoLogin.cred);
    loginPendente = carregarStatus().then((status) => new Promise((resolve) => {
      const fundo = document.createElement('div');
      fundo.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,30,40,.55);display:flex;align-items:center;justify-content:center;padding:16px;font-family:inherit;';
      fundo.innerHTML = `
        <form id="loginIA" style="background:#fff;color:#1b2a33;border-radius:14px;box-shadow:0 18px 50px rgba(0,0,0,.3);width:100%;max-width:360px;padding:22px 22px 18px;display:flex;flex-direction:column;gap:12px;">
          <h2 style="margin:0;font-size:1.15rem;color:#1B4F72;">Entrar no avaliador</h2>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:.85rem;font-weight:700;">Usuário
            <input name="usuario" autocomplete="username" required style="font:inherit;font-weight:400;padding:9px 10px;border:1px solid #b9c7d1;border-radius:8px;"></label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:.85rem;font-weight:700;">Senha
            <input name="senha" type="password" autocomplete="current-password" required style="font:inherit;font-weight:400;padding:9px 10px;border:1px solid #b9c7d1;border-radius:8px;"></label>
          <label style="display:flex;flex-direction:column;gap:4px;font-size:.85rem;font-weight:700;">Inteligência artificial
            <select name="ia" style="font:inherit;font-weight:400;padding:9px 10px;border:1px solid #b9c7d1;border-radius:8px;background:#fff;"></select>
            <span style="font-weight:400;font-size:.75rem;color:#5a6b75;">Dá para trocar depois no seletor "IA" no topo da página.</span></label>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:4px;">
            <button type="button" data-acao="cancelar" style="font:inherit;padding:8px 14px;border-radius:8px;border:1px solid #b9c7d1;background:#fff;cursor:pointer;">Cancelar</button>
            <button type="submit" style="font:inherit;font-weight:700;padding:8px 16px;border-radius:8px;border:0;background:#1B6B93;color:#fff;cursor:pointer;">Entrar</button>
          </div>
        </form>`;
      document.body.appendChild(fundo);
      const form = fundo.querySelector('form');
      const sel = form.elements.ia;
      sel.querySelectorAll('option').forEach((o) => o.remove());
      opcoesIA(sel, status);
      sel.querySelectorAll('option').forEach((o) => { o.style.color = ''; });
      form.elements.usuario.value = usuarioPadrao;
      setTimeout(() => form.elements.senha.focus(), 0);
      const fechar = (valor) => { fundo.remove(); loginPendente = null; resolve(valor); };
      form.querySelector('[data-acao="cancelar"]').addEventListener('click', () => fechar(null));
      fundo.addEventListener('keydown', (e) => { if (e.key === 'Escape') fechar(null); });
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!sel.disabled || sel.value) salvar(sel.value);
        const cred = { usuario: form.elements.usuario.value, senha: form.elements.senha.value };
        ultimoLogin = { cred, quando: Date.now() };
        fechar(cred);
      });
    }));
    return loginPendente;
  }

  // Cabeçalho Authorization (Basic) aceitando acentos na senha.
  function basic(usuario, senha) {
    return 'Basic ' + btoa(unescape(encodeURIComponent(`${usuario}:${senha}`)));
  }

  function montar(status) {
    const brand = document.querySelector('header .brand');
    if (!brand || document.getElementById('seletorIA')) return;
    const caixa = document.createElement('div');
    caixa.className = 'no-print';
    caixa.style.cssText = 'margin-left:auto;flex-shrink:0;display:flex;align-items:center;gap:8px;font-size:.85rem;color:inherit;';
    const rotulo = document.createElement('label');
    rotulo.htmlFor = 'seletorIA';
    rotulo.textContent = 'IA:';
    rotulo.style.cssText = 'font-weight:700;color:#fff;margin:0;';
    const sel = document.createElement('select');
    sel.id = 'seletorIA';
    sel.title = 'Escolha qual inteligência artificial faz as sugestões';
    sel.style.cssText = 'font:inherit;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.55);background:rgba(255,255,255,.16);color:#fff;cursor:pointer;';
    salvar(opcoesIA(sel, status));
    if (sel.disabled) sel.style.cursor = 'default';
    else sel.addEventListener('change', () => salvar(sel.value));
    caixa.append(rotulo, sel);
    brand.appendChild(caixa);
  }

  window.SeletorIA = {
    provedor: () => escolhido,
    cabecalho: () => (escolhido ? { 'X-IA-Provedor': escolhido } : {}),
    pedirLogin,
    basic,
    esquecerLogin: () => { ultimoLogin = null; }
  };

  function iniciar() {
    carregarStatus().then((status) => { if (status && status.ok !== undefined) montar(status); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
