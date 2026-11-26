/**
 * O que o assistente pode pedir, executado AQUI no front pela mesma API que as telas usam
 * (localStorage na demo, Laravel na versão real). A API de IA só escolhe a ferramenta e os argumentos.
 *
 *  - consultas: só leitura, devolvem poucos campos (sem documento, e-mail, telefone ou observações);
 *  - cadastros: só preparam os valores do formulário; quem grava é o formulário, depois do usuário conferir;
 *  - exclusões: só localizam o registro; quem exclui é o botão de confirmação do cartão.
 */
import type { Api } from '../api/tipos'
import type { Chamada, Cliente, Orcamento, Produto } from '../types'
import type { ClienteForm, ProdutoForm } from '../types'
import type { OrcamentoInicial } from '../components/formularios/FormOrcamento'
import { rotuloStatus } from './format'

export const MAX_LINHAS = 15

export const semAcento = (t: string) => t.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim()

const texto = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined)
const numero = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
const soma = (valores: number[]) => Math.round(valores.reduce((s, v) => s + Math.round(v * 100), 0)) / 100

// ---------------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------------
export async function executarConsulta(api: Api, chamada: Chamada): Promise<unknown> {
  const a = chamada.args
  switch (chamada.nome) {
    case 'resumo_painel': {
      const r = await api.dashboard()
      return {
        recebido_mes: r.recebido_mes, a_receber: r.a_receber, em_atraso: r.em_atraso, orcamentos_em_aberto: r.orcamentos_em_aberto,
        orcamentos_por_status: r.orcamentos_por_status, recebido_por_mes: r.recebido_por_mes,
        produtos_mais_alugados: r.produtos_mais_alugados.map((p) => ({ produto: p.nome, quantidade: p.quantidade })),
        proximos_eventos: r.proximos_eventos.map((e) => ({ numero: e.numero, evento: e.evento, cliente: e.cliente, retirada: e.data_retirada, devolucao: e.data_devolucao, total: e.total })),
      }
    }
    case 'consultar_orcamentos': {
      const status = texto(a.status) as Orcamento['status'] | undefined
      const de = texto(a.retirada_de)
      const ate = texto(a.retirada_ate)
      const lista = (await api.orcamentos.listar({ busca: texto(a.busca), status: status ?? '' }))
        .filter((o) => (!de || o.data_retirada >= de) && (!ate || o.data_retirada <= ate))
      return {
        total: lista.length,
        soma_dos_totais: soma(lista.map((o) => o.total)),
        linhas: lista.slice(0, MAX_LINHAS).map((o) => ({ numero: o.numero, cliente: o.cliente?.nome ?? '', evento: o.evento, status: o.status, retirada: o.data_retirada, devolucao: o.data_devolucao, total: o.total })),
      }
    }
    case 'consultar_clientes': {
      const lista = await api.clientes.listar(texto(a.busca))
      return { total: lista.length, linhas: lista.slice(0, MAX_LINHAS).map((c) => ({ nome: c.nome, tipo: c.tipo === 'PJ' ? 'empresa' : 'pessoa física', cidade: c.cidade })) }
    }
    case 'consultar_produtos': {
      const lista = await api.produtos.listar({ busca: texto(a.busca), categoria: texto(a.categoria), ativo: typeof a.ativo === 'boolean' ? a.ativo : undefined })
      return {
        total: lista.length,
        linhas: lista.slice(0, MAX_LINHAS).map((p) => ({ codigo: p.codigo, nome: p.nome, categoria: p.categoria, valor_diaria: p.valor_diaria, estoque: p.quantidade, ativo: p.ativo })),
      }
    }
    case 'consultar_cobrancas': {
      const situacao = (texto(a.situacao) ?? 'todos') as 'todos' | 'pendente' | 'atrasado' | 'pago' | 'cancelado'
      const lista = await api.pagamentos.listar(situacao)
      return {
        total: lista.length,
        soma_dos_valores: soma(lista.map((p) => p.valor)),
        linhas: lista.slice(0, MAX_LINHAS).map((p) => ({ orcamento: p.orcamento?.numero ?? '', cliente: p.orcamento?.cliente?.nome ?? '', valor: p.valor, vencimento: p.vencimento, pago_em: p.pago_em, status: p.status })),
      }
    }
    default:
      throw new Error(`Consulta desconhecida: ${chamada.nome}`)
  }
}

