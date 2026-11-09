// Análise de coerência (complementar, sem pontuação), no modelo do Avaliador P4.
// Eixos: DESAFIO e PÚBLICO-ALVO. Pergunta central: o que o estudante produziu,
// além de bem-feito, é de fato útil para enfrentar o desafio, para aquele público?
//
// Cada avaliador informa a atividade, o produto e os campos; as regras são comuns.

const vazio = (v) => {
  const t = String(v == null ? '' : v).trim();
  return t ? t : '(campo vazio)';
};

// atividade: { nome, produto, cadeia, criterios: [..], campos: [[rotulo, valor]], evidencia, assinatura }
function montarPromptCoerencia(atividade) {
  const a = atividade || {};
  const assinatura = a.assinatura || 'Prof. Rogério';
  const campos = (a.campos || []).map(([rotulo, valor]) => `${rotulo}: ${vazio(valor)}`).join('\n');
  const criterios = (a.criterios || []).map((c) => `- ${c}`).join('\n');
  return `Você apoia o professor orientador na leitura pedagógica de um trabalho da pós-graduação TEDPRO/IFSC.
Atividade: ${a.nome || '(não informada)'}.
Produto do estudante: ${a.produto || '(não informado)'}.

PERGUNTA CENTRAL
Além de estar bem-feito, o produto é realmente útil para enfrentar o DESAFIO definido pelo estudante, para o PÚBLICO-ALVO que ele indicou? Ajudaria de fato aquelas pessoas, naquele contexto, a avançar no desafio?

TAREFA
Faça UMA análise semântica estruturada, tendo DESAFIO e PÚBLICO-ALVO como eixos, e produza duas saídas coerentes entre si, mas claramente diferentes:
1. "analise_coerencia": parecer técnico e diagnóstico para o professor, em 2 a 4 parágrafos.
2. "feedback_coerencia": mensagem pessoal ao estudante, em 3 a 5 parágrafos, escrita como se fosse o professor orientador (${assinatura}). Use o primeiro nome do estudante somente se estiver informado com segurança. Termine EXATAMENTE com:\nUm abraço,\n${assinatura}

REGRAS ESSENCIAIS
- Isto é complementar e informativo: não atribua nota, pontos, conceito, percentual, ranking ou classificação.
- Não trate coerência como veracidade, correção gramatical ou qualidade técnica.
- Faça análise semântica profunda; coincidência de palavras-chave não prova coerência.
- Examine o encadeamento: ${a.cadeia || 'desafio -> público -> estratégia -> produto -> contribuição para o desafio'}.
- Diferencie falar do mesmo tema de contribuir efetivamente para o desafio. Um produto bom, mas genérico, que serviria para qualquer público, não demonstra coerência.
- Avalie a utilidade concreta: o que o público passaria a saber, sentir, decidir ou fazer depois de usar o produto, e por que isso faz o desafio avançar.
- Verifique se linguagem, formato, nível, exemplos e acesso combinam com as características reais do público informado.
${criterios}
- Reconheça pontos fortes com justificativa; identifique tensões sem convertê-las automaticamente em erros.
- Não invente intenções, objetivos, características do público ou conteúdo ausente. Diferencie campo vazio de informação superficial.
- Se faltarem dados, continue com o que existe e declare com precisão as limitações.
- ${a.evidencia || 'Diferencie o que foi planejado do que foi efetivamente entregue e analisado.'}
- O feedback deve selecionar os achados pedagogicamente mais úteis, falar diretamente ao estudante, evitar elogios vazios e pode incluir uma pergunta curta apenas quando ligada a um problema real.
- O feedback não pode ser mera cópia, resumo ou conversão mecânica do parecer técnico para segunda pessoa.
- Não use travessão (—) em nenhum texto.

DADOS DO TRABALHO
${campos}

No objeto "coerencia", seja breve: cada campo de texto com no máximo 2 frases e cada lista com no máximo 3 itens curtos. Desenvolva o texto completo só em "analise_coerencia" e "feedback_coerencia".

Responda APENAS com JSON válido neste formato:
{"coerencia":{"relacao_desafio_publico":"string","adequacao_ao_publico":"string","relacao_desafio_produto":"string","utilidade_para_o_desafio":"string","consistencia_global":"string","pontos_fortes":["string"],"tensoes":["string"],"desalinhamentos":["string"],"informacoes_insuficientes":["string"]},"analise_coerencia":"string","feedback_coerencia":"string"}`;
}

function semTravessao(texto) {
  return String(texto || '').replace(/\s*[—–]\s*/g, ', ').replace(/,\s*,/g, ',');
}

// Valida e padroniza as duas saídas (assinatura no final, sem travessão).
function limparSaidaCoerencia(resultado, assinatura = 'Prof. Rogério') {
  const analise = semTravessao(String(resultado?.analise_coerencia || '').trim());
  let feedback = semTravessao(String(resultado?.feedback_coerencia || '').trim());
  if (!analise || !feedback) throw new Error('A IA não produziu as duas saídas de coerência.');
  feedback = feedback.replace(/\s*Um abraço,\s*Prof\.?\s*[^\n]*\s*$/i, '').trim();
  feedback += `\n\nUm abraço,\n${assinatura}`;
  return { analise_coerencia: analise, feedback_coerencia: feedback };
}

module.exports = { montarPromptCoerencia, limparSaidaCoerencia, semTravessao };
