import { criarApiLocal } from '../api/local'
import { ApiError } from '../api/tipos'
import { HOJE, memoria } from '../test/utils'
import { diaLocal, excluir, executarConsulta, localizarParaExcluir, MAX_LINHAS, prepararCadastro, semAcento } from './ferramentas'

const nova = () => criarApiLocal({ storage: memoria(), agora: () => HOJE, protegida: false })

describe('semAcento', () => {
  it('tira acento, caixa e espaços das pontas', () => {
    expect(semAcento('  Mobiliário  ')).toBe('mobiliario')
  })
})

describe('consultas (só leitura, poucos campos)', () => {
  it('conta orçamentos por status e soma os totais', async () => {
    const api = nova()
    const r = (await executarConsulta(api, { nome: 'consultar_orcamentos', args: { status: 'aprovado' } })) as { total: number; soma_dos_totais: number; linhas: { status: string }[] }
    expect(r.total).toBe((await api.orcamentos.listar({ status: 'aprovado' })).length)
    expect(r.total).toBe(6)
    expect(r.soma_dos_totais).toBeGreaterThan(0)
    expect(r.linhas.every((l) => l.status === 'aprovado')).toBe(true)
  })

  it('limita as linhas, mas o total continua o real', async () => {
    const r = (await executarConsulta(nova(), { nome: 'consultar_orcamentos', args: {} })) as { total: number; linhas: unknown[] }
    expect(r.total).toBe(30)
    expect(r.linhas).toHaveLength(MAX_LINHAS)
  })

  it('filtra orçamentos pela data de retirada', async () => {
    const api = nova()
    const todos = await api.orcamentos.listar()
    const alvo = todos[0].data_retirada
    const r = (await executarConsulta(api, { nome: 'consultar_orcamentos', args: { retirada_de: alvo, retirada_ate: alvo } })) as { total: number }
    expect(r.total).toBe(todos.filter((o) => o.data_retirada === alvo).length)
  })

  it('filtra orçamentos pela data de devolução, que é outra data', async () => {
    const api = nova()
    const todos = await api.orcamentos.listar()
    const alvo = todos[0].data_devolucao
    const r = (await executarConsulta(api, { nome: 'consultar_orcamentos', args: { devolucao_de: alvo, devolucao_ate: alvo } })) as { total: number }
    expect(r.total).toBe(todos.filter((o) => o.data_devolucao === alvo).length)
  })

  it('orçamento tem três datas diferentes: criado, retirada e devolução não se misturam', async () => {
    const api = nova()
    const todos = await api.orcamentos.listar()
    const alvo = diaLocal(todos[0].criado_em)
    const criados = (await executarConsulta(api, { nome: 'consultar_orcamentos', args: { criado_de: alvo, criado_ate: alvo } })) as { total: number }
    expect(criados.total).toBe(todos.filter((o) => diaLocal(o.criado_em) === alvo).length)
    expect(criados.total).toBeGreaterThan(0)
    // o mesmo dia pedido como retirada ou como devolução é outra contagem (a menos que coincida por acaso nos dados)
    const retirada = (await executarConsulta(api, { nome: 'consultar_orcamentos', args: { retirada_de: alvo, retirada_ate: alvo } })) as { total: number }
    expect(retirada.total).toBe(todos.filter((o) => o.data_retirada === alvo).length)
  })

  it('"criados hoje": um orçamento acabado de criar aparece, mesmo com retirada e devolução em outro dia', async () => {
    const api = nova()
    const cliente = (await api.clientes.listar())[0]
    const produto = (await api.produtos.listar())[0]
    const novo = await api.orcamentos.criar({ cliente_id: cliente.id, evento: 'Teste de hoje', data_retirada: '2030-01-10', data_devolucao: '2030-01-11', desconto: 0, observacoes: '', itens: [{ produto_id: produto.id, quantidade: 1 }] })
    const hoje = diaLocal(HOJE.toISOString())
    const r = (await executarConsulta(api, { nome: 'consultar_orcamentos', args: { criado_de: hoje, criado_ate: hoje } })) as { total: number; linhas: { numero: string }[] }
    expect(r.linhas.map((l) => l.numero)).toContain(novo.numero)
    const porRetirada = (await executarConsulta(api, { nome: 'consultar_orcamentos', args: { retirada_de: hoje, retirada_ate: hoje } })) as { linhas: { numero: string }[] }
    expect(porRetirada.linhas.map((l) => l.numero)).not.toContain(novo.numero)
  })

  it('clientes e produtos filtram pelo dia do cadastro e cobranças pelo dia do pagamento', async () => {
    const api = nova()
    const clientes = await api.clientes.listar()
    const alvo = diaLocal(clientes[0].criado_em)
    const c = (await executarConsulta(api, { nome: 'consultar_clientes', args: { criado_de: alvo, criado_ate: alvo } })) as { total: number }
    expect(c.total).toBe(clientes.filter((x) => diaLocal(x.criado_em) === alvo).length)
    const pagas = (await api.pagamentos.listar('pago')).filter((p) => p.pago_em)
    const dia = diaLocal(pagas[0].pago_em)
    const p = (await executarConsulta(api, { nome: 'consultar_cobrancas', args: { pago_de: dia, pago_ate: dia } })) as { total: number }
    expect(p.total).toBe((await api.pagamentos.listar('todos')).filter((x) => diaLocal(x.pago_em) === dia).length)
  })

  it('filtra cobranças pelo vencimento', async () => {
    const api = nova()
    const todas = await api.pagamentos.listar('todos')
    const alvo = todas[0].vencimento
    const r = (await executarConsulta(api, { nome: 'consultar_cobrancas', args: { vencimento_de: alvo, vencimento_ate: alvo } })) as { total: number }
    expect(r.total).toBe(todas.filter((p) => p.vencimento === alvo).length)
  })

  it('a contagem da Lumi não depende da paginação das telas', async () => {
    const api = nova()
    const todos = await api.produtos.listar()
    expect(todos.length).toBeGreaterThan(10) // mais que uma página de 10
    const r = (await executarConsulta(api, { nome: 'consultar_produtos', args: {} })) as { total: number }
    expect(r.total).toBe(todos.length)
    expect((await api.produtos.pagina(undefined, { pagina: 1, porPagina: 10 })).total).toBe(todos.length)
  })

  it('clientes saem sem documento, e-mail, telefone ou observações', async () => {
    const r = (await executarConsulta(nova(), { nome: 'consultar_clientes', args: { busca: 'Fortaleza' } })) as { total: number; linhas: Record<string, unknown>[] }
    expect(r.total).toBeGreaterThan(0)
    expect(Object.keys(r.linhas[0]).sort()).toEqual(['cidade', 'nome', 'tipo'])
  })

  it('produtos: filtra por categoria e por ativo', async () => {
    const r = (await executarConsulta(nova(), { nome: 'consultar_produtos', args: { categoria: 'Som', ativo: false } })) as { total: number; linhas: { codigo: string; ativo: boolean }[] }
    expect(r.total).toBe(1)
    expect(r.linhas[0]).toMatchObject({ codigo: 'SOM-002', ativo: false })
  })

  it('cobranças: filtra por situação e soma os valores', async () => {
    const api = nova()
    const atrasadas = await api.pagamentos.listar('atrasado')
    const r = (await executarConsulta(api, { nome: 'consultar_cobrancas', args: { situacao: 'atrasado' } })) as { total: number; soma_dos_valores: number }
    expect(r.total).toBe(atrasadas.length)
    expect(r.soma_dos_valores).toBeCloseTo(atrasadas.reduce((s, p) => s + p.valor, 0), 2)
  })

  it('resumo do painel traz os números principais e nada de dados pessoais', async () => {
    const r = (await executarConsulta(nova(), { nome: 'resumo_painel', args: {} })) as Record<string, unknown>
    expect(Object.keys(r)).toEqual(expect.arrayContaining(['recebido_mes', 'a_receber', 'em_atraso', 'orcamentos_em_aberto', 'proximos_eventos']))
  })

  it('consulta desconhecida dá erro (nunca executa outra coisa)', async () => {
    await expect(executarConsulta(nova(), { nome: 'excluir_registro', args: {} })).rejects.toThrow()
  })
})

