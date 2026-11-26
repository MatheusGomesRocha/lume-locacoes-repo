import type { Chamada, RespostaChat } from '../types'
import type { SpecConsulta } from './catalogo'
import { hojeISO } from './format'

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
  /** Estado da conversa do agente (criar orçamento/cliente falando). Volta como veio na resposta anterior. */
  agente?: Record<string, unknown> | null
  /** Respostas que o master escreveu (só na demonstração: na versão real o Laravel anexa). */
  /** Consultas aprovadas pelo master (só na demonstração: na versão real o Laravel anexa). */
  catalogo?: SpecConsulta[]
  faqExtra?: { id: number; modulo: string; pergunta: string; resposta: string; palavras_chave: string[] }[]
}

export interface ClienteChat {
  sugestoes(): Promise<string[]>
  perguntar(pergunta: string, contexto?: ContextoChat): Promise<RespostaChat>
}

const MAX_PERGUNTAS_NO_CONTEXTO = 3
const MAX_VOLTAS_DO_AGENTE = 5

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
export function criarClienteChat(
  config: Config,
  buscar: typeof fetch = (...a) => fetch(...a),
  tempoLimiteMs = 30_000,
  /** Executa as consultas que o assistente pede (ler dados). Sem isto, pedidos de consulta viram "indisponível". */
  executar?: (consulta: Chamada) => Promise<unknown>,
  hoje: () => string = () => hojeISO(),
): ClienteChat {
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
      const corpo: Record<string, unknown> = { pergunta, hoje: hoje() }
      if (contexto?.historico.length) corpo.historico = contexto.historico
      if (contexto?.ultimoId) corpo.ultimo_id = contexto.ultimoId
      if (contexto?.agente) corpo.agente = contexto.agente
      if (config.tipo === 'direto' && contexto?.faqExtra?.length) {
        corpo.faq_extra = contexto.faqExtra.map(({ id, modulo, pergunta, resposta, palavras_chave }) => ({ id, modulo, pergunta, resposta, palavras_chave }))
      }

      if (config.tipo === 'direto' && contexto?.catalogo?.length) corpo.catalogo = contexto.catalogo

      async function enviar(c: Record<string, unknown>): Promise<RespostaChat> {
        try {
          const r = await chamar('/chat', { method: 'POST', body: JSON.stringify(c) })
          if (r.status === 429) {
            return { ...RESPOSTA_INDISPONIVEL, resposta: 'Muitas perguntas em pouco tempo. Aguarde um minuto e tente de novo.' }
          }
          const dados = await r.json().catch(() => null)
          if (dados && typeof dados.resposta === 'string') return dados as RespostaChat
          return RESPOSTA_INDISPONIVEL
        } catch {
          return RESPOSTA_INDISPONIVEL
        }
      }

      const primeira = await enviar(corpo)
      if (!primeira.consultas?.length) return primeira.confianca === 0 && !primeira.encontrou && !primeira.fonte ? primeira : { ...primeira, voltas: 1 }

      // O assistente pediu dados: o front lê pela mesma API das telas e manda o resultado na volta seguinte.
      if (!executar) return RESPOSTA_INDISPONIVEL
      async function ler(consultas: Chamada[]) {
        const resultados = []
        for (const consulta of consultas.slice(0, 3)) {
          try {
            resultados.push({ nome: consulta.nome, args: consulta.args, resultado: await executar!(consulta) })
          } catch (e) {
            const semPermissao = (e as { status?: number }).status === 403
            resultados.push({ nome: consulta.nome, args: consulta.args, resultado: { erro: semPermissao ? 'o usuário não tem permissão para ver estes dados' : 'não foi possível consultar agora' } })
          }
        }
        return resultados
      }

      // Consulta simples (sem agente): uma volta só; se ainda pedir consulta, desiste em vez de entrar em laço.
      if (!primeira.agente) {
        const segunda = await enviar({ ...corpo, resultados: await ler(primeira.consultas) })
        return segunda.consultas?.length ? RESPOSTA_INDISPONIVEL : { ...segunda, voltas: 2, ferramentas: primeira.consultas.map((c) => c.nome) }
      }

      // Agente: cada volta devolve o estado da conversa junto dos resultados. Teto de voltas evita laço.
      let resposta = primeira
      const ferramentas: string[] = []
      let voltas = 1
      while (resposta.consultas?.length && voltas <= MAX_VOLTAS_DO_AGENTE) {
        ferramentas.push(...resposta.consultas.map((c) => c.nome))
        resposta = await enviar({ ...corpo, agente: resposta.agente, resultados: await ler(resposta.consultas) })
        voltas += 1
      }
      return resposta.consultas?.length ? RESPOSTA_INDISPONIVEL : { ...resposta, voltas, ferramentas }
    },
  }
}
