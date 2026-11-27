import type { ChatLog, FaqItem, RelatorioEvolucao } from '../types'
import { ApiError } from '../api/tipos'
import { pendentesDeResposta, normalizarPergunta } from './logs'
import type { SpecConsulta } from './catalogo'

export const MAX_PERGUNTAS_POR_ANALISE = 5

export interface PerguntaParaAnalise { pergunta: string; tipo: string; vezes: number }

/**
 * Perguntas sem resposta que ainda valem a pena analisar: não foram respondidas pelo master nem ignoradas, e nenhuma
 * proposta (pendente ou aprovada) já trata delas. As mais repetidas vêm primeiro.
 */
export function perguntasParaAnalisar(logs: ChatLog[], faq: FaqItem[], relatorios: RelatorioEvolucao[]): PerguntaParaAnalise[] {
  const jaTratadas = new Set(relatorios.filter((r) => r.status !== 'reprovada').flatMap((r) => r.perguntas.map(normalizarPergunta)))
  const grupos = new Map<string, PerguntaParaAnalise>()
  for (const l of pendentesDeResposta(logs, faq)) {
    const chave = normalizarPergunta(l.pergunta)
    if (chave.length < 4 || jaTratadas.has(chave)) continue
    const g = grupos.get(chave)
    if (g) g.vezes += 1
    else grupos.set(chave, { pergunta: l.pergunta.slice(0, 300), tipo: 'dados', vezes: 1 })
  }
  return [...grupos.values()].sort((a, b) => b.vezes - a.vezes).slice(0, MAX_PERGUNTAS_POR_ANALISE)
}

export const proximoNumeroEvolucao = (relatorios: RelatorioEvolucao[]) =>
  relatorios.reduce((m, r) => Math.max(m, Number(r.id.replace(/\D/g, '')) || 0), 0) + 1

/** A consulta está ativa no catálogo? */
export const ativas = (relatorios: RelatorioEvolucao[]): SpecConsulta[] =>
  relatorios.filter((r) => r.status === 'aprovada' && r.ativa && r.pacote).map((r) => r.pacote!.spec)

/** Fala com a API de IA (só a demonstração usa isto: na versão real quem fala é o Laravel). */
/** Frase de ataque dos testes do Tester (ex.: "…; DROP TABLE"). O servidor da API recusa corpos com ela, então ela não viaja: fica só a descrição do caso. */
const TEXTO_DE_ATAQUE = /\b(drop\s+table|union\s+select|delete\s+from|insert\s+into|truncate\s+table)\b/i
export const TEXTO_OMITIDO = '[texto de injeção omitido no envio]'

/** Há frase de ataque em algum texto do valor? (perguntas assim não vão para o Analista: o servidor recusaria o pacote inteiro.) */
export function temTextoDeAtaque(valor: unknown): boolean {
  if (typeof valor === 'string') return TEXTO_DE_ATAQUE.test(valor)
  if (Array.isArray(valor)) return valor.some(temTextoDeAtaque)
  if (valor && typeof valor === 'object') return Object.values(valor).some(temTextoDeAtaque)
  return false
}

/** Copia o valor trocando qualquer texto com frase de ataque pelo aviso acima (objetos e listas inclusive). */
export function semTextoDeAtaque<T>(valor: T): T {
  if (typeof valor === 'string') return (TEXTO_DE_ATAQUE.test(valor) ? TEXTO_OMITIDO : valor) as T
  if (Array.isArray(valor)) return valor.map((v) => semTextoDeAtaque(v)) as T
  if (valor && typeof valor === 'object') return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, semTextoDeAtaque(v)])) as T
  return valor
}

export async function chamarIa<T>(buscar: typeof fetch, base: string, caminho: string, corpo: unknown, tempoMs = 120_000): Promise<T> {
  const controle = new AbortController()
  const timer = setTimeout(() => controle.abort(), tempoMs)
  try {
    const r = await buscar(base.replace(/\/$/, '') + caminho, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(corpo), signal: controle.signal })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) throw new ApiError(typeof json.detail === 'string' ? json.detail : 'A API de IA não respondeu como esperado.', r.status === 503 ? 503 : 502)
    return json as T
  } catch (e) {
    if (e instanceof ApiError) throw e
    const tecnico = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    throw new ApiError(`Não foi possível falar com a API de IA agora. Tente de novo em instantes. [${caminho} · ${tecnico}]`, 502)
  } finally {
    clearTimeout(timer)
  }
}

export interface EstatisticaEvolucao {
  /** Propostas que chegaram a ter uma consulta para decidir. */
  comConsulta: number
  /** Itens só de registro (o Analista não viu como resolver com segurança): não entram na taxa. */
  semConsulta: number
  pendentes: number
  aprovadas: number
  reprovadas: number
  decididas: number
  /** aprovadas / decididas, de 0 a 1 (null sem nenhuma decisão ainda). */
  taxaAprovacao: number | null
  /** Em quantas decisões o Master fez o que o Tester recomendou (aprovar/ler avisos -> aprovou; reprovar -> reprovou). */
  concordouComTester: number
  /** Decisões seguidas aprovadas, da mais recente para trás (a base de confiança que o projeto quer medir). */
  aprovadasSeguidas: number
}

/** Quanto os Agents acertam, na opinião de quem decide. Só mede: nada aqui aprova ou ativa coisa alguma. */
export function estatisticasEvolucao(relatorios: RelatorioEvolucao[]): EstatisticaEvolucao {
  const comConsulta = relatorios.filter((r) => r.pacote)
  const decididas = comConsulta.filter((r) => r.status !== 'pendente')
  const aprovadas = decididas.filter((r) => r.status === 'aprovada')
  const recentesPrimeiro = [...decididas].sort((a, b) => (b.decisao?.em ?? '').localeCompare(a.decisao?.em ?? ''))
  let seguidas = 0
  for (const r of recentesPrimeiro) {
    if (r.status !== 'aprovada') break
    seguidas += 1
  }
  const concordou = decididas.filter((r) => (r.veredito === 'reprovar_recomendado') === (r.status === 'reprovada')).length
  return {
    comConsulta: comConsulta.length,
    semConsulta: relatorios.length - comConsulta.length,
    pendentes: comConsulta.length - decididas.length,
    aprovadas: aprovadas.length,
    reprovadas: decididas.length - aprovadas.length,
    decididas: decididas.length,
    taxaAprovacao: decididas.length ? aprovadas.length / decididas.length : null,
    concordouComTester: concordou,
    aprovadasSeguidas: seguidas,
  }
}
