import type { ChatLog } from '../types'
import { calcular, inicioDaSemana, porSemana, porTipo, porVersao, variacao } from './metricas'

let n = 0
const log = (o: Partial<ChatLog>): ChatLog => ({ id: ++n, criado_em: '2026-11-24T10:00:00', pergunta: 'p', resposta: 'r', tipo: 'ajuda', fonte_id: null, ferramenta: null, gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 100, voltas: 1, feedback: null, desfecho: null, ...o })

describe('métricas de custo e qualidade', () => {
  it('soma tokens e custo, e conta como acerto o que respondeu sem 👎', () => {
    const m = calcular([
      log({ tokens_entrada: 1000, tokens_saida: 100, custo_usd: 0.00014 }),
      log({ tipo: 'consulta', tokens_entrada: 500, tokens_saida: 50, custo_usd: 0.00007 }),
      log({ tipo: 'nao_encontrou' }),
      log({ feedback: 'negativo' }),
    ])
    expect(m).toMatchObject({ conversas: 4, resolvidas: 2, taxaAcerto: 0.5, tokens: 1650, tokensPorConversa: 413, comModelo: 2, semResposta: 1, negativos: 1 })
    expect(m.custoUsd).toBeCloseTo(0.00021, 6)
  })

  it('registros antigos, sem campos de consumo, contam zero e a lista vazia não quebra', () => {
    expect(calcular([log({})]).tokens).toBe(0)
    expect(calcular([])).toMatchObject({ conversas: 0, taxaAcerto: null, tokensPorConversa: null })
  })

  it('agrupa por tipo, por semana (segunda a domingo) e por versão', () => {
    const logs = [
      log({ criado_em: '2026-11-23T09:00:00', versao: 'aaa1111' }), log({ criado_em: '2026-11-25T09:00:00', tipo: 'consulta', versao: 'aaa1111' }),
      log({ criado_em: '2026-11-30T09:00:00', versao: 'bbb2222', tipo: 'nao_encontrou' }), log({ criado_em: '2026-12-01T09:00:00', versao: 'bbb2222' }),
    ]
    expect(porTipo(logs).map((l) => l.chave)).toEqual(['ajuda', 'consulta', 'nao_encontrou'])
    expect(inicioDaSemana('2026-11-29T12:00:00')).toBe('2026-11-23') // domingo ainda é da semana que começou na segunda 23
    expect(porSemana(logs).map((l) => [l.chave, l.metrica.conversas])).toEqual([['2026-11-30', 2], ['2026-11-23', 2]])
    expect(porVersao(logs).map((l) => l.chave)).toEqual(['bbb2222', 'aaa1111']) // a mais nova primeiro
  })

  it('compara com a versão anterior e só marca como confiável com amostra mínima', () => {
    const muitos = (ok: number, ruins: number) => [...Array(ok).fill(0).map(() => log({})), ...Array(ruins).fill(0).map(() => log({ tipo: 'nao_encontrou' }))]
    const v = variacao(calcular(muitos(9, 1)), calcular(muitos(7, 3)))
    expect(v).toEqual({ acerto: 20, tokensPorConversa: 0, confiavel: true })
    expect(variacao(calcular(muitos(2, 0)), calcular(muitos(7, 3)))?.confiavel).toBe(false)
    expect(variacao(calcular(muitos(9, 1)), undefined)).toBeNull()
  })
})
