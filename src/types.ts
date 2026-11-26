export type StatusOrcamento = 'rascunho' | 'enviado' | 'aprovado' | 'finalizado' | 'cancelado'
export const STATUS_ORCAMENTO: StatusOrcamento[] = ['rascunho', 'enviado', 'aprovado', 'finalizado', 'cancelado']

export type StatusPagamento = 'pendente' | 'pago' | 'cancelado'
export type FormaPagamento = 'pix' | 'cartao' | 'boleto' | 'dinheiro'
export const FORMAS: FormaPagamento[] = ['pix', 'cartao', 'boleto', 'dinheiro']

export interface Cliente {
  id: number
  nome: string
  tipo: 'PF' | 'PJ'
  documento: string | null
  email: string | null
  telefone: string | null
  cidade: string | null
  observacoes: string | null
}
export type ClienteForm = Omit<Cliente, 'id'>

export interface Produto {
  id: number
  codigo: string
  nome: string
  categoria: string
  descricao: string | null
  valor_diaria: number
  valor_reposicao: number
  quantidade: number
  ativo: boolean
}
export type ProdutoForm = Omit<Produto, 'id'>

export interface ItemOrcamento {
  id?: number
  produto_id: number
  quantidade: number
  valor_diaria: number
  produto?: Pick<Produto, 'id' | 'codigo' | 'nome'>
}

export interface Pagamento {
  id: number
  orcamento_id: number
  valor: number
  vencimento: string
  pago_em: string | null
  forma: FormaPagamento | null
  status: StatusPagamento
  orcamento?: { id: number; numero: string; evento: string; cliente?: { id: number; nome: string } }
}

export interface Orcamento {
  id: number
  numero: string
  cliente_id: number
  cliente?: Pick<Cliente, 'id' | 'nome'>
  evento: string
  data_retirada: string
  data_devolucao: string
  status: StatusOrcamento
  desconto: number
  total: number
  observacoes: string | null
  diarias: number
  itens: ItemOrcamento[]
  pagamentos?: Pagamento[]
}

export interface OrcamentoForm {
  cliente_id: number
  evento: string
  data_retirada: string
  data_devolucao: string
  desconto: number
  observacoes: string
  itens: { produto_id: number; quantidade: number }[]
}

export interface Resumo {
  recebido_mes: number
  a_receber: number
  em_atraso: number
  orcamentos_em_aberto: number
  recebido_por_mes: { mes: string; total: number }[]
  orcamentos_por_status: { status: StatusOrcamento; total: number }[]
  produtos_mais_alugados: { produto_id: number; codigo: string; nome: string; quantidade: number }[]
  proximos_eventos: { id: number; numero: string; evento: string; cliente: string; data_retirada: string; data_devolucao: string; total: number }[]
}

export interface RespostaChat {
  encontrou: boolean
  resposta: string
  fonte: { id: string; modulo: string; pergunta: string } | null
  confianca: number
  relacionadas: { id: string; pergunta: string }[]
  usou_contexto?: boolean
  gerada_por_llm?: boolean
}
