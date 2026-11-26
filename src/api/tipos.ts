import type {
  ChatLog, ChatLogAjuste, ChatLogForm, FaqForm, FaqItem, TipoLog,
  Grupo, GrupoForm, MinhaContaForm, Sessao, Usuario, UsuarioForm,
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
  /** Respostas do master para perguntas sem resposta (só o master mexe). */
  faq: {
    listar(): Promise<FaqItem[]>
    criar(dados: FaqForm): Promise<FaqItem>
    atualizar(id: number, dados: FaqForm): Promise<FaqItem>
    excluir(id: number): Promise<void>
    /** O que o chat manda à API junto da pergunta. Na versão real o Laravel já anexa por conta própria, então volta vazio. */
    paraAssistente(): Promise<FaqItem[]>
  }
  /** Login e sessão. */
  auth: {
    /** Espera o que for preciso para `salva()` responder (a demo carrega os usuários do navegador). */
    pronta(): Promise<void>
    /** Sessão guardada neste navegador, sem ir à rede. */
    salva(): Sessao | null
    entrar(email: string, senha: string): Promise<Sessao>
    sair(): Promise<void>
    /** Relê usuário e permissões (o grupo pode ter mudado desde o login). */
    atualizar(): Promise<Sessao>
    alterarMinhaConta(dados: MinhaContaForm): Promise<Sessao>
  }
  usuarios: {
    listar(): Promise<Usuario[]>
    criar(dados: UsuarioForm): Promise<Usuario>
    atualizar(id: number, dados: UsuarioForm): Promise<Usuario>
    excluir(id: number): Promise<void>
  }
  grupos: {
    listar(): Promise<Grupo[]>
    criar(dados: GrupoForm): Promise<Grupo>
    atualizar(id: number, dados: GrupoForm): Promise<Grupo>
    excluir(id: number): Promise<void>
  }
  /** Registro das conversas com o assistente. */
  chatLogs: {
    listar(filtros?: { tipo?: TipoLog; feedback?: 'positivo' | 'negativo' }): Promise<ChatLog[]>
    registrar(dados: ChatLogForm): Promise<ChatLog>
    atualizar(id: number, ajuste: ChatLogAjuste): Promise<ChatLog>
    limpar(): Promise<void>
  }
  /** Só existe na versão local: volta aos dados de exemplo. */
  restaurarExemplo?(): Promise<void>
}
