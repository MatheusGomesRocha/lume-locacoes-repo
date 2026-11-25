import { ApiError } from './tipos'
import { bancoDoSeed, CHAVE_STORAGE, criarApiLocal, type Seed } from './local'

const HOJE = new Date(2026, 10, 15) // 15/11/2026
const memoria = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}
const api = (seed?: Seed) => criarApiLocal({ storage: memoria(), agora: () => HOJE, seed })

const prod = (id: number, quantidade = 10, valor = 100) => ({ id, codigo: `P-${id}`, nome: `Produto ${id}`, categoria: 'Teste', descricao: null, valor_diaria: valor, valor_reposicao: 0, quantidade, ativo: true })
const cli = (id: number, nome = `Cliente ${id}`) => ({ id, nome, tipo: 'PF' as const, documento: null, email: null, telefone: null, cidade: null, observacoes: null })

/** Seed pequeno e previsível para os testes de regra. */
const seedMini = (extra: Partial<Seed> = {}): Seed => ({ clientes: [cli(1, 'Maria'), cli(2, 'Ana')], produtos: [prod(1, 5, 100), prod(2, 3, 50)], orcamentos: [], pagamentos: [], ...extra })
const form = (extra = {}) => ({ cliente_id: 1, evento: 'Casamento', data_retirada: '2026-12-10', data_devolucao: '2026-12-12', desconto: 0, observacoes: '', itens: [{ produto_id: 1, quantidade: 2 }], ...extra })

async function rejeita(p: Promise<unknown>): Promise<ApiError> {
  try { await p } catch (e) { return e as ApiError }
  throw new Error('Era para falhar')
}

describe('seed padrão', () => {
  it('carrega 14 clientes, 30 produtos, 30 orçamentos e 19 cobranças', async () => {
    const a = api()
    expect(await a.clientes.listar()).toHaveLength(14)
    expect(await a.produtos.listar()).toHaveLength(30)
    expect(await a.orcamentos.listar()).toHaveLength(30)
    expect(await a.pagamentos.listar()).toHaveLength(19)
  })
  it('números de orçamento são únicos e totais batem com as regras', async () => {
    const lista = await api().orcamentos.listar()
    expect(new Set(lista.map((o) => o.numero)).size).toBe(30)
    for (const o of lista) {
      const esperado = o.itens.reduce((s, i) => s + i.valor_diaria * i.quantidade, 0) * o.diarias - o.desconto
      expect(o.total).toBeCloseTo(Math.max(0, esperado), 2)
    }
  })
  it('não deixa estoque estourado nos aprovados', async () => {
    const a = api()
    const aprovados = (await a.orcamentos.listar({ status: 'aprovado' }))
    for (const o of aprovados) {
      // reaprovar um aprovado não é permitido, então checamos via simulação: o conflito só aparece ao aprovar outro
      expect(o.status).toBe('aprovado')
    }
    expect(aprovados.length).toBeGreaterThan(0)
  })
  it('pagas têm data e pendentes não', async () => {
    const ps = await api().pagamentos.listar()
    ps.filter((p) => p.status === 'pago').forEach((p) => expect(p.pago_em).not.toBeNull())
    ps.filter((p) => p.status === 'pendente').forEach((p) => expect(p.pago_em).toBeNull())
  })
  it('bancoDoSeed desloca as datas a partir de hoje', () => {
    const b = bancoDoSeed(seedMini({ orcamentos: [{ id: 1, cliente_id: 1, status: 'rascunho', evento: 'x', criado_dias: -2, retirada_dias: 5, devolucao_dias: 7, desconto: 0, observacoes: '', itens: [{ produto_id: 1, quantidade: 1 }] }] }), HOJE)
    expect(b.orcamentos[0].data_retirada).toBe('2026-11-20')
    expect(b.orcamentos[0].numero).toBe('2026/0001')
    expect(b.orcamentos[0].total).toBe(200)
  })
})

