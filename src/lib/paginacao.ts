import type { Pagina, PedidoPagina } from '../types'

export const POR_PAGINA_PADRAO = 10
export const OPCOES_POR_PAGINA = [10, 25, 50, 100]
/** O servidor também limita a este valor. */
export const MAXIMO_POR_PAGINA = 100

/** Corta a página pedida de uma lista inteira (a demo, que guarda tudo no navegador, pagina assim; o Laravel faz no banco). */
export function paginar<T>(todos: T[], { pagina, porPagina }: PedidoPagina): Pagina<T> {
  const por = Math.min(MAXIMO_POR_PAGINA, Math.max(1, Math.floor(porPagina) || POR_PAGINA_PADRAO))
  const ultima = Math.max(1, Math.ceil(todos.length / por))
  const atual = Math.min(Math.max(1, Math.floor(pagina) || 1), ultima)
  return { dados: todos.slice((atual - 1) * por, atual * por), total: todos.length, pagina: atual, por_pagina: por, ultima_pagina: ultima }
}

/** Dá a cada lista da demo o método `pagina`, em cima do `listar` dela (que já confere as permissões). */
export function comPaginas<A extends { clientes: any; produtos: any; orcamentos: any; pagamentos: any; usuarios: any; grupos: any; chatLogs: any }>(api: A): A {
  const dar = (grupo: any, semFiltro = false) => ({
    ...grupo,
    pagina: async (...args: unknown[]) => {
      const pg = args[args.length - 1] as PedidoPagina
      return paginar(await (semFiltro ? grupo.listar() : grupo.listar(args[0])), pg)
    },
  })
  return { ...api, clientes: dar(api.clientes), produtos: dar(api.produtos), orcamentos: dar(api.orcamentos), pagamentos: dar(api.pagamentos), usuarios: dar(api.usuarios, true), grupos: dar(api.grupos, true), chatLogs: dar(api.chatLogs) }
}
