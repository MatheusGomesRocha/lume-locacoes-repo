import { dataBR, dataCurta, hojeISO, mesCurto, moeda, rotuloStatus } from './format'

describe('moeda', () => {
  it('formata em reais com espaço comum', () => {
    expect(moeda(1234.5)).toBe('R$ 1.234,50')
    expect(moeda(0)).toBe('R$ 0,00')
  })
  it('trata valores inválidos como zero', () => {
    expect(moeda(NaN)).toBe('R$ 0,00')
  })
})

describe('dataBR', () => {
  it('troca AAAA-MM-DD por DD/MM/AAAA', () => expect(dataBR('2026-12-05')).toBe('05/12/2026'))
  it('aceita data com hora', () => expect(dataBR('2026-12-05T10:00:00')).toBe('05/12/2026'))
  it('mostra traço quando vazio', () => {
    expect(dataBR(null)).toBe('—')
    expect(dataBR(undefined)).toBe('—')
  })
})

describe('dataCurta e mesCurto', () => {
  it('abrevia dia e mês', () => expect(dataCurta('2026-03-09')).toBe('9 mar'))
  it('devolve só o mês', () => expect(mesCurto('2026-11')).toBe('nov'))
})

describe('hojeISO', () => {
  const base = new Date(2026, 10, 25)
  it('devolve a própria data', () => expect(hojeISO(0, base)).toBe('2026-11-25'))
  it('soma e subtrai dias, mudando de mês e ano', () => {
    expect(hojeISO(10, base)).toBe('2026-12-05')
    expect(hojeISO(-25, base)).toBe('2026-10-31')
    expect(hojeISO(40, base)).toBe('2027-01-04')
  })
})

describe('rotuloStatus', () => {
  it('traduz status conhecidos', () => {
    expect(rotuloStatus('pendente')).toBe('A receber')
    expect(rotuloStatus('aprovado')).toBe('Aprovado')
  })
  it('mantém o texto de status desconhecidos', () => expect(rotuloStatus('xyz')).toBe('xyz'))
})
