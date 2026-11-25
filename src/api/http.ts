import { ApiError, type Api } from './tipos'

/** Driver da versão real: chama a API Laravel. */
export function criarApiHttp(baseUrl: string, buscar: typeof fetch = (...a) => fetch(...a)): Api {
  const base = baseUrl.replace(/\/$/, '')

  async function chamar<T>(metodo: string, caminho: string, corpo?: unknown): Promise<T> {
    let resp: Response
    try {
      resp = await buscar(base + caminho, {
        method: metodo,
        headers: { Accept: 'application/json', ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}) },
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      })
    } catch {
      throw new ApiError('Não foi possível conectar ao servidor. Verifique se a API está no ar.', 0)
    }
    if (resp.status === 204) return undefined as T
    const json = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const campos = (json.errors ?? {}) as Record<string, string[]>
      const primeiro = Object.values(campos)[0]?.[0]
      throw new ApiError(primeiro ?? json.message ?? 'Algo deu errado. Tente novamente.', resp.status, json.detalhes ?? [], campos)
    }
    return json as T
  }

  const qs = (params: Record<string, string | boolean | undefined>) => {
    const p = new URLSearchParams()
    Object.entries(params).forEach(([k, v]) => v !== undefined && v !== '' && p.set(k, String(v)))
    const s = p.toString()
    return s ? `?${s}` : ''
  }

  return {
    modo: 'http',
    dashboard: () => chamar('GET', '/dashboard'),
    clientes: {
      listar: (busca) => chamar('GET', '/clientes' + qs({ q: busca })),
      criar: (d) => chamar('POST', '/clientes', d),
      atualizar: (id, d) => chamar('PUT', `/clientes/${id}`, d),
      excluir: (id) => chamar('DELETE', `/clientes/${id}`),
    },
    produtos: {
      listar: (f = {}) => chamar('GET', '/produtos' + qs({ q: f.busca, categoria: f.categoria, ativo: f.ativo })),
      criar: (d) => chamar('POST', '/produtos', d),
      atualizar: (id, d) => chamar('PUT', `/produtos/${id}`, d),
      excluir: (id) => chamar('DELETE', `/produtos/${id}`),
    },
    orcamentos: {
      listar: (f = {}) => chamar('GET', '/orcamentos' + qs({ q: f.busca, status: f.status })),
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
      baixar: (id, pago_em, forma) => chamar('POST', `/pagamentos/${id}/baixar`, { pago_em, forma }),
    },
  }
}
