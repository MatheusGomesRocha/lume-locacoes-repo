import { criarApiHttp } from './http'
import { ApiError } from './tipos'

function falso(resposta: { status?: number; json?: unknown } | Error) {
  const chamadas: { url: string; init: RequestInit }[] = []
  const fn = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, init })
    if (resposta instanceof Error) throw resposta
    return { status: resposta.status ?? 200, ok: (resposta.status ?? 200) < 400, json: async () => resposta.json ?? {} } as Response
  }) as unknown as typeof fetch
  return { api: criarApiHttp('http://x/api/', fn), chamadas }
}

describe('driver http', () => {
  it('monta a URL sem barra dupla e envia Accept JSON', async () => {
    const { api, chamadas } = falso({ json: [] })
    await api.clientes.listar()
    expect(chamadas[0].url).toBe('http://x/api/clientes')
    expect((chamadas[0].init.headers as Record<string, string>).Accept).toBe('application/json')
    expect(api.modo).toBe('http')
  })
  it('envia filtros na query string e ignora os vazios', async () => {
    const { api, chamadas } = falso({ json: [] })
    await api.orcamentos.listar({ busca: 'maria', status: '' })
    await api.produtos.listar({ categoria: 'Som', ativo: false })
    await api.pagamentos.listar('atrasado')
    await api.pagamentos.listar('todos')
    expect(chamadas.map((c) => c.url)).toEqual([
      'http://x/api/orcamentos?q=maria', 'http://x/api/produtos?categoria=Som&ativo=false', 'http://x/api/pagamentos?status=atrasado', 'http://x/api/pagamentos',
    ])
  })
  it('envia corpo JSON com Content-Type e usa o método certo', async () => {
    const { api, chamadas } = falso({ json: {} })
    await api.pagamentos.baixar(7, '2026-11-10', 'pix')
    await api.orcamentos.aprovar(3)
    await api.clientes.atualizar(2, { nome: 'A' } as never)
    expect(chamadas[0]).toMatchObject({ url: 'http://x/api/pagamentos/7/baixar', init: { method: 'POST', body: '{"pago_em":"2026-11-10","forma":"pix"}' } })
    expect((chamadas[0].init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
    expect(chamadas[1].url).toBe('http://x/api/orcamentos/3/aprovar')
    expect(chamadas[2].init.method).toBe('PUT')
  })
  it('204 devolve vazio', async () => {
    const { api } = falso({ status: 204 })
    await expect(api.clientes.excluir(1)).resolves.toBeUndefined()
  })
  it('erro de validação usa a primeira mensagem do campo', async () => {
    const { api } = falso({ status: 422, json: { message: 'The given data was invalid.', errors: { nome: ['O campo nome é obrigatório.'] } } })
    const erro = (await api.clientes.criar({} as never).catch((e) => e)) as ApiError
    expect(erro).toBeInstanceOf(ApiError)
    expect(erro.message).toBe('O campo nome é obrigatório.')
    expect(erro.status).toBe(422)
    expect(erro.campos.nome).toHaveLength(1)
  })
  it('erro de regra traz mensagem e detalhes de estoque', async () => {
    const detalhes = [{ produto_id: 1, codigo: 'LUZ-1', produto: 'Refletor', solicitado: 2, disponivel: 1 }]
    const { api } = falso({ status: 422, json: { message: 'Não há estoque suficiente para o período do orçamento.', detalhes } })
    const erro = (await api.orcamentos.aprovar(1).catch((e) => e)) as ApiError
    expect(erro.message).toContain('estoque')
    expect(erro.detalhes).toEqual(detalhes)
  })
  it('erro sem corpo conhecido usa mensagem padrão', async () => {
    const { api } = falso({ status: 500, json: {} })
    expect(((await api.dashboard().catch((e) => e)) as ApiError).message).toBe('Algo deu errado. Tente novamente.')
  })
  it('falha de rede vira erro amigável com status 0', async () => {
    const { api } = falso(new TypeError('Failed to fetch'))
    const erro = (await api.dashboard().catch((e) => e)) as ApiError
    expect(erro.status).toBe(0)
    expect(erro.message).toContain('conectar ao servidor')
  })
})
