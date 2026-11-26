import type { ChatLog, TipoLog } from '../types'

/**
 * Métricas de custo e qualidade, calculadas só com o registro das conversas (o mesmo na versão real e na demo).
 *
 * "Resolvida" = a Lumi deu uma resposta (não foi "não encontrei" nem erro) e o usuário não marcou 👎.
 * Taxa de acerto = resolvidas / conversas. É uma medida de uso real: complementa, não substitui, a avaliação com perguntas de referência.
 */
export interface Metrica {
  conversas: number
  resolvidas: number
  /** 0 a 1; null sem conversas. */
  taxaAcerto: number | null
  positivos: number
  negativos: number
  semResposta: number
  /** Conversas que chamaram o modelo (as demais saíram do FAQ, do cache ou de regras, sem custo). */
  comModelo: number
  tokensEntrada: number
  tokensSaida: number
  tokens: number
  tokensPorConversa: number | null
  custoUsd: number
  latenciaMediaMs: number | null
}

const SEM_RESPOSTA: TipoLog[] = ['nao_encontrou', 'erro']

export function calcular(logs: ChatLog[]): Metrica {
  const n = logs.length
  const resolvidas = logs.filter((l) => !SEM_RESPOSTA.includes(l.tipo) && l.feedback !== 'negativo').length
  const entrada = logs.reduce((s, l) => s + (l.tokens_entrada ?? 0), 0)
  const saida = logs.reduce((s, l) => s + (l.tokens_saida ?? 0), 0)
  return {
    conversas: n,
    resolvidas,
    taxaAcerto: n ? resolvidas / n : null,
    positivos: logs.filter((l) => l.feedback === 'positivo').length,
    negativos: logs.filter((l) => l.feedback === 'negativo').length,
    semResposta: logs.filter((l) => SEM_RESPOSTA.includes(l.tipo)).length,
    comModelo: logs.filter((l) => (l.tokens_entrada ?? 0) + (l.tokens_saida ?? 0) > 0).length,
    tokensEntrada: entrada,
    tokensSaida: saida,
    tokens: entrada + saida,
    tokensPorConversa: n ? Math.round((entrada + saida) / n) : null,
    custoUsd: Math.round(logs.reduce((s, l) => s + (l.custo_usd ?? 0), 0) * 1e6) / 1e6,
    latenciaMediaMs: n ? Math.round(logs.reduce((s, l) => s + l.latencia_ms, 0) / n) : null,
  }
}

export interface Linha { chave: string; rotulo: string; metrica: Metrica }

/** Um grupo por tipo de pergunta, na ordem em que a tela mostra. */
export function porTipo(logs: ChatLog[]): Linha[] {
  const ordem: [TipoLog, string][] = [['ajuda', 'Ajuda (como usar)'], ['consulta', 'Consulta de dados'], ['cadastro', 'Cadastro'], ['exclusao', 'Exclusão'], ['nao_encontrou', 'Sem resposta'], ['erro', 'Erro']]
  return ordem.map(([t, rotulo]) => ({ chave: t, rotulo, metrica: calcular(logs.filter((l) => l.tipo === t)) })).filter((l) => l.metrica.conversas > 0)
}

/** Segunda-feira da semana da data (a semana vai de segunda a domingo), como AAAA-MM-DD. */
export function inicioDaSemana(iso: string): string {
  const d = new Date(iso)
  const dia = (d.getDay() + 6) % 7 // segunda = 0
  const seg = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dia)
  return `${seg.getFullYear()}-${String(seg.getMonth() + 1).padStart(2, '0')}-${String(seg.getDate()).padStart(2, '0')}`
}

const dataCurta = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/** Histórico semanal, da semana mais recente para a mais antiga. */
export function porSemana(logs: ChatLog[]): Linha[] {
  const grupos = new Map<string, ChatLog[]>()
  logs.forEach((l) => {
    const k = inicioDaSemana(l.criado_em)
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  })
  return [...grupos.entries()].sort((a, b) => b[0].localeCompare(a[0])).map(([k, ls]) => ({ chave: k, rotulo: `Semana de ${dataCurta(k)}`, metrica: calcular(ls) }))
}

export const SEM_VERSAO = 'sem versão'

/** Uma linha por versão do assistente (commit publicado), da mais nova para a mais antiga pela data da primeira conversa. */
export function porVersao(logs: ChatLog[]): Linha[] {
  const grupos = new Map<string, ChatLog[]>()
  logs.forEach((l) => {
    const k = l.versao || SEM_VERSAO
    grupos.set(k, [...(grupos.get(k) ?? []), l])
  })
  const primeira = (ls: ChatLog[]) => ls.map((l) => l.criado_em).sort()[0]
  return [...grupos.entries()].sort((a, b) => primeira(b[1]).localeCompare(primeira(a[1]))).map(([k, ls]) => ({ chave: k, rotulo: k, metrica: calcular(ls) }))
}

export interface Variacao {
  /** Em pontos percentuais (taxa de acerto). */
  acerto: number | null
  /** Tokens por conversa: diferença absoluta. */
  tokensPorConversa: number | null
  /** Só vale comparar com amostra mínima dos dois lados. */
  confiavel: boolean
}

export const AMOSTRA_MINIMA = 10

/** Quanto mudou da versão anterior (`antes`) para a atual (`agora`). */
export function variacao(agora: Metrica, antes: Metrica | undefined): Variacao | null {
  if (!antes || agora.taxaAcerto === null || antes.taxaAcerto === null) return null
  return {
    acerto: Math.round((agora.taxaAcerto - antes.taxaAcerto) * 1000) / 10,
    tokensPorConversa: agora.tokensPorConversa !== null && antes.tokensPorConversa !== null ? agora.tokensPorConversa - antes.tokensPorConversa : null,
    confiavel: agora.conversas >= AMOSTRA_MINIMA && antes.conversas >= AMOSTRA_MINIMA,
  }
}