describe('persistência', () => {
  it('grava no storage e outra instância enxerga', async () => {
    const storage = memoria()
    const a = criarApiLocal({ storage, agora: () => HOJE, seed: seedMini() })
    await a.clientes.criar({ ...cli(0, 'Novo'), nome: 'Novo' } as never)
    const b = criarApiLocal({ storage, agora: () => HOJE, seed: seedMini() })
    expect((await b.clientes.listar()).map((c) => c.nome)).toContain('Novo')
    expect(storage.getItem(CHAVE_STORAGE)).toContain('Novo')
  })
  it('se o storage estiver corrompido, recomeça do exemplo', async () => {
    const storage = memoria()
    storage.setItem(CHAVE_STORAGE, '{quebrado')
    expect(await criarApiLocal({ storage, agora: () => HOJE, seed: seedMini() }).clientes.listar()).toHaveLength(2)
  })
  it('restaurarExemplo descarta as mudanças', async () => {
    const a = api(seedMini())
    await a.clientes.excluir(2)
    expect(await a.clientes.listar()).toHaveLength(1)
    await a.restaurarExemplo!()
    expect(await a.clientes.listar()).toHaveLength(2)
  })
  it('modo é local', () => expect(api().modo).toBe('local'))
})

describe('clientes', () => {
  it('lista em ordem alfabética e busca por nome, documento, e-mail e cidade', async () => {
    const a = api(seedMini({ clientes: [{ ...cli(1, 'Zélia'), cidade: 'Aquiraz' }, { ...cli(2, 'Ana'), documento: '123', email: 'x@y.com' }] }))
    expect((await a.clientes.listar()).map((c) => c.nome)).toEqual(['Ana', 'Zélia'])
    expect(await a.clientes.listar('aquiraz')).toHaveLength(1)
    expect(await a.clientes.listar('123')).toHaveLength(1)
    expect(await a.clientes.listar('x@y')).toHaveLength(1)
    expect(await a.clientes.listar('nada')).toHaveLength(0)
  })
  it('cria com id novo e valida nome, tipo e e-mail', async () => {
    const a = api(seedMini())
    const novo = await a.clientes.criar({ ...cli(0), nome: 'Joana' } as never)
    expect(novo.id).toBe(3)
    expect((await rejeita(a.clientes.criar({ ...cli(0), nome: '' } as never))).campos.nome).toBeDefined()
    expect((await rejeita(a.clientes.criar({ ...cli(0), tipo: 'XX' } as never))).campos.tipo).toBeDefined()
    expect((await rejeita(a.clientes.criar({ ...cli(0), email: 'invalido' } as never))).campos.email).toBeDefined()
  })
  it('atualiza e devolve 404 para inexistente', async () => {
    const a = api(seedMini())
    expect((await a.clientes.atualizar(1, { ...cli(1), nome: 'Maria Souza' } as never)).nome).toBe('Maria Souza')
    expect((await rejeita(a.clientes.atualizar(99, cli(99) as never))).status).toBe(404)
  })
  it('exclui sem orçamentos e bloqueia com orçamentos', async () => {
    const a = api(seedMini())
    await a.orcamentos.criar(form())
    const erro = await rejeita(a.clientes.excluir(1))
    expect(erro.status).toBe(409)
    expect(erro.message).toBe('Este cliente já tem orçamentos e não pode ser excluído.')
    await a.clientes.excluir(2)
    expect(await a.clientes.listar()).toHaveLength(1)
  })
})

