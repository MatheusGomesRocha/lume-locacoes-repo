import type { Api } from '../api/tipos'
import type { RelatorioEvolucao } from '../types'
import { camposDaEntidade, carregarEntidade, completarTextos, ErroConsulta, explicarRegistro, filtrarLinhas, type Linha, type SessaoConsulta } from './catalogo'
import { hojeISO } from './format'

/**
 * Prévia com dados REAIS: roda a consulta proposta sobre os dados de verdade (a mesma leitura das telas que o chat usa, com as permissões
 * de quem olha). Na versão real isso vem do banco pelo Laravel; na demonstração, do que está salvo no navegador. Quem entende a pergunta
 * (parâmetros) é a API de IA, que só recebe a consulta, o texto das perguntas e a data de hoje: nunca dados do sistema.
 */
export interface ItemDaPrevia {
  pergunta: string
  params: Record<string, unknown>
  /** Quantos registros a consulta conta agora. null se não deu para rodar (veja `erro`). */
  total: number | null
  soma?: number
  campos: string[]
  /** Até 8 registros que entraram na contagem. */
  linhas: Linha[]
  erro?: string
}

export interface PreviaReal { hoje: string; itens: ItemDaPrevia[] }

const MAX_LINHAS = 8

function itemDe(rel: RelatorioEvolucao, pergunta: string, params: Record<string, unknown>, faltando: string[], dados: Linha[], sessao: SessaoConsulta): ItemDaPrevia {
  const spec = rel.pacote!.spec
  const campos = camposDaEntidade(spec.entidade)
  let usados = params
  if (faltando.length) {
    const r = completarTextos(spec, params, pergunta, dados)
    if ('pergunta' in r) return { pergunta, params, total: null, campos, linhas: [], erro: r.pergunta }
    usados = r.params
  }
  try {
    const linhas = filtrarLinhas(spec, usados, { [spec.entidade]: dados }, sessao)
    const soma = spec.operacao === 'somar' ? linhas.reduce((t, l) => t + Math.round(Number(l[spec.campo_soma ?? ''] ?? 0) * 100), 0) / 100 : undefined
    return { pergunta, params: usados, total: linhas.length, soma, campos, linhas: linhas.slice(0, MAX_LINHAS) }
  } catch (e) {
    if (e instanceof ErroConsulta) return { pergunta, params: usados, total: null, campos, linhas: [], erro: e.codigo === 'permissao' ? 'Você não tem permissão para ver estes dados.' : e.message }
    throw e
  }
}

export async function previaComDadosReais(api: Api, rel: RelatorioEvolucao): Promise<PreviaReal> {
  if (!rel.pacote) throw new Error('Esta proposta não tem consulta.')
  const sessao = api.auth.salva()
  if (!sessao) throw new Error('Faça login para ver a prévia.')
  const hoje = hojeISO()
  const ctx: SessaoConsulta = { papel: sessao.usuario.papel, permissoes: sessao.permissoes, hoje }
  const { exemplos } = await api.evolucao.parametrosDosExemplos(rel.id, hoje)
  const dados = sessao.permissoes.includes(rel.pacote.spec.permissao) ? await carregarEntidade(api, rel.pacote.spec.entidade) : []
  return { hoje, itens: exemplos.map((x) => itemDe(rel, x.pergunta, x.params, x.faltando, dados, ctx)) }
}

const alnum = (t: unknown) => String(t ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '')

export interface RegistroConferido {
  registro: Linha
  entrou: boolean
  filtros: { campo: string; op: string; esperado: unknown; atual: unknown; ok: boolean }[]
}

/** "Este registro deveria entrar": acha no banco os registros que citam o texto (ex.: 2026/0012) e diz, filtro a filtro, se entram na consulta. */
export async function conferirRegistro(api: Api, rel: RelatorioEvolucao, item: ItemDaPrevia, texto: string): Promise<RegistroConferido[]> {
  const sessao = api.auth.salva()
  if (!rel.pacote || !sessao) return []
  const busca = alnum(texto)
  if (busca.length < 3) return []
  const spec = rel.pacote.spec
  const ctx: SessaoConsulta = { papel: sessao.usuario.papel, permissoes: sessao.permissoes, hoje: hojeISO() }
  if (!ctx.permissoes.includes(spec.permissao)) return []
  const achados = (await carregarEntidade(api, spec.entidade)).filter((l) => Object.values(l).some((v) => typeof v === 'string' && alnum(v).includes(busca)))
  return achados.slice(0, 10).map((registro) => {
    const filtros = explicarRegistro(spec, item.params, registro, ctx)
    return { registro, entrou: filtros.every((f) => f.ok), filtros }
  })
}
