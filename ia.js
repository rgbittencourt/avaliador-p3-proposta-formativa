// Camada única de IA: o app chama sempre chamarIA(prompt, temperatura) e
// esta camada decide se fala com a OpenAI ou com a Anthropic (Claude).
//
// Variáveis de ambiente:
//   IA_PROVEDOR        openai | anthropic. Se ficar vazia, usa a OpenAI quando
//                      houver OPENAI_API_KEY; senão, a Anthropic quando houver
//                      ANTHROPIC_API_KEY.
//   OPENAI_API_KEY     chave da OpenAI          OPENAI_MODEL     (padrão gpt-4o-mini)
//   ANTHROPIC_API_KEY  chave da Anthropic       ANTHROPIC_MODEL  (padrão claude-haiku-5-5)
//   IA_MAX_TOKENS      limite de tokens da resposta (padrão 8192)
//
// Sem nenhuma chave, iaConfigurada é false e o app segue com a análise local.

const PROVEDORES = {
  openai:    { nome: 'OpenAI',    variavelChave: 'OPENAI_API_KEY',    variavelModelo: 'OPENAI_MODEL',    modeloPadrao: 'gpt-4o-mini' },
  anthropic: { nome: 'Anthropic', variavelChave: 'ANTHROPIC_API_KEY', variavelModelo: 'ANTHROPIC_MODEL', modeloPadrao: 'claude-haiku-5-5' }
};

const INSTRUCAO_JSON = 'Responda somente com um único objeto JSON válido, sem texto antes ou depois e sem blocos de código.';

function configIA(env = process.env) {
  let provedor = String(env.IA_PROVEDOR || '').trim().toLowerCase();
  if (!PROVEDORES[provedor]) {
    provedor = env.OPENAI_API_KEY ? 'openai' : env.ANTHROPIC_API_KEY ? 'anthropic' : 'openai';
  }
  const p = PROVEDORES[provedor];
  const chave = env[p.variavelChave] || '';
  return {
    provedor,
    nome: p.nome,
    variavelChave: p.variavelChave,
    chave,
    modelo: env[p.variavelModelo] || p.modeloPadrao,
    maxTokens: Number(env.IA_MAX_TOKENS) || 8192,
    configurada: Boolean(chave)
  };
}

// Extrai o objeto JSON de um texto, tolerando cercas ``` e frases ao redor.
function extrairJSON(texto) {
  const limpo = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const ini = limpo.indexOf('{');
  const fim = limpo.lastIndexOf('}');
  if (ini < 0 || fim < ini) throw new Error('A IA não respondeu em um formato reconhecível. Tente novamente.');
  try { return JSON.parse(limpo.slice(ini, fim + 1)); }
  catch { throw new Error('A IA não respondeu em um formato reconhecível. Tente novamente.'); }
}

function erroHTTP(cfg, status, detalhe) {
  console.error(cfg.nome, status, detalhe);
  const erro = new Error(`A API da ${cfg.nome} recusou a análise (${status}).`);
  erro.status = status === 429 ? 429 : 502;
  return erro;
}

async function chamarOpenAI(cfg, prompt, temperatura, f) {
  const r = await f('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: cfg.modelo,
      response_format: { type: 'json_object' },
      temperature: temperatura,
      messages: [{ role: 'user', content: prompt }]
    })
  });
  if (!r.ok) throw erroHTTP(cfg, r.status, await r.text().catch(() => ''));
  const data = await r.json();
  return extrairJSON(data.choices?.[0]?.message?.content);
}

async function chamarAnthropic(cfg, prompt, temperatura, f) {
  const enviar = (comTemperatura) => {
    const corpo = {
      model: cfg.modelo,
      max_tokens: cfg.maxTokens,
      system: INSTRUCAO_JSON,
      messages: [{ role: 'user', content: prompt }]
    };
    if (comTemperatura) corpo.temperature = temperatura;
    return f('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': cfg.chave, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(corpo)
    });
  };
  let r = await enviar(true);
  let detalhe = '';
  if (r.status === 400) {
    // Alguns modelos não aceitam "temperature": tenta de novo sem ele.
    detalhe = await r.text().catch(() => '');
    if (/temperature/i.test(detalhe)) { r = await enviar(false); detalhe = ''; }
  }
  if (!r.ok) throw erroHTTP(cfg, r.status, detalhe || await r.text().catch(() => ''));
  const data = await r.json();
  if (data.stop_reason === 'refusal') throw new Error('A IA da Anthropic recusou responder a este conteúdo.');
  if (data.stop_reason === 'max_tokens') throw new Error('A resposta da IA foi cortada por excesso de tamanho. Aumente IA_MAX_TOKENS ou tente novamente.');
  const texto = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
  return extrairJSON(texto);
}

// Envia o prompt ao provedor configurado e devolve o objeto JSON da resposta.
async function chamarIA(prompt, temperatura = 0.2, opcoes = {}) {
  const cfg = opcoes.config || configIA(opcoes.env);
  const f = opcoes.fetch || fetch;
  if (!cfg.configurada) throw new Error(`${cfg.variavelChave} não configurada no servidor.`);
  return cfg.provedor === 'anthropic'
    ? chamarAnthropic(cfg, prompt, temperatura, f)
    : chamarOpenAI(cfg, prompt, temperatura, f);
}

// Resumo seguro (sem a chave) para o /api/health.
function statusIA(cfg = configIA()) {
  return { iaConfigurada: cfg.configurada, iaProvedor: cfg.provedor, iaModelo: cfg.modelo };
}

module.exports = { configIA, chamarIA, statusIA, extrairJSON, PROVEDORES };
