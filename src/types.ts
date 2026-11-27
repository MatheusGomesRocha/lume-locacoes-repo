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
  /** Quando foi cadastrado (ISO). Vem do servidor; a demo grava ao criar. */
  criado_em?: string
}
export type ClienteForm = Omit<Cliente, 'id' | 'criado_em'>

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
  criado_em?: string
}
export type ProdutoForm = Omit<Produto, 'id' | 'criado_em'>

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
  criado_em?: string
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
  criado_em?: string
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

/** Pedido de ferramenta feito pelo assistente. Quem executa é o front, nunca a API de IA. */
export interface Chamada {
  nome: string
  args: Record<string, unknown>
}

export interface RespostaChat {
  /** A pergunta pede algo que o sistema não guarda: já veio respondida, e não vai para a fila dos Agents. */
  impossivel?: boolean
  encontrou: boolean
  resposta: string
  fonte: { id: string; modulo: string; pergunta: string } | null
  confianca: number
  relacionadas: { id: string; pergunta: string }[]
  usou_contexto?: boolean
  gerada_por_llm?: boolean
  /** A resposta veio do cache da API (não gastou chamada ao modelo). */
  em_cache?: boolean
  /** Quantas idas à API foram necessárias (2 quando houve consulta de dados). */
  voltas?: number
  /** Nomes das consultas que o front executou para chegar a esta resposta. */
  ferramentas?: string[]
  /** Consultas que o front deve executar e devolver (a resposta final vem na segunda volta). */
  consultas?: Chamada[]
  /** Cadastros e exclusões que viram cartões no chat, cada um com a confirmação do usuário. */
  acoes?: Chamada[]
  /** Conversa do agente em andamento (criar orçamento/cliente falando no chat). O front devolve este estado na próxima mensagem; `null`/ausente = terminou. */
  agente?: Record<string, unknown> | null
  /** Tokens e custo estimado do modelo nesta volta (ausente quando a resposta não chamou o modelo). */
  consumo?: ConsumoModelo
  /** Versão da API que respondeu (commit publicado). */
  versao?: string
  /** Respostas sugeridas pelo agente, mostradas como botões (clicar equivale a digitar). */
  opcoes?: string[]
  /** Gravações que o usuário JÁ confirmou com "sim" na conversa. É a única forma de o agente gravar algo. */
  executar?: Chamada[]
}

/** O que aconteceu com um pedido de cadastro ou exclusão aberto no chat. */
export type Desfecho = 'concluido' | 'cancelado' | 'recusado' | 'ignorado'
/** Resposta que o master escreveu para uma pergunta sem resposta. Entra direto na base de ajuda da Lumi. */
export interface FaqItem {
  id: number
  modulo: string
  pergunta: string
  resposta: string
  palavras_chave: string[]
  criado_em: string
}
export type FaqForm = Omit<FaqItem, 'id' | 'criado_em'>
export const MODULOS_FAQ = ['Orçamentos', 'Financeiro', 'Produtos', 'Clientes', 'Painel', 'Acesso', 'Assistente', 'Versão de demonstração']

export interface ConsumoModelo { chamadas: number; entrada: number; saida: number; custo_usd: number }

export type TipoLog = 'ajuda' | 'consulta' | 'cadastro' | 'exclusao' | 'nao_encontrou' | 'erro'
export const TIPOS_LOG: TipoLog[] = ['ajuda', 'consulta', 'cadastro', 'exclusao', 'nao_encontrou', 'erro']

/** Uma pergunta feita ao assistente e como ela foi respondida (observabilidade). Não guarda os dados que a consulta leu. */
/** Uma página de uma lista, com o total de itens (o total vem do servidor, não do tamanho da página). */
export interface Pagina<T> {
  dados: T[]
  total: number
  pagina: number
  por_pagina: number
  ultima_pagina: number
}
export interface PedidoPagina { pagina: number; porPagina: number }

export interface ChatLog {
  id: number
  criado_em: string
  pergunta: string
  resposta: string
  tipo: TipoLog
  fonte_id: string | null
  ferramenta: string | null
  gerada_por_llm: boolean
  em_cache: boolean
  usou_contexto: boolean
  latencia_ms: number
  voltas: number
  /** Tokens gastos no modelo para responder (0 quando não usou o modelo) e o custo estimado em US$. */
  tokens_entrada?: number
  tokens_saida?: number
  custo_usd?: number
  /** Versão do assistente que respondeu (commit da API); null em registros antigos. */
  versao?: string | null
  feedback: 'positivo' | 'negativo' | null
  desfecho: Desfecho | null
  usuario?: string | null
}
export type ChatLogForm = Omit<ChatLog, 'id' | 'criado_em' | 'feedback' | 'desfecho' | 'usuario'>
export type ChatLogAjuste = Partial<Pick<ChatLog, 'feedback' | 'desfecho'>>

// ---------------------------------------------------------------------------
// Acesso: usuários, grupos e permissões
// ---------------------------------------------------------------------------
export type Papel = 'master' | 'admin' | 'usuario'
export const ROTULO_PAPEL: Record<Papel, string> = { master: 'Master', admin: 'Administrador', usuario: 'Usuário' }

export interface Usuario {
  id: number
  nome: string
  email: string
  papel: Papel
  grupo_id: number
  grupo?: { id: number; nome: string }
  ativo: boolean
  criado_em?: string
}
export interface UsuarioForm {
  nome: string
  email: string
  papel: Papel
  grupo_id: number
  ativo: boolean
  /** Obrigatória ao criar; ao editar, só se for trocar. */
  senha?: string
}
export interface Grupo {
  id: number
  nome: string
  descricao: string | null
  /** Chaves "modulo.acao". O grupo do master tem todas e não pode ser alterado. */
  permissoes: string[]
  sistema: boolean
  usuarios_count: number
  criado_em?: string
}
export interface GrupoForm { nome: string; descricao: string | null; permissoes: string[] }

/** Quem está logado e o que pode fazer. */
export interface Sessao {
  usuario: Usuario
  permissoes: string[]
}
export interface MinhaContaForm { nome: string; email: string; senha_atual?: string; nova_senha?: string }

// ---------------------------------------------------------------------------
// Evolução assistida: consultas novas propostas pelos Agents, que o master aprova ou reprova
// ---------------------------------------------------------------------------
export type VereditoEvolucao = 'aprovar_recomendado' | 'revisar_com_atencao' | 'reprovar_recomendado'
export type StatusEvolucao = 'pendente' | 'aprovada' | 'reprovada'
export interface RelatorioEvolucao {
  id: string
  titulo: string
  decisao_do_analista: string
  motivo?: string | null
  perguntas: string[]
  vezes: number
  status: StatusEvolucao
  veredito: VereditoEvolucao | null
  /** O relatório completo em markdown simples: o que cada Agent fez, o que foi verificado, o que NÃO foi provado. */
  texto: string
  /** O que o Analista propôs (a API pede de volta ao refazer as checagens). */
  proposta?: Record<string, unknown>
  pacote: { spec: import('./lib/catalogo').SpecConsulta; regras_declaradas?: string[] } | null
  avaliacao: { selo: string | null; resumo: { casos: number; passaram: number; falharam: number; bloqueios: number; avisos: number } } | null
  /** Consulta ativa no catálogo (só vale para aprovadas). */
  ativa: boolean
  decisao?: { por: string; em: string } | null
  criado_em: string
}
