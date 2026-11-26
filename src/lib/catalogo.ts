import type { Api } from '../api/tipos'
import { ApiError } from '../api/tipos'
import type { Chamada } from '../types'
import { ehAdmin } from './permissoes'

/**
 * Executa as consultas que os Agents criaram e o Master aprovou. A consulta é DADO (uma "spec"), nunca código:
 * esta função é a única coisa que roda. Espelha ia-api/evolucao/consulta.py (os dois passam pelos mesmos casos em
 * src/test/catalogo_vetores.json). Ordem fixa: permissão -> parâmetros -> filtros -> operação.
 */

export type TipoCampo = 'texto' | 'numero' | 'data' | 'bool' | 'enum'
export type Linha = Record<string, unknown>

export interface DefParametro { tipo: TipoCampo; valores?: string[]; obrigatorio?: boolean }
export interface Filtro { campo: string; op: string; parametro?: string; valor?: string | number | boolean }
export interface SpecConsulta {
  nome: string
  descricao?: string
  entidade: string
  operacao: 'contar' | 'listar' | 'somar'
  campo_soma?: string
  saida?: string[]
  ordenar_por?: string
  limite?: number
  filtros?: Filtro[]
  parametros?: Record<string, DefParametro>
  permissao: string
  papel_minimo?: string
  exemplos?: string[]
  palavras_chave?: string[]
  sinonimos?: Record<string, string[]>
}

/** Só o que o executor precisa saber de cada entidade (o esquema completo mora na API Python). */
const ENTIDADES: Record<string, { soAdmin: boolean; campos: Record<string, TipoCampo> }> = {
  clientes: { soAdmin: false, campos: { nome: 'texto', tipo: 'enum', cidade: 'texto', observacoes: 'texto' } },
  produtos: { soAdmin: false, campos: { codigo: 'texto', nome: 'texto', categoria: 'texto', valor_diaria: 'numero', valor_reposicao: 'numero', quantidade: 'numero', ativo: 'bool' } },
  orcamentos: { soAdmin: false, campos: { numero: 'texto', cliente_nome: 'texto', evento: 'texto', status: 'enum', data_retirada: 'data', data_devolucao: 'data', diarias: 'numero', desconto: 'numero', total: 'numero' } },
  pagamentos: { soAdmin: false, campos: { orcamento_numero: 'texto', valor: 'numero', vencimento: 'data', pago_em: 'data', status: 'enum', forma: 'enum' } },
  usuarios: { soAdmin: true, campos: { nome: 'texto', papel: 'enum', grupo_nome: 'texto', ativo: 'bool' } },
}

export class ErroConsulta extends Error {
  constructor(mensagem: string, public codigo: 'permissao' | 'parametro' | 'erro') {
    super(mensagem)
  }
}

