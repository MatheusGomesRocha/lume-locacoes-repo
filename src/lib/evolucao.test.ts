import { estatisticasEvolucao } from './evolucao'
import type { RelatorioEvolucao } from '../types'

const rel = (id: string, status: RelatorioEvolucao['status'], veredito: RelatorioEvolucao['veredito'], em: string, pacote = true) =>
  ({ id, titulo: id, decisao_do_analista: 'criar_consulta', perguntas: [id], vezes: 1, status, veredito, texto: '', ativa: status === 'aprovada', decisao: status === 'pendente' ? null : { por: 'M', em }, criado_em: em, pacote: pacote ? { spec: {} } : null, avaliacao: null }) as unknown as RelatorioEvolucao

describe('estatísticas dos Agents', () => {
  it('sem nada decidido, não há taxa', () => {
    expect(estatisticasEvolucao([])).toMatchObject({ decididas: 0, taxaAprovacao: null, aprovadasSeguidas: 0 })
    expect(estatisticasEvolucao([rel('1', 'pendente', 'aprovar_recomendado', '2026-11-01')]).pendentes).toBe(1)
  })

  it('conta aprovadas, reprovadas, a taxa e as aprovações seguidas mais recentes', () => {
    const e = estatisticasEvolucao([
      rel('1', 'reprovada', 'reprovar_recomendado', '2026-11-01T10:00'), rel('2', 'aprovada', 'aprovar_recomendado', '2026-11-02T10:00'),
      rel('3', 'aprovada', 'revisar_com_atencao', '2026-11-03T10:00'), rel('4', 'aprovada', 'aprovar_recomendado', '2026-11-04T10:00'),
      rel('5', 'pendente', 'aprovar_recomendado', '2026-11-05T10:00'), rel('6', 'pendente', null, '2026-11-05T10:00', false),
    ])
    expect(e).toMatchObject({ comConsulta: 5, semConsulta: 1, pendentes: 1, aprovadas: 3, reprovadas: 1, decididas: 4, aprovadasSeguidas: 3 })
    expect(e.taxaAprovacao).toBe(0.75)
  })

  it('uma reprovação recente zera a sequência, e o Master discordar do Tester aparece', () => {
    const e = estatisticasEvolucao([rel('1', 'aprovada', 'aprovar_recomendado', '2026-11-01'), rel('2', 'reprovada', 'aprovar_recomendado', '2026-11-02')])
    expect(e.aprovadasSeguidas).toBe(0)
    expect(e.concordouComTester).toBe(1) // aprovou a 1 (concordou); reprovou a 2 contra a recomendação (discordou)
  })
})
