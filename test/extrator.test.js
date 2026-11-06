const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../public/extrator.js');
const row = (texts, y) => texts.map((s, j) => ({s, x:20+j*150, y, w:80,h:10})).filter(i=>i.s);
const header = [
 ...row(['PARTE 2 - DINÂMICA DA PROPOSTA FORMATIVA'],750),
 ...row(['ESPAÇOS','ATIVIDADE','DURAÇÃO','PAPEL DO ALUNO','PAPEL DO PROFESSOR'],700)
];
test('recognizes hour-class and compound durations without discarding the row', () => {
 for(const duration of ['2 horas-aula','2 horas aula','2 h-aula','2 horas','1 hora','30 minutos','1h30','1 h 30 min']){
  const r=X.extrair([{itens:[...header,...row(['Sala','Atividade',duration,'Participa','Orienta'],500)]}]);
  assert.equal(r.dinamica.length,1,duration);
  assert.equal(r.dinamica[0].duracao,duration);
 }
});
test('preserves continuations in every column and starts the following record separately', () => {
 for(let col=0;col<5;col++){
  const continuation=['','','','',''];continuation[col]='Continuação da célula';
  const r=X.extrair([
   {itens:[...header,...row(['Sala','Missão 1','2 horas-aula','Participa','Orienta'],500)]},
   {itens:[...row(continuation,750),...row(['Casa','Missão 2','1 hora','Pesquisa','Acompanha'],600)]}
  ]);
  assert.equal(r.dinamica.length,2);
  const key=['espaco','atividade','duracao','papelAluno','papelProfessor'][col];
  assert.ok(r.dinamica[0][key].includes('Continuação da célula'));
  assert.equal(r.dinamica[1].atividade,'Missão 2');
 }
});
