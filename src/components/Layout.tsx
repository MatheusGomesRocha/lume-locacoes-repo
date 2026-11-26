import { Banknote, Boxes, History, KeyRound, LayoutDashboard, LogOut, Menu, MessageCircle, RotateCcw, ScrollText, ShieldCheck, UserCog, Users, X } from 'lucide-react'
import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useServicos } from '../lib/servicos'
import { useSessao } from '../lib/sessao'
import { Launcher } from './Launcher'
import { Confirmar, useAviso } from './ui'

/** `permissao`: basta ter uma. `so: master` aparece só para o master. */
const itens: { para: string; rotulo: string; Icone: typeof Users; fim?: boolean; permissao?: string[]; so?: 'master' }[] = [
  { para: '/', rotulo: 'Painel', Icone: LayoutDashboard, fim: true, permissao: ['painel.ver'] },
  { para: '/orcamentos', rotulo: 'Orçamentos', Icone: ScrollText, permissao: ['orcamentos.ver'] },
  { para: '/financeiro', rotulo: 'Financeiro', Icone: Banknote, permissao: ['financeiro.ver'] },
  { para: '/produtos', rotulo: 'Produtos', Icone: Boxes, permissao: ['produtos.ver'] },
  { para: '/clientes', rotulo: 'Clientes', Icone: Users, permissao: ['clientes.ver'] },
  { para: '/assistente', rotulo: 'Assistente', Icone: MessageCircle, fim: true, permissao: ['assistente.usar'] },
  { para: '/assistente/conversas', rotulo: 'Conversas', Icone: History, permissao: ['assistente.conversas'] },
  { para: '/usuarios', rotulo: 'Usuários', Icone: UserCog, permissao: ['usuarios.ver'] },
  { para: '/grupos', rotulo: 'Grupos', Icone: ShieldCheck, so: 'master' },
]

function Marca() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-lume-400 text-noite-950">
        <svg viewBox="0 0 32 32" className="h-5 w-5" aria-hidden><path d="M16 5a7 7 0 0 0-4 12.7V20a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.3A7 7 0 0 0 16 5Z" fill="currentColor" /><rect x="13" y="23" width="6" height="2.4" rx="1.2" fill="currentColor" /></svg>
      </span>
      <div className="leading-tight">
        <p className="font-display text-lg font-bold text-white">Lume</p>
        <p className="-mt-0.5 text-xs text-white/55">Locações</p>
      </div>
    </div>
  )
}

export function Layout() {
  const [menu, setMenu] = useState(false)
  const [confirmando, setConfirmando] = useState(false)
  const { api } = useServicos()
  const { sessao, pode, sair } = useSessao()
  const visiveis = itens.filter((i) => (i.so ? sessao?.usuario.papel === i.so : !i.permissao || pode(...i.permissao)))
  const avisar = useAviso()
  const { pathname } = useLocation()

  async function restaurar() {
    await api.restaurarExemplo?.()
    setConfirmando(false)
    avisar('Dados de exemplo restaurados.')
    setTimeout(() => window.location.reload(), 600)
  }

  const nav = (
    <nav className="mt-8 flex flex-1 flex-col gap-1" aria-label="Principal">
      {visiveis.map(({ para, rotulo, Icone, fim }) => (
        <NavLink
          key={para}
          to={para}
          end={fim}
          onClick={() => setMenu(false)}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[15px] font-medium transition-colors ${isActive ? 'bg-white/10 text-white' : 'text-white/65 hover:bg-white/5 hover:text-white'}`
          }
        >
          {({ isActive }) => (
            <>
              <Icone className={`h-[18px] w-[18px] ${isActive ? 'text-lume-400' : ''}`} aria-hidden />
              {rotulo}
            </>
          )}
        </NavLink>
      ))}
      <div className="mt-auto space-y-3">
      <div className="rounded-2xl bg-white/5 p-4">
        <p className="truncate text-sm font-semibold text-white">{sessao?.usuario.nome}</p>
        <p className="truncate text-xs text-white/55">{sessao?.usuario.grupo?.nome}</p>
        <div className="mt-3 flex items-center gap-4 text-xs font-semibold text-lume-300">
          <NavLink to="/conta" onClick={() => setMenu(false)} className="flex items-center gap-1.5 hover:text-lume-400"><KeyRound className="h-3.5 w-3.5" aria-hidden /> Minha conta</NavLink>
          <button onClick={() => void sair()} className="flex items-center gap-1.5 hover:text-lume-400"><LogOut className="h-3.5 w-3.5" aria-hidden /> Sair</button>
        </div>
      </div>
      {api.modo === 'local' && (
        <div className="rounded-2xl bg-white/5 p-4">
          <p className="text-sm font-semibold text-white">Versão de demonstração</p>
          <p className="mt-1 text-xs leading-relaxed text-white/60">Os dados ficam só neste navegador e são fictícios.</p>
          <button onClick={() => setConfirmando(true)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-lume-300 hover:text-lume-400">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restaurar dados de exemplo
          </button>
        </div>
      )}
      </div>
    </nav>
  )

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <aside className="hidden flex-col bg-noite-900 p-5 lg:sticky lg:top-0 lg:flex lg:h-screen">
        <Marca />
        {nav}
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between bg-noite-900 px-4 py-3 lg:hidden">
        <Marca />
        <button onClick={() => setMenu(true)} aria-label="Abrir menu" className="rounded-lg p-2 text-white hover:bg-white/10"><Menu className="h-6 w-6" /></button>
      </header>
      {menu && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-noite-950/60" onClick={() => setMenu(false)} />
          <aside className="relative flex h-full w-72 flex-col bg-noite-900 p-5">
            <div className="flex items-center justify-between"><Marca /><button onClick={() => setMenu(false)} aria-label="Fechar menu" className="rounded-lg p-2 text-white hover:bg-white/10"><X className="h-5 w-5" /></button></div>
            {nav}
          </aside>
        </div>
      )}

      <main className="min-w-0 px-4 pb-28 pt-6 sm:px-8 lg:px-10 lg:pt-9">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>

      {pathname !== '/assistente' && pode('assistente.usar') && <Launcher />}
      <Confirmar aberto={confirmando} titulo="Restaurar dados de exemplo?" texto="Tudo o que você cadastrou ou alterou nesta demonstração será apagado e os dados fictícios voltam ao início." rotuloConfirmar="Restaurar" aoConfirmar={() => void restaurar()} aoFechar={() => setConfirmando(false)} />
    </div>
  )
}
