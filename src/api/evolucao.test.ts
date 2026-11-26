import { MASTER_EMAIL, SENHA_DEMO } from './acesso'
import { criarApiLocal } from './local'
import { ApiError } from './tipos'
import { HOJE, memoria } from '../test/utils'

const SPEC = {
  nome: 'contar_clientes_por_cidade', entidade: 'clientes', operacao: 'contar', permissao: 'clientes.ver',
  parametros: { cidade: { tipo: 'texto', obrigatorio: true } }, filtros: [{ campo: 'cidade', op: 'igual', parametro: 'cidade' }],
  exemplos: ['quantos clientes em fortaleza', 'clientes de sobral', 'total de clientes por cidade'],
}
const relatorio = (o = {}) => ({ id: 'EV-0001', titulo: 'Clientes por cidade', decisao_do_analista: 'criar_consulta', perguntas: ['quantos clientes tenho em Fortaleza?'], vezes: 2, status: 'pendente', veredito: 'aprovar_recomendado', texto: '# EV-0001', proposta: { entidade: 'clientes' }, pacote: { spec: SPEC }, avaliacao: null, ...o })
const log = (pergunta: string) => ({ pergunta, resposta: 'não sei', tipo: 'nao_encontrou' as const, fonte_id: null, ferramenta: null, gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 10, voltas: 1 })
const falhaCom = async (p: Promise<unknown>, status: number) => {
  const e = await p.then(() => null, (x) => x)
  expect(e).toBeInstanceOf(ApiError)
  expect((e as ApiError).status).toBe(status)
  return e as ApiError
}

function montar(respostas: { propor?: object | number; checar?: object } = {}) {
  const chamadas: { url: string; corpo: Record<string, unknown> }[] = []
  const buscar = (async (url: string, init: RequestInit) => {
    chamadas.push({ url, corpo: JSON.parse(String(init.body)) })
    if (url.endsWith('/evolucao/propor')) {
      if (typeof respostas.propor === 'number') return new Response(JSON.stringify({ detail: 'sem modelo' }), { status: respostas.propor })
      return new Response(JSON.stringify(respostas.propor ?? { relatorios: [relatorio()] }))
    }
    return new Response(JSON.stringify(respostas.checar ?? { bloqueio: false, achados: [] }))
  }) as unknown as typeof fetch
  const api = criarApiLocal({ storage: memoria(), agora: () => HOJE, iaUrl: 'http://ia', buscar })
  return { api, chamadas }
}
const masterCom = async (r = {}) => { const m = montar(r); await m.api.auth.entrar(MASTER_EMAIL, SENHA_DEMO); return m }

describe('evolução assistida (demonstração)', () => {
  it('sem perguntas sem resposta nem chama a IA', async () => {
    const { api, chamadas } = await masterCom()
    expect(await api.evolucao.analisar()).toEqual({ novos: [], semPerguntas: true })
    expect(chamadas).toHaveLength(0)
  })

  it('analisa as perguntas sem resposta e guarda a proposta como pendente (nada ativo)', async () => {
    const { api, chamadas } = await masterCom()
    await api.chatLogs.registrar(log('quantos clientes tenho em Fortaleza?'))
    await api.chatLogs.registrar(log('Quantos clientes tenho em Fortaleza'))
    const r = await api.evolucao.analisar()
    expect(r.novos).toHaveLength(1)
    expect(chamadas[0].corpo.perguntas).toEqual([{ pergunta: 'quantos clientes tenho em Fortaleza?', tipo: 'dados', vezes: 2 }])
    expect((await api.evolucao.listar())[0].status).toBe('pendente')
    expect(await api.evolucao.catalogo()).toEqual([])
  })

  it('não analisa de novo a pergunta que já tem proposta', async () => {
    const { api } = await masterCom()
    await api.chatLogs.registrar(log('quantos clientes tenho em Fortaleza?'))
    await api.evolucao.analisar()
    expect((await api.evolucao.analisar()).semPerguntas).toBe(true)
  })

  it('aprovar refaz as checagens, ativa a consulta e registra quem decidiu', async () => {
    const { api, chamadas } = await masterCom()
    await api.chatLogs.registrar(log('quantos clientes tenho em Fortaleza?'))
    await api.evolucao.analisar()
    const r = await api.evolucao.decidir('EV-0001', true)
    expect(r).toMatchObject({ status: 'aprovada', ativa: true })
    expect(r.decisao?.por).toBeTruthy()
    expect(chamadas.at(-1)?.url).toContain('/evolucao/checar')
    expect((await api.evolucao.catalogo()).map((s) => s.nome)).toEqual(['contar_clientes_por_cidade'])
    await falhaCom(api.evolucao.decidir('EV-0001', false), 422) // já decidida
  })

  it('bloqueio nas checagens refeitas impede a aprovação', async () => {
    const { api } = await masterCom({ checar: { bloqueio: true, achados: [{ gravidade: 'bloqueio', mensagem: 'campo secreto' }] } })
    await api.chatLogs.registrar(log('quantos clientes tenho em Fortaleza?'))
    await api.evolucao.analisar()
    const e = await falhaCom(api.evolucao.decidir('EV-0001', true), 422)
    expect(e.message).toContain('campo secreto')
    expect(await api.evolucao.catalogo()).toEqual([])
  })

  it('o Tester recomendando reprovar: só dá para reprovar', async () => {
    const { api } = await masterCom({ propor: { relatorios: [relatorio({ veredito: 'reprovar_recomendado' })] } })
    await api.chatLogs.registrar(log('quantos clientes tenho em Fortaleza?'))
    await api.evolucao.analisar()
    await falhaCom(api.evolucao.decidir('EV-0001', true), 422)
    expect((await api.evolucao.decidir('EV-0001', false)).status).toBe('reprovada')
    expect(await api.evolucao.catalogo()).toEqual([])
  })

  it('desativar tira a consulta do catálogo', async () => {
    const { api } = await masterCom()
    await api.chatLogs.registrar(log('quantos clientes tenho em Fortaleza?'))
    await api.evolucao.analisar()
    await api.evolucao.decidir('EV-0001', true)
    await api.evolucao.desativar('EV-0001')
    expect(await api.evolucao.catalogo()).toEqual([])
    expect((await api.evolucao.listar())[0]).toMatchObject({ status: 'aprovada', ativa: false })
  })

  it('IA fora do ar: erro claro e nada é guardado', async () => {
    const { api } = await masterCom({ propor: 503 })
    await api.chatLogs.registrar(log('quantos clientes tenho em Fortaleza?'))
    const e = await falhaCom(api.evolucao.analisar(), 503)
    expect(e.message).toContain('sem modelo')
    expect(await api.evolucao.listar()).toEqual([])
  })

  it('sem login ninguém mexe (401)', async () => {
    const { api } = montar()
    await falhaCom(api.evolucao.listar(), 401)
    await falhaCom(api.evolucao.catalogo(), 401)
  })
})
