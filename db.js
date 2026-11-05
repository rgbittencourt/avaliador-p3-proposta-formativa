const fs = require('fs/promises');
const path = require('path');
const { Pool } = require('pg');
const githubBackup = require('./github-backup');

const DIRETORIO_DADOS = process.env.DATA_DIR || path.join(__dirname, 'data');
const ARQUIVO = path.join(DIRETORIO_DADOS, 'turmas.json');
const LEGADO = path.join(DIRETORIO_DADOS, 'turma.json');
const DATABASE_URL = process.env.DATABASE_URL || '';
const pool = DATABASE_URL ? new Pool({connectionString:DATABASE_URL, ssl:{rejectUnauthorized:false}}) : null;
const TABELA_ESTADO = 'p3_app_state';
let tabelaPronta = false;

async function prepararPostgres(){
  if(!pool || tabelaPronta) return;
  await pool.query(`CREATE TABLE IF NOT EXISTS ${TABELA_ESTADO} (
    id integer PRIMARY KEY,
    payload jsonb NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`);
  tabelaPronta = true;
}

function slug(valor){
  return String(valor || '').trim().toLowerCase().normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '').slice(0, 80) || `turma-${Date.now()}`;
}

async function salvar(base){
  if(pool){
    await prepararPostgres();
    await pool.query(
      `INSERT INTO ${TABELA_ESTADO} (id, payload, updated_at) VALUES (1, $1::jsonb, now())
       ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload, updated_at = now()`,
      [JSON.stringify(base)]
    );
  } else {
    await fs.mkdir(path.dirname(ARQUIVO), {recursive:true});
    const temporario = `${ARQUIVO}.tmp`;
    await fs.writeFile(temporario, JSON.stringify(base, null, 2), 'utf-8');
    await fs.rename(temporario, ARQUIVO);
  }
  if(githubBackup.status().configurado){
    try{ await githubBackup.sincronizar(base); }
    catch(e){ console.error('Backup GitHub não realizado:', e.message); }
  }
}

async function inicializar(){
  if(pool){
    await prepararPostgres();
    const resultado = await pool.query(`SELECT payload FROM ${TABELA_ESTADO} WHERE id = 1`);
    const base=resultado.rows[0]?.payload||{version:2,turmas:[]};
    if(!resultado.rows[0]?.payload) await salvar(base);
    return base;
  }
  try{ return JSON.parse(await fs.readFile(ARQUIVO, 'utf-8')); } catch{}
  let avaliacoes=[];
  try{
    const legado = JSON.parse(await fs.readFile(LEGADO, 'utf-8'));
    if(Array.isArray(legado)) avaliacoes = legado;
  }catch{}
  const agora = new Date().toISOString();
  const base = {version:2, turmas: avaliacoes.length ? [{id:'turma-principal', nome:'Turma principal', criadaEm:agora, atualizadaEm:agora, avaliacoes}] : []};
  await salvar(base);
  return base;
}

async function ler(){
  const base = await inicializar();
  if(!base || !Array.isArray(base.turmas)) throw new Error('Banco de turmas inválido.');
  return base;
}

async function listarTurmas(){
  const base = await ler();
  return base.turmas.map(({avaliacoes, ...turma})=>({...turma, quantidade:(avaliacoes||[]).length}));
}

async function criarTurma(nome){
  nome = String(nome || '').trim();
  if(!nome) throw new Error('Informe o nome da turma.');
  const base = await ler();
  let id = slug(nome), contador=2;
  while(base.turmas.some(t=>t.id===id)) id = `${slug(nome)}-${contador++}`;
  const agora = new Date().toISOString();
  const turma = {id, nome:nome.slice(0,120), criadaEm:agora, atualizadaEm:agora, avaliacoes:[]};
  base.turmas.push(turma);
  await salvar(base);
  return {id:turma.id, nome:turma.nome, criadaEm:turma.criadaEm, atualizadaEm:turma.atualizadaEm, quantidade:0};
}

async function renomearTurma(id, nome){
  nome = String(nome || '').trim();
  if(!nome) throw new Error('Informe o nome da turma.');
  const base = await ler();
  const turma = base.turmas.find(t=>t.id===id);
  if(!turma) throw new Error('Turma não encontrada.');
  turma.nome = nome.slice(0,120);
  turma.atualizadaEm = new Date().toISOString();
  await salvar(base);
  return {id:turma.id, nome:turma.nome, criadaEm:turma.criadaEm, atualizadaEm:turma.atualizadaEm, quantidade:turma.avaliacoes.length};
}

