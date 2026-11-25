import type {
  Cliente, ClienteForm, FormaPagamento, Orcamento, OrcamentoForm, Pagamento, Produto, ProdutoForm, Resumo, StatusOrcamento,
} from '../types'
import type { Falta } from '../lib/regras'

/** Erro de uma chamada: mensagem para mostrar ao usuário, status HTTP e detalhes opcionais. */
export class ApiError extends Error {
  constructor(
    mensagem: string,
    public status = 422,
    public detalhes: Falta[] = [],
    public campos: Record<string, string[]> = {},
  ) {
    super(mensagem)
    this.name = 'ApiError'
  }
}

export type FiltroPagamento = 'todos' | 'pendente' | 'atrasado' | 'pago' | 'cancelado'

/**
 * Tudo o que as telas precisam dos dados. Existem duas implementações:
 *  - http.ts  → conversa com o Laravel (versão real)
 *  - local.ts → guarda no localStorage do navegador (versão GitHub Pages)
 */
export interface Api {
  modo: 'http' | 'local'
  dashboard(): Promise<Resumo>

  clientes: {
    listar(busca?: string): Promise<Cliente[]>
    criar(dados: ClienteForm): Promise<Cliente>
    atualizar(id: number, dados: ClienteForm): Promise<Cliente>
    excluir(id: number): Promise<void>
  }
  produtos: {
    listar(filtros?: { busca?: string; categoria?: string; ativo?: boolean }): Promise<Produto[]>
    criar(dados: ProdutoForm): Promise<Produto>
    atualizar(id: number, dados: ProdutoForm): Promise<Produto>
    excluir(id: number): Promise<void>
  }
  orcamentos: {
    listar(filtros?: { busca?: string; status?: StatusOrcamento | '' }): Promise<Orcamento[]>
    obter(id: number): Promise<Orcamento>
    criar(dados: OrcamentoForm): Promise<Orcamento>
    atualizar(id: number, dados: OrcamentoForm): Promise<Orcamento>
    excluir(id: number): Promise<void>
    enviar(id: number): Promise<Orcamento>
    aprovar(id: number): Promise<Orcamento>
    finalizar(id: number): Promise<Orcamento>
    cancelar(id: number): Promise<Orcamento>
  }
  pagamentos: {
    listar(filtro?: FiltroPagamento): Promise<Pagamento[]>
    baixar(id: number, pagoEm: string, forma: FormaPagamento): Promise<Pagamento>
  }
  /** Só existe na versão local: volta aos dados de exemplo. */
  restaurarExemplo?(): Promise<void>
}
