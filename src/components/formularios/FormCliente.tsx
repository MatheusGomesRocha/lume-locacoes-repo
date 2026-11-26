import { useState, type FormEvent } from 'react'
import { useApi } from '../../lib/servicos'
import type { Cliente, ClienteForm } from '../../types'
import { Botao, Campo, useAviso } from '../ui'
import { errosDeCampos, mensagemDeErro } from '../Formulario'

export const CLIENTE_VAZIO: ClienteForm = { nome: '', tipo: 'PF', documento: '', email: '', telefone: '', cidade: '', observacoes: '' }

interface Props {
  /** Cliente que está sendo editado; sem ele, é um cadastro novo. */
  registro?: Cliente | null
  /** Valores para já vir preenchido (o assistente usa isto). */
  inicial?: Partial<ClienteForm>
  aoSalvo: (cliente: Cliente) => void
  aoCancelar: () => void
  /** Uma coluna só, para caber dentro do chat. */
  compacto?: boolean
}

/** O formulário de cliente. É o mesmo na tela de Clientes e dentro do chat, com as mesmas regras (quem valida é a API). */
export function FormCliente({ registro, inicial, aoSalvo, aoCancelar, compacto }: Props) {
  const api = useApi()
  const avisar = useAviso()
  const [form, setForm] = useState<ClienteForm>(() =>
    registro
      ? { nome: registro.nome, tipo: registro.tipo, documento: registro.documento ?? '', email: registro.email ?? '', telefone: registro.telefone ?? '', cidade: registro.cidade ?? '', observacoes: registro.observacoes ?? '' }
      : { ...CLIENTE_VAZIO, ...inicial },
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const largo = compacto ? '' : 'sm:col-span-2'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErros({})
    try {
      const dados = { ...form, documento: form.documento || null, email: form.email || null, telefone: form.telefone || null, cidade: form.cidade || null, observacoes: form.observacoes || null }
      aoSalvo(registro ? await api.clientes.atualizar(registro.id, dados) : await api.clientes.criar(dados))
    } catch (err) {
      const campos = errosDeCampos(err)
      setErros(campos)
      if (!Object.keys(campos).length) avisar(mensagemDeErro(err), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const set = (campo: keyof ClienteForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <form onSubmit={salvar} className={`grid gap-4 ${compacto ? '' : 'sm:grid-cols-2'}`} noValidate>
      <Campo rotulo="Nome" erro={erros.nome} className={largo}>{(id, aria) => <input id={id} {...aria} className={`entrada ${erros.nome ? 'entrada-erro' : ''}`} value={form.nome} onChange={set('nome')} autoFocus={!compacto} />}</Campo>
      <Campo rotulo="Tipo" erro={erros.tipo}>{(id) => <select id={id} className="entrada" value={form.tipo} onChange={set('tipo')}><option value="PF">Pessoa física</option><option value="PJ">Empresa</option></select>}</Campo>
      <Campo rotulo="CPF ou CNPJ" erro={erros.documento}>{(id) => <input id={id} className="entrada" value={form.documento ?? ''} onChange={set('documento')} />}</Campo>
      <Campo rotulo="E-mail" erro={erros.email}>{(id, aria) => <input id={id} {...aria} type="email" className={`entrada ${erros.email ? 'entrada-erro' : ''}`} value={form.email ?? ''} onChange={set('email')} />}</Campo>
      <Campo rotulo="Telefone" erro={erros.telefone}>{(id) => <input id={id} className="entrada" value={form.telefone ?? ''} onChange={set('telefone')} />}</Campo>
      <Campo rotulo="Cidade" erro={erros.cidade} className={largo}>{(id) => <input id={id} className="entrada" value={form.cidade ?? ''} onChange={set('cidade')} />}</Campo>
      <Campo rotulo="Observações" className={largo}>{(id) => <textarea id={id} rows={compacto ? 2 : 3} className="entrada" value={form.observacoes ?? ''} onChange={set('observacoes')} />}</Campo>
      <div className={`mt-2 flex justify-end gap-2 ${largo}`}>
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
        <Botao type="submit" carregando={salvando}>Salvar cliente</Botao>
      </div>
    </form>
  )
}
