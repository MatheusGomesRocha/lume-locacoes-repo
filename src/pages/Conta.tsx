import { useState, type FormEvent } from 'react'
import { errosDeCampos, mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, Campo, useAviso } from '../components/ui'
import { useApi } from '../lib/servicos'
import { useSessao } from '../lib/sessao'
import { ROTULO_PAPEL } from '../types'

export default function Conta() {
  const api = useApi()
  const avisar = useAviso()
  const { sessao, atualizar } = useSessao()
  const eu = sessao!.usuario
  const [nome, setNome] = useState(eu.nome)
  const [email, setEmail] = useState(eu.email)
  const [atual, setAtual] = useState('')
  const [nova, setNova] = useState('')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [geral, setGeral] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErros({}); setGeral(''); setEnviando(true)
    try {
      await api.auth.alterarMinhaConta({ nome, email, senha_atual: atual || undefined, nova_senha: nova || undefined })
      await atualizar()
      setAtual(''); setNova('')
      avisar('Seus dados foram atualizados.')
    } catch (err) {
      const campos = errosDeCampos(err)
      setErros(campos)
      if (!Object.keys(campos).length) setGeral(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <>
      <Cabecalho titulo="Minha conta" descricao={`${ROTULO_PAPEL[eu.papel]} · grupo ${eu.grupo?.nome ?? '—'}`} />
      <form onSubmit={enviar} className="cartao max-w-lg space-y-4 p-6" noValidate>
        <Campo rotulo="Nome" erro={erros.nome}>{(id, aria) => <input id={id} {...aria} className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} />}</Campo>
        <Campo rotulo="E-mail" erro={erros.email}>{(id, aria) => <input id={id} {...aria} type="email" className="entrada" value={email} onChange={(e) => setEmail(e.target.value)} />}</Campo>
        <Campo rotulo="Senha atual" erro={erros.senha_atual} dica="Só é preciso se for trocar a senha.">{(id, aria) => <input id={id} {...aria} type="password" autoComplete="current-password" className="entrada" value={atual} onChange={(e) => setAtual(e.target.value)} />}</Campo>
        <Campo rotulo="Nova senha" erro={erros.nova_senha} dica="Mínimo de 8 caracteres.">{(id, aria) => <input id={id} {...aria} type="password" autoComplete="new-password" className="entrada" value={nova} onChange={(e) => setNova(e.target.value)} />}</Campo>
        {geral && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{geral}</p>}
        <div className="flex justify-end"><Botao type="submit" carregando={enviando}>Salvar</Botao></div>
      </form>
    </>
  )
}
