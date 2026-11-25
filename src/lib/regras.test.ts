import { calcularFaltas, calcularTotal, diarias, periodosSeSobrepoem, podeAprovar, podeCancelar, podeEditar, podeEnviar, podeExcluir, podeFinalizar, proximoNumero } from './regras'

describe('diarias', () => {
  it('conta os dias entre retirada e devolução', () => {
    expect(diarias('2026-12-10', '2026-12-12')).toBe(2)
    expect(diarias('2026-01-30', '2026-02-02')).toBe(3)
  })
  it('tem mínimo de uma diária', () => {
    expect(diarias('2026-12-10', '2026-12-10')).toBe(1)
    expect(diarias('2026-12-12', '2026-12-10')).toBe(1)
    expect(diarias(null, null)).toBe(1)
    expect(diarias(undefined, '2026-12-10')).toBe(1)
  })
  it('não sofre com mudança de horário de verão', () => {
    expect(diarias('2026-10-30', '2026-11-02')).toBe(3)
  })
})

describe('calcularTotal', () => {
  const itens = [{ quantidade: 2, valor_diaria: 100 }, { quantidade: 1, valor_diaria: 50 }]
  it('multiplica itens pelas diárias', () => expect(calcularTotal(itens, 3)).toBe(750))
  it('subtrai o desconto depois das diárias', () => expect(calcularTotal(itens, 3, 100)).toBe(650))
  it('nunca fica negativo', () => {
    expect(calcularTotal([{ quantidade: 1, valor_diaria: 50 }], 1, 999)).toBe(0)
    expect(calcularTotal([], 2)).toBe(0)
  })
  it('arredonda em centavos sem erro de ponto flutuante', () => {
    expect(calcularTotal([{ quantidade: 3, valor_diaria: 33.33 }], 1)).toBe(99.99)
    expect(calcularTotal([{ quantidade: 1, valor_diaria: 0.1 }, { quantidade: 1, valor_diaria: 0.2 }], 1)).toBe(0.3)
  })
})

describe('proximoNumero', () => {
  const hoje = new Date(2026, 4, 1)
  it('começa em 0001 no ano', () => expect(proximoNumero([], hoje)).toBe('2026/0001'))
  it('soma um ao maior do ano', () => expect(proximoNumero(['2026/0001', '2026/0007'], hoje)).toBe('2026/0008'))
  it('reinicia a cada ano', () => expect(proximoNumero(['2026/0042'], new Date(2027, 0, 2))).toBe('2027/0001'))
  it('não repete depois de excluir um antigo', () => expect(proximoNumero(['2026/0002'], hoje)).toBe('2026/0003'))
  it('ignora números de outros anos', () => expect(proximoNumero(['2025/0099'], hoje)).toBe('2026/0001'))
})

describe('periodosSeSobrepoem', () => {
  it('detecta cruzamento e as pontas', () => {
    expect(periodosSeSobrepoem('2026-12-10', '2026-12-12', '2026-12-11', '2026-12-13')).toBe(true)
    expect(periodosSeSobrepoem('2026-12-10', '2026-12-14', '2026-12-14', '2026-12-16')).toBe(true)
  })
  it('separa períodos distintos', () => expect(periodosSeSobrepoem('2026-12-01', '2026-12-05', '2026-12-06', '2026-12-08')).toBe(false))
})

describe('calcularFaltas', () => {
  const produtos = [{ id: 1, codigo: 'LUZ-1', nome: 'Refletor', quantidade: 5 }]
  const o = (id: number, status: string, ini: string, fim: string, qtd: number) => ({ id, status: status as never, data_retirada: ini, data_devolucao: fim, itens: [{ produto_id: 1, quantidade: qtd, valor_diaria: 10 }] })

  it('considera só aprovados que se sobrepõem', () => {
    const novo = o(9, 'rascunho', '2026-12-11', '2026-12-13', 2)
    const todos = [o(1, 'aprovado', '2026-12-10', '2026-12-12', 4), o(2, 'rascunho', '2026-12-10', '2026-12-12', 5), o(3, 'finalizado', '2026-12-10', '2026-12-12', 5), novo]
    const f = calcularFaltas(novo, todos, produtos)
    expect(f).toEqual([{ produto_id: 1, codigo: 'LUZ-1', produto: 'Refletor', solicitado: 2, disponivel: 1 }])
  })
  it('ignora o próprio orçamento e períodos que não se tocam', () => {
    const atual = o(2, 'aprovado', '2026-12-10', '2026-12-12', 5)
    expect(calcularFaltas(atual, [o(1, 'aprovado', '2026-12-01', '2026-12-05', 5), atual], produtos)).toEqual([])
  })
  it('trata datas de borda como sobreposição', () => {
    const novo = o(9, 'rascunho', '2026-12-14', '2026-12-16', 1)
    expect(calcularFaltas(novo, [o(1, 'aprovado', '2026-12-10', '2026-12-14', 5), novo], produtos)).toHaveLength(1)
  })
  it('disponível nunca fica negativo e produto desconhecido é ignorado', () => {
    const novo = { ...o(9, 'rascunho', '2026-12-10', '2026-12-12', 1), itens: [{ produto_id: 1, quantidade: 1, valor_diaria: 1 }, { produto_id: 77, quantidade: 1, valor_diaria: 1 }] }
    const f = calcularFaltas(novo, [o(1, 'aprovado', '2026-12-10', '2026-12-12', 5), o(2, 'aprovado', '2026-12-10', '2026-12-12', 5)], produtos)
    expect(f).toHaveLength(1)
    expect(f[0].disponivel).toBe(0)
  })
})

describe('quais ações cada status permite', () => {
  it('editar', () => {
    ;['rascunho', 'enviado'].forEach((s) => expect(podeEditar(s)).toBe(true))
    ;['aprovado', 'finalizado', 'cancelado'].forEach((s) => expect(podeEditar(s)).toBe(false))
  })
  it('enviar', () => { expect(podeEnviar('rascunho')).toBe(true); expect(podeEnviar('enviado')).toBe(false) })
  it('aprovar', () => { expect(podeAprovar('rascunho')).toBe(true); expect(podeAprovar('enviado')).toBe(true); expect(podeAprovar('aprovado')).toBe(false) })
  it('finalizar', () => { expect(podeFinalizar('aprovado')).toBe(true); expect(podeFinalizar('enviado')).toBe(false) })
  it('cancelar', () => { expect(podeCancelar('aprovado')).toBe(true); expect(podeCancelar('finalizado')).toBe(false); expect(podeCancelar('cancelado')).toBe(false) })
  it('excluir', () => { expect(podeExcluir('rascunho')).toBe(true); expect(podeExcluir('cancelado')).toBe(true); expect(podeExcluir('aprovado')).toBe(false) })
})