async function listarAvaliacoes(turmaId){
  const base = await ler();
  const turma = base.turmas.find(t=>t.id===turmaId);
  if(!turma) throw new Error('Turma não encontrada.');
  return turma.avaliacoes || [];
}

async function upsertAvaliacao(turmaId, id, dados){
  const base = await ler();
  const turma = base.turmas.find(t=>t.id===turmaId);
  if(!turma) throw new Error('Turma não encontrada.');
  const idx = turma.avaliacoes.findIndex(a=>a.id===id);
  const registro = {...dados, id};
  if(idx>=0) turma.avaliacoes[idx]=registro; else turma.avaliacoes.push(registro);
  turma.atualizadaEm = new Date().toISOString();
  await salvar(base);
  return registro;
}

async function importarTurma(dados={}){
  const nome=String(dados.turma?.nome||dados.nome||'').trim();
  const idInformado=String(dados.turma?.id||dados.turmaId||'').trim();
  const avaliacoes=Array.isArray(dados.avaliacoes)?dados.avaliacoes:[];
  if(!nome&&!idInformado) throw new Error('O arquivo não identifica a turma.');
  if(!avaliacoes.length) throw new Error('O arquivo não contém avaliações.');
  const base=await ler();
  let turma=base.turmas.find(t=>(idInformado&&t.id===idInformado)||(nome&&String(t.nome||'').trim().toLowerCase()===nome.toLowerCase()));
  if(!turma){
    let id=slug(idInformado||nome),contador=2;
    while(base.turmas.some(t=>t.id===id))id=`${slug(idInformado||nome)}-${contador++}`;
    const agora=new Date().toISOString();
    turma={id,nome:(nome||idInformado).slice(0,120),criadaEm:agora,atualizadaEm:agora,avaliacoes:[]};
    base.turmas.push(turma);
  }
  turma.avaliacoes=Array.isArray(turma.avaliacoes)?turma.avaliacoes:[];
  let inseridas=0,atualizadas=0;
  for(let i=0;i<avaliacoes.length;i++){
    const item=avaliacoes[i];if(!item||typeof item!=='object')continue;
    const id=String(item.id||`${slug(item.matricula||item.nome)}-${Date.now()}-${i}`);
    const idx=turma.avaliacoes.findIndex(a=>a.id===id);
    const registro={...item,id};
    if(idx>=0){turma.avaliacoes[idx]=registro;atualizadas++;}else{turma.avaliacoes.push(registro);inseridas++;}
  }
  turma.atualizadaEm=new Date().toISOString();
  await salvar(base);
  return {id:turma.id,nome:turma.nome,inseridas,atualizadas,quantidade:turma.avaliacoes.length};
}

async function removerAvaliacao(turmaId, id){
  const base = await ler();
  const turma = base.turmas.find(t=>t.id===turmaId);
  if(!turma) throw new Error('Turma não encontrada.');
  const antes = turma.avaliacoes.length;
  turma.avaliacoes = turma.avaliacoes.filter(a=>a.id!==id);
  turma.atualizadaEm = new Date().toISOString();
  await salvar(base);
  return turma.avaliacoes.length !== antes;
}

async function limparAvaliacoes(turmaId){
  const base = await ler();
  const turma = base.turmas.find(t=>t.id===turmaId);
  if(!turma) throw new Error('Turma não encontrada.');
  turma.avaliacoes=[];
  turma.atualizadaEm = new Date().toISOString();
  await salvar(base);
}

async function excluirTurma(id, confirmarNome){
  const base = await ler();
  const indice = base.turmas.findIndex(t=>t.id===id);
  if(indice<0) throw new Error('Turma não encontrada.');
  const turma = base.turmas[indice];
  if(String(confirmarNome || '') !== turma.nome) throw new Error('O nome de confirmação não corresponde ao nome da turma.');
  const resumo = {id:turma.id, nome:turma.nome, avaliacoesRemovidas:(turma.avaliacoes||[]).length};
  base.turmas.splice(indice,1);
  await salvar(base);
  return resumo;
}

async function sincronizarBackupGitHub(){
  const status = githubBackup.status();
  if(!status.configurado) throw new Error('Configure GITHUB_DATA_OWNER, GITHUB_DATA_REPO e GITHUB_DATA_TOKEN no servidor.');
  return githubBackup.sincronizar(await ler());
}

function statusBackupGitHub(){
  return githubBackup.status();
}

module.exports = {listarTurmas, criarTurma, renomearTurma, excluirTurma, listarAvaliacoes, upsertAvaliacao, importarTurma, removerAvaliacao, limparAvaliacoes, sincronizarBackupGitHub, statusBackupGitHub};
