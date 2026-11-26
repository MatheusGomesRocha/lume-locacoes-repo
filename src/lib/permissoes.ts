import type { Papel } from '../types'

/** Cada módulo tem uma lista fixa de ações. A permissão é a chave "modulo.acao". */
export interface ModuloDePermissao {
  id: string
  nome: string
  acoes: { id: string; nome: string }[]
  /** Só faz efeito para administradores (e o master). */
  soAdmin?: boolean
}

const crud = [{ id: 'ver', nome: 'Ver' }, { id: 'criar', nome: 'Criar' }, { id: 'editar', nome: 'Editar' }, { id: 'excluir', nome: 'Excluir' }]

export const MODULOS: ModuloDePermissao[] = [
  { id: 'painel', nome: 'Painel', acoes: [{ id: 'ver', nome: 'Ver' }] },
  {
    id: 'orcamentos', nome: 'Orçamentos',
    acoes: [...crud, { id: 'enviar', nome: 'Enviar' }, { id: 'aprovar', nome: 'Aprovar' }, { id: 'finalizar', nome: 'Finalizar' }, { id: 'cancelar', nome: 'Cancelar' }],
  },
  { id: 'financeiro', nome: 'Financeiro', acoes: [{ id: 'ver', nome: 'Ver' }, { id: 'baixar', nome: 'Dar baixa' }] },
  { id: 'produtos', nome: 'Produtos', acoes: crud },
  { id: 'clientes', nome: 'Clientes', acoes: crud },
  { id: 'assistente', nome: 'Assistente', acoes: [{ id: 'usar', nome: 'Usar o chat' }, { id: 'conversas', nome: 'Ver e apagar conversas' }] },
  { id: 'usuarios', nome: 'Usuários', acoes: crud, soAdmin: true },
]

/** Só o master tem (responder perguntas sem resposta). Fica fora do catálogo: nenhum grupo a recebe. */
export const PERMISSAO_SO_MASTER = 'faq.responder'

export const chave = (modulo: string, acao: string) => `${modulo}.${acao}`
export const TODAS_PERMISSOES: string[] = MODULOS.flatMap((m) => m.acoes.map((a) => chave(m.id, a.id)))
export const permissaoExiste = (p: string) => TODAS_PERMISSOES.includes(p)

/** Descarta chaves desconhecidas e repetidas (um grupo salvo antes de um módulo mudar não quebra). */
export const limparPermissoes = (lista: string[]) => [...new Set(lista.filter(permissaoExiste))]

export const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para esta ação.'
export const MENSAGEM_SEM_SESSAO = 'Sua sessão expirou. Entre novamente.'

export const ehAdmin = (papel: Papel) => papel === 'master' || papel === 'admin'

/** Regras de hierarquia (as mesmas do Laravel): quem pode mexer em quem. */
export function podeGerenciar(ator: { id: number; papel: Papel }, alvo: { id: number; papel: Papel }): boolean {
  if (alvo.papel === 'master') return ator.id === alvo.id
  if (ator.papel === 'master') return true
  if (ator.papel === 'admin') return alvo.papel === 'usuario'
  return false
}
