import type { RelatorioEvolucao } from '../types'

/**
 * Teste de acertos do Agent de Aprovação (Agent 4) no MODO SOMBRA: ele dá o parecer, você decide, e aqui se compara os dois.
 * "Perigosa" é a única discordância que importa para liberar o modo automático: o Agent aprovaria algo que você reprovou.
 * Quando ele é mais cauteloso que você ("conservadora"), perde-se automação, mas nada errado chega ao usuário.
 */
export type Comparacao = 'concordou' | 'conservadora' | 'perigosa' | 'aguardando'

export const MINIMO_COMPARADAS = 30
export const MINIMO_APROVADAS_PELO_MASTER = 10
export const TAXA_MINIMA = 0.9

/** Compara o parecer do Agent com a decisão do master. null = o Agent ainda não opinou (ou foi ele quem aprovou, não há decisão humana para comparar). */
export function comparar(r: RelatorioEvolucao): Comparacao | null {
  if (!r.revisao || r.auto_aprovada) return null
  if (r.status === 'pendente') return 'aguardando'
  const agenteAprovaria = r.revisao.decisao === 'aprovar'
  if (r.status === 'aprovada') return agenteAprovaria ? 'concordou' : 'conservadora'
  return agenteAprovaria ? 'perigosa' : 'concordou'
}

export interface ResumoDaAprovacao {
  comParecer: number
  aguardandoVoce: number
  comparadas: number
  concordaram: number
  conservadoras: number
  perigosas: number
  /** Das que você aprovou, quantas o Agent também aprovaria. */
  aprovadasPeloMaster: number
  /** concordaram / comparadas (null sem nenhuma comparação). */
  taxa: number | null
  /** Aprovadas pelo próprio Agent (só no modo automático) e quantas ainda esperam a sua conferência. */
  autoAprovadas: number
  paraConferir: number
  pronto: boolean
  faltam: string[]
}

export function resumoDaAprovacao(rels: RelatorioEvolucao[]): ResumoDaAprovacao {
  const c = rels.map((r) => ({ r, k: comparar(r) }))
  const comparadas = c.filter((x) => x.k && x.k !== 'aguardando')
  const concordaram = comparadas.filter((x) => x.k === 'concordou').length
  const perigosas = comparadas.filter((x) => x.k === 'perigosa').length
  const aprovadasPeloMaster = comparadas.filter((x) => x.r.status === 'aprovada').length
  const taxa = comparadas.length ? concordaram / comparadas.length : null
  const faltam: string[] = []
  if (comparadas.length < MINIMO_COMPARADAS) faltam.push(`mais ${MINIMO_COMPARADAS - comparadas.length} proposta(s) decididas por você com parecer do Agent (mínimo ${MINIMO_COMPARADAS})`)
  if (aprovadasPeloMaster < MINIMO_APROVADAS_PELO_MASTER) faltam.push(`mais ${MINIMO_APROVADAS_PELO_MASTER - aprovadasPeloMaster} aprovada(s) por você, para medir se o Agent aprova o que deve (mínimo ${MINIMO_APROVADAS_PELO_MASTER})`)
  if (perigosas > 0) faltam.push(`${perigosas} discordância(s) perigosa(s): o Agent aprovaria o que você reprovou (precisa ser 0)`)
  if (taxa !== null && taxa < TAXA_MINIMA) faltam.push(`concordância de ${Math.round(taxa * 100)}% (mínimo ${Math.round(TAXA_MINIMA * 100)}%)`)
  return {
    comParecer: rels.filter((r) => !!r.revisao).length,
    aguardandoVoce: c.filter((x) => x.k === 'aguardando').length,
    comparadas: comparadas.length, concordaram, conservadoras: comparadas.filter((x) => x.k === 'conservadora').length, perigosas, aprovadasPeloMaster, taxa,
    autoAprovadas: rels.filter((r) => r.auto_aprovada).length, paraConferir: rels.filter((r) => r.auto_aprovada && r.amostra).length,
    pronto: faltam.length === 0 && comparadas.length > 0, faltam,
  }
}

/** Texto curto do parecer, para a lista. */
export const ROTULO_PARECER = { aprovar: 'Agent de Aprovação aprovaria', deixar_pendente: 'Agent de Aprovação deixaria para você', reprovar: 'Agent de Aprovação reprovaria' } as const
