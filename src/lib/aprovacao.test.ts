import { MINIMO_COMPARADAS, comparar, resumoDaAprovacao } from './aprovacao'
import type { RelatorioEvolucao, RevisaoEvolucao } from '../types'

const rev = (decisao: RevisaoEvolucao['decisao']): RevisaoEvolucao => ({ decisao, motivo: '', condicoes: [], risco: null, parecer_do_modelo: null })
const rel = (status: RelatorioEvolucao['status'], agente: RevisaoEvolucao['decisao'] | null, extra: Partial<RelatorioEvolucao> = {}): RelatorioEvolucao =>
  ({ id: 'EV-1', titulo: 't', decisao_do_analista: 'criar_consulta', perguntas: [], vezes: 1, status, veredito: null, texto: '', pacote: null, avaliacao: null, ativa: false, criado_em: '', revisao: agente ? rev(agente) : null, ...extra })

describe('comparação do Agent de Aprovação com a decisão do master', () => {
  it('classifica cada combinação', () => {
    expect(comparar(rel('aprovada', 'aprovar'))).toBe('concordou')
    expect(comparar(rel('reprovada', 'deixar_pendente'))).toBe('concordou')
    expect(comparar(rel('reprovada', 'reprovar'))).toBe('concordou')
    expect(comparar(rel('aprovada', 'deixar_pendente'))).toBe('conservadora')
    expect(comparar(rel('aprovada', 'reprovar'))).toBe('conservadora')
    expect(comparar(rel('reprovada', 'aprovar'))).toBe('perigosa')
    expect(comparar(rel('pendente', 'aprovar'))).toBe('aguardando')
  })

  it('sem parecer, ou aprovada pelo próprio Agent, não há o que comparar', () => {
    expect(comparar(rel('aprovada', null))).toBeNull()
    expect(comparar(rel('aprovada', 'aprovar', { auto_aprovada: true }))).toBeNull()
  })
})

describe('resumo e critério para liberar o modo automático', () => {
  const muitas = (n: number, status: 'aprovada' | 'reprovada', agente: RevisaoEvolucao['decisao']) => Array.from({ length: n }, () => rel(status, agente))

  it('só fica pronto com amostra suficiente, concordância alta e nenhuma discordância perigosa', () => {
    const bom = resumoDaAprovacao([...muitas(15, 'aprovada', 'aprovar'), ...muitas(15, 'reprovada', 'deixar_pendente')])
    expect(bom).toMatchObject({ comparadas: 30, concordaram: 30, perigosas: 0, taxa: 1, pronto: true, faltam: [] })
    const perigo = resumoDaAprovacao([...muitas(15, 'aprovada', 'aprovar'), ...muitas(14, 'reprovada', 'deixar_pendente'), ...muitas(1, 'reprovada', 'aprovar')])
    expect(perigo.pronto).toBe(false)
    expect(perigo.faltam.join(' ')).toContain('perigosa')
  })

  it('poucos casos, ou nenhuma aprovação do master para medir, não bastam', () => {
    const pouco = resumoDaAprovacao(muitas(5, 'aprovada', 'aprovar'))
    expect(pouco.pronto).toBe(false)
    expect(pouco.faltam.join(' ')).toContain(String(MINIMO_COMPARADAS - 5))
    const semAprovacoes = resumoDaAprovacao(muitas(40, 'reprovada', 'reprovar'))
    expect(semAprovacoes.pronto).toBe(false)
    expect(semAprovacoes.faltam.join(' ')).toContain('aprovada(s) por você')
  })

  it('concordância abaixo de 90% não libera, mesmo sem perigosas', () => {
    const r = resumoDaAprovacao([...muitas(10, 'aprovada', 'aprovar'), ...muitas(10, 'aprovada', 'deixar_pendente'), ...muitas(10, 'reprovada', 'reprovar')])
    expect(r).toMatchObject({ conservadoras: 10, perigosas: 0, pronto: false })
    expect(r.faltam.join(' ')).toContain('concordância')
  })

  it('conta as aprovações automáticas e as sorteadas para conferir', () => {
    const r = resumoDaAprovacao([rel('aprovada', 'aprovar', { auto_aprovada: true, amostra: true }), rel('aprovada', 'aprovar', { auto_aprovada: true }), rel('pendente', 'aprovar')])
    expect(r).toMatchObject({ autoAprovadas: 2, paraConferir: 1, aguardandoVoce: 1, comparadas: 0 })
  })
})
