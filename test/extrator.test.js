const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../public/extrator.js');
const C = require('../public/p3-core.js');
const row = (texts, y) => texts.map((s, j) => ({s, x:20+j*150, y, w:80,h:10})).filter(i=>i.s);
const header = [
 ...row(['PARTE 2 - DINÂMICA DA PROPOSTA FORMATIVA'],750),
 ...row(['ESPAÇOS','ATIVIDADE','DURAÇÃO','PAPEL DO ALUNO','PAPEL DO PROFESSOR'],700)
];
test('recognizes hour-class and compound durations without discarding the row', () => {
 for(const duration of ['2h','2H','2horas','2horas-aula','2h/a','2 h','2 H','2 horas','2 horas-aula','2 h/a','2 H/A','2hrs','2h-aula','2 HORAS-AULA','2 horas‑aula','30minutos','30 minutos','30min','30 min','30m','30 m','30 MIN','30 min.','1h30','1 h 30 min','1h30m','1 hora e 30 minutos','1,5 h','1 hora']){
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

test('duration import and totals use identical rules', () => {
 for (const [value,expected] of [['2h',120],['2H',120],['2horas',120],['2horas-aula',120],['2h/a',120],['2 h',120],['2 H',120],['2 horas',120],['2 horas-aula',120],['2 h/a',120],['30 minutos',30],['30min',30],['30 m',30],['30 MIN.',30],['1h30',90],['1h30m',90],['1 hora e 30 minutos',90],['1,5h',90],['1 H/A e 15 min',75]]) {
  assert.equal(C.duracaoValida(value),true,value);
  assert.equal(C.paraMinutos(value),expected,value);
 }
 for(const value of ['2','30','Indique a duração da atividade','Atividade de 2 horas','2h lixo']) assert.equal(C.duracaoValida(value),false,value);
});
test('preserves simultaneous continuation of all five cells across multiple pages', () => {
 const r=X.extrair([
  {itens:[...header,...row(['Sala','Missão','2 h/a','Participa','Orienta'],500)]},
  {itens:row(['espaço continua','atividade continua','tempo continua','aluno continua','professor continua'],750)},
  {itens:[...row(['fim espaço','fim atividade','fim tempo','fim aluno','fim professor'],750),...row(['Casa','Outra missão','30 m','Pesquisa','Acompanha'],500)]}
 ]);
 assert.equal(r.dinamica.length,2);
 ['espaco','atividade','duracao','papelAluno','papelProfessor'].forEach((k,i)=>{
  assert.ok(r.dinamica[0][k].includes(['fim espaço','fim atividade','fim tempo','fim aluno','fim professor'][i]));
 });
 assert.equal(r.dinamica[1].atividade,'Outra missão');
});