// ---------------------------------------------------------------------------
// Cadastros: valores iniciais do formulário
// ---------------------------------------------------------------------------
export type PreparoCadastro =
  | { modulo: 'cliente'; inicial: Partial<ClienteForm>; avisos: string[] }
  | { modulo: 'produto'; inicial: Partial<ProdutoForm>; avisos: string[]; categorias: string[] }
  | { modulo: 'orcamento'; inicial: OrcamentoInicial; avisos: string[]; clientes: Cliente[]; produtos: Produto[] }

/** Acha o único registro que casa com o texto (igual primeiro, depois "contém"). Vazio ou ambíguo devolve a lista para avisar. */
function achar<T>(lista: T[], busca: string, campos: (x: T) => (string | null | undefined)[]): T[] {
  const alvo = semAcento(busca)
  const valores = (x: T) => campos(x).filter((v): v is string => !!v).map(semAcento)
  const iguais = lista.filter((x) => valores(x).some((v) => v === alvo))
  if (iguais.length) return iguais
  return lista.filter((x) => valores(x).some((v) => v.includes(alvo)))
}

export async function prepararCadastro(api: Api, chamada: Chamada): Promise<PreparoCadastro | null> {
  const a = chamada.args
  switch (chamada.nome) {
    case 'cadastrar_cliente': {
      const inicial: Partial<ClienteForm> = {}
      if (texto(a.nome)) inicial.nome = texto(a.nome)!
      if (a.tipo === 'PF' || a.tipo === 'PJ') inicial.tipo = a.tipo
      for (const campo of ['documento', 'email', 'telefone', 'cidade', 'observacoes'] as const) if (texto(a[campo])) inicial[campo] = texto(a[campo])!
      return { modulo: 'cliente', inicial, avisos: [] }
    }
    case 'cadastrar_produto': {
      const inicial: Partial<ProdutoForm> = {}
      for (const campo of ['codigo', 'nome', 'categoria', 'descricao'] as const) if (texto(a[campo])) inicial[campo] = texto(a[campo])!
      for (const campo of ['valor_diaria', 'valor_reposicao', 'quantidade'] as const) if (numero(a[campo]) !== undefined) inicial[campo] = numero(a[campo])!
      const categorias = [...new Set((await api.produtos.listar()).map((p) => p.categoria))].sort()
      return { modulo: 'produto', inicial, avisos: [], categorias }
    }
    case 'cadastrar_orcamento': {
      const [clientes, produtos] = await Promise.all([api.clientes.listar(), api.produtos.listar({ ativo: true })])
      const inicial: OrcamentoInicial = {}
      const avisos: string[] = []
      if (texto(a.evento)) inicial.evento = texto(a.evento)!
      if (texto(a.data_retirada)) inicial.data_retirada = texto(a.data_retirada)!
      if (texto(a.data_devolucao)) inicial.data_devolucao = texto(a.data_devolucao)!
      if (numero(a.desconto) !== undefined) inicial.desconto = numero(a.desconto)!
      if (texto(a.observacoes)) inicial.observacoes = texto(a.observacoes)!

      const nomeCliente = texto(a.cliente)
      if (nomeCliente) {
        const c = achar(clientes, nomeCliente, (x) => [x.nome])
        if (c.length === 1) inicial.cliente_id = c[0].id
        else avisos.push(c.length ? `Há mais de um cliente parecido com “${nomeCliente}”. Escolha o cliente no campo.` : `Não encontrei o cliente “${nomeCliente}”. Escolha um cliente da lista ou cadastre antes.`)
      }

      const itens: { produto_id: number; quantidade: number }[] = []
      for (const bruto of Array.isArray(a.itens) ? a.itens : []) {
        const nome = texto((bruto as Record<string, unknown>)?.produto)
        if (!nome) continue
        const quantidade = Math.max(1, Math.floor(numero((bruto as Record<string, unknown>).quantidade) ?? 1))
        const p = achar(produtos, nome, (x) => [x.nome, x.codigo])
        if (p.length === 1 && !itens.some((i) => i.produto_id === p[0].id)) itens.push({ produto_id: p[0].id, quantidade })
        else if (p.length !== 1) avisos.push(p.length ? `Há mais de um produto parecido com “${nome}”. Adicione o produto certo na lista.` : `Não encontrei o produto “${nome}” entre os ativos. Escolha na lista.`)
      }
      if (itens.length) inicial.itens = itens
      return { modulo: 'orcamento', inicial, avisos, clientes, produtos }
    }
    default:
      return null
  }
}

