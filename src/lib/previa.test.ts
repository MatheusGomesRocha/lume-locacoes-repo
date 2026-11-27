import type { Api } from '../api/tipos'
import type { RelatorioEvolucao } from '../types'
import { conferirRegistro, previaComDadosReais } from './previa'
import { hojeISO } from './format'

const hoje = hojeISO()
const ontem = hojeISO(-1)
const spec = {
  nome: 'contar_pagamentos_por_forma_e_periodo', descricao: '', permissao: 'financeiro.ver', entidade: 'pagamentos', operacao: 'contar',
  filtros: [{ campo: 'forma', op: 'igual', parametro: 'forma' }, { campo: 'pago_em', op: 'maior_igual', parametro: 'de' }, { campo: 'pago_em', op: 'menor_igual', parametro: 'ate' }],
  parametros: { forma: { tipo: 'enum', valores: ['pix', 'boleto'], obrigatorio: true }, de: { tipo: 'data', obrigatorio: true }, ate: { tipo: 'data', obrigatorio: true } },
}
const rel = { id: 'EV-1', pacote: { spec } } as unknown as RelatorioEvolucao
const pagamento = (numero: string, forma: string, pago_em: string | null) => ({ orcamento: { numero }, valor: 100, vencimento: pago_em, pago_em, status: pago_em ? 'pago' : 'pendente', forma, criado_em: null })

function apiFalsa(permissoes = ['financeiro.ver']): Api {
  return {
    auth: { salva: () => ({ usuario: { papel: 'master' }, permissoes }) },
    pagamentos: { listar: async () => [pagamento('ORC-2026-0012', 'pix', ontem), pagamento('ORC-2026-0013', 'boleto', ontem), pagamento('ORC-2026-0014', 'pix', '2020-01-01')] },
    evolucao: { parametrosDosExemplos: async () => ({ exemplos: [{ pergunta: 'quantos pagos no pix essa semana?', params: { forma: 'pix', de: ontem, ate: hoje }, faltando: [] }] }) },
  } as unknown as Api
}

describe('prévia com dados reais', () => {
  it('roda a consulta sobre os registros de verdade e mostra o que entrou', async () => {
    const p = await previaComDadosReais(apiFalsa(), rel)
    expect(p.itens[0].total).toBe(1)
    expect(p.itens[0].linhas[0].orcamento_numero).toBe('ORC-2026-0012')
  })

  it('sem a permissão da consulta, não roda e avisa', async () => {
    const p = await previaComDadosReais(apiFalsa([]), rel)
    expect(p.itens[0].total).toBeNull()
    expect(p.itens[0].erro).toMatch(/permissão/)
  })

  it('conferir um registro diz se entrou e, se não, qual filtro barrou', async () => {
    const api = apiFalsa()
    const item = (await previaComDadosReais(api, rel)).itens[0]
    const [entrou] = await conferirRegistro(api, rel, item, '2026/0012')
    expect(entrou.entrou).toBe(true)
    const [fora] = await conferirRegistro(api, rel, item, 'ORC-2026-0014')
    expect(fora.entrou).toBe(false)
    expect(fora.filtros.filter((f) => !f.ok).map((f) => f.campo)).toEqual(['pago_em'])
    expect(await conferirRegistro(api, rel, item, 'ORC-9999')).toEqual([])
  })
})
