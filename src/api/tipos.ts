import type {
  Pagina,
  PedidoPagina,
  ChatLog, ChatLogAjuste, ChatLogForm, EstadoDoAprovador, FaqForm, FaqItem, RelatorioEvolucao, ResumoDaExecucao, TipoLog,
  Grupo, GrupoForm, MinhaContaForm, Sessao, Usuario, UsuarioForm,
  Cliente, ClienteForm, FormaPagamento, Orcamento, OrcamentoForm, Pagamento, Produto, ProdutoForm, Resumo, StatusOrcamento,
} from '../types'
import type { SpecConsulta } from '../lib/catalogo'
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
/** A mesma API sem o `pagina` das listas: é o que a demo escreve à mão; o `pagina` entra por cima (lib/paginacao.ts). */
export type SemPagina<T> = { [K in keyof T]: T[K] extends (...a: never[]) => unknown ? T[K] : Omit<T[K], 'pagina'> }

export interface Api {
  modo: 'http' | 'local'
  dashboard(): Promise<Resumo>

  clientes: {
    listar(busca?: string): Promise<Cliente[]>
    pagina(busca: string | undefined, pg: PedidoPagina): Promise<Pagina<Cliente>>
    criar(dados: ClienteForm): Promise<Cliente>
    atualizar(id: number, dados: ClienteForm): Promise<Cliente>
    excluir(id: number): Promise<void>
  }
  produtos: {
    listar(filtros?: { busca?: string; categoria?: string; ativo?: boolean }): Promise<Produto[]>
    pagina(filtros: { busca?: string; categoria?: string; ativo?: boolean } | undefined, pg: PedidoPagina): Promise<Pagina<Produto>>
    criar(dados: ProdutoForm): Promise<Produto>
    atualizar(id: number, dados: ProdutoForm): Promise<Produto>
    excluir(id: number): Promise<void>
  }
  orcamentos: {
    listar(filtros?: { busca?: string; status?: StatusOrcamento | '' }): Promise<Orcamento[]>
    pagina(filtros: { busca?: string; status?: StatusOrcamento | '' } | undefined, pg: PedidoPagina): Promise<Pagina<Orcamento>>
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
    pagina(filtro: FiltroPagamento | undefined, pg: PedidoPagina): Promise<Pagina<Pagamento>>
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
  /** Consultas novas criadas pelos Agents (ver ia-api/evolucao). Só o master analisa e decide; quem usa o chat só lê o catálogo aprovado. */
  evolucao: {
    /** Consultas aprovadas e ativas (o que o chat pode executar). */
    catalogo(): Promise<SpecConsulta[]>
    /** O que o chat manda à API junto da pergunta. Na versão real o Laravel já anexa por conta própria, então volta vazio. */
    paraAssistente(): Promise<SpecConsulta[]>
    listar(): Promise<RelatorioEvolucao[]>
    /** Roda os 3 Agents sobre as perguntas sem resposta e guarda os relatórios como pendentes. */
    analisar(): Promise<{ novos: RelatorioEvolucao[]; semPerguntas: boolean }>
    decidir(id: string, aprovar: boolean): Promise<RelatorioEvolucao>
    desativar(id: string): Promise<RelatorioEvolucao>
    /** Executa agora o Agent de Aprovação (na versão real é o mesmo que o job de 5 em 5 minutos). */
    revisar(): Promise<ResumoDaExecucao>
    /** Em que modo ele está (desligado, sombra ou automático) e quanto do limite do dia já usou. */
    aprovador(): Promise<EstadoDoAprovador>
    /** O master conferiu uma aprovação automática sorteada. */
    conferir(id: string): Promise<RelatorioEvolucao>
    /** Prévia com dados reais: o que o chat entenderia de cada pergunta de exemplo da consulta, com a data de hoje de quem usa. */
    parametrosDosExemplos(id: string, hoje: string): Promise<{ exemplos: { pergunta: string; params: Record<string, unknown>; faltando: string[] }[] }>
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
    pagina(pg: PedidoPagina): Promise<Pagina<Usuario>>
    criar(dados: UsuarioForm): Promise<Usuario>
    atualizar(id: number, dados: UsuarioForm): Promise<Usuario>
    excluir(id: number): Promise<void>
  }
  grupos: {
    listar(): Promise<Grupo[]>
    pagina(pg: PedidoPagina): Promise<Pagina<Grupo>>
    criar(dados: GrupoForm): Promise<Grupo>
    atualizar(id: number, dados: GrupoForm): Promise<Grupo>
    excluir(id: number): Promise<void>
  }
  /** Registro das conversas com o assistente. */
  chatLogs: {
    listar(filtros?: { tipo?: TipoLog; feedback?: 'positivo' | 'negativo' }): Promise<ChatLog[]>
    pagina(filtros: { tipo?: TipoLog; feedback?: 'positivo' | 'negativo' } | undefined, pg: PedidoPagina): Promise<Pagina<ChatLog>>
    registrar(dados: ChatLogForm): Promise<ChatLog>
    atualizar(id: number, ajuste: ChatLogAjuste): Promise<ChatLog>
    limpar(): Promise<void>
  }
  /** Só existe na versão local: volta aos dados de exemplo. */
  restaurarExemplo?(): Promise<void>
}
