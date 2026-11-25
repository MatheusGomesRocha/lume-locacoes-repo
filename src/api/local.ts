/**
 * Driver da versão de demonstração (GitHub Pages): tudo fica no localStorage do navegador.
 * Reproduz as regras do Laravel (mesmas mensagens, mesmos status HTTP) usando lib/regras.ts.
 */
import seedPadrao from '../data/seed.json'
import { hojeISO } from '../lib/format'
import { calcularFaltas, calcularTotal, diarias, podeAprovar, podeCancelar, podeEditar, podeEnviar, podeExcluir, podeFinalizar, proximoNumero } from '../lib/regras'
import { STATUS_ORCAMENTO } from '../types'
import type { Cliente, FormaPagamento, Orcamento, OrcamentoForm, Pagamento, Produto, Resumo, StatusOrcamento } from '../types'
import { ApiError, type Api, type FiltroPagamento } from './tipos'

export const CHAVE_STORAGE = 'lume:v1'

interface ItemSalvo { produto_id: number; quantidade: number; valor_diaria: number }
interface OrcamentoSalvo extends Omit<Orcamento, 'cliente' | 'itens' | 'pagamentos' | 'diarias'> { itens: ItemSalvo[] }
interface Banco {
  clientes: Cliente[]
  produtos: Produto[]
  orcamentos: OrcamentoSalvo[]
  pagamentos: Pagamento[]
}

export interface Seed {
  clientes: Cliente[]
  produtos: Produto[]
  orcamentos: {
    id: number; cliente_id: number; status: StatusOrcamento; evento: string
    criado_dias: number; retirada_dias: number; devolucao_dias: number
    desconto: number; observacoes: string; itens: { produto_id: number; quantidade: number }[]
  }[]
  pagamentos: { orcamento_id: number; vencimento_dias: number; pago_dias: number | null; forma: FormaPagamento | null }[]
}

const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const contem = (texto: string | null | undefined, busca: string) => (texto ?? '').toLowerCase().includes(busca.toLowerCase())
const proximoId = (lista: { id: number }[]) => lista.reduce((m, x) => Math.max(m, x.id), 0) + 1

/** Monta o banco inicial a partir do seed. Datas do seed são deslocamentos em dias a partir de "hoje". */
export function bancoDoSeed(seed: Seed, base: Date = new Date()): Banco {
  const precos = new Map(seed.produtos.map((p) => [p.id, p.valor_diaria]))
  const sequencia: Record<number, number> = {}
  const totais = new Map<number, number>()

  const orcamentos = seed.orcamentos.map((o): OrcamentoSalvo => {
    const criado = new Date(base.getFullYear(), base.getMonth(), base.getDate() + o.criado_dias)
    const retirada = hojeISO(o.retirada_dias, base)
    const devolucao = hojeISO(o.devolucao_dias, base)
    const itens = o.itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade, valor_diaria: precos.get(i.produto_id) ?? 0 }))
    sequencia[criado.getFullYear()] = (sequencia[criado.getFullYear()] ?? 0) + 1
    const total = calcularTotal(itens, diarias(retirada, devolucao), o.desconto)
    totais.set(o.id, total)
    return {
      id: o.id,
      numero: `${criado.getFullYear()}/${String(sequencia[criado.getFullYear()]).padStart(4, '0')}`,
      cliente_id: o.cliente_id, evento: o.evento, data_retirada: retirada, data_devolucao: devolucao,
      status: o.status, desconto: o.desconto, total, observacoes: o.observacoes || null, itens,
    }
  })

  const pagamentos = seed.pagamentos.map((p, i): Pagamento => ({
    id: i + 1,
    orcamento_id: p.orcamento_id,
    valor: totais.get(p.orcamento_id) ?? 0,
    vencimento: hojeISO(p.vencimento_dias, base),
    pago_em: p.pago_dias === null ? null : hojeISO(p.pago_dias, base),
    forma: p.forma,
    status: p.pago_dias === null ? 'pendente' : 'pago',
  }))

  return { clientes: clonar(seed.clientes), produtos: clonar(seed.produtos), orcamentos, pagamentos }
}

export interface OpcoesLocal {
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  agora?: () => Date
  seed?: Seed
}

