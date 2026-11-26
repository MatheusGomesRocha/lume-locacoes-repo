import { montarRegistro, resumirLogs, tipoDaResposta } from './logs'
import type { ChatLog, RespostaChat } from '../types'

const base: RespostaChat = { encontrou: true, resposta: 'x', fonte: { id: 'faq-1', pergunta: 'P' } as RespostaChat['fonte'], confianca: 0.9, relacionadas: [] }

describe('tipoDaResposta', () => {
  it('classifica pelo que a API devolveu', () => {
    expect(tipoDaResposta(base, 'x')).toBe('ajuda')
    expect(tipoDaResposta({ ...base, encontrou: false, fonte: null }, 'Não encontrei')).toBe('nao_encontrou')
    expect(tipoDaResposta({ ...base, voltas: 2, ferramentas: ['resumo_painel'] }, 'x')).toBe('consulta')
    expect(tipoDaResposta({ ...base, acoes: [{ nome: 'cadastrar_cliente', args: {} }] }, 'x')).toBe('cadastro')
    expect(tipoDaResposta({ ...base, acoes: [{ nome: 'excluir_registro', args: {} }] }, 'x')).toBe('exclusao')
    expect(tipoDaResposta({ encontrou: false, resposta: '', fonte: null, confianca: 0, relacionadas: [] }, 'O assistente está indisponível')).toBe('erro')
  })
})

describe('montarRegistro', () => {
  it('corta textos longos e não leva dados das consultas', () => {
    const r = montarRegistro('p'.repeat(900), { ...base, voltas: 2, gerada_por_llm: true }, 'r'.repeat(900), 123.6, 'resumo_painel', 'consulta')
    expect(r.pergunta).toHaveLength(500)
    expect(r.resposta).toHaveLength(600)
    expect(r).toMatchObject({ latencia_ms: 124, voltas: 2, gerada_por_llm: true, ferramenta: 'resumo_painel', fonte_id: 'faq-1' })
    expect(Object.keys(r)).not.toContain('resultados')
  })
})

describe('resumirLogs', () => {
  const log = (o: Partial<ChatLog>): ChatLog => ({ id: 1, criado_em: '', pergunta: '', resposta: '', tipo: 'ajuda', fonte_id: null, ferramenta: null, gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 100, voltas: 1, feedback: null, desfecho: null, ...o })
  it('soma tipos, cache, falhas, tempos e avaliações', () => {
    const r = resumirLogs([log({}), log({ tipo: 'nao_encontrou', latencia_ms: 300 }), log({ em_cache: true, feedback: 'positivo' }), log({ gerada_por_llm: true, feedback: 'negativo', tipo: 'erro' })])
    expect(r).toMatchObject({ total: 4, emCache: 1, comModelo: 1, semResposta: 2, positivos: 1, negativos: 1, latenciaMediaMs: 150 })
    expect(r.porTipo.nao_encontrou).toBe(1)
  })
  it('lista vazia não quebra', () => {
    expect(resumirLogs([])).toMatchObject({ total: 0, latenciaMediaMs: null, latenciaP95Ms: null })
  })
})