describe('cadastros só preparam o formulário', () => {
  it('cliente: leva só o que foi dito e ignora tipo inválido', async () => {
    const api = nova()
    const r = await prepararCadastro(api, { nome: 'cadastrar_cliente', args: { nome: 'Padaria Sol', tipo: 'XX', cidade: 'Fortaleza' } })
    expect(r).toEqual({ modulo: 'cliente', inicial: { nome: 'Padaria Sol', cidade: 'Fortaleza' }, avisos: [] })
    expect(await api.clientes.listar('Padaria')).toEqual([])
  })

  it('produto: números e categorias existentes', async () => {
    const r = await prepararCadastro(nova(), { nome: 'cadastrar_produto', args: { nome: 'Tripé', valor_diaria: 25, quantidade: 4 } })
    expect(r).toMatchObject({ modulo: 'produto', inicial: { nome: 'Tripé', valor_diaria: 25, quantidade: 4 } })
    expect((r as { categorias: string[] }).categorias).toContain('Som')
  })

  it('orçamento: acha o cliente e os produtos por nome, sem acento e por código', async () => {
    const api = nova()
    const r = await prepararCadastro(api, { nome: 'cadastrar_orcamento', args: { cliente: 'hotel por do sol', evento: 'Réveillon', itens: [{ produto: 'cadeira tiffany', quantidade: 50 }, { produto: 'LUZ-001', quantidade: 2 }] } })
    expect(r).toMatchObject({ modulo: 'orcamento', avisos: [], inicial: { cliente_id: 7, evento: 'Réveillon', itens: [{ produto_id: 11, quantidade: 50 }, { produto_id: 1, quantidade: 2 }] } })
  })

  it('orçamento: cliente ou produto que não existe vira aviso, não vira chute', async () => {
    const r = (await prepararCadastro(nova(), { nome: 'cadastrar_orcamento', args: { cliente: 'Zé Ninguém', itens: [{ produto: 'Foguete', quantidade: 1 }] } })) as { inicial: Record<string, unknown>; avisos: string[] }
    expect(r.inicial.cliente_id).toBeUndefined()
    expect(r.inicial.itens).toBeUndefined()
    expect(r.avisos).toHaveLength(2)
    expect(r.avisos[0]).toContain('Zé Ninguém')
  })

  it('orçamento: nome ambíguo não escolhe sozinho', async () => {
    const r = (await prepararCadastro(nova(), { nome: 'cadastrar_orcamento', args: { cliente: 'Mesa', itens: [{ produto: 'Mesa', quantidade: 1 }] } })) as { inicial: Record<string, unknown>; avisos: string[] }
    expect(r.inicial.itens).toBeUndefined()
    expect(r.avisos.some((a) => a.includes('mais de um produto'))).toBe(true)
  })

  it('orçamento: produto inativo não entra', async () => {
    const r = (await prepararCadastro(nova(), { nome: 'cadastrar_orcamento', args: { itens: [{ produto: 'Subwoofer', quantidade: 1 }] } })) as { inicial: Record<string, unknown>; avisos: string[] }
    expect(r.inicial.itens).toBeUndefined()
    expect(r.avisos).toHaveLength(1)
  })

  it('ferramenta que não é de cadastro devolve null', async () => {
    expect(await prepararCadastro(nova(), { nome: 'excluir_registro', args: {} })).toBeNull()
  })
})

