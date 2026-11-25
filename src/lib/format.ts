const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

export function moeda(valor: number): string {
  // Intl usa espaço não separável (U+00A0) entre R$ e o número; trocamos por espaço comum para facilitar busca e testes
  return moedaBR.format(valor || 0).replace(/ /g, ' ')
}

/** "2026-12-10" -> "10/12/2026". Sem usar Date para não sofrer com fuso horário. */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [a, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${a}`
}

/** "2026-12-10" -> "10 dez" */
export function dataCurta(iso: string): string {
  const meses = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
  const [, m, d] = iso.slice(0, 10).split('-')
  return `${Number(d)} ${meses[Number(m) - 1]}`
}

/** "2026-11" -> "nov" */
export function mesCurto(anoMes: string): string {
  return dataCurta(`${anoMes}-01`).split(' ')[1]
}

export function hojeISO(deslocamentoEmDias = 0, base: Date = new Date()): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + deslocamentoEmDias)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function rotuloStatus(status: string): string {
  const mapa: Record<string, string> = {
    rascunho: 'Rascunho', enviado: 'Enviado', aprovado: 'Aprovado', finalizado: 'Finalizado', cancelado: 'Cancelado',
    pendente: 'A receber', pago: 'Pago', atrasado: 'Em atraso',
  }
  return mapa[status] ?? status
}

export const rotuloForma: Record<string, string> = { pix: 'Pix', cartao: 'Cartão', boleto: 'Boleto', dinheiro: 'Dinheiro' }
