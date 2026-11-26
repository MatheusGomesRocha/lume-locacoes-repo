import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { ControlePagina } from '../lib/usePaginado'
import { OPCOES_POR_PAGINA } from '../lib/paginacao'

/** Rodapé das listas: "1–10 de 53", itens por página e anterior/próxima. */
export function Paginacao({ total, pagina, porPagina, ultimaPagina, aoMudarPagina, aoMudarPorPagina }: ControlePagina) {
  if (total === 0) return null
  const de = (pagina - 1) * porPagina + 1
  const ate = Math.min(total, pagina * porPagina)
  const botao = 'rounded-lg border border-gelo-200 p-2 text-tinta-soft hover:bg-gelo-100 disabled:cursor-not-allowed disabled:opacity-40'
  return (
    <nav aria-label="Paginação" className="flex flex-wrap items-center justify-between gap-3 border-t border-gelo-200 px-5 py-3 text-sm text-tinta-soft">
      <p>{de}–{ate} de {total}</p>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2">
          Por página
          <select aria-label="Itens por página" className="entrada !w-auto !py-1" value={porPagina} onChange={(e) => aoMudarPorPagina(Number(e.target.value))}>
            {OPCOES_POR_PAGINA.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <span>Página {pagina} de {ultimaPagina}</span>
        <button type="button" className={botao} aria-label="Página anterior" disabled={pagina <= 1} onClick={() => aoMudarPagina(pagina - 1)}><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" className={botao} aria-label="Próxima página" disabled={pagina >= ultimaPagina} onClick={() => aoMudarPagina(pagina + 1)}><ChevronRight className="h-4 w-4" /></button>
      </div>
    </nav>
  )
}