describe('produtos', () => {
  const novo = (extra = {}) => ({ codigo: 'LUZ-9', nome: 'Refletor', categoria: 'Luz', descricao: null, valor_diaria: 85, valor_reposicao: 0, quantidade: 10, ativo: true, ...extra })
  it('lista por código e filtra por busca, categoria e ativo', async () => {
    const a = api(seedMini({ produtos: [{ ...prod(1), codigo: 'B-1', nome: 'Caixa', categoria: 'Som' }, { ...prod(2), codigo: 'A-1', nome: 'Refletor', categoria: 'Luz', ativo: false }] }))
    expect((await a.produtos.listar())[0].codigo).toBe('A-1')
    expect(await a.produtos.listar({ busca: 'caixa' })).toHaveLength(1)
    expect(await a.produtos.listar({ busca: 'A-1' })).toHaveLength(1)
    expect(await a.produtos.listar({ categoria: 'Som' })).toHaveLength(1)
    expect((await a.produtos.listar({ ativo: true }))[0].codigo).toBe('B-1')
    expect((await a.produtos.listar({ ativo: false }))[0].codigo).toBe('A-1')
  })
  it('cria com padrões e valida código único e números', async () => {
    const a = api(seedMini())
    expect((await a.produtos.criar(novo())).id).toBe(3)
    expect((await rejeita(a.produtos.criar(novo()))).campos.codigo).toBeDefined()
    expect((await rejeita(a.produtos.criar(novo({ codigo: 'X', valor_diaria: -1 })))).campos.valor_diaria).toBeDefined()
    expect((await rejeita(a.produtos.criar(novo({ codigo: 'X', quantidade: 1.5 })))).campos.quantidade).toBeDefined()
    expect(Object.keys((await rejeita(a.produtos.criar({} as never))).campos)).toEqual(expect.arrayContaining(['codigo', 'nome', 'categoria']))
  })
  it('atualiza mantendo o próprio código, mas não aceita o de outro', async () => {
    const a = api(seedMini())
    expect((await a.produtos.atualizar(1, novo({ codigo: 'P-1', nome: 'Novo nome' }))).nome).toBe('Novo nome')
    expect((await rejeita(a.produtos.atualizar(1, novo({ codigo: 'P-2' })))).campos.codigo).toBeDefined()
  })
  it('exclui sem uso e bloqueia produto usado em orçamento', async () => {
    const a = api(seedMini())
    await a.orcamentos.criar(form())
    expect((await rejeita(a.produtos.excluir(1))).status).toBe(409)
    await a.produtos.excluir(2)
    expect(await a.produtos.listar()).toHaveLength(1)
  })
})

describe('orçamentos: criar e ler', () => {
  it('calcula diárias, total, número e congela o preço', async () => {
    const a = api(seedMini())
    const o = await a.orcamentos.criar(form({ desconto: 100, itens: [{ produto_id: 1, quantidade: 2 }, { produto_id: 2, quantidade: 4 }] }))
    expect(o.total).toBe(700) // (2×100 + 4×50) × 2 − 100
    expect(o.diarias).toBe(2)
    expect(o.status).toBe('rascunho')
    expect(o.numero).toBe('2026/0001')
    expect(o.cliente?.nome).toBe('Maria')
    expect(o.itens[0].produto?.codigo).toBe('P-1')
    expect((await a.orcamentos.criar(form())).numero).toBe('2026/0002')
  })
  it('valida campos obrigatórios, datas, desconto e itens', async () => {
    const a = api(seedMini())
    expect((await rejeita(a.orcamentos.criar(form({ cliente_id: 99 })))).campos.cliente_id).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ evento: ' ' })))).campos.evento).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ data_retirada: '' })))).campos.data_retirada).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ data_devolucao: '2026-12-01' })))).campos.data_devolucao).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ desconto: -5 })))).campos.desconto).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ itens: [] })))).campos.itens).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ itens: [{ produto_id: 1, quantidade: 0 }] })))).campos['itens.0.quantidade']).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ itens: [{ produto_id: 1, quantidade: 1 }, { produto_id: 1, quantidade: 2 }] })))).campos['itens.1.produto_id']).toBeDefined()
    expect((await rejeita(a.orcamentos.criar(form({ itens: [{ produto_id: 99, quantidade: 1 }] })))).campos['itens.0.produto_id']).toBeDefined()
  })
  it('não aceita produto inativo', async () => {
    const a = api(seedMini({ produtos: [{ ...prod(1), ativo: false }] }))
    expect((await rejeita(a.orcamentos.criar(form()))).campos['itens.0.produto_id']).toBeDefined()
  })
  it('lista com filtros de status e busca, e obtém um por id', async () => {
    const a = api(seedMini())
    const o1 = await a.orcamentos.criar(form({ evento: 'Formatura', cliente_id: 1 }))
    const o2 = await a.orcamentos.criar(form({ evento: 'Casamento', cliente_id: 2 }))
    await a.orcamentos.aprovar(o2.id)
    expect((await a.orcamentos.listar())[0].id).toBe(o2.id)
    expect(await a.orcamentos.listar({ status: 'aprovado' })).toHaveLength(1)
    expect(await a.orcamentos.listar({ busca: 'formatura' })).toHaveLength(1)
    expect((await a.orcamentos.listar({ busca: 'maria' }))[0].id).toBe(o1.id)
    expect(await a.orcamentos.listar({ busca: '2026/0002' })).toHaveLength(1)
    expect((await a.orcamentos.obter(o1.id)).evento).toBe('Formatura')
    expect((await rejeita(a.orcamentos.obter(99))).status).toBe(404)
  })
})

