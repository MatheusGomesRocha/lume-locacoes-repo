import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Api } from '../api/tipos'
import { EVENTO_SESSAO_EXPIRADA } from '../api/http'
import type { Sessao } from '../types'

interface ContextoSessao {
  /** `undefined` enquanto confere a sessão guardada; `null` sem login. */
  sessao: Sessao | null | undefined
  entrar(email: string, senha: string): Promise<void>
  sair(): Promise<void>
  /** Relê usuário e permissões (ex.: depois de editar a própria conta). */
  atualizar(): Promise<void>
  /** Tem a permissão "modulo.acao"? Qualquer uma, se passar várias. */
  pode(...permissoes: string[]): boolean
}

const Contexto = createContext<ContextoSessao | null>(null)

export function SessaoProvider({ api, children }: { api: Api; children: ReactNode }) {
  const [sessao, setSessao] = useState<Sessao | null | undefined>(undefined)

  useEffect(() => {
    let vivo = true
    void (async () => {
      await api.auth.pronta()
      const salva = api.auth.salva()
      if (vivo) setSessao(salva)
      if (!salva) return
      // o grupo pode ter mudado desde o último acesso: confere de novo com o servidor
      try {
        const nova = await api.auth.atualizar()
        if (vivo) setSessao(nova)
      } catch (e) {
        if (vivo && (e as { status?: number }).status === 401) setSessao(null)
      }
    })()
    const expirou = () => setSessao(null)
    window.addEventListener(EVENTO_SESSAO_EXPIRADA, expirou)
    return () => { vivo = false; window.removeEventListener(EVENTO_SESSAO_EXPIRADA, expirou) }
  }, [api])

  const entrar = useCallback(async (email: string, senha: string) => setSessao(await api.auth.entrar(email, senha)), [api])
  const sair = useCallback(async () => { await api.auth.sair(); setSessao(null) }, [api])
  const atualizar = useCallback(async () => setSessao(await api.auth.atualizar()), [api])

  const valor = useMemo<ContextoSessao>(() => ({
    sessao, entrar, sair, atualizar,
    pode: (...p) => !!sessao && p.some((x) => sessao.permissoes.includes(x)),
  }), [sessao, entrar, sair, atualizar])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useSessao(): ContextoSessao {
  const c = useContext(Contexto)
  if (!c) throw new Error('useSessao precisa estar dentro de SessaoProvider')
  return c
}
