const test = require('node:test');
const assert = require('node:assert');
const {configIA, chamarIA, extrairJSON} = require('../ia');

function respostaFalsa(status, corpo){
  return {ok: status >= 200 && status < 300, status,
    json: async () => corpo, text: async () => (typeof corpo === 'string' ? corpo : JSON.stringify(corpo))};
}

test('configIA escolhe o provedor pela variável e, sem ela, pela chave disponível', () => {
  assert.equal(configIA({}).configurada, false);
  assert.equal(configIA({OPENAI_API_KEY:'a'}).provedor, 'openai');
  assert.equal(configIA({ANTHROPIC_API_KEY:'b'}).provedor, 'anthropic');
  assert.equal(configIA({OPENAI_API_KEY:'a', ANTHROPIC_API_KEY:'b'}).provedor, 'openai');
  const c = configIA({IA_PROVEDOR:'Anthropic', OPENAI_API_KEY:'a', ANTHROPIC_API_KEY:'b'});
  assert.equal(c.provedor, 'anthropic');
  assert.equal(c.modelo, 'claude-haiku-5-5');
  assert.equal(configIA({IA_PROVEDOR:'anthropic', OPENAI_API_KEY:'a'}).configurada, false);
  assert.equal(configIA({OPENAI_API_KEY:'a'}).modelo, 'gpt-4o-mini');
});

test('extrairJSON tolera cercas de código e texto ao redor', () => {
  assert.deepEqual(extrairJSON('```json\n{"a":1}\n```'), {a:1});
  assert.deepEqual(extrairJSON('Segue: {"a":{"b":2}} pronto.'), {a:{b:2}});
  assert.throws(() => extrairJSON('sem json'), /formato reconhecível/);
});

test('chamarIA monta a requisição da Anthropic e lê o JSON do bloco de texto', async () => {
  let pedido;
  const fetch = async (url, op) => { pedido = {url, op, corpo: JSON.parse(op.body)};
    return respostaFalsa(200, {stop_reason:'end_turn', content:[{type:'text', text:'{"nota":7}'}]}); };
  const r = await chamarIA('avalie', 0.3, {env:{IA_PROVEDOR:'anthropic', ANTHROPIC_API_KEY:'k'}, fetch});
  assert.deepEqual(r, {nota:7});
  assert.equal(pedido.url, 'https://api.anthropic.com/v1/messages');
  assert.equal(pedido.op.headers['x-api-key'], 'k');
  assert.equal(pedido.op.headers['anthropic-version'], '2023-06-01');
  assert.equal(pedido.corpo.model, 'claude-haiku-5-5');
  assert.equal(pedido.corpo.temperature, 0.3);
  assert.ok(pedido.corpo.max_tokens > 0);
  assert.equal(pedido.corpo.messages[0].content, 'avalie');
});

test('chamarIA repete sem temperature quando a Anthropic recusa o parâmetro', async () => {
  const corpos = [];
  const fetch = async (_url, op) => { corpos.push(JSON.parse(op.body));
    return corpos.length === 1
      ? respostaFalsa(400, 'temperature is not supported for this model')
      : respostaFalsa(200, {stop_reason:'end_turn', content:[{type:'text', text:'{"ok":true}'}]}); };
  const r = await chamarIA('x', 0.2, {env:{IA_PROVEDOR:'anthropic', ANTHROPIC_API_KEY:'k'}, fetch});
  assert.deepEqual(r, {ok:true});
  assert.equal('temperature' in corpos[1], false);
});

test('chamarIA trata recusa, resposta cortada e erro HTTP da Anthropic', async () => {
  const env = {IA_PROVEDOR:'anthropic', ANTHROPIC_API_KEY:'k'};
  await assert.rejects(chamarIA('x', 0, {env, fetch: async () => respostaFalsa(200, {stop_reason:'refusal', content:[]})}), /recusou responder/);
  await assert.rejects(chamarIA('x', 0, {env, fetch: async () => respostaFalsa(200, {stop_reason:'max_tokens', content:[{type:'text', text:'{"a":'}]})}), /cortada/);
  // cortada na 1ª tentativa e completa na 2ª, com o dobro do limite
  const limites = [];
  const r = await chamarIA('x', 0, {env, fetch: async (_u, op) => { const c = JSON.parse(op.body); limites.push(c.max_tokens);
    return limites.length === 1 ? respostaFalsa(200, {stop_reason:'max_tokens', content:[{type:'text', text:'{"a":'}]})
                                : respostaFalsa(200, {stop_reason:'end_turn', content:[{type:'text', text:'{"a":1}'}]}); }});
  assert.deepEqual(r, {a:1});
  assert.deepEqual(limites, [16000, 32000]);
  await assert.rejects(chamarIA('x', 0, {env, fetch: async () => respostaFalsa(529, 'overloaded')}), /Anthropic recusou a análise \(529\)/);
});

test('chamarIA mantém o comportamento atual com a OpenAI', async () => {
  let pedido;
  const fetch = async (url, op) => { pedido = {url, op, corpo: JSON.parse(op.body)};
    return respostaFalsa(200, {choices:[{message:{content:'{"nota":9}'}}]}); };
  const r = await chamarIA('avalie', 0, {env:{OPENAI_API_KEY:'sk'}, fetch});
  assert.deepEqual(r, {nota:9});
  assert.equal(pedido.url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(pedido.op.headers.Authorization, 'Bearer sk');
  assert.deepEqual(pedido.corpo.response_format, {type:'json_object'});
  await assert.rejects(chamarIA('x', 0, {env:{}, fetch}), /OPENAI_API_KEY não configurada/);
});

test('o seletor da tela escolhe o provedor só quando há chave para ele', () => {
  const {configDaRequisicao, provedoresDisponiveis} = require('../ia');
  const req = (v) => ({get: (h) => (h.toLowerCase() === 'x-ia-provedor' ? v : undefined)});
  const env = {IA_PROVEDOR:'openai', OPENAI_API_KEY:'a', ANTHROPIC_API_KEY:'b'};
  assert.equal(configDaRequisicao(req('anthropic'), env).provedor, 'anthropic');
  assert.equal(configDaRequisicao(req('openai'), env).provedor, 'openai');
  assert.equal(configDaRequisicao(req(undefined), env).provedor, 'openai');
  assert.equal(configDaRequisicao(req('qualquer'), env).provedor, 'openai');
  assert.equal(configDaRequisicao(req('anthropic'), {IA_PROVEDOR:'openai', OPENAI_API_KEY:'a'}).provedor, 'openai');
  assert.deepEqual(provedoresDisponiveis(env).map(p => p.id), ['openai','anthropic']);
  assert.deepEqual(provedoresDisponiveis({ANTHROPIC_API_KEY:'b'}).map(p => p.id), ['anthropic']);
  assert.deepEqual(provedoresDisponiveis({}), []);
});
