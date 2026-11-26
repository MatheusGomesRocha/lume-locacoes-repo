import { useCallback, useEffect, useState } from 'react'

export const EVENTO_DADOS_ALTERADOS = 'lume:dados-alterados'

/** Avisa as telas abertas que algo foi cadastrado ou excluído por fora delas (pelo assistente). */
export const avisarDadosAlterados = () => window.dispatchEvent(new Event(EVENTO_DADOS_ALTERADOS))

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

  // O assistente pode cadastrar ou excluir registros: a tela aberta atualiza a lista sozinha.
  useEffect(() => {
    const aoAlterar = () => void recarregar()
    window.addEventListener(EVENTO_DADOS_ALTERADOS, aoAlterar)
    return () => window.removeEventListener(EVENTO_DADOS_ALTERADOS, aoAlterar)
  }, [recarregar])

  return { dados, erro, carregando, recarregar }
}