const semAcento = (t: unknown) => String(t).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const palavras = (t: unknown) => semAcento(t).split(/[^a-z0-9]+/).filter(Boolean)
/** Todas as palavras da busca aparecem INTEIRAS no texto ("maria" não acha "Mariana"). */
export function casaPalavras(busca: unknown, texto: unknown): boolean {
  const alvo = new Set(palavras(texto))
  const q = palavras(busca)
  return q.length > 0 && q.every((p) => alvo.has(p))
}

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
function dataValida(s: string): boolean {
  if (!DATA_ISO.test(s)) return false
  const d = new Date(`${s}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

function valorDoParametro(def: DefParametro, bruto: unknown): string | number | boolean {
  if (def.tipo === 'bool') {
    if (typeof bruto === 'boolean') return bruto
    throw new ErroConsulta('valor lógico esperado', 'parametro')
  }
  if (def.tipo === 'numero') {
    if (typeof bruto !== 'number' || !Number.isFinite(bruto)) throw new ErroConsulta('número esperado', 'parametro')
    return bruto
  }
  if (typeof bruto !== 'string' || !bruto.trim() || bruto.length > 120) throw new ErroConsulta('texto esperado', 'parametro')
  if (def.tipo === 'data' && !dataValida(bruto)) throw new ErroConsulta('data inválida (use AAAA-MM-DD)', 'parametro')
  if (def.tipo === 'enum' && !(def.valores ?? []).includes(bruto)) throw new ErroConsulta(`valor fora da lista: ${bruto}`, 'parametro')
  return bruto.trim()
}

function validarParametros(spec: SpecConsulta, params: Record<string, unknown>): Record<string, string | number | boolean> {
  const defs = spec.parametros ?? {}
  if (!params || typeof params !== 'object' || Array.isArray(params)) throw new ErroConsulta('parâmetros inválidos', 'parametro')
  const extra = Object.keys(params).filter((k) => !(k in defs)).sort()[0]
  if (extra) throw new ErroConsulta(`parâmetro desconhecido: ${extra}`, 'parametro')
  const saida: Record<string, string | number | boolean> = {}
  for (const [nome, def] of Object.entries(defs)) {
    if (params[nome] === undefined || params[nome] === null) {
      if (def.obrigatorio) throw new ErroConsulta(`falta o parâmetro ${nome}`, 'parametro')
      continue
    }
    saida[nome] = valorDoParametro(def, params[nome])
  }
  return saida
}

function confere(op: string, atual: unknown, esperado: unknown, tipo: TipoCampo): boolean {
  if (op === 'contem') return atual !== null && atual !== undefined && casaPalavras(esperado, atual)
  if (atual === null || atual === undefined) return op === 'diferente'
  let a = atual as string | number | boolean
  let e = esperado as string | number | boolean
  if (tipo === 'texto' && (op === 'igual' || op === 'diferente')) { a = semAcento(a); e = semAcento(e) }
  if (op === 'igual') return a === e
  if (op === 'diferente') return a !== e
  return op === 'maior_igual' ? a >= e : a <= e
}

export interface SessaoConsulta { papel: string; permissoes: string[] }

export function executarSpec(spec: SpecConsulta, params: Record<string, unknown>, dados: Record<string, Linha[]>, sessao: SessaoConsulta): Record<string, unknown> {
  const ent = ENTIDADES[spec.entidade]
  if (!ent) throw new ErroConsulta('entidade desconhecida', 'erro')
  if (!sessao.permissoes.includes(spec.permissao)) throw new ErroConsulta(`sem a permissão ${spec.permissao}`, 'permissao')
  if (ent.soAdmin && !ehAdmin(sessao.papel as never)) throw new ErroConsulta('só master e administrador', 'permissao')
  const valores = validarParametros(spec, params)
  let linhas = [...(dados[spec.entidade] ?? [])]
  for (const f of spec.filtros ?? []) {
    const tipo = ent.campos[f.campo]
    if (!tipo) throw new ErroConsulta(`campo desconhecido: ${f.campo}`, 'erro')
    let esperado: unknown
    if (f.parametro !== undefined) {
      if (!(f.parametro in valores)) continue // filtro opcional sem valor: não filtra
      esperado = valores[f.parametro]
    } else {
      esperado = f.valor
    }
    linhas = linhas.filter((l) => confere(f.op, l[f.campo], esperado, tipo))
  }
  const saida: Record<string, unknown> = { total: linhas.length }
  if (spec.operacao === 'somar') {
    const centavos = linhas.reduce((s, l) => s + Math.round(Number(l[spec.campo_soma ?? ''] ?? 0) * 100), 0)
    saida.soma = centavos / 100
  } else if (spec.operacao === 'listar') {
    const por = spec.ordenar_por
    if (por) {
      linhas.sort((x, y) => {
        const a = x[por] as string | number | null | undefined
        const b = y[por] as string | number | null | undefined
        const an = a === null || a === undefined
        const bn = b === null || b === undefined
        if (an !== bn) return an ? 1 : -1
        if (an) return 0
        return (a as string | number) < (b as string | number) ? -1 : (a as string | number) > (b as string | number) ? 1 : 0
      })
    }
    saida.linhas = linhas.slice(0, spec.limite || 20).map((l) => Object.fromEntries((spec.saida ?? []).map((c) => [c, l[c] ?? null])))
  }
  return saida
}

// ---------------------------------------------------------------------------
// Ligação com as telas: lê os dados pela MESMA API das telas (com as permissões de quem está logado)
// ---------------------------------------------------------------------------
export async function carregarEntidade(api: Api, entidade: string): Promise<Linha[]> {
  switch (entidade) {
    case 'clientes':
      return (await api.clientes.listar()).map((c) => ({ nome: c.nome, tipo: c.tipo, cidade: c.cidade, observacoes: c.observacoes ?? null }))
    case 'produtos':
      return (await api.produtos.listar()).map((p) => ({ codigo: p.codigo, nome: p.nome, categoria: p.categoria, valor_diaria: p.valor_diaria, valor_reposicao: p.valor_reposicao, quantidade: p.quantidade, ativo: p.ativo }))
    case 'orcamentos':
      return (await api.orcamentos.listar()).map((o) => ({ numero: o.numero, cliente_nome: o.cliente?.nome ?? null, evento: o.evento, status: o.status, data_retirada: o.data_retirada, data_devolucao: o.data_devolucao, diarias: o.diarias, desconto: o.desconto, total: o.total }))
    case 'pagamentos':
      return (await api.pagamentos.listar('todos')).map((p) => ({ orcamento_numero: p.orcamento?.numero ?? null, valor: p.valor, vencimento: p.vencimento, pago_em: p.pago_em, status: p.status, forma: p.forma }))
    case 'usuarios':
      return (await api.usuarios.listar()).map((u) => ({ nome: u.nome, papel: u.papel, grupo_nome: u.grupo?.nome ?? null, ativo: u.ativo }))
    default:
      throw new ErroConsulta('entidade desconhecida', 'erro')
  }
}

/** Resultado de uma chamada `catalogo` pedida pela API. Sem sessão, sem spec aprovada ou sem permissão: lança (o chat mostra o motivo). */
export async function executarCatalogo(api: Api, chamada: Chamada): Promise<unknown> {
  const sessao = api.auth.salva()
  if (!sessao) throw new ApiError('Faça login para consultar.', 401)
  const spec = (await api.evolucao.catalogo()).find((s) => s.nome === chamada.args.nome)
  if (!spec) return { erro: 'esta consulta não está mais aprovada' }
  const params = (chamada.args.params ?? {}) as Record<string, unknown>
  try {
    const ctx: SessaoConsulta = { papel: sessao.usuario.papel, permissoes: sessao.permissoes }
    // permissão e parâmetros são conferidos ANTES de ler qualquer dado
    executarSpec({ ...spec, operacao: 'contar', filtros: [] }, params, { [spec.entidade]: [] }, ctx)
    return executarSpec(spec, params, { [spec.entidade]: await carregarEntidade(api, spec.entidade) }, ctx)
  } catch (e) {
    if (e instanceof ErroConsulta) {
      return { erro: e.codigo === 'permissao' ? 'o usuário não tem permissão para ver estes dados' : e.message }
    }
    throw e
  }
}
