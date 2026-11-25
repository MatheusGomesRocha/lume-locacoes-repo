/**
 * Regras de negócio do orçamento. São a MESMA lógica do Laravel (app/Services/OrcamentoService.php).
 * O driver local (GitHub Pages) usa estas funções; o backend real tem a sua cópia em PHP.
 * Se uma regra mudar, mude nos dois lugares e nos dois conjuntos de testes.
 */
import type { ItemOrcamento, Orcamento } from '../types'

const MS_DIA = 86_400_000

function paraUTC(iso: string): number {
  const [a, m, d] = iso.slice(0, 10).split('-').map(Number)
  return Date.UTC(a, m - 1, d)
}

/** Dias entre retirada e devolução, com mínimo de 1 diária. */
export function diarias(retirada?: string | null, devolucao?: string | null): number {
  if (!retirada || !devolucao) return 1
  const dias = Math.round((paraUTC(devolucao) - paraUTC(retirada)) / MS_DIA)
  return Math.max(1, dias)
}

/** (soma dos itens × diárias) − desconto, nunca negativo, em centavos exatos. */
export function calcularTotal(itens: Pick<ItemOrcamento, 'quantidade' | 'valor_diaria'>[], numDiarias: number, desconto = 0): number {
  const centavos = itens.reduce((s, i) => s + Math.round(i.valor_diaria * 100) * i.quantidade, 0) * numDiarias
  return Math.max(0, centavos - Math.round(desconto * 100)) / 100
}

/** Próximo número no formato AAAA/0001, reiniciando a cada ano e nunca repetindo. */
export function proximoNumero(existentes: string[], hoje: Date = new Date()): string {
  const ano = hoje.getFullYear()
  const maior = existentes
    .filter((n) => n.startsWith(`${ano}/`))
    .map((n) => Number(n.split('/')[1]))
    .reduce((a, b) => Math.max(a, b), 0)
  return `${ano}/${String(maior + 1).padStart(4, '0')}`
}

export interface Falta {
  produto_id: number
  codigo: string
  produto: string
  solicitado: number
  disponivel: number
}

/** Períodos que se tocam (inclusive nas pontas) disputam o mesmo estoque. */
export function periodosSeSobrepoem(aIni: string, aFim: string, bIni: string, bFim: string): boolean {
  return aIni <= bFim && aFim >= bIni
}

/**
 * Quais itens do orçamento passam do estoque no período dele.
 * Só orçamentos APROVADOS seguram estoque (rascunho/enviado/finalizado/cancelado não).
 */
export function calcularFaltas(
  orcamento: Pick<Orcamento, 'id' | 'data_retirada' | 'data_devolucao' | 'itens'>,
  todos: Pick<Orcamento, 'id' | 'status' | 'data_retirada' | 'data_devolucao' | 'itens'>[],
  produtos: { id: number; codigo: string; nome: string; quantidade: number }[],
): Falta[] {
  const concorrentes = todos.filter(
    (o) => o.id !== orcamento.id && o.status === 'aprovado' && periodosSeSobrepoem(o.data_retirada, o.data_devolucao, orcamento.data_retirada, orcamento.data_devolucao),
  )
  const faltas: Falta[] = []
  for (const item of orcamento.itens) {
    const produto = produtos.find((p) => p.id === item.produto_id)
    if (!produto) continue
    const usado = concorrentes.reduce((s, o) => s + o.itens.filter((i) => i.produto_id === item.produto_id).reduce((t, i) => t + i.quantidade, 0), 0)
    const disponivel = produto.quantidade - usado
    if (item.quantidade > disponivel) {
      faltas.push({ produto_id: produto.id, codigo: produto.codigo, produto: produto.nome, solicitado: item.quantidade, disponivel: Math.max(0, disponivel) })
    }
  }
  return faltas
}

/** Quais status permitem cada ação (usado pela tela para mostrar/ocultar botões e pelo driver local para validar). */
export const podeEditar = (s: string) => s === 'rascunho' || s === 'enviado'
export const podeEnviar = (s: string) => s === 'rascunho'
export const podeAprovar = (s: string) => s === 'rascunho' || s === 'enviado'
export const podeFinalizar = (s: string) => s === 'aprovado'
export const podeCancelar = (s: string) => s === 'rascunho' || s === 'enviado' || s === 'aprovado'
export const podeExcluir = (s: string) => s === 'rascunho' || s === 'cancelado'
