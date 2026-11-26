import { useState, type FormEvent } from 'react'
import { SENHA_DEMO } from '../api/acesso'
import { Botao } from '../components/ui'
import { Lumi } from '../components/Lumi'
import { useApi } from '../lib/servicos'
import { useSessao } from '../lib/sessao'

const CONTAS_DEMO = [
  { rotulo: 'Master', email: 'master@lume.com' },
  { rotulo: 'Administradora', email: 'admin@lume.com' },
  { rotulo: 'Atendimento', email: 'atendimento@lume.com' },
  { rotulo: 'Financeiro', email: 'financeiro@lume.com' },
]

export default function Login() {
  const { entrar } = useSessao()
  const demo = useApi().modo === 'local'
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErro('')
    setEnviando(true)
    try {
      await entrar(email, senha)
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Não foi possível entrar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-gelo-50 px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <Lumi tamanho={96} estado="feliz" className="mx-auto" />
          <h1 className="mt-3 text-2xl font-bold text-noite-900">Lume Locações</h1>
          <p className="text-sm text-tinta-soft">Entre para continuar.</p>
        </div>
        <form onSubmit={enviar} className="cartao space-y-4 p-6" noValidate>
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm font-medium text-tinta">E-mail</label>
            <input id="login-email" type="email" autoComplete="username" className="entrada" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label htmlFor="login-senha" className="mb-1 block text-sm font-medium text-tinta">Senha</label>
            <input id="login-senha" type="password" autoComplete="current-password" className="entrada" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          {erro && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{erro}</p>}
          <Botao type="submit" carregando={enviando} className="w-full">Entrar</Botao>
        </form>
        {demo && (
          <div className="mt-5 rounded-2xl bg-white/70 p-4 text-sm text-tinta-soft ring-1 ring-gelo-200">
            <p className="font-medium text-tinta">Demonstração: escolha uma conta</p>
            <p className="mt-0.5 text-xs">Senha de todas: {SENHA_DEMO}. Cada uma tem permissões diferentes.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {CONTAS_DEMO.map((c) => (
                <button key={c.email} type="button" onClick={() => { setEmail(c.email); setSenha(SENHA_DEMO); setErro('') }}
                  className="rounded-lg bg-gelo-100 px-3 py-1.5 text-xs font-semibold text-tinta hover:bg-gelo-200">{c.rotulo}</button>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