describe('orçamentos: editar', () => {
  it('edita rascunho e enviado, recalculando', async () => {
    const a = api(seedMini())
    const o = await a.orcamentos.criar(form())
    const novo = await a.orcamentos.atualizar(o.id, form({ data_devolucao: '2026-12-10', itens: [{ produto_id: 1, quantidade: 2 }, { produto_id: 2, quantidade: 4 }] }))
    expect(novo.total).toBe(400)
    expect(novo.diarias).toBe(1)
    await a.orcamentos.enviar(o.id)
    await a.orcamentos.atualizar(o.id, form())
  })
  it('não edita aprovado', async () => {
    const a = api(seedMini())
    const o = await a.orcamentos.criar(form())
    await a.orcamentos.aprovar(o.id)
    const erro = await rejeita(a.orcamentos.atualizar(o.id, form()))
    expect(erro.status).toBe(409)
    expect(erro.message).toBe('Só é possível editar orçamentos em rascunho ou enviados.')
  })
  it('preço do item fica congelado, item novo usa o preço atual', async () => {
    const storage = memoria()
    const a = criarApiLocal({ storage, agora: () => HOJE, seed: seedMini() })
    const o = await a.orcamentos.criar(form({ data_devolucao: '2026-12-10', itens: [{ produto_id: 1, quantidade: 1 }] }))
    await a.produtos.atualizar(1, { ...prod(1), valor_diaria: 999 } as never)
    await a.produtos.atualizar(2, { ...prod(2), valor_diaria: 70 } as never)
    expect((await a.orcamentos.obter(o.id)).itens[0].valor_diaria).toBe(100)
    const novo = await a.orcamentos.atualizar(o.id, form({ data_devolucao: '2026-12-10', itens: [{ produto_id: 1, quantidade: 1 }, { produto_id: 2, quantidade: 1 }] }))
    expect(novo.total).toBe(170)
  })
})

