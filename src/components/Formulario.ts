import { ApiError } from '../api/tipos'

/** Mensagens por campo vindas da API/driver; a primeira de cada campo. */
export function errosDeCampos(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {}
  return Object.fromEntries(Object.entries(e.campos).map(([k, v]) => [k, v[0]]))
}

export const mensagemDeErro = (e: unknown): string => (e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.')
