import { atrasoDeDigitacao, criarClienteChat, montarContexto, RESPOSTA_INDISPONIVEL } from './chat'

describe('atrasoDeDigitacao', () => {
  it('respostas curtas demoram menos que longas', () => {
    expect(atrasoDeDigitacao('ok', () => 0)).toBeLessThan(atrasoDeDigitacao('a'.repeat(300), () => 0))
  })
  it('fica sempre entre 0,9 s e 2,5 s', () => {
    expect(atrasoDeDigitacao('', () => 0)).toBe(900)
    expect(atrasoDeDigitacao('a'.repeat(5000), () => 1)).toBe(2500)
    for (let i = 0; i < 50; i++) {
      const t = atrasoDeDigitacao('x'.repeat(i * 10))
      expect(t).toBeGreaterThanOrEqual(900)
      expect(t).toBeLessThanOrEqual(2500)
    }
  })
  it('a variação aleatória soma até 400 ms', () => {
    expect(atrasoDeDigitacao('', () => 1) - atrasoDeDigitacao('', () => 0)).toBe(400)
  })
})

const resp = (status: number, json: unknown) => (async () => ({ status, ok: status < 400, json: async () => json }) as Response) as unknown as typeof fetch

describe('cliente do chat', () => {
  it('direto: POST /chat e devolve a resposta', async () => {
    const chamadas: string[] = []
    const f = (async (u: string, i: RequestInit) => {
      chamadas.push(`${i.method} ${u} ${i.body}`)
      return { status: 200, ok: true, json: async () => ({ encontrou: true, resposta: 'Oi', fonte: null, confianca: 1, relacionadas: [] }) }
    }) as unknown as typeof fetch
    const r = await criarClienteChat({ tipo: 'direto', url: 'http://ia/' }, f, 30_000, undefined, () => '2026-11-25').perguntar('Como criar?')
    expect(r.resposta).toBe('Oi')
    expect(chamadas[0]).toBe('POST http://ia/chat {"pergunta":"Como criar?","hoje":"2026-11-25"}')
  })
  it('429 vira aviso de limite', async () => {
    const r = await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, resp(429, {})).perguntar('x')
    expect(r.resposta).toContain('Muitas perguntas')
    expect(r.encontrou).toBe(false)
  })
  it('resposta inesperada ou rede fora viram "indisponível"', async () => {
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, resp(500, { erro: 1 })).perguntar('x')).toEqual(RESPOSTA_INDISPONIVEL)
    const quebrado = (async () => { throw new TypeError('rede') }) as unknown as typeof fetch
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, quebrado).perguntar('x')).toEqual(RESPOSTA_INDISPONIVEL)
  })
  it('laravel: lê sugestões de /chat/sugestoes', async () => {
    const s = await criarClienteChat({ tipo: 'laravel', url: 'http://api' }, resp(200, ['A?', 'B?'])).sugestoes()
    expect(s.sort()).toEqual(['A?', 'B?'])
  })
  it('direto: sugestões vêm de /faq, limitadas a 5', async () => {
    const faq = Array.from({ length: 12 }, (_, i) => ({ pergunta: `P${i}?` }))
    const s = await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, resp(200, faq)).sugestoes()
    expect(s).toHaveLength(5)
    expect(s[0]).toMatch(/^P\d+\?$/)
  })
  it('sugestões voltam vazias se algo falhar', async () => {
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, resp(500, [])).sugestoes()).toEqual([])
    const quebrado = (async () => { throw new Error('x') }) as unknown as typeof fetch
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, quebrado).sugestoes()).toEqual([])
  })
  it('estoura o tempo limite e responde "indisponível"', async () => {
    const lento = ((_u: string, i: RequestInit) => new Promise((_, rej) => i.signal!.addEventListener('abort', () => rej(new Error('abort'))))) as unknown as typeof fetch
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, lento, 20).perguntar('x')).toEqual(RESPOSTA_INDISPONIVEL)
  })
})