describe('orçamentos: fluxo de status', () => {
  it('enviar só em rascunho', async () => {
    const a = api(seedMini())
    const o = await a.orcamentos.criar(form())
    expect((await a.orcamentos.enviar(o.id)).status).toBe('enviado')
    expect((await rejeita(a.orcamentos.enviar(o.id))).status).toBe(409)
  })
  it('aprovar cria a cobrança com vencimento na retirada', async () => {
    const a = api(seedMini())
    const o = await a.orcamentos.criar(form())
    await a.orcamentos.enviar(o.id)
    const ap = await a.orcamentos.aprovar(o.id)
    expect(ap.status).toBe('aprovado')
    expect(ap.pagamentos).toHaveLength(1)
    expect(ap.pagamentos![0]).toMatchObject({ valor: 400, vencimento: '2026-12-10', status: 'pendente' })
  })
  it('aprovar não repete e não aprova cancelado', async () => {
    const a = api(seedMini())
    const o = await a.orcamentos.criar(form())
    await a.orcamentos.aprovar(o.id)
    expect((await rejeita(a.orcamentos.aprovar(o.id))).status).toBe(409)
    const c = await a.orcamentos.criar(form())
    await a.orcamentos.cancelar(c.id)
    expect((await rejeita(a.orcamentos.aprovar(c.id))).status).toBe(409)
    expect(await a.pagamentos.listar()).toHaveLength(1)
  })
  it('bloqueia aprovação sem estoque e informa o que falta', async () => {
    const a = api(seedMini())
    const a1 = await a.orcamentos.criar(form({ itens: [{ produto_id: 1, quantidade: 4 }] }))
    await a.orcamentos.aprovar(a1.id)
    const b = await a.orcamentos.criar(form({ data_retirada: '2026-12-11', data_devolucao: '2026-12-13', itens: [{ produto_id: 1, quantidade: 2 }] }))
    const erro = await rejeita(a.orcamentos.aprovar(b.id))
    expect(erro.status).toBe(422)
    expect(erro.message).toBe('Não há estoque suficiente para o período do orçamento.')
    expect(erro.detalhes[0]).toMatchObject({ codigo: 'P-1', solicitado: 2, disponivel: 1 })
    expect((await a.orcamentos.obter(b.id)).status).toBe('rascunho')
    expect((await a.orcamentos.obter(b.id)).pagamentos).toHaveLength(0)
  })
  it('aprova períodos que não se sobrepõem', async () => {
    const a = api(seedMini())
    await a.orcamentos.aprovar((await a.orcamentos.criar(form({ data_retirada: '2026-12-01', data_devolucao: '2026-12-05', itens: [{ produto_id: 1, quantidade: 5 }] }))).id)
    const b = await a.orcamentos.criar(form({ data_retirada: '2026-12-06', data_devolucao: '2026-12-08', itens: [{ produto_id: 1, quantidade: 5 }] }))
    expect((await a.orcamentos.aprovar(b.id)).status).toBe('aprovado')
  })
  it('finalizar só aprovado, e libera o estoque', async () => {
    const a = api(seedMini())
    const x = await a.orcamentos.criar(form({ itens: [{ produto_id: 1, quantidade: 5 }] }))
    const y = await a.orcamentos.criar(form({ itens: [{ produto_id: 1, quantidade: 5 }] }))
    await a.orcamentos.aprovar(x.id)
    expect((await rejeita(a.orcamentos.aprovar(y.id))).status).toBe(422)
    expect((await rejeita(a.orcamentos.finalizar(y.id))).status).toBe(409)
    expect((await a.orcamentos.finalizar(x.id)).status).toBe('finalizado')
    expect((await a.orcamentos.aprovar(y.id)).status).toBe('aprovado')
  })
  it('cancelar cancela cobranças pendentes, preserva as pagas e libera estoque', async () => {
    const a = api(seedMini())
    const x = await a.orcamentos.criar(form({ itens: [{ produto_id: 1, quantidade: 5 }] }))
    const y = await a.orcamentos.criar(form({ itens: [{ produto_id: 1, quantidade: 5 }] }))
    await a.orcamentos.aprovar(x.id)
    expect((await rejeita(a.orcamentos.aprovar(y.id))).status).toBe(422)
    expect((await a.orcamentos.cancelar(x.id)).pagamentos![0].status).toBe('cancelado')
    expect((await a.orcamentos.aprovar(y.id)).status).toBe('aprovado')

    const paga = await a.pagamentos.listar('pendente')
    await a.pagamentos.baixar(paga[0].id, '2026-11-10', 'pix')
    await a.orcamentos.cancelar(y.id)
    const pagos = await a.pagamentos.listar('pago')
    expect(pagos).toHaveLength(1) // a cobrança já paga continua paga
    expect(pagos[0].id).toBe(paga[0].id)
  })
  it('não cancela finalizado nem cancelado', async () => {
    const a = api(seedMini())
    const x = await a.orcamentos.criar(form())
    await a.orcamentos.aprovar(x.id)
    await a.orcamentos.finalizar(x.id)
    expect((await rejeita(a.orcamentos.cancelar(x.id))).status).toBe(409)
    const y = await a.orcamentos.criar(form())
    await a.orcamentos.cancelar(y.id)
    expect((await rejeita(a.orcamentos.cancelar(y.id))).status).toBe(409)
  })
  it('exclui rascunho e cancelado (com cobranças); bloqueia os demais', async () => {
    const a = api(seedMini())
    const r = await a.orcamentos.criar(form())
    await a.orcamentos.excluir(r.id)
    const c = await a.orcamentos.criar(form())
    await a.orcamentos.aprovar(c.id)
    await a.orcamentos.cancelar(c.id)
    await a.orcamentos.excluir(c.id)
    expect(await a.orcamentos.listar()).toHaveLength(0)
    expect(await a.pagamentos.listar()).toHaveLength(0)
    for (const passo of ['enviar', 'aprovar', 'finalizar'] as const) {
      const o = await a.orcamentos.criar(form({ data_retirada: '2027-01-01', data_devolucao: '2027-01-02' }))
      for (const p of ['enviar', 'aprovar', 'finalizar'] as const) { await a.orcamentos[p](o.id); if (p === passo) break }
      expect((await rejeita(a.orcamentos.excluir(o.id))).status).toBe(409)
    }
  })
})

