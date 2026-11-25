import { useCallback, useEffect, useState } from 'react'

/** Carrega dados assíncronos e permite recarregar. `deps` refaz a busca quando mudam. */
export function useCarregar<T>(buscar: () => Promise<T>, deps: unknown[] = []) {
  const [dados, setDados] = useState<T | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [carregando, setCarregando] = useState(true)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const recarregar = useCallback(async () => {
    try {
      setErro(null)
      setDados(await buscar())
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Algo deu errado.')
    } finally {
      setCarregando(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  return { dados, erro, carregando, recarregar }
}
