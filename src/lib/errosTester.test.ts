import { describe, expect, it } from 'vitest'
import { errosDoTester } from './errosTester'
import type { RelatorioEvolucao } from '../types'

const rel = (texto: string): RelatorioEvolucao => ({ id: 'EV-0001', titulo: 'x', decisao_do_analista: 'criar_consulta', perguntas: [], vezes: 1, status: 'pendente', veredito: 'revisar_com_atencao', texto, pacote: null, avaliacao: null, ativa: false, criado_em: '2026-11-26T10:00:00Z' })

describe('errosDoTester', () => {
  it('separa caso que falhou, correção do código, dúvida do Tester e aviso do revisor', () => {
    const e = errosDoTester([rel([
      '- ✅ [codigo] tudo certo', '- ❌ [tester_llm] burla → esperado {a}, obtido {b}', '- ❌ C09 · Filtros e parâmetros coerentes',
      '- 🔧 corrigido: “x”: rotulou como busca', '- 🗑️ descartado: “y”: sem esperado', '- ⚠️ T02: o Tester esperava 1', '- ⚠️ REV: Revisor (modelo), confira', '- ⛔ C09: o parâmetro dias é numero',
    ].join('\n'))])
    expect(e.map((x) => x.tipo)).toEqual(['caso_falhou', 'checagem_falhou', 'corrigido_pelo_codigo', 'descartado_pelo_codigo', 'duvida_do_tester', 'aviso_do_revisor', 'achado'])
    expect(e[0]).toMatchObject({ origem: 'tester_llm', relatorio: 'EV-0001' })
  })
})
