import { criarClienteChat, type ClienteChat } from '../lib/chat'
import { criarApiHttp } from './http'
import { criarApiLocal } from './local'
import type { Api } from './tipos'

export interface Servicos {
  api: Api
  chat: ClienteChat
}

/** Escolhe o driver pelo build: VITE_DRIVER=local (GitHub Pages) ou http (Laravel). */
export function criarServicos(env: Record<string, string | undefined> = import.meta.env): Servicos {
  if (env.VITE_DRIVER === 'local') {
    return {
      api: criarApiLocal(),
      chat: criarClienteChat({ tipo: 'direto', url: env.VITE_IA_API_URL || 'http://127.0.0.1:8001' }),
    }
  }
  const url = env.VITE_API_URL || 'http://localhost:8000/api'
  return { api: criarApiHttp(url), chat: criarClienteChat({ tipo: 'laravel', url }) }
}
