import { MENSAGEM_SEM_PERMISSAO, MENSAGEM_SEM_SESSAO, PERMISSAO_SO_MASTER } from '../lib/permissoes'
import { ApiError, type Api } from './tipos'

/**
 * Qualquer uma destas permissões libera a chamada. As listas de clientes e produtos também servem a quem monta
 * orçamentos (o formulário precisa escolher cliente e produto).
 */
const MONTA_ORCAMENTO = ['orcamentos.criar', 'orcamentos.editar']

export const PERMISSOES_DA_API: Record<string, string[]> = {
  'dashboard': ['painel.ver'],
  'clientes.listar': ['clientes.ver', ...MONTA_ORCAMENTO],
  'clientes.criar': ['clientes.criar'],
  'clientes.atualizar': ['clientes.editar'],
  'clientes.excluir': ['clientes.excluir'],
  'produtos.listar': ['produtos.ver', ...MONTA_ORCAMENTO],
  'produtos.criar': ['produtos.criar'],
  'produtos.atualizar': ['produtos.editar'],
  'produtos.excluir': ['produtos.excluir'],
  'orcamentos.listar': ['orcamentos.ver', 'financeiro.ver'],
  'orcamentos.obter': ['orcamentos.ver'],
  'orcamentos.criar': ['orcamentos.criar'],
  'orcamentos.atualizar': ['orcamentos.editar'],
  'orcamentos.excluir': ['orcamentos.excluir'],
  'orcamentos.enviar': ['orcamentos.enviar'],
  'orcamentos.aprovar': ['orcamentos.aprovar'],
  'orcamentos.finalizar': ['orcamentos.finalizar'],
  'orcamentos.cancelar': ['orcamentos.cancelar'],
  'pagamentos.listar': ['financeiro.ver'],
  'pagamentos.baixar': ['financeiro.baixar'],
  'faq.listar': [PERMISSAO_SO_MASTER],
  'faq.criar': [PERMISSAO_SO_MASTER],
  'faq.atualizar': [PERMISSAO_SO_MASTER],
  'faq.excluir': [PERMISSAO_SO_MASTER],
  'faq.paraAssistente': ['assistente.usar'],
  'chatLogs.registrar': ['assistente.usar'],
  'chatLogs.atualizar': ['assistente.usar'],
  'chatLogs.listar': ['assistente.conversas'],
  'chatLogs.limpar': ['assistente.conversas'],
}

/**
 * Confere a permissão antes de cada ação de dados. Na demonstração é a única barreira (tudo roda no navegador);
 * na versão real o Laravel confere de novo e esta camada só dá a resposta mais cedo.
 * `permissoes()` devolve null quando ninguém está logado.
 */
export function protegerApi(api: Api, permissoes: () => Promise<string[] | null>): Api {
  const checar = async (caminho: string) => {
    const atuais = await permissoes()
    if (!atuais) throw new ApiError(MENSAGEM_SEM_SESSAO, 401)
    const aceitas = PERMISSOES_DA_API[caminho]
    if (!aceitas || !aceitas.some((p) => atuais.includes(p))) throw new ApiError(MENSAGEM_SEM_PERMISSAO, 403)
  }
  const envolver = <T extends object>(grupo: T, prefixo: string): T =>
    Object.fromEntries(
      Object.entries(grupo).map(([nome, fn]) => [nome, async (...args: unknown[]) => { await checar(`${prefixo}.${nome}`); return (fn as (...a: unknown[]) => unknown)(...args) }]),
    ) as T

  return {
    ...api,
    dashboard: async () => { await checar('dashboard'); return api.dashboard() },
    clientes: envolver(api.clientes, 'clientes'),
    produtos: envolver(api.produtos, 'produtos'),
    orcamentos: envolver(api.orcamentos, 'orcamentos'),
    pagamentos: envolver(api.pagamentos, 'pagamentos'),
    chatLogs: envolver(api.chatLogs, 'chatLogs'),
    faq: envolver(api.faq, 'faq'),
  }
}
