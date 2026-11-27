import { montarRegistro, normalizarPergunta, pendentesDeResposta, quantasVezesPerguntaram, resumirLogs, sugerirPergunta, tipoDaResposta } from './logs'
import type { ChatLog, FaqItem, RespostaChat } from '../types'

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

describe('perguntas sem resposta (tela do master)', () => {
  const log = (id: number, pergunta: string, extra: Partial<ChatLog> = {}): ChatLog => ({
    id, criado_em: '2026-11-25T10:00:00Z', pergunta, resposta: 'Não encontrei', tipo: 'nao_encontrou', fonte_id: null, ferramenta: null,
    gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 10, voltas: 1, feedback: null, desfecho: null, ...extra,
  })
  const faq: FaqItem[] = [{ id: 1, modulo: 'Acesso', pergunta: 'Como adicionar uma pessoa?', resposta: 'x', palavras_chave: ['adiciono pessoa no sistema'], criado_em: '' }]

  it('normaliza acento, caixa e pontuação', () => {
    expect(normalizarPergunta('  Como ADICIONO uma pessoa?! ')).toBe('como adiciono uma pessoa')
    expect(normalizarPergunta('Orçamento é aprovação')).toBe('orcamento e aprovacao')
  })

  it('só pendem as sem resposta que não foram ignoradas nem respondidas', () => {
    const logs = [
      log(1, 'como faço backup?'),
      log(2, 'Adiciono pessoa no sistema!'),            // já respondida (palavra-chave)
      log(3, 'receita de bolo', { desfecho: 'ignorado' }),
      log(4, 'como criar um orçamento', { tipo: 'ajuda' }), // achou resposta: não é pendência
      log(5, 'como faço backup'),                        // repetida da 1
    ]
    expect(pendentesDeResposta(logs, faq).map((l) => l.id)).toEqual([1, 5])
  })

  it('conta quantas vezes a mesma pergunta apareceu', () => {
    const logs = [log(1, 'Como faço backup?'), log(2, 'como faco backup'), log(3, 'outra')]
    expect(quantasVezesPerguntaram(logs, 'como faço backup')).toBe(2)
  })

  it('sugere a pergunta com maiúscula e interrogação', () => {
    expect(sugerirPergunta('como adiciono uma pessoa no sistema')).toBe('Como adiciono uma pessoa no sistema?')
    expect(sugerirPergunta('  já tem "?"?? ')).toBe('Já tem "?"?')
    expect(sugerirPergunta('   ')).toBe('')
  })
})

import { respondeuSemDados } from './logs'

describe('consulta que não achou nada conta como pergunta sem resposta', () => {
  it('reconhece as frases de "não achei" e não confunde com resposta boa', () => {
    expect(respondeuSemDados('Não encontrei essa informação nos dados consultados.')).toBe(true)
    expect(respondeuSemDados('Não consegui encontrar clientes nesse período.')).toBe(true)
    expect(respondeuSemDados('Você tem 12 clientes. Nenhum deles é de Sobral.')).toBe(false)
    expect(respondeuSemDados('Você tem 0 orçamentos aprovados.')).toBe(false)
  })
  it('uma consulta com essa resposta vira nao_encontrou; com dados, continua consulta', () => {
    const r = { encontrou: true, resposta: '', fonte: null, confianca: 1, relacionadas: [], ferramentas: ['consultar_clientes'], voltas: 2 } as never
    expect(tipoDaResposta(r, 'Não encontrei essa informação nos dados consultados.')).toBe('nao_encontrou')
    expect(tipoDaResposta(r, 'Você tem 8 clientes.')).toBe('consulta')
  })
})

describe('pergunta impossível', () => {
  it('conta como ajuda respondida, não como pergunta sem resposta para os Agents', () => {
    expect(tipoDaResposta({ impossivel: true, encontrou: true } as never, 'Não consigo responder isso: o sistema não guarda cidade.')).toBe('ajuda')
  })
})
