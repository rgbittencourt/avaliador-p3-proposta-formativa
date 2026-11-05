// Uso: node scripts/testar-pdfs.js <pasta-com-pdfs> [--json]
// Lê cada PDF com pdf.js (mesma lib do navegador), roda o extrator e imprime um resumo.
// Os PDFs dos alunos NÃO fazem parte do repositório (dados pessoais).
const fs = require('fs');
const path = require('path');
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const { extrair, paginaDoPdfjs } = require('../public/extrator');
const Core = require('../public/p3-core');

async function lerPdf(arquivo) {
  const dados = new Uint8Array(fs.readFileSync(arquivo));
  const pdf = await pdfjs.getDocument({ data: dados, useSystemFonts: true, disableFontFace: true }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) paginas.push(paginaDoPdfjs(await (await pdf.getPage(i)).getTextContent()));
  return { paginas, numPages: pdf.numPages };
}

async function main() {
  const pasta = process.argv[2];
  const json = process.argv.includes('--json');
  if (!pasta) { console.error('Informe a pasta com os PDFs.'); process.exit(1); }
  const arquivos = fs.readdirSync(pasta).filter((f) => /\.pdf$/i.test(f)).sort();
  const saida = [];
  for (const f of arquivos) {
    try {
      const { paginas, numPages } = await lerPdf(path.join(pasta, f));
      const r = extrair(paginas);
      if (!/Nome completo/i.test(JSON.stringify(paginas).slice(0, 4000)) && !r.nome) continue; // ignora enunciado/rubrica
      const alertas = Core.alertasAutomaticos({ ...r, avaliacaoTexto: r.avaliacaoTexto });
      saida.push({ arquivo: f, paginas: numPages, ...r, alertas: alertas.map((a) => `${a.nivel}:${a.codigo}`) });
    } catch (e) { console.error('Falha em', f, e.message); }
  }
  if (json) { console.log(JSON.stringify(saida, null, 2)); return; }
  for (const r of saida) {
    const cheio = (v) => (String(v || '').trim() ? 'ok' : '--');
    console.log(`\n=== ${r.nome || '(sem nome)'} | mat ${r.matricula} | orient: ${r.orientador}`);
    console.log(`desafio[${cheio(r.desafio)}] público[${cheio(r.publicoAlvo)}] objetivo[${cheio(r.objetivo)}] conteúdos[${cheio(r.conteudos)}] metod[${cheio(r.metodologias)}] tipo[${cheio(r.tipo)}] carga[${r.cargaHoraria}] partic[${r.participantes}] recursos[${cheio(r.recursos)}] aval[${cheio(r.avaliacaoTexto)}]`);
    console.log(`dinâmica: ${r.dinamica.length} linha(s) | IA: ${r.iaDeclaracao || '??'} (${(r.iaDescricao || '').length} car.) | alertas: ${r.alertas.join(', ') || 'nenhum'}`);
    r.dinamica.forEach((l, i) => console.log(`   ${i + 1}. [${(l.espaco || '').slice(0, 28)}] [${(l.duracao || '').slice(0, 16)}] aluno:${l.papelAluno ? 'ok' : '--'} prof:${l.papelProfessor ? 'ok' : '--'} ativ:${l.atividade ? 'ok' : '--'}`));
  }
}
main();
