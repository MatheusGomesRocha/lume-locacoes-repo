import { useEffect, useState } from 'react'
import type { Pagina, PedidoPagina } from '../types'
import { OPCOES_POR_PAGINA, POR_PAGINA_PADRAO, paginar } from './paginacao'
import { useCarregar } from './useCarregar'

const CHAVE = 'lume.por_pagina'

function lerPorPagina(): number {
  try {
    const n = Number(localStorage.getItem(CHAVE))
    return OPCOES_POR_PAGINA.includes(n) ? n : POR_PAGINA_PADRAO
  } catch {
    return POR_PAGINA_PADRAO
  }
}

/** Tamanho da página e página atual. A página volta para a 1 quando os filtros mudam. */
function usePosicao(filtros: unknown[]) {
  const chave = JSON.stringify(filtros)
  const [estado, setEstado] = useState({ chave, pagina: 1 })
  const [porPagina, setPor] = useState(lerPorPagina)
  const pagina = estado.chave === chave ? estado.pagina : 1
  return {
    pagina,
    porPagina,
    irPara: (n: number) => setEstado({ chave, pagina: n }),
    mudarPorPagina: (n: number) => {
      try { localStorage.setItem(CHAVE, String(n)) } catch { /* sem armazenamento: vale só nesta visita */ }
      setPor(n)
      setEstado({ chave, pagina: 1 })
    },
  }
}

export interface ControlePagina {
  total: number
  pagina: number
  porPagina: number
  ultimaPagina: number
  aoMudarPagina: (n: number) => void
  aoMudarPorPagina: (n: number) => void
}

/** Lista paginada pelo servidor (Laravel) ou pela demo: `dados` são só os itens da página atual. */
export function usePaginado<T>(buscar: (pg: PedidoPagina) => Promise<Pagina<T>>, filtros: unknown[]) {
  const pos = usePosicao(filtros)
  const r = useCarregar(() => buscar({ pagina: pos.pagina, porPagina: pos.porPagina }), [...filtros, pos.pagina, pos.porPagina])
  const resposta = r.dados
  // apagou o último item da última página: volta para a última que ainda existe
  useEffect(() => {
    if (resposta && resposta.dados.length === 0 && resposta.pagina > 1) pos.irPara(Math.max(1, resposta.ultima_pagina))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resposta])
  const controle: ControlePagina = {
    total: resposta?.total ?? 0, pagina: resposta?.pagina ?? pos.pagina, porPagina: pos.porPagina, ultimaPagina: resposta?.ultima_pagina ?? 1,
    aoMudarPagina: pos.irPara, aoMudarPorPagina: pos.mudarPorPagina,
  }
  return { dados: resposta ? resposta.dados : null, erro: r.erro, carregando: r.carregando, recarregar: r.recarregar, controle }
}

/** Para listas que a tela já filtra por conta própria (Conversas): pagina o que sobrou do filtro. */
export function usePaginaLocal<T>(itens: T[], filtros: unknown[]) {
  const pos = usePosicao(filtros)
  const p = paginar(itens, { pagina: pos.pagina, porPagina: pos.porPagina })
  const controle: ControlePagina = { total: p.total, pagina: p.pagina, porPagina: pos.porPagina, ultimaPagina: p.ultima_pagina, aoMudarPagina: pos.irPara, aoMudarPorPagina: pos.mudarPorPagina }
  return { dados: p.dados, controle }
}
