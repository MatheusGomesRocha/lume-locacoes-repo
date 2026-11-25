import { Chat } from '../components/Chat'
import { Lumi } from '../components/Lumi'

export default function Assistente() {
  return (
    <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="relative overflow-hidden rounded-3xl bg-noite-900 p-7 text-white lg:self-start">
        <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-lume-500/10 blur-2xl" aria-hidden />
        <Lumi tamanho={150} estado="feliz" flutuando className="relative mx-auto" />
        <h1 className="relative mt-4 text-[26px] font-bold leading-tight">Oi, eu sou a Lumi</h1>
        <p className="relative mt-2 text-[15px] leading-relaxed text-white/70">
          Tiro dúvidas sobre como usar o sistema: criar orçamentos, cobrar, cadastrar produtos e clientes.
        </p>
        <p className="relative mt-4 rounded-xl bg-white/8 p-3 text-[13px] leading-relaxed text-white/65">
          Ainda não consulto os seus números (valores, listas, totais). Para isso, use o Painel e o Financeiro.
        </p>
      </aside>
      <section aria-label="Conversa com a Lumi" className="flex h-[min(680px,calc(100vh-7rem))] flex-col overflow-hidden rounded-3xl border border-gelo-200 bg-gelo-50 shadow-card">
        <Chat variante="pagina" />
      </section>
    </div>
  )
}