describe('exclusões: localizar e confirmar', () => {
  it('acha um produto por nome ou código, sem acento', async () => {
    const api = nova()
    expect((await localizarParaExcluir(api, 'produto', 'refletor led')).map((a) => a.id)).toEqual([1])
    expect((await localizarParaExcluir(api, 'produto', 'luz-002')).map((a) => a.id)).toEqual([2])
    expect((await localizarParaExcluir(api, 'cliente', 'maria albuquerque')).length).toBe(0)
    expect((await localizarParaExcluir(api, 'cliente', 'mariana albuquerque'))[0].rotulo).toBe('Mariana Albuquerque — Fortaleza')
  })

  it('devolve vários quando é ambíguo e nenhum quando não acha', async () => {
    const api = nova()
    expect((await localizarParaExcluir(api, 'produto', 'Tenda')).length).toBe(2)
    expect(await localizarParaExcluir(api, 'produto', 'inexistente')).toEqual([])
  })

  it('orçamento pode ser achado pelo número', async () => {
    const api = nova()
    const o = (await api.orcamentos.listar())[0]
    const [alvo] = await localizarParaExcluir(api, 'orcamento', o.numero)
    expect(alvo.id).toBe(o.id)
    expect(alvo.rotulo).toContain(o.numero)
  })

  it('localizar não exclui nada', async () => {
    const api = nova()
    const antes = (await api.produtos.listar()).length
    await localizarParaExcluir(api, 'produto', 'Tenda')
    expect((await api.produtos.listar()).length).toBe(antes)
  })

  it('excluir segue as mesmas regras das telas: cliente com orçamento não sai', async () => {
    const api = nova()
    const [alvo] = await localizarParaExcluir(api, 'cliente', 'Hotel Pôr do Sol')
    await expect(excluir(api, alvo)).rejects.toThrow(/já tem orçamentos/)
    await expect(excluir(api, alvo)).rejects.toBeInstanceOf(ApiError)
  })

  it('excluir: produto usado em orçamento não sai', async () => {
    const api = nova()
    const [alvo] = await localizarParaExcluir(api, 'produto', 'LUZ-001')
    await expect(excluir(api, alvo)).rejects.toThrow(/já foi usado em orçamentos/)
  })

  it('excluir: orçamento aprovado não sai; rascunho sai', async () => {
    const api = nova()
    const lista = await api.orcamentos.listar()
    const aprovado = lista.find((o) => o.status === 'aprovado')!
    const rascunho = lista.find((o) => o.status === 'rascunho')!
    await expect(excluir(api, { modulo: 'orcamento', id: aprovado.id, rotulo: '' })).rejects.toThrow()
    await excluir(api, { modulo: 'orcamento', id: rascunho.id, rotulo: '' })
    expect((await api.orcamentos.listar()).some((o) => o.id === rascunho.id)).toBe(false)
  })

  it('excluir: produto sem uso sai', async () => {
    const api = nova()
    const novo = await api.produtos.criar({ codigo: 'TST-1', nome: 'Teste', categoria: 'Som', descricao: null, valor_diaria: 1, valor_reposicao: 0, quantidade: 1, ativo: true })
    await excluir(api, { modulo: 'produto', id: novo.id, rotulo: '' })
    expect((await api.produtos.listar({ busca: 'TST-1' })).length).toBe(0)
  })
})
