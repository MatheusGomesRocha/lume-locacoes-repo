import type { RespostaChat } from '../types'

/**
 * Tempo de "digitando…" antes de mostrar a resposta, para parecer que o assistente está pesquisando.
 * Respostas longas demoram um pouco mais. Sempre entre 0,9 s e 2,5 s.
 */
export function atrasoDeDigitacao(resposta: string, aleatorio: () => number = Math.random): number {
  const porTamanho = Math.min(resposta.length * 8, 1200)
  const variacao = aleatorio() * 400
  return Math.round(Math.min(2500, 900 + porTamanho + variacao))
}

export const RESPOSTA_INDISPONIVEL: RespostaChat = {
  encontrou: false,
  resposta: 'O assistente está indisponível no momento. Tente novamente em instantes.',
  fonte: null,
  confianca: 0,
  relacionadas: [],
}

/** O que veio antes na conversa. A API não guarda nada: o front manda isto junto de cada pergunta. */
export interface ContextoChat {
  historico: string[]
  ultimoId?: string | null
}

export interface ClienteChat {
  sugestoes(): Promise<string[]>
  perguntar(pergunta: string, contexto?: ContextoChat): Promise<RespostaChat>
}

const MAX_PERGUNTAS_NO_CONTEXTO = 3

/**
 * Monta o contexto a partir das mensagens já trocadas (antes da pergunta nova):
 * as últimas perguntas do usuário e o id da resposta que a Lumi deu por último.
 */
export function montarContexto(mensagens: { autor: 'usuario' | 'lumi'; texto: string; fonteId?: string | null }[]): ContextoChat {
  const historico = mensagens.filter((m) => m.autor === 'usuario').map((m) => m.texto).slice(-MAX_PERGUNTAS_NO_CONTEXTO)
  const ultimaDaLumi = [...mensagens].reverse().find((m) => m.autor === 'lumi')
  return { historico, ultimoId: ultimaDaLumi?.fonteId ?? null }
}

type Config = { tipo: 'direto'; url: string } | { tipo: 'laravel'; url: string }

/**
 * Fala com o assistente.
 *  - "direto": navegador -> API Python (usado no GitHub Pages)
 *  - "laravel": navegador -> Laravel -> API Python (versão real; o Laravel esconde a API e o token)
 */
export function criarClienteChat(config: Config, buscar: typeof fetch = (...a) => fetch(...a), tempoLimiteMs = 30_000): ClienteChat {
  const base = config.url.replace(/\/$/, '')

  async function chamar(caminho: string, init?: RequestInit): Promise<Response> {
    const controle = new AbortController()
    const timer = setTimeout(() => controle.abort(), tempoLimiteMs)
    try {
      return await buscar(base + caminho, { ...init, signal: controle.signal, headers: { Accept: 'application/json', ...(init?.body ? { 'Content-Type': 'application/json' } : {}) } })
    } finally {
      clearTimeout(timer)
    }
  }

  return {
    async sugestoes() {
      try {
        const r = await chamar(config.tipo === 'direto' ? '/faq' : '/chat/sugestoes')
        if (!r.ok) return []
        const dados = await r.json()
        const perguntas: string[] = config.tipo === 'direto' ? dados.map((i: { pergunta: string }) => i.pergunta) : dados
        // embaralha uma cópia e pega 5, para variar as sugestões a cada visita
        return [...perguntas].sort(() => Math.random() - 0.5).slice(0, 5)
      } catch {
        return []
      }
    },

    async perguntar(pergunta, contexto) {
      try {
        const corpo: Record<string, unknown> = { pergunta }
        if (contexto?.historico.length) corpo.historico = contexto.historico
        if (contexto?.ultimoId) corpo.ultimo_id = contexto.ultimoId
        const r = await chamar('/chat', { method: 'POST', body: JSON.stringify(corpo) })
        if (r.status === 429) {
          return { ...RESPOSTA_INDISPONIVEL, resposta: 'Muitas perguntas em pouco tempo. Aguarde um minuto e tente de novo.' }
        }
        const dados = await r.json().catch(() => null)
        if (dados && typeof dados.resposta === 'string') return dados as RespostaChat
        return RESPOSTA_INDISPONIVEL
      } catch {
        return RESPOSTA_INDISPONIVEL
      }
    },
  }
}
