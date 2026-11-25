import { X } from 'lucide-react'
import { useState } from 'react'
import { Chat } from './Chat'
import { Lumi } from './Lumi'

/** Botão flutuante que abre a conversa com a Lumi em qualquer tela. */
export function Launcher() {
  const [aberto, setAberto] = useState(false)
  return (
    <>
      {aberto && (
        <section aria-label="Conversa com a Lumi" className="animate-entrar fixed inset-x-3 bottom-24 z-40 flex h-[min(560px,calc(100vh-8rem))] flex-col overflow-hidden rounded-3xl border border-gelo-200 bg-gelo-50 shadow-pop sm:inset-x-auto sm:right-6 sm:w-[390px]">
          <header className="flex items-center gap-3 bg-noite-900 px-4 py-3">
            <Lumi tamanho={40} estado="feliz" />
            <div className="flex-1 leading-tight">
              <p className="font-display text-base font-bold text-white">Lumi</p>
              <p className="flex items-center gap-1.5 text-xs text-white/65"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden /> Assistente de ajuda</p>
            </div>
            <button onClick={() => setAberto(false)} aria-label="Fechar conversa" className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"><X className="h-5 w-5" /></button>
          </header>
          <div className="min-h-0 flex-1"><Chat variante="painel" /></div>
        </section>
      )}
      <button
        onClick={() => setAberto((a) => !a)}
        aria-label={aberto ? 'Fechar assistente' : 'Abrir assistente'}
        aria-expanded={aberto}
        className="fixed bottom-5 right-5 z-40 grid h-16 w-16 place-items-center rounded-full bg-noite-900 shadow-pop ring-4 ring-white transition-transform hover:scale-105 sm:right-6"
      >
        <Lumi tamanho={46} flutuando={!aberto} />
      </button>
    </>
  )
}
