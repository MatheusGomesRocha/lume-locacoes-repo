import { createContext, useContext, type ReactNode } from 'react'
import type { Servicos } from '../api'

const Contexto = createContext<Servicos | null>(null)

export function ServicosProvider({ servicos, children }: { servicos: Servicos; children: ReactNode }) {
  return <Contexto.Provider value={servicos}>{children}</Contexto.Provider>
}

export function useServicos(): Servicos {
  const s = useContext(Contexto)
  if (!s) throw new Error('useServicos precisa estar dentro de ServicosProvider')
  return s
}

/** Atalho: a maioria das telas só precisa da API de dados. */
export const useApi = () => useServicos().api
