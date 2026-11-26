import type { ChatLog, ChatLogForm, RespostaChat, TipoLog } from '../types'

/** Que tipo de interação foi esta, olhando só a resposta que a API devolveu. */
export function tipoDaResposta(r: RespostaChat, resposta: string): TipoLog {
  if (r.voltas === 2 || r.ferramentas?.length || r.consultas?.length) return 'consulta'
  if (r.acoes?.[0]?.nome === 'excluir_registro') return 'exclusao'
  if (r.acoes?.length) return 'cadastro'
  if (r.confianca === 0 && !r.encontrou && r.fonte === null && resposta.includes('indispon')) return 'erro'
  return r.encontrou ? 'ajuda' : 'nao_encontrou'
}

const CORTE_RESPOSTA = 600

/** Nome da ferramenta envolvida, se houve. */
export const ferramentaDaResposta = (r: RespostaChat): string | null => r.ferramentas?.[0] ?? r.acoes?.[0]?.nome ?? null

/** Monta o registro de uma pergunta. Guarda a ferramenta usada, mas nunca os dados que ela leu. */
export function montarRegistro(pergunta: string, r: RespostaChat, texto: string, latenciaMs: number, ferramenta: string | null, tipo: TipoLog): ChatLogForm {
  return {
    pergunta: pergunta.slice(0, 500),
    resposta: texto.slice(0, CORTE_RESPOSTA),
    tipo,
    fonte_id: r.fonte?.id ?? null,
    ferramenta,
    gerada_por_llm: !!r.gerada_por_llm,
    em_cache: !!r.em_cache,
    usou_contexto: !!r.usou_contexto,
    latencia_ms: Math.max(0, Math.round(latenciaMs)),
    voltas: r.voltas ?? 1,
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