// ---------------------------------------------------------------------------
// Exclusões: achar o registro (quem exclui é o botão de confirmação)
// ---------------------------------------------------------------------------
export type ModuloExclusao = 'cliente' | 'produto' | 'orcamento'
export interface Alvo { modulo: ModuloExclusao; id: number; rotulo: string }

export const ROTULO_MODULO: Record<ModuloExclusao, string> = { cliente: 'cliente', produto: 'produto', orcamento: 'orçamento' }

const rotuloCliente = (c: Cliente) => `${c.nome}${c.cidade ? ` — ${c.cidade}` : ''}`
const rotuloProduto = (p: Produto) => `${p.nome} (${p.codigo})`
const rotuloOrcamento = (o: Orcamento) => `Orçamento ${o.numero} — ${o.evento}${o.cliente ? `, ${o.cliente.nome}` : ''} (${rotuloStatus(o.status)})`

export async function localizarParaExcluir(api: Api, modulo: ModuloExclusao, busca: string): Promise<Alvo[]> {
  if (modulo === 'cliente') {
    const todos = await api.clientes.listar()
    return achar(todos, busca, (c) => [c.nome, c.documento, c.email]).map((c) => ({ modulo, id: c.id, rotulo: rotuloCliente(c) }))
  }
  if (modulo === 'produto') {
    const todos = await api.produtos.listar()
    return achar(todos, busca, (p) => [p.nome, p.codigo]).map((p) => ({ modulo, id: p.id, rotulo: rotuloProduto(p) }))
  }
  const todos = await api.orcamentos.listar()
  return achar(todos, busca, (o) => [o.numero, o.evento, o.cliente?.nome]).map((o) => ({ modulo, id: o.id, rotulo: rotuloOrcamento(o) }))
}

/** A exclusão de verdade: passa pela mesma API das telas, então vale exatamente a mesma regra de hoje. */
export async function excluir(api: Api, alvo: Alvo): Promise<void> {
  if (alvo.modulo === 'cliente') return api.clientes.excluir(alvo.id)
  if (alvo.modulo === 'produto') return api.produtos.excluir(alvo.id)
  return api.orcamentos.excluir(alvo.id)
}

// ---------------------------------------------------------------------------
// Permissões: o assistente nunca faz o que o usuário não poderia fazer nas telas
// ---------------------------------------------------------------------------
const PERMISSAO_DA_FERRAMENTA: Record<string, string> = {
  resumo_painel: 'painel.ver',
  consultar_orcamentos: 'orcamentos.ver',
  consultar_clientes: 'clientes.ver',
  consultar_produtos: 'produtos.ver',
  consultar_cobrancas: 'financeiro.ver',
  cadastrar_cliente: 'clientes.criar',
  cadastrar_produto: 'produtos.criar',
  cadastrar_orcamento: 'orcamentos.criar',
}
const MODULO_DA_EXCLUSAO: Record<string, string> = { cliente: 'clientes', produto: 'produtos', orcamento: 'orcamentos' }

/** Permissão exigida por um pedido do assistente (`null` se a ferramenta é desconhecida). */
export function permissaoDaChamada(c: Chamada): string | null {
  if (c.nome === 'excluir_registro') {
    const modulo = MODULO_DA_EXCLUSAO[String(c.args.modulo)]
    return modulo ? `${modulo}.excluir` : null
  }
  return PERMISSAO_DA_FERRAMENTA[c.nome] ?? null
}
