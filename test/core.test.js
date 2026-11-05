const test = require('node:test');
const assert = require('node:assert');
const C = require('../public/p3-core.js');
const { limparAvaliacao, montarPromptExtracao, limparExtracao } = require('../server.js');

test('rubrica soma 10 pontos', () => assert.strictEqual(C.NOTA_MAXIMA, 10));
test('C5 é binário', () => assert.strictEqual(C.pontoValido('ia', 0.5) === 0 || C.pontoValido('ia', 0.5) === 1, true));
test('sem travessão', () => assert.ok(!/[—–]/.test(C.semTravessao('a — b – c'))));
test('orientador errado vira pedido em primeira pessoa', () => {
  const d = { nome: 'Ana Maria', matricula: '20261400001', orientador: 'selecione', desafio: 'Como podemos testar?' };
  const p = { coerencia: { pontos: 2 }, dinamica: { pontos: 3 }, tecnologias: { pontos: 2 }, avaliacao: { pontos: 2 }, ia: { pontos: 1 } };
  const f = C.feedbackLocal(d, p, {});
  assert.match(f, /^Olá Ana,/);
  assert.match(f, /Sou eu, Prof\. Rogério Gonçalves Bittencourt/);
  assert.match(f, /Um abraço,\nProf\. Rogério$/);
  assert.ok(!/[—–]/.test(f));
});
test('feedback só lista critérios abaixo do máximo', () => {
  const d = { nome: 'Ana', matricula: '20261400001', orientador: C.ORIENTADOR_CORRETO, desafio: 'x' };
  const p = { coerencia: { pontos: 2 }, dinamica: { pontos: 2 }, tecnologias: { pontos: 2 }, avaliacao: { pontos: 2 }, ia: { pontos: 1 } };
  const f = C.feedbackLocal(d, p, {});
  assert.match(f, /Critério 2:/);
  assert.ok(!/Critério 1: /.test(f));
});
test('limparAvaliacao ajusta pontos inválidos', () => {
  const r = limparAvaliacao({ pontuacoes: { ia: { pontos: 0.5 }, dinamica: { pontos: 9 } } });
  assert.ok([0, 1].includes(r.pontuacoes.ia.pontos));
  assert.strictEqual(r.pontuacoes.dinamica.pontos, 3);
});
test('limparExtracao normaliza IA', () => assert.strictEqual(limparExtracao({ iaDeclaracao: 'talvez' }).iaDeclaracao, ''));
test('prompt de extração inclui o texto', () => assert.match(montarPromptExtracao({ paginas: ['abc'] }), /abc/));
