const OWNER = process.env.GITHUB_DATA_OWNER || '';
const REPO = process.env.GITHUB_DATA_REPO || '';
const BRANCH = process.env.GITHUB_DATA_BRANCH || 'main';
const FILE_PATH = process.env.GITHUB_DATA_PATH || 'dados/turmas.json';
const TOKEN = process.env.GITHUB_DATA_TOKEN || '';

let fila = Promise.resolve();
let estado = {
  configurado: Boolean(OWNER && REPO && TOKEN),
  repositorio: OWNER && REPO ? `https://github.com/${OWNER}/${REPO}` : '',
  arquivo: FILE_PATH,
  ultimaSincronizacao: null,
  ultimoErro: null,
  pendente: false
};

function headers(){
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${TOKEN}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'avaliador-p3'
  };
}

function apiUrl(){
  return `https://api.github.com/repos/${encodeURIComponent(OWNER)}/${encodeURIComponent(REPO)}/contents/${FILE_PATH.split('/').map(encodeURIComponent).join('/')}`;
}

async function detalheErro(resp){
  const dados = await resp.json().catch(()=>null);
  return dados?.message || `GitHub respondeu com erro ${resp.status}`;
}

async function gravar(base){
  if(!estado.configurado) throw new Error('Backup do GitHub ainda não configurado no servidor.');
  estado.pendente = true;
  try{
    const consulta = await fetch(`${apiUrl()}?ref=${encodeURIComponent(BRANCH)}`, {headers:headers()});
    let sha;
    if(consulta.ok){
      const atual = await consulta.json();
      sha = atual.sha;
    } else if(consulta.status !== 404){
      throw new Error(await detalheErro(consulta));
    }

    const corpo = {
      message: `backup: atualizar dados das turmas (${new Date().toISOString()})`,
      content: Buffer.from(`${JSON.stringify(base, null, 2)}\n`, 'utf8').toString('base64'),
      branch: BRANCH
    };
    if(sha) corpo.sha = sha;
    const resposta = await fetch(apiUrl(), {
      method:'PUT', headers:{...headers(), 'Content-Type':'application/json'}, body:JSON.stringify(corpo)
    });
    if(!resposta.ok) throw new Error(await detalheErro(resposta));
    estado.ultimaSincronizacao = new Date().toISOString();
    estado.ultimoErro = null;
    return {...estado, pendente:false};
  }catch(e){
    estado.ultimoErro = e.message;
    throw e;
  }finally{
    estado.pendente = false;
  }
}

function sincronizar(base){
  const copia = JSON.parse(JSON.stringify(base));
  fila = fila.catch(()=>{}).then(()=>gravar(copia));
  return fila;
}

function status(){
  return {...estado};
}

module.exports = {sincronizar, status};
