import { ArrowUp, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { atrasoDeDigitacao } from '../lib/chat'
import { useServicos } from '../lib/servicos'
import type { RespostaChat } from '../types'
import { Lumi } from './Lumi'

interface Mensagem {
  id: number
  autor: 'usuario' | 'lumi'
  texto: string
  relacionadas?: RespostaChat['relacionadas']
  naoEncontrou?: boolean
}

const esperarPadrao = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

const SAUDACAO = 'Oi! Eu sou a Lumi. Posso te explicar como usar o sistema: orçamentos, financeiro, produtos e clientes. O que você quer saber?'

/** Três pontinhos pulando, como o "digitando…" do WhatsApp. */
export function Digitando() {
  return (
    <div role="status" aria-label="Lumi está digitando" className="flex items-end gap-2 animate-entrar">
      <Lumi tamanho={34} estado="pensando" />
      <div className="flex gap-1.5 rounded-2xl rounded-bl-md bg-white px-4 py-3.5 shadow-card ring-1 ring-gelo-200">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2 w-2 animate-pontinho rounded-full bg-tinta-mute" style={{ animationDelay: `${i * 0.18}s` }} />
        ))}
      </div>
    </div>
  )
}

/**
 * Conversa com a Lumi. `esperar` e `atraso` podem ser trocados nos testes para não depender de relógio.
 * Fluxo: manda a pergunta → mostra "digitando…" → quando a resposta chega, espera o restante do tempo
 * simulado de pesquisa (pelo menos `atraso(resposta)`) antes de mostrá-la.
 */
export function Chat({ variante = 'painel', esperar = esperarPadrao, atraso = atrasoDeDigitacao }: {
  variante?: 'painel' | 'pagina'
  esperar?: (ms: number) => Promise<void>
  atraso?: (resposta: string) => number
}) {
  const { chat } = useServicos()
  const [mensagens, setMensagens] = useState<Mensagem[]>([{ id: 0, autor: 'lumi', texto: SAUDACAO }])
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [texto, setTexto] = useState('')
  const [digitando, setDigitando] = useState(false)
  const fim = useRef<HTMLDivElement>(null)
  const proximoId = useRef(1)

  useEffect(() => {
    let vivo = true
    void chat.sugestoes().then((s) => vivo && setSugestoes(s))
    return () => { vivo = false }
  }, [chat])

  useEffect(() => {
    fim.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [mensagens, digitando])

  async function enviar(pergunta: string) {
    const limpa = pergunta.trim()
    if (limpa.length < 2 || digitando) return
    setTexto('')
    setSugestoes([])
    setMensagens((m) => [...m, { id: proximoId.current++, autor: 'usuario', texto: limpa }])
    setDigitando(true)

    const inicio = Date.now()
    const resposta = await chat.perguntar(limpa)
    const restante = Math.max(0, atraso(resposta.resposta) - (Date.now() - inicio))
    await esperar(restante)

    setDigitando(false)
    setMensagens((m) => [...m, { id: proximoId.current++, autor: 'lumi', texto: resposta.resposta, relacionadas: resposta.relacionadas, naoEncontrou: !resposta.encontrou }])
  }

  function aoEnviar(e: FormEvent) {
    e.preventDefault()
    void enviar(texto)
  }

  const ultimaId = mensagens[mensagens.length - 1]?.id

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex-1 space-y-4 overflow-y-auto ${variante === 'pagina' ? 'px-5 py-6 sm:px-8' : 'px-4 py-4'}`} aria-live="polite">
        {mensagens.map((m) =>
          m.autor === 'usuario' ? (
            <div key={m.id} className="flex animate-entrar justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-noite-900 px-4 py-2.5 text-[15px] leading-relaxed text-white">{m.texto}</p>
            </div>
          ) : (
            <div key={m.id} className="flex animate-entrar items-end gap-2">
              <Lumi tamanho={34} estado={m.naoEncontrou ? 'ocioso' : 'feliz'} />
              <div className="max-w-[85%]">
                <p className="rounded-2xl rounded-bl-md bg-white px-4 py-2.5 text-[15px] leading-relaxed text-tinta shadow-card ring-1 ring-gelo-200">{m.texto}</p>
                {m.relacionadas && m.relacionadas.length > 0 && m.id === ultimaId && !digitando && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="w-full text-xs text-tinta-mute">{m.naoEncontrou ? 'Talvez você queira saber:' : 'Veja também:'}</span>
                    {m.relacionadas.map((r) => (
                      <button key={r.id} onClick={() => void enviar(r.pergunta)} className="rounded-full border border-gelo-300 bg-white px-3 py-1 text-left text-[13px] text-tinta-soft hover:border-lume-500 hover:bg-lume-50 hover:text-tinta">
                        {r.pergunta}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ),
        )}
        {digitando && <Digitando />}
        {sugestoes.length > 0 && !digitando && (
          <div className="flex flex-wrap gap-2 pl-10">
            {sugestoes.map((s) => (
              <button key={s} onClick={() => void enviar(s)} className="flex items-center gap-1.5 rounded-full border border-lume-300 bg-lume-50 px-3.5 py-1.5 text-left text-[13.5px] font-medium text-lume-700 hover:bg-lume-100">
                <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden /> {s}
              </button>
            ))}
          </div>
        )}
        <div ref={fim} />
      </div>

      <form onSubmit={aoEnviar} className="border-t border-gelo-200 bg-white p-3 sm:p-4">
        <div className="flex items-center gap-2 rounded-2xl border border-gelo-300 bg-gelo-50 py-1.5 pl-4 pr-1.5 focus-within:border-lume-500 focus-within:ring-2 focus-within:ring-lume-500/25">
          <label htmlFor="pergunta-lumi" className="sr-only">Sua pergunta</label>
          <input
            id="pergunta-lumi"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            maxLength={500}
            placeholder="Pergunte algo sobre o sistema…"
            className="min-w-0 flex-1 bg-transparent py-2 text-[15px] outline-none placeholder:text-tinta-mute focus-visible:!shadow-none focus-visible:!ring-0 focus-visible:!ring-offset-0"
            autoComplete="off"
          />
          <button type="submit" aria-label="Enviar pergunta" disabled={digitando || texto.trim().length < 2} className="grid h-10 w-10 place-items-center rounded-xl bg-lume-500 text-noite-950 transition-colors hover:bg-lume-400 disabled:cursor-not-allowed disabled:bg-gelo-200 disabled:text-tinta-mute">
            <ArrowUp className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </form>
    </div>
  )
}
