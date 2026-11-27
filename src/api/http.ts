import { ApiError, type Api } from './tipos'
import type { PedidoPagina, Sessao } from '../types'

export const CHAVE_TOKEN = 'lume:token:v1'
export const CHAVE_SESSAO_HTTP = 'lume:sessao-http:v1'
export const EVENTO_SESSAO_EXPIRADA = 'lume:sessao-expirada'

/** Driver da versão real: chama a API Laravel. */
export function criarApiHttp(baseUrl: string, buscar: typeof fetch = (...a) => fetch(...a), storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage): Api {
  const base = baseUrl.replace(/\/$/, '')
  const token = () => storage.getItem(CHAVE_TOKEN)
  const guardar = (t: string | null, s: Sessao | null) => {
    if (t && s) { storage.setItem(CHAVE_TOKEN, t); storage.setItem(CHAVE_SESSAO_HTTP, JSON.stringify(s)) }
    else { storage.removeItem(CHAVE_TOKEN); storage.removeItem(CHAVE_SESSAO_HTTP) }
  }

  async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    let resp: Response
    try {
      resp = await buscar(base + caminho, {
        method: metodo,
        headers: { Accept: 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}), ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      })
    } catch {
      throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está no ar.', 0)
    }
    if (resp.status === 204) return undefined as T
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      // token vencido ou revogado: limpa e avisa o app (login com e-mail errado também dá 401, mas aí não havia sessão)
      if (resp.status === 401 && token()) { guardar(null, null); window.dispatchEvent(new Event(EVENTO_SESSAO_EXPIRADA)) }
      const campos = (json.errors ?? {}) as Record<string, string[]>
      const primeiro = Object.values(campos)[0]?.[0]
      throw new ApiError(primeiro ?? json.message ?? 'Algo deu errado. Tente novamente.', resp.status, json.detalhes ?? [], campos)
    }
    return json as T
  }

  const qs = (params: Record<string, string | number | boolean | undefined>) => {
    const p = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)))
    const s = p.toString()
    return s ? `?${s}` : ''
  }
  const pg = (p: PedidoPagina) => ({ pagina: p.pagina, por_pagina: p.porPagina })

  return {
    modo: 'http',
    auth: {
      async pronta() {},
      salva() {
        try { return token() ? (JSON.parse(storage.getItem(CHAVE_SESSAO_HTTP) ?? 'null') as Sessao | null) : null } catch { return null }
      },
      async entrar(email, senha) {
        const r = await chamar<Sessao & { token: string }>('POST', '/login', { email, senha })
        const { token: t, ...sessao } = r
        guardar(t, sessao)
        return sessao
      },
      async sair() {
        try { await chamar('POST', '/logout') } catch { /* sem rede ou token já vencido: sai do mesmo jeito */ }
        guardar(null, null)
      },
      async atualizar() {
        const s = await chamar<Sessao>('GET', '/eu')
        guardar(token(), s)
        return s
      },
      async alterarMinhaConta(d) {
        const s = await chamar<Sessao>('PUT', '/eu', d)
        guardar(token(), s)
        return s
      },
    },
    usuarios: {
      listar: () => chamar('GET', '/usuarios'),
      pagina: (p) => chamar('GET', '/usuarios' + qs(pg(p))),
      criar: (d) => chamar('POST', '/usuarios', d),
      atualizar: (id, d) => chamar('PUT', `/usuarios/${id}`, d),
      excluir: (id) => chamar('DELETE', `/usuarios/${id}`),
    },
    grupos: {
      listar: () => chamar('GET', '/grupos'),
      pagina: (p) => chamar('GET', '/grupos' + qs(pg(p))),
      criar: (d) => chamar('POST', '/grupos', d),
      atualizar: (id, d) => chamar('PUT', `/grupos/${id}`, d),
      excluir: (id) => chamar('DELETE', `/grupos/${id}`),
    },
    dashboard: () => chamar('GET', '/dashboard'),
    faq: {
      listar: () => chamar('GET', '/faq-itens'),
      criar: (d) => chamar('POST', '/faq-itens', d),
      atualizar: (id, d) => chamar('PUT', `/faq-itens/${id}`, d),
      excluir: (id) => chamar('DELETE', `/faq-itens/${id}`),
      paraAssistente: async () => [],
    },
    evolucao: {
      catalogo: () => chamar('GET', '/evolucao/catalogo'),
      paraAssistente: async () => [],
      listar: () => chamar('GET', '/evolucao'),
      analisar: () => chamar('POST', '/evolucao/analisar'),
      decidir: (id, aprovar) => chamar('POST', `/evolucao/${id}/decidir`, { aprovar }),
      desativar: (id) => chamar('POST', `/evolucao/${id}/desativar`),
      revisar: () => chamar('POST', '/evolucao/revisar'),
      aprovador: () => chamar('GET', '/evolucao/aprovador'),
      conferir: (id) => chamar('POST', `/evolucao/${id}/conferir`),
      parametrosDosExemplos: (id, hoje) => chamar('POST', `/evolucao/${id}/previa-parametros`, { hoje }),
    },
    chatLogs: {
      listar: (f = {}) => chamar('GET', '/chat-logs' + qs({ tipo: f.tipo, feedback: f.feedback })),
      pagina: (f = {}, p) => chamar('GET', '/chat-logs' + qs({ tipo: f.tipo, feedback: f.feedback, ...pg(p) })),
      registrar: (d) => chamar('POST', '/chat-logs', d),
      atualizar: (id, ajuste) => chamar('PATCH', `/chat-logs/${id}`, ajuste),
      limpar: () => chamar('DELETE', '/chat-logs'),
    },
    clientes: {
      listar: (busca) => chamar('GET', '/clientes' + qs({ q: busca })),
      pagina: (busca, p) => chamar('GET', '/clientes' + qs({ q: busca, ...pg(p) })),
      criar: (d) => chamar('POST', '/clientes', d),
      atualizar: (id, d) => chamar('PUT', `/clientes/${id}`, d),
      excluir: (id) => chamar('DELETE', `/clientes/${id}`),
    },
    produtos: {
      listar: (f = {}) => chamar('GET', '/produtos' + qs({ q: f.busca, categoria: f.categoria, ativo: f.ativo })),
      pagina: (f = {}, p) => chamar('GET', '/produtos' + qs({ q: f.busca, categoria: f.categoria, ativo: f.ativo, ...pg(p) })),
      criar: (d) => chamar('POST', '/produtos', d),
      atualizar: (id, d) => chamar('PUT', `/produtos/${id}`, d),
      excluir: (id) => chamar('DELETE', `/produtos/${id}`),
    },
    orcamentos: {
      listar: (f = {}) => chamar('GET', '/orcamentos' + qs({ q: f.busca, status: f.status })),
      pagina: (f = {}, p) => chamar('GET', '/orcamentos' + qs({ q: f.busca, status: f.status, ...pg(p) })),
      obter: (id) => chamar('GET', `/orcamentos/${id}`),
      criar: (d) => chamar('POST', '/orcamentos', d),
      atualizar: (id, d) => chamar('PUT', `/orcamentos/${id}`, d),
      excluir: (id) => chamar('DELETE', `/orcamentos/${id}`),
      enviar: (id) => chamar('POST', `/orcamentos/${id}/enviar`),
      aprovar: (id) => chamar('POST', `/orcamentos/${id}/aprovar`),
      finalizar: (id) => chamar('POST', `/orcamentos/${id}/finalizar`),
      cancelar: (id) => chamar('POST', `/orcamentos/${id}/cancelar`),
    },
    pagamentos: {
      listar: (filtro = 'todos') => chamar('GET', '/pagamentos' + qs({ status: filtro === 'todos' ? undefined : filtro })),
      pagina: (filtro = 'todos', p) => chamar('GET', '/pagamentos' + qs({ status: filtro === 'todos' ? undefined : filtro, ...pg(p) })),
      baixar: (id, pago_em, forma) => chamar('POST', `/pagamentos/${id}/baixar`, { pago_em, forma }),
    },
  }
}