describe('contexto da conversa', () => {
  it('perguntar envia historico e ultimo_id quando há contexto', async () => {
    const corpos: string[] = []
    const f = (async (_u: string, i: RequestInit) => {
      corpos.push(String(i.body))
      return { status: 200, ok: true, json: async () => ({ encontrou: true, resposta: 'Oi', fonte: null, confianca: 1, relacionadas: [] }) }
    }) as unknown as typeof fetch
    const cliente = criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, undefined, () => '2026-11-25')
    await cliente.perguntar('mas eu quero excluir', { historico: ['e produtos?'], ultimoId: 'prod-excluir' })
    await cliente.perguntar('oi', { historico: [], ultimoId: null })
    expect(JSON.parse(corpos[0])).toEqual({ pergunta: 'mas eu quero excluir', hoje: '2026-11-25', historico: ['e produtos?'], ultimo_id: 'prod-excluir' })
    expect(JSON.parse(corpos[1])).toEqual({ pergunta: 'oi', hoje: '2026-11-25' })
  })

  it('montarContexto pega as últimas 3 perguntas do usuário e a última resposta da Lumi', () => {
    const msgs = [
      { autor: 'lumi' as const, texto: 'Oi!' },
      { autor: 'usuario' as const, texto: 'p1' },
      { autor: 'lumi' as const, texto: 'r1', fonteId: 'a' },
      { autor: 'usuario' as const, texto: 'p2' },
      { autor: 'lumi' as const, texto: 'r2', fonteId: 'b' },
      { autor: 'usuario' as const, texto: 'p3' },
      { autor: 'usuario' as const, texto: 'p4' },
    ]
    expect(montarContexto(msgs)).toEqual({ historico: ['p2', 'p3', 'p4'], ultimoId: 'b' })
  })

  it('montarContexto: sem conversa ou quando a última resposta não achou nada, não há ultimoId', () => {
    expect(montarContexto([{ autor: 'lumi', texto: 'Oi!' }])).toEqual({ historico: [], ultimoId: null })
    expect(montarContexto([{ autor: 'usuario', texto: 'x' }, { autor: 'lumi', texto: 'não achei', fonteId: null }])).toEqual({ historico: ['x'], ultimoId: null })
  })
})

describe('consultas pedidas pelo assistente (duas voltas)', () => {
  const consulta = { nome: 'consultar_orcamentos', args: { status: 'aprovado' } }
  const pedido = { encontrou: true, resposta: '', fonte: null, confianca: 1, relacionadas: [], consultas: [consulta] }
  const final = { encontrou: true, resposta: 'Você tem 3 orçamentos aprovados.', fonte: null, confianca: 1, relacionadas: [] }

  function servidor(respostas: unknown[]) {
    const corpos: Record<string, unknown>[] = []
    const f = (async (_u: string, i: RequestInit) => {
      corpos.push(JSON.parse(String(i.body)))
      return { status: 200, ok: true, json: async () => respostas[corpos.length - 1] }
    }) as unknown as typeof fetch
    return { f, corpos }
  }

  it('executa a consulta no front e manda o resultado na segunda volta', async () => {
    const { f, corpos } = servidor([pedido, final])
    const executar = vi.fn(async () => ({ total: 3 }))
    const r = await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, executar, () => '2026-11-25').perguntar('quantos aprovados?', { historico: ['oi'] })
    expect(r.resposta).toBe('Você tem 3 orçamentos aprovados.')
    expect(executar).toHaveBeenCalledWith(consulta)
    expect(corpos[0].resultados).toBeUndefined()
    expect(corpos[1]).toEqual({ pergunta: 'quantos aprovados?', hoje: '2026-11-25', historico: ['oi'], resultados: [{ ...consulta, resultado: { total: 3 } }] })
  })

  it('se a consulta falha, avisa o modelo em vez de inventar', async () => {
    const { f, corpos } = servidor([pedido, final])
    await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, async () => { throw new Error('rede') }).perguntar('quantos?')
    expect((corpos[1].resultados as { resultado: unknown }[])[0].resultado).toEqual({ erro: 'não foi possível consultar agora' })
  })

  it('sem executor, um pedido de consulta vira "indisponível"', async () => {
    const { f, corpos } = servidor([pedido])
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f).perguntar('quantos?')).toEqual(RESPOSTA_INDISPONIVEL)
    expect(corpos).toHaveLength(1)
  })

  it('só faz uma segunda volta: se pedir consulta de novo, desiste', async () => {
    const { f, corpos } = servidor([pedido, pedido, pedido])
    expect(await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, async () => ({})).perguntar('quantos?')).toEqual(RESPOSTA_INDISPONIVEL)
    expect(corpos).toHaveLength(2)
  })

  it('no máximo 3 consultas por volta', async () => {
    const muitas = { ...pedido, consultas: Array.from({ length: 6 }, () => consulta) }
    const { f } = servidor([muitas, final])
    const executar = vi.fn(async () => ({}))
    await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, executar).perguntar('x?')
    expect(executar).toHaveBeenCalledTimes(3)
  })

  it('ações (cadastro, exclusão) não disparam segunda volta: seguem para o chat montar o cartão', async () => {
    const acao = { ...final, resposta: 'Abri o cadastro.', acoes: [{ nome: 'cadastrar_cliente', args: { nome: 'Ana' } }] }
    const { f, corpos } = servidor([acao])
    const r = await criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f, 30_000, async () => ({})).perguntar('cadastra a Ana')
    expect(r.acoes).toEqual(acao.acoes)
    expect(corpos).toHaveLength(1)
  })
})
