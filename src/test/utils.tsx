import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { criarApiLocal } from '../api/local'
import type { Servicos } from '../api'
import App from '../App'
import { AvisoProvider } from '../components/ui'
import type { ClienteChat, ContextoChat } from '../lib/chat'
import { ServicosProvider } from '../lib/servicos'
import type { RespostaChat } from '../types'

export const HOJE = new Date(2026, 10, 25)

export function memoria() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

export function chatFalso(respostas: Partial<RespostaChat> | ((p: string) => Partial<RespostaChat>) = {}, sugestoes: string[] = []): ClienteChat & { perguntas: string[]; contextos: (ContextoChat | undefined)[] } {
  const perguntas: string[] = []
  const contextos: (ContextoChat | undefined)[] = []
  return {
    perguntas,
    contextos,
    sugestoes: async () => sugestoes,
    perguntar: async (p, contexto) => {
      perguntas.push(p)
      contextos.push(contexto)
      const r = typeof respostas === 'function' ? respostas(p) : respostas
      return { encontrou: true, resposta: 'Resposta de teste.', fonte: null, confianca: 1, relacionadas: [], ...r }
    },
  }
}

export function servicosDeTeste(extra: Partial<Servicos> = {}): Servicos {
  return { api: criarApiLocal({ storage: memoria(), agora: () => HOJE }), chat: chatFalso(), ...extra }
}

export function renderizar(rota = '/', servicos: Servicos = servicosDeTeste()) {
  const r = render(
    <ServicosProvider servicos={servicos}>
      <AvisoProvider>
        <MemoryRouter initialEntries={[rota]}>
          <App />
        </MemoryRouter>
      </AvisoProvider>
    </ServicosProvider>,
  )
  return { ...r, servicos }
}
