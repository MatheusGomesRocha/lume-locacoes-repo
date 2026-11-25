import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { rotuloStatus } from '../lib/format'

/* ---------- Botão ---------- */
type Variante = 'primario' | 'secundario' | 'fantasma' | 'perigo'
const estilos: Record<Variante, string> = {
  primario: 'bg-noite-900 text-white hover:bg-noite-700 shadow-sm',
  secundario: 'bg-white text-tinta border border-gelo-300 hover:bg-gelo-100',
  fantasma: 'text-tinta-soft hover:bg-gelo-100 hover:text-tinta',
  perigo: 'bg-red-600 text-white hover:bg-red-700',
}

export function Botao({ variante = 'primario', pequeno, carregando, className = '', children, disabled, ...resto }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; pequeno?: boolean; carregando?: boolean }) {
  return (
    <button
      {...resto}
      disabled={disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${pequeno ? 'px-3 py-1.5 text-sm' : 'px-4 py-2.5 text-[15px]'} ${estilos[variante]} ${className}`}
    >
      {carregando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  )
}

/* ---------- Campo de formulário ---------- */
export function Campo({ rotulo, erro, dica, children, className = '' }: { rotulo: string; erro?: string; dica?: string; children: (id: string, aria: Record<string, unknown>) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-tinta">{rotulo}</label>
      {children(id, { 'aria-invalid': !!erro, 'aria-describedby': erro ? `${id}-erro` : undefined })}
      {dica && !erro && <p className="mt-1 text-xs text-tinta-mute">{dica}</p>}
      {erro && <p id={`${id}-erro`} className="mt-1 text-xs font-medium text-red-600">{erro}</p>}
    </div>
  )
}

/* ---------- Selo de status ---------- */
const coresSelo: Record<string, string> = {
  rascunho: 'bg-gelo-100 text-tinta-soft ring-gelo-300',
  enviado: 'bg-sky-50 text-sky-700 ring-sky-200',
  aprovado: 'bg-lume-50 text-lume-700 ring-lume-300',
  finalizado: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelado: 'bg-red-50 text-red-700 ring-red-200',
  pendente: 'bg-sky-50 text-sky-700 ring-sky-200',
  pago: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  atrasado: 'bg-red-50 text-red-700 ring-red-200',
}
export function Selo({ status }: { status: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${coresSelo[status] ?? coresSelo.rascunho}`}>{rotuloStatus(status)}</span>
}

/* ---------- Cabeçalho de página ---------- */
export function Cabecalho({ titulo, descricao, acoes }: { titulo: string; descricao?: string; acoes?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-noite-900">{titulo}</h1>
        {descricao && <p className="mt-1 max-w-xl text-[15px] text-tinta-soft">{descricao}</p>}
      </div>
      {acoes && <div className="flex flex-wrap gap-2">{acoes}</div>}
    </div>
  )
}

/* ---------- Estados ---------- */
export function Carregando({ texto = 'Carregando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center justify-center gap-2 py-16 text-tinta-soft">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {texto}
    </div>
  )
}

export function Vazio({ titulo, texto, acao }: { titulo: string; texto?: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <p className="font-display text-lg font-semibold text-noite-900">{titulo}</p>
      {texto && <p className="mt-1 max-w-sm text-sm text-tinta-soft">{texto}</p>}
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function CaixaErro({ mensagem, aoTentar }: { mensagem: string; aoTentar?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex-1">{mensagem}</div>
      {aoTentar && <button onClick={aoTentar} className="font-semibold underline">Tentar de novo</button>}
    </div>
  )
}

/* ---------- Modal ---------- */
export function Modal({ aberto, titulo, aoFechar, children, largo }: { aberto: boolean; titulo: string; aoFechar: () => void; children: ReactNode; largo?: boolean }) {
  useEffect(() => {
    if (!aberto) return
    const tecla = (e: KeyboardEvent) => e.key === 'Escape' && aoFechar()
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [aberto, aoFechar])
  if (!aberto) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-noite-950/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className={`animate-entrar max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-pop sm:rounded-2xl ${largo ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="flex items-center justify-between border-b border-gelo-200 px-6 py-4">
          <h2 className="text-lg font-bold text-noite-900">{titulo}</h2>
          <button onClick={aoFechar} aria-label="Fechar" className="rounded-lg p-1.5 text-tinta-mute hover:bg-gelo-100 hover:text-tinta"><X className="h-5 w-5" /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

export function Confirmar({ aberto, titulo, texto, rotuloConfirmar, perigo, aoConfirmar, aoFechar, carregando }: {
  aberto: boolean; titulo: string; texto: string; rotuloConfirmar: string; perigo?: boolean; aoConfirmar: () => void; aoFechar: () => void; carregando?: boolean
}) {
  return (
    <Modal aberto={aberto} titulo={titulo} aoFechar={aoFechar}>
      <p className="text-[15px] text-tinta-soft">{texto}</p>
      <div className="mt-6 flex justify-end gap-2">
        <Botao variante="secundario" onClick={aoFechar}>Voltar</Botao>
        <Botao variante={perigo ? 'perigo' : 'primario'} onClick={aoConfirmar} carregando={carregando}>{rotuloConfirmar}</Botao>
      </div>
    </Modal>
  )
}

/* ---------- Avisos (toast) ---------- */
interface Aviso { id: number; texto: string; tipo: 'ok' | 'erro' }
const ContextoAviso = createContext<(texto: string, tipo?: Aviso['tipo']) => void>(() => {})
export const useAviso = () => useContext(ContextoAviso)

export function AvisoProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const avisar = useCallback((texto: string, tipo: Aviso['tipo'] = 'ok') => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a, { id, texto, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), 4500)
  }, [])
  return (
    <ContextoAviso.Provider value={avisar}>
      {children}
      <div aria-live="polite" className="fixed bottom-24 right-4 z-[60] flex w-[min(92vw,360px)] flex-col gap-2 lg:bottom-6">
        {avisos.map((a) => (
          <div key={a.id} className={`animate-entrar flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm font-medium shadow-pop ${a.tipo === 'ok' ? 'bg-noite-900 text-white' : 'bg-red-600 text-white'}`}>
            {a.tipo === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-lume-400" aria-hidden /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />}
            {a.texto}
          </div>
        ))}
      </div>
    </ContextoAviso.Provider>
  )
}
