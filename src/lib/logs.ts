import type { ConsumoModelo, ChatLog, ChatLogForm, FaqItem, RespostaChat, TipoLog } from '../types'

/**
 * A Lumi consultou o sistema mas disse que não achou/não sabe: para o registro isso é uma pergunta SEM resposta
 * (é o que os Agents precisam ver para propor uma consulta nova), não uma consulta bem-sucedida.
 */
export function respondeuSemDados(texto: string): boolean {
  const t = texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  return /\bnao (encontrei|consegui (encontrar|achar|responder|ver|consultar)|tenho (essa |a )?informacao|ha (dados|informacao)|sei informar|foi possivel)\b/.test(t)
}

/** Que tipo de interação foi esta, olhando só a resposta que a API devolveu. */
export function tipoDaResposta(r: RespostaChat, resposta: string): TipoLog {
  if (r.impossivel) return 'ajuda' // respondida de verdade ("o sistema não guarda isso"): não é pergunta sem resposta para os Agents
  if (r.agente || r.executar?.length || (r.ferramentas && r.ferramentas.some((n) => n.startsWith('localizar_') || n === 'verificar_disponibilidade'))) return 'cadastro'
  if (r.voltas === 2 || r.ferramentas?.length || r.consultas?.length) return respondeuSemDados(resposta) && !r.consulta_vazia ? 'nao_encontrou' : 'consulta'
  if (r.acoes?.[0]?.nome === 'excluir_registro') return 'exclusao'
  if (r.acoes?.length) return 'cadastro'
  if (r.confianca === 0 && !r.encontrou && r.fonte === null && resposta.includes('indispon')) return 'erro'
  return r.encontrou && !respondeuSemDados(resposta) ? 'ajuda' : 'nao_encontrou'
}

const CORTE_RESPOSTA = 600

/** Nome da ferramenta envolvida, se houve. */
export const ferramentaDaResposta = (r: RespostaChat): string | null => {
  if (r.executar?.length) return r.executar[r.executar.length - 1].nome
  if (r.agente || r.ferramentas?.some((n) => n.startsWith('localizar_'))) return r.agente?.fluxo === 'cliente' ? 'agente_cliente' : 'agente_orcamento'
  return r.ferramentas?.[0] ?? r.acoes?.[0]?.nome ?? null
}

/** Soma o consumo de duas voltas da mesma pergunta (a consulta de dados faz duas idas à API). */
export function somarConsumo(a?: ConsumoModelo, b?: ConsumoModelo): ConsumoModelo | undefined {
  if (!a || !b) return a ?? b
  return { chamadas: a.chamadas + b.chamadas, entrada: a.entrada + b.entrada, saida: a.saida + b.saida, custo_usd: Math.round((a.custo_usd + b.custo_usd) * 1e6) / 1e6 }
}

/** Monta o registro de uma pergunta. Guarda a ferramenta usada, mas nunca os dados que ela leu. */
export function montarRegistro(pergunta: string, r: RespostaChat, texto: string, latenciaMs: number, ferramenta: string | null, tipo: TipoLog): ChatLogForm {
  return {
    pergunta: (r.pergunta_completa || pergunta).slice(0, 500),
    resposta: texto.slice(0, CORTE_RESPOSTA),
    tipo,
    fonte_id: r.fonte?.id ?? null,
    ferramenta,
    gerada_por_llm: !!r.gerada_por_llm,
    em_cache: !!r.em_cache,
    usou_contexto: !!r.usou_contexto,
    latencia_ms: Math.max(0, Math.round(latenciaMs)),
    voltas: r.voltas ?? 1,
    tokens_entrada: r.consumo?.entrada ?? 0,
    tokens_saida: r.consumo?.saida ?? 0,
    custo_usd: r.consumo?.custo_usd ?? 0,
    versao: r.versao ?? null,
  }
}

export interface ResumoLogs {
  total: number
  porTipo: Record<TipoLog, number>
  comModelo: number
  emCache: number
  semResposta: number
  latenciaMediaMs: number | null
  latenciaP95Ms: number | null
  positivos: number
  negativos: number
}

export function resumirLogs(logs: ChatLog[]): ResumoLogs {
  const porTipo: Record<TipoLog, number> = { ajuda: 0, consulta: 0, cadastro: 0, exclusao: 0, nao_encontrou: 0, erro: 0 }
  logs.forEach((l) => { porTipo[l.tipo] += 1 })
  const tempos = logs.map((l) => l.latencia_ms).sort((a, b) => a - b)
  return {
    total: logs.length,
    porTipo,
    comModelo: logs.filter((l) => l.gerada_por_llm).length,
    emCache: logs.filter((l) => l.em_cache).length,
    semResposta: porTipo.nao_encontrou + porTipo.erro,
    latenciaMediaMs: tempos.length ? Math.round(tempos.reduce((s, t) => s + t, 0) / tempos.length) : null,
    latenciaP95Ms: tempos.length ? tempos[Math.min(tempos.length - 1, Math.floor(tempos.length * 0.95))] : null,
    positivos: logs.filter((l) => l.feedback === 'positivo').length,
    negativos: logs.filter((l) => l.feedback === 'negativo').length,
  }
}

export const ROTULO_TIPO: Record<TipoLog, string> = { ajuda: 'Ajuda', consulta: 'Consulta', cadastro: 'Cadastro', exclusao: 'Exclusão', nao_encontrou: 'Não encontrou', erro: 'Erro' }

/** Minúsculas, sem acento nem pontuação: "Como adiciono uma pessoa?" e "como adiciono uma pessoa" são a mesma pergunta. */
export const normalizarPergunta = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Uma pergunta sem resposta que o master ainda pode tratar: não foi ignorada nem respondida. */
export function pendentesDeResposta(logs: ChatLog[], faq: FaqItem[]): ChatLog[] {
  const respondidas = new Set(faq.flatMap((i) => [i.pergunta, ...i.palavras_chave]).map(normalizarPergunta))
  return logs.filter((l) => l.tipo === 'nao_encontrou' && l.desfecho !== 'ignorado' && !respondidas.has(normalizarPergunta(l.pergunta)))
}

/** O mesmo texto de pergunta, quantas vezes apareceu (para o master ver o que mais falta). */
export function quantasVezesPerguntaram(logs: ChatLog[], pergunta: string): number {
  const alvo = normalizarPergunta(pergunta)
  return logs.filter((l) => l.tipo === 'nao_encontrou' && normalizarPergunta(l.pergunta) === alvo).length
}

/** Primeira letra maiúscula e "?" no fim: sugestão para o campo "pergunta" do FAQ. */
export function sugerirPergunta(texto: string): string {
  const t = texto.trim().replace(/[?!.\s]+$/, '')
  return t ? `${t[0].toUpperCase()}${t.slice(1)}?` : ''
}
