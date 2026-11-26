import { criarApiLocal } from '../api/local'
import { HOJE, memoria } from '../test/utils'
import { criarClienteChat, RESPOSTA_INDISPONIVEL } from './chat'
import { executarConsulta, executarGravacoes, permissaoDaChamada } from './ferramentas'
import { ferramentaDaResposta, tipoDaResposta } from './logs'

const nova = () => criarApiLocal({ storage: memoria(), agora: () => HOJE, protegida: false })
const consulta = (api: ReturnType<typeof nova>, nome: string, args: Record<string, unknown>) => executarConsulta(api, { nome, args })

describe('leituras do agente', () => {
  it('localizar_clientes acha por todas as palavras, em qualquer ordem, sem acento nem caixa', async () => {
    const api = nova()
    expect(await consulta(api, 'localizar_clientes', { busca: 'aurora cerimonial' })).toEqual({ linhas: [{ id: 2, nome: 'Cerimonial Aurora', cidade: expect.anything() }] })
    expect(((await consulta(api, 'localizar_clientes', { busca: 'cerimonial' })) as { linhas: unknown[] }).linhas).toHaveLength(1)
    expect(await consulta(api, 'localizar_clientes', { busca: 'ninguém existe' })).toEqual({ linhas: [] })
    expect(await consulta(api, 'localizar_clientes', { busca: '   ' })).toEqual({ linhas: [] })
  })

  it('localizar_produtos devolve id e preço por busca, só de produtos ativos', async () => {
    const api = nova()
    const r = (await consulta(api, 'localizar_produtos', { buscas: ['refletor led', 'xyz'] })) as { itens: { busca: string; linhas: { id: number; valor_diaria: number }[] }[] }
    expect(r.itens[0].linhas[0]).toMatchObject({ id: 1, valor_diaria: 85 })
    expect(r.itens[1]).toEqual({ busca: 'xyz', linhas: [] })
    await api.produtos.atualizar(1, { ...(await api.produtos.listar()).find((p) => p.id === 1)!, ativo: false })
    expect(((await consulta(api, 'localizar_produtos', { buscas: ['refletor led'] })) as { itens: { linhas: unknown[] }[] }).itens[0].linhas).toEqual([])
  })

  it('verificar_disponibilidade avisa quando o pedido passa do estoque e não avisa quando cabe', async () => {
    const api = nova()
    const faltas = (qtd: number) => consulta(api, 'verificar_disponibilidade', { retirada: '2027-03-01', devolucao: '2027-03-02', itens: [{ produto_id: 3, quantidade: qtd }] })
    expect(await faltas(1)).toEqual({ faltas: [] })
    expect(await faltas(100)).toEqual({ faltas: [{ produto: 'Moving Head Beam 230', solicitado: 100, disponivel: 8 }] })
  })

  it('permissões: cada ferramenta do agente exige a permissão da tela correspondente', () => {
    const p = (nome: string) => permissaoDaChamada({ nome, args: {} })
    expect([p('localizar_clientes'), p('localizar_produtos'), p('verificar_disponibilidade'), p('criar_cliente'), p('criar_orcamento')]).toEqual(['clientes.ver', 'produtos.ver', 'orcamentos.ver', 'clientes.criar', 'orcamentos.criar'])
  })
})

describe('gravações do agente (só depois do "sim")', () => {
  const orcamento = (extra: Record<string, unknown> = {}) => ({ nome: 'criar_orcamento', args: { cliente_id: 1, cliente_novo: false, evento: 'Evento do Agente', data_retirada: '2026-11-26', data_devolucao: '2026-11-26', desconto: 0, observacoes: '', itens: [{ produto_id: 1, quantidade: 2 }], ...extra } })

  it('cria o orçamento como rascunho pela mesma API das telas', async () => {
    const api = nova()
    const r = await executarGravacoes(api, [orcamento()])
    expect(r.ok).toBe(true)
    expect(r.texto).toMatch(/Orçamento .* criado como rascunho/)
    expect((await api.orcamentos.listar({ busca: 'Evento do Agente' }))[0]).toMatchObject({ status: 'rascunho', cliente_id: 1, total: 170 })
  })

  it('cadastra o cliente novo e usa o id dele no orçamento', async () => {
    const api = nova()
    const r = await executarGravacoes(api, [{ nome: 'criar_cliente', args: { nome: 'João Victor', tipo: 'PF', telefone: '(85) 98888-7777', documento: null, email: null, cidade: 'Fortaleza' } }, orcamento({ cliente_id: null, cliente_novo: true })])
    expect(r.ok).toBe(true)
    const novo = (await api.clientes.listar('João Victor'))[0]
    expect(novo).toMatchObject({ nome: 'João Victor', tipo: 'PF', cidade: 'Fortaleza' })
    expect((await api.orcamentos.listar({ busca: 'Evento do Agente' }))[0].cliente_id).toBe(novo.id)
  })

  it('segue as regras da API: erro vira mensagem e o que já foi feito é dito', async () => {
    const api = nova()
    const r = await executarGravacoes(api, [{ nome: 'criar_cliente', args: { nome: 'Cliente Novo', tipo: 'PF' } }, orcamento({ cliente_id: null, cliente_novo: true, itens: [] })])
    expect(r.ok).toBe(false)
    expect(r.texto).toContain('Cliente “Cliente Novo” cadastrado.')
    expect(r.texto).toContain('Não consegui concluir')
    expect(await api.orcamentos.listar({ busca: 'Evento do Agente' })).toHaveLength(0)
  })

  it('ignora o que não conhece', async () => {
    expect((await executarGravacoes(nova(), [{ nome: 'apagar_tudo', args: {} }])).texto).toBe('Nada para criar.')
  })
})

