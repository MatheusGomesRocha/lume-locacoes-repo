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
    const r = await criarClienteChat({ tipo: 'direto', url: 'http://ia/' }, f).perguntar('Como criar?')
    expect(r.resposta).toBe('Oi')
    expect(chamadas[0]).toBe('POST http://ia/chat {"pergunta":"Como criar?"}')
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
    const cliente = criarClienteChat({ tipo: 'direto', url: 'http://ia' }, f)
    await cliente.perguntar('mas eu quero excluir', { historico: ['e produtos?'], ultimoId: 'prod-excluir' })
    await cliente.perguntar('oi', { historico: [], ultimoId: null })
    expect(JSON.parse(corpos[0])).toEqual({ pergunta: 'mas eu quero excluir', historico: ['e produtos?'], ultimo_id: 'prod-excluir' })
    expect(JSON.parse(corpos[1])).toEqual({ pergunta: 'oi' })
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