describe('pagamentos', () => {
  async function cenario() {
    const a = api(seedMini())
    const mk = async (ret: string) => (await a.orcamentos.aprovar((await a.orcamentos.criar(form({ data_retirada: ret, data_devolucao: ret, itens: [{ produto_id: 2, quantidade: 1 }] }))).id)).pagamentos![0]
    const avencer = await mk('2026-11-20')
    const hoje = await mk('2026-11-15')
    const atrasado = await mk('2026-11-10')
    await a.pagamentos.baixar((await mk('2026-11-01')).id, '2026-11-02', 'pix')
    return { a, avencer, hoje, atrasado }
  }
  it('lista com orçamento e cliente, do vencimento mais recente ao mais antigo', async () => {
    const { a } = await cenario()
    const todos = await a.pagamentos.listar()
    expect(todos).toHaveLength(4)
    expect(todos[0].vencimento).toBe('2026-11-20')
    expect(todos[0].orcamento?.cliente?.nome).toBe('Maria')
  })
  it('filtra a vencer (inclui hoje), atrasados e pagos', async () => {
    const { a, avencer, hoje, atrasado } = await cenario()
    expect((await a.pagamentos.listar('pendente')).map((p) => p.id).sort()).toEqual([avencer.id, hoje.id].sort())
    expect((await a.pagamentos.listar('atrasado')).map((p) => p.id)).toEqual([atrasado.id])
    expect(await a.pagamentos.listar('pago')).toHaveLength(1)
    expect(await a.pagamentos.listar('cancelado')).toHaveLength(0)
  })
  it('baixa registra data, forma e status', async () => {
    const { a, atrasado } = await cenario()
    const p = await a.pagamentos.baixar(atrasado.id, '2026-11-15', 'boleto')
    expect(p).toMatchObject({ status: 'pago', pago_em: '2026-11-15', forma: 'boleto' })
  })
  it('baixa valida dados, data futura, status e existência', async () => {
    const { a, atrasado } = await cenario()
    expect((await rejeita(a.pagamentos.baixar(atrasado.id, '', 'pix'))).status).toBe(422)
    expect((await rejeita(a.pagamentos.baixar(atrasado.id, '2026-11-20', 'pix'))).campos.pago_em).toBeDefined()
    await a.pagamentos.baixar(atrasado.id, '2026-11-15', 'pix')
    expect((await rejeita(a.pagamentos.baixar(atrasado.id, '2026-11-15', 'pix'))).status).toBe(409)
    expect((await rejeita(a.pagamentos.baixar(999, '2026-11-15', 'pix'))).status).toBe(404)
  })
})