export function criarApiLocal({ storage = localStorage, agora = () => new Date(), seed = seedPadrao as unknown as Seed }: OpcoesLocal = {}): Api {
  function ler(): Banco {
    const bruto = storage.getItem(CHAVE_STORAGE)
    if (bruto) {
      try {
        return JSON.parse(bruto) as Banco
      } catch {
        /* dado corrompido: recomeça do exemplo */
      }
    }
    const novo = bancoDoSeed(seed, agora())
    storage.setItem(CHAVE_STORAGE, JSON.stringify(novo))
    return novo
  }
  const gravar = (b: Banco) => storage.setItem(CHAVE_STORAGE, JSON.stringify(b))

  function montar(b: Banco, o: OrcamentoSalvo): Orcamento {
    const cliente = b.clientes.find((c) => c.id === o.cliente_id)
    return {
      ...clonar(o),
      cliente: cliente ? { id: cliente.id, nome: cliente.nome } : undefined,
      diarias: diarias(o.data_retirada, o.data_devolucao),
      itens: o.itens.map((i) => {
        const p = b.produtos.find((x) => x.id === i.produto_id)
        return { ...i, produto: p ? { id: p.id, codigo: p.codigo, nome: p.nome } : undefined }
      }),
      pagamentos: b.pagamentos.filter((p) => p.orcamento_id === o.id).map(clonar),
    }
  }

  function pagamentoCom(b: Banco, p: Pagamento): Pagamento {
    const o = b.orcamentos.find((x) => x.id === p.orcamento_id)
    const c = o && b.clientes.find((x) => x.id === o.cliente_id)
    return { ...clonar(p), orcamento: o ? { id: o.id, numero: o.numero, evento: o.evento, cliente: c ? { id: c.id, nome: c.nome } : undefined } : undefined }
  }

  function validarOrcamento(b: Banco, d: OrcamentoForm) {
    const campos: Record<string, string[]> = {}
    if (!b.clientes.some((c) => c.id === Number(d.cliente_id))) campos.cliente_id = ['O valor escolhido em cliente é inválido ou está inativo.']
    if (!d.evento?.trim()) campos.evento = ['O campo evento é obrigatório.']
    if (!d.data_retirada) campos.data_retirada = ['O campo data de retirada é obrigatório.']
    if (!d.data_devolucao) campos.data_devolucao = ['O campo data de devolução é obrigatório.']
    else if (d.data_retirada && d.data_devolucao < d.data_retirada) campos.data_devolucao = ['O campo data de devolução deve ser uma data igual ou posterior a data de retirada.']
    if (d.desconto < 0) campos.desconto = ['O campo desconto deve ser de pelo menos 0.']
    if (!d.itens?.length) campos.itens = ['O campo itens deve ter pelo menos 1 item.']
    else {
      const vistos = new Set<number>()
      d.itens.forEach((i, n) => {
        const p = b.produtos.find((x) => x.id === Number(i.produto_id))
        if (!p || !p.ativo) campos[`itens.${n}.produto_id`] = ['O valor escolhido em produto é inválido ou está inativo.']
        else if (vistos.has(p.id)) campos[`itens.${n}.produto_id`] = ['O campo produto tem um valor repetido.']
        vistos.add(Number(i.produto_id))
        if (!Number.isInteger(Number(i.quantidade)) || Number(i.quantidade) < 1) campos[`itens.${n}.quantidade`] = ['O campo quantidade do item deve ser de pelo menos 1.']
      })
    }
    const primeiro = Object.values(campos)[0]?.[0]
    if (primeiro) throw new ApiError(primeiro, 422, [], campos)
  }

  /** Mantém o preço já congelado dos itens que continuam e usa o preço atual nos novos. */
  function montarItens(b: Banco, d: OrcamentoForm, anteriores: ItemSalvo[] = []): ItemSalvo[] {
    return d.itens.map((i) => {
      const antigo = anteriores.find((a) => a.produto_id === Number(i.produto_id))
      const preco = antigo?.valor_diaria ?? b.produtos.find((p) => p.id === Number(i.produto_id))!.valor_diaria
      return { produto_id: Number(i.produto_id), quantidade: Number(i.quantidade), valor_diaria: preco }
    })
  }

  function exigir(condicao: boolean, mensagem: string) {
    if (!condicao) throw new ApiError(mensagem, 409)
  }
  const achar = <T extends { id: number }>(lista: T[], id: number): T => {
    const x = lista.find((i) => i.id === id)
    if (!x) throw new ApiError('Registro não encontrado.', 404)
    return x
  }

  function faltasDe(b: Banco, o: OrcamentoSalvo) {
    return calcularFaltas(o, b.orcamentos, b.produtos)
  }

  return {
    modo: 'local',

    async dashboard(): Promise<Resumo> {
      const b = ler()
      const hoje = hojeISO(0, agora())
      const [ano, mes] = hoje.split('-').map(Number)
      const prefixoMes = hoje.slice(0, 7)
      const soma = (ps: Pagamento[]) => Math.round(ps.reduce((s, p) => s + Math.round(p.valor * 100), 0)) / 100

      const pagos = b.pagamentos.filter((p) => p.status === 'pago' && p.pago_em)
      const pendentes = b.pagamentos.filter((p) => p.status === 'pendente')

      const meses: { mes: string; total: number }[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(ano, mes - 1 - i, 1)
        const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        meses.push({ mes: chave, total: soma(pagos.filter((p) => p.pago_em!.startsWith(chave))) })
      }

      const alugados = new Map<number, number>()
      b.orcamentos.filter((o) => o.status === 'aprovado' || o.status === 'finalizado').forEach((o) =>
        o.itens.forEach((i) => alugados.set(i.produto_id, (alugados.get(i.produto_id) ?? 0) + i.quantidade)))

      return {
        recebido_mes: soma(pagos.filter((p) => p.pago_em!.startsWith(prefixoMes))),
        a_receber: soma(pendentes.filter((p) => p.vencimento >= hoje)),
        em_atraso: soma(pendentes.filter((p) => p.vencimento < hoje)),
        orcamentos_em_aberto: b.orcamentos.filter((o) => o.status === 'rascunho' || o.status === 'enviado').length,
        recebido_por_mes: meses,
        orcamentos_por_status: STATUS_ORCAMENTO.map((s) => ({ status: s, total: b.orcamentos.filter((o) => o.status === s).length })),
        produtos_mais_alugados: [...alugados.entries()]
          .sort((x, y) => y[1] - x[1] || x[0] - y[0])
          .slice(0, 5)
          .map(([id, quantidade]) => {
            const p = b.produtos.find((x) => x.id === id)!
            return { produto_id: id, codigo: p.codigo, nome: p.nome, quantidade }
          }),
        proximos_eventos: b.orcamentos
          .filter((o) => o.status === 'aprovado' && o.data_retirada >= hoje)
          .sort((x, y) => x.data_retirada.localeCompare(y.data_retirada) || x.id - y.id)
          .slice(0, 5)
          .map((o) => ({
            id: o.id, numero: o.numero, evento: o.evento, cliente: b.clientes.find((c) => c.id === o.cliente_id)?.nome ?? '',
            data_retirada: o.data_retirada, data_devolucao: o.data_devolucao, total: o.total,
          })),
      }
    },

    clientes: {
      async listar(busca = '') {
        const b = ler()
        const t = busca.trim()
        return b.clientes
          .filter((c) => !t || [c.nome, c.documento, c.email, c.cidade].some((v) => contem(v, t)))
          .sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
      },
      async criar(d) {
        const b = ler()
        const campos: Record<string, string[]> = {}
        if (!d.nome?.trim()) campos.nome = ['O campo nome é obrigatório.']
        if (d.tipo !== 'PF' && d.tipo !== 'PJ') campos.tipo = ['O valor escolhido em tipo é inválido.']
        if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) campos.email = ['O campo e-mail deve ser um e-mail válido.']
        if (Object.keys(campos).length) throw new ApiError(Object.values(campos)[0][0], 422, [], campos)
        const novo: Cliente = { ...d, id: proximoId(b.clientes) }
        b.clientes.push(novo)
        gravar(b)
        return novo
      },
      async atualizar(id, d) {
        const b = ler()
        const atual = achar(b.clientes, id)
        if (!d.nome?.trim()) throw new ApiError('O campo nome é obrigatório.', 422, [], { nome: ['O campo nome é obrigatório.'] })
        Object.assign(atual, d)
        gravar(b)
        return clonar(atual)
      },
      async excluir(id) {
        const b = ler()
        achar(b.clientes, id)
        exigir(!b.orcamentos.some((o) => o.cliente_id === id), 'Este cliente já tem orçamentos e não pode ser excluído.')
        b.clientes = b.clientes.filter((c) => c.id !== id)
        gravar(b)
      },
    },

    produtos: {
      async listar({ busca = '', categoria, ativo } = {}) {
        const b = ler()
        const t = busca.trim()
        return b.produtos
          .filter((p) => !t || contem(p.nome, t) || contem(p.codigo, t))
          .filter((p) => !categoria || p.categoria === categoria)
          .filter((p) => ativo === undefined || p.ativo === ativo)
          .sort((x, y) => x.codigo.localeCompare(y.codigo))
      },
      async criar(d) {
        const b = ler()
        const campos = validarProduto(b, d)
        if (Object.keys(campos).length) throw new ApiError(Object.values(campos)[0][0], 422, [], campos)
        const novo: Produto = { ...d, valor_reposicao: d.valor_reposicao || 0, ativo: d.ativo ?? true, id: proximoId(b.produtos) }
        b.produtos.push(novo)
        gravar(b)
        return novo
      },
      async atualizar(id, d) {
        const b = ler()
        const atual = achar(b.produtos, id)
        const campos = validarProduto(b, d, id)
        if (Object.keys(campos).length) throw new ApiError(Object.values(campos)[0][0], 422, [], campos)
        Object.assign(atual, { ...d, valor_reposicao: d.valor_reposicao || 0 })
        gravar(b)
        return clonar(atual)
      },
      async excluir(id) {
        const b = ler()
        achar(b.produtos, id)
        exigir(!b.orcamentos.some((o) => o.itens.some((i) => i.produto_id === id)), 'Este produto já foi usado em orçamentos e não pode ser excluído. Desmarque "Ativo" para tirá-lo de circulação.')
        b.produtos = b.produtos.filter((p) => p.id !== id)
        gravar(b)
      },
    },

    orcamentos: {
      async listar({ busca = '', status = '' } = {}) {
        const b = ler()
        const t = busca.trim()
        return b.orcamentos
          .filter((o) => !status || o.status === status)
          .filter((o) => !t || contem(o.numero, t) || contem(o.evento, t) || contem(b.clientes.find((c) => c.id === o.cliente_id)?.nome, t))
          .sort((x, y) => y.id - x.id)
          .map((o) => montar(b, o))
      },
      async obter(id) {
        const b = ler()
        return montar(b, achar(b.orcamentos, id))
      },
      async criar(d) {
        const b = ler()
        validarOrcamento(b, d)
        const itens = montarItens(b, d)
        const novo: OrcamentoSalvo = {
          id: proximoId(b.orcamentos),
          numero: proximoNumero(b.orcamentos.map((o) => o.numero), agora()),
          cliente_id: Number(d.cliente_id), evento: d.evento.trim(), data_retirada: d.data_retirada, data_devolucao: d.data_devolucao,
          status: 'rascunho', desconto: Number(d.desconto) || 0, observacoes: d.observacoes?.trim() || null, itens,
          total: calcularTotal(itens, diarias(d.data_retirada, d.data_devolucao), Number(d.desconto) || 0),
        }
        b.orcamentos.push(novo)
        gravar(b)
        return montar(b, novo)
      },
      async atualizar(id, d) {
        const b = ler()
        const o = achar(b.orcamentos, id)
        exigir(podeEditar(o.status), 'Só é possível editar orçamentos em rascunho ou enviados.')
        validarOrcamento(b, d)
        const itens = montarItens(b, d, o.itens)
        Object.assign(o, {
          cliente_id: Number(d.cliente_id), evento: d.evento.trim(), data_retirada: d.data_retirada, data_devolucao: d.data_devolucao,
          desconto: Number(d.desconto) || 0, observacoes: d.observacoes?.trim() || null, itens,
          total: calcularTotal(itens, diarias(d.data_retirada, d.data_devolucao), Number(d.desconto) || 0),
        })
        gravar(b)
        return montar(b, o)
      },
      async excluir(id) {
        const b = ler()
        const o = achar(b.orcamentos, id)
        exigir(podeExcluir(o.status), 'Só orçamentos em rascunho ou cancelados podem ser excluídos.')
        b.orcamentos = b.orcamentos.filter((x) => x.id !== id)
        b.pagamentos = b.pagamentos.filter((p) => p.orcamento_id !== id)
        gravar(b)
      },
      async enviar(id) {
        const b = ler()
        const o = achar(b.orcamentos, id)
        exigir(podeEnviar(o.status), 'Só orçamentos em rascunho podem ser enviados.')
        o.status = 'enviado'
        gravar(b)
        return montar(b, o)
      },
      async aprovar(id) {
        const b = ler()
        const o = achar(b.orcamentos, id)
        exigir(podeAprovar(o.status), 'Só orçamentos em rascunho ou enviados podem ser aprovados.')
        const faltas = faltasDe(b, o)
        if (faltas.length) throw new ApiError('Não há estoque suficiente para o período do orçamento.', 422, faltas)
        o.status = 'aprovado'
        b.pagamentos.push({ id: proximoId(b.pagamentos), orcamento_id: o.id, valor: o.total, vencimento: o.data_retirada, pago_em: null, forma: null, status: 'pendente' })
        gravar(b)
        return montar(b, o)
      },
      async finalizar(id) {
        const b = ler()
        const o = achar(b.orcamentos, id)
        exigir(podeFinalizar(o.status), 'Só orçamentos aprovados podem ser finalizados.')
        o.status = 'finalizado'
        gravar(b)
        return montar(b, o)
      },
      async cancelar(id) {
        const b = ler()
        const o = achar(b.orcamentos, id)
        exigir(podeCancelar(o.status), 'Orçamentos finalizados ou já cancelados não podem ser cancelados.')
        o.status = 'cancelado'
        b.pagamentos.filter((p) => p.orcamento_id === id && p.status === 'pendente').forEach((p) => (p.status = 'cancelado'))
        gravar(b)
        return montar(b, o)
      },
    },

    pagamentos: {
      async listar(filtro: FiltroPagamento = 'todos') {
        const b = ler()
        const hoje = hojeISO(0, agora())
        return b.pagamentos
          .filter((p) => {
            if (filtro === 'pendente') return p.status === 'pendente' && p.vencimento >= hoje
            if (filtro === 'atrasado') return p.status === 'pendente' && p.vencimento < hoje
            if (filtro === 'pago' || filtro === 'cancelado') return p.status === filtro
            return true
          })
          .sort((x, y) => y.vencimento.localeCompare(x.vencimento) || y.id - x.id)
          .map((p) => pagamentoCom(b, p))
      },
      async baixar(id, pagoEm, forma) {
        const b = ler()
        const p = achar(b.pagamentos, id)
        if (!pagoEm || !forma) throw new ApiError('Informe a data e a forma de pagamento.', 422)
        if (pagoEm > hojeISO(0, agora())) throw new ApiError('O campo data do pagamento deve ser uma data igual ou anterior a hoje.', 422, [], { pago_em: ['A data do pagamento não pode ser futura.'] })
        exigir(p.status === 'pendente', 'Só cobranças pendentes podem receber pagamento.')
        Object.assign(p, { status: 'pago', pago_em: pagoEm, forma })
        gravar(b)
        return pagamentoCom(b, p)
      },
    },

    async restaurarExemplo() {
      storage.removeItem(CHAVE_STORAGE)
      ler()
    },
  }
}

function validarProduto(b: Banco, d: Omit<Produto, 'id'>, ignorarId?: number): Record<string, string[]> {
  const campos: Record<string, string[]> = {}
  if (!d.codigo?.trim()) campos.codigo = ['O campo código é obrigatório.']
  else if (b.produtos.some((p) => p.codigo === d.codigo && p.id !== ignorarId)) campos.codigo = ['Já existe um registro com este valor em código.']
  if (!d.nome?.trim()) campos.nome = ['O campo nome é obrigatório.']
  if (!d.categoria?.trim()) campos.categoria = ['O campo categoria é obrigatório.']
  if (!(Number(d.valor_diaria) >= 0) || d.valor_diaria === null || (d.valor_diaria as unknown) === '') campos.valor_diaria = ['O campo valor da diária deve ser de pelo menos 0.']
  if (!Number.isInteger(Number(d.quantidade)) || Number(d.quantidade) < 0) campos.quantidade = ['O campo quantidade deve ser um número inteiro.']
  return campos
}