describe('chat com o agente (várias voltas)', () => {
  const pedido = (n: string) => ({ encontrou: true, resposta: '', fonte: null, confianca: 1, relacionadas: [], agente: { passo: n }, consultas: [{ nome: n === 'a' ? 'localizar_clientes' : 'verificar_disponibilidade', args: {} }] })
  const resumo = { encontrou: true, resposta: 'Resumo', fonte: null, confianca: 1, relacionadas: [], agente: { passo: 'confirmar' }, opcoes: ['Confirmar', 'Cancelar'] }

  function servidor(respostas: unknown[]) {
    const corpos: Record<string, unknown>[] = []
    const f = (async (_u: string, i: RequestInit) => {
      corpos.push(JSON.parse(String(i.body)))
      return { status: 200, ok: true, json: async () => respostas[Math.min(corpos.length - 1, respostas.length - 1)] }
    }) as unknown as typeof fetch
    return { f, corpos }
  }

  it('devolve o estado do agente com os resultados a cada volta e para quando não pede mais nada', async () => {
    const { f, corpos } = servidor([pedido('a'), pedido('b'), resumo])
    const executar = vi.fn(async () => ({ linhas: [] }))
    const r = await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, executar, () => '2026-11-25').perguntar('crie um orçamento', { historico: [] })
    expect(r.opcoes).toEqual(['Confirmar', 'Cancelar'])
    expect(r.voltas).toBe(3)
    expect(r.ferramentas).toEqual(['localizar_clientes', 'verificar_disponibilidade'])
    expect(corpos[1]).toMatchObject({ agente: { passo: 'a' }, resultados: [{ nome: 'localizar_clientes', resultado: { linhas: [] } }] })
    expect(corpos[2]).toMatchObject({ agente: { passo: 'b' } })
  })

  it('manda o estado da conversa do agente junto da mensagem seguinte', async () => {
    const { f, corpos } = servidor([resumo])
    await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f).perguntar('sim', { historico: [], agente: { passo: 'confirmar' } })
    expect(corpos[0]).toMatchObject({ pergunta: 'sim', agente: { passo: 'confirmar' } })
  })

  it('um agente que nunca para de pedir consulta não prende o chat', async () => {
    const { f, corpos } = servidor([pedido('a')])
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, async () => ({})).perguntar('crie um orçamento')).toEqual(RESPOSTA_INDISPONIVEL)
    expect(corpos.length).toBeLessThanOrEqual(7)
  })

  it('consulta que o usuário não pode fazer chega ao agente como erro de permissão', async () => {
    const { f, corpos } = servidor([pedido('a'), resumo])
    await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, async () => { throw Object.assign(new Error('x'), { status: 403 }) }).perguntar('crie um orçamento')
    expect((corpos[1].resultados as { resultado: unknown }[])[0].resultado).toEqual({ erro: 'o usuário não tem permissão para ver estes dados' })
  })

  it('o registro de conversas marca o agente como cadastro e a ferramenta do fluxo', () => {
    const base = { encontrou: true, resposta: '', fonte: null, confianca: 1, relacionadas: [] }
    expect(tipoDaResposta({ ...base, agente: { fluxo: 'orcamento' }, voltas: 2, ferramentas: ['localizar_clientes'] }, 'x')).toBe('cadastro')
    expect(ferramentaDaResposta({ ...base, agente: { fluxo: 'orcamento' }, ferramentas: ['localizar_clientes'] })).toBe('agente_orcamento')
    expect(ferramentaDaResposta({ ...base, agente: { fluxo: 'cliente' } })).toBe('agente_cliente')
    expect(ferramentaDaResposta({ ...base, executar: [{ nome: 'criar_cliente', args: {} }, { nome: 'criar_orcamento', args: {} }] })).toBe('criar_orcamento')
    expect(tipoDaResposta({ ...base, executar: [{ nome: 'criar_orcamento', args: {} }] }, 'x')).toBe('cadastro')
  })
})