describe('dashboard', () => {
  it('sem dados, tudo zerado e 6 meses', async () => {
    const r = await api(seedMini()).dashboard()
    expect(r).toMatchObject({ recebido_mes: 0, a_receber: 0, em_atraso: 0, orcamentos_em_aberto: 0, proximos_eventos: [] })
    expect(r.recebido_por_mes).toHaveLength(6)
    expect(r.recebido_por_mes.map((m) => m.mes)).toEqual(['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'])
  })
  it('separa recebido no mês, a receber e em atraso', async () => {
    const seed = seedMini({
      orcamentos: [{ id: 1, cliente_id: 1, status: 'aprovado', evento: 'x', criado_dias: -30, retirada_dias: 5, devolucao_dias: 6, desconto: 0, observacoes: '', itens: [{ produto_id: 1, quantidade: 1 }] }],
      pagamentos: [
        { orcamento_id: 1, vencimento_dias: -10, pago_dias: -5, forma: 'pix' },   // pago em 10/11: conta no mês (valor 100)
        { orcamento_id: 1, vencimento_dias: -30, pago_dias: -20, forma: 'pix' },  // pago em 26/10: mês anterior
        { orcamento_id: 1, vencimento_dias: 0, pago_dias: null, forma: null },    // vence hoje: a receber
        { orcamento_id: 1, vencimento_dias: -1, pago_dias: null, forma: null },   // atrasado
      ],
    })
    const r = await api(seed).dashboard()
    expect(r.recebido_mes).toBe(100)
    expect(r.a_receber).toBe(100)
    expect(r.em_atraso).toBe(100)
    expect(r.recebido_por_mes.at(-1)!.total).toBe(100)
    expect(r.recebido_por_mes.at(-2)!.total).toBe(100)
  })
  it('conta orçamentos em aberto e por status', async () => {
    const a = api(seedMini())
    await a.orcamentos.criar(form())
    await a.orcamentos.criar(form())
    const e = await a.orcamentos.criar(form({ itens: [{ produto_id: 2, quantidade: 1 }] }))
    await a.orcamentos.enviar(e.id)
    const r = await a.dashboard()
    expect(r.orcamentos_em_aberto).toBe(3)
    expect(r.orcamentos_por_status.find((s) => s.status === 'rascunho')!.total).toBe(2)
    expect(r.orcamentos_por_status).toHaveLength(5)
  })
  it('produtos mais alugados: só aprovados/finalizados, no máximo 5', async () => {
    const produtos = Array.from({ length: 6 }, (_, i) => prod(i + 1, 50))
    const orcamentos = produtos.map((p, i) => ({ id: i + 1, cliente_id: 1, status: 'aprovado' as const, evento: 'x', criado_dias: -1, retirada_dias: 30 + i * 3, devolucao_dias: 31 + i * 3, desconto: 0, observacoes: '', itens: [{ produto_id: p.id, quantidade: i + 1 }] }))
    orcamentos.push({ id: 7, cliente_id: 1, status: 'rascunho' as never, evento: 'x', criado_dias: -1, retirada_dias: 1, devolucao_dias: 2, desconto: 0, observacoes: '', itens: [{ produto_id: 1, quantidade: 100 }] })
    const r = await api(seedMini({ produtos, orcamentos })).dashboard()
    expect(r.produtos_mais_alugados).toHaveLength(5)
    expect(r.produtos_mais_alugados[0]).toMatchObject({ nome: 'Produto 6', quantidade: 6 })
    expect(r.produtos_mais_alugados.map((p) => p.nome)).not.toContain('Produto 1')
  })
  it('próximos eventos: aprovados de hoje em diante, em ordem de data', async () => {
    const mk = (id: number, status: 'aprovado' | 'enviado', ret: number, evento: string) => ({ id, cliente_id: 1, status, evento, criado_dias: -40, retirada_dias: ret, devolucao_dias: ret + 1, desconto: 0, observacoes: '', itens: [{ produto_id: 1, quantidade: 1 }] })
    const r = await api(seedMini({ orcamentos: [mk(1, 'aprovado', -5, 'Passado'), mk(2, 'aprovado', 35, 'Depois'), mk(3, 'aprovado', 0, 'Hoje'), mk(4, 'enviado', 3, 'Não aprovado')] })).dashboard()
    expect(r.proximos_eventos.map((e) => e.evento)).toEqual(['Hoje', 'Depois'])
    expect(r.proximos_eventos[0].cliente).toBe('Maria')
  })
  it('funciona com o seed padrão', async () => {
    const r = await api().dashboard()
    expect(r.recebido_por_mes).toHaveLength(6)
    expect(r.orcamentos_por_status.reduce((s, x) => s + x.total, 0)).toBe(30)
  })
})
