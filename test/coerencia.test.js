const test = require('node:test');
const assert = require('node:assert');
const {montarPromptCoerencia, limparSaidaCoerencia} = require('../coerencia');

test('prompt de coerência tem a pergunta central, os eixos e os campos da atividade', () => {
  const p = montarPromptCoerencia({nome:'Atividade X', produto:'produto Y', cadeia:'a -> b', criterios:['critério próprio'], campos:[['Desafio','Como podemos ajudar?'],['Público-alvo','']], assinatura:'Prof. Ana'});
  assert.match(p, /PERGUNTA CENTRAL/);
  assert.match(p, /realmente útil para enfrentar o DESAFIO/);
  assert.match(p, /Desafio: Como podemos ajudar\?/);
  assert.match(p, /Público-alvo: \(campo vazio\)/);
  assert.match(p, /- critério próprio/);
  assert.match(p, /Um abraço,\nProf\. Ana/);
  assert.match(p, /não atribua nota/);
});

test('limparSaidaCoerencia exige as duas saídas, fixa a assinatura e remove travessão', () => {
  const r = limparSaidaCoerencia({analise_coerencia:'Parecer — com travessão.', feedback_coerencia:'Olá, Ana.\n\nUm abraço,\nProf. Rogério'}, 'Prof. Luís');
  assert.equal(r.analise_coerencia, 'Parecer, com travessão.');
  assert.ok(r.feedback_coerencia.endsWith('Um abraço,\nProf. Luís'));
  assert.equal((r.feedback_coerencia.match(/Um abraço/g) || []).length, 1);
  assert.throws(() => limparSaidaCoerencia({analise_coerencia:'só uma'}), /duas saídas/);
});
