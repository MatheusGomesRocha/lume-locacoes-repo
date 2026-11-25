import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errosDeCampos, mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, Campo, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from '../components/ui'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'
import type { Cliente, ClienteForm } from '../types'

const vazio: ClienteForm = { nome: '', tipo: 'PF', documento: '', email: '', telefone: '', cidade: '', observacoes: '' }

export default function Clientes() {
  const api = useApi()
  const avisar = useAviso()
  const [busca, setBusca] = useState('')
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.clientes.listar(busca), [api, busca])
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Cliente | null>(null)
  const [form, setForm] = useState<ClienteForm>(vazio)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  function abrir(c: Cliente | 'novo') {
    setErros({})
    setForm(c === 'novo' ? vazio : { nome: c.nome, tipo: c.tipo, documento: c.documento ?? '', email: c.email ?? '', telefone: c.telefone ?? '', cidade: c.cidade ?? '', observacoes: c.observacoes ?? '' })
    setEditando(c)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErros({})
    try {
      const dados = { ...form, documento: form.documento || null, email: form.email || null, telefone: form.telefone || null, cidade: form.cidade || null, observacoes: form.observacoes || null }
      if (editando === 'novo') await api.clientes.criar(dados)
      else if (editando) await api.clientes.atualizar(editando.id, dados)
      avisar(editando === 'novo' ? 'Cliente cadastrado.' : 'Cliente atualizado.')
      setEditando(null)
      await recarregar()
    } catch (err) {
      const campos = errosDeCampos(err)
      setErros(campos)
      if (!Object.keys(campos).length) avisar(mensagemDeErro(err), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  async function excluir() {
    if (!excluindo) return
    try {
      await api.clientes.excluir(excluindo.id)
      avisar('Cliente excluído.')
      await recarregar()
    } catch (err) {
      avisar(mensagemDeErro(err), 'erro')
    }
    setExcluindo(null)
  }

  const set = (campo: keyof ClienteForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <>
      <Cabecalho titulo="Clientes" descricao="Quem aluga com você." acoes={<Botao onClick={() => abrir('novo')}><Plus className="h-4 w-4" aria-hidden /> Novo cliente</Botao>} />

      <div className="relative mb-4 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-mute" aria-hidden />
        <input aria-label="Buscar clientes" className="entrada pl-10" placeholder="Buscar por nome, documento, e-mail ou cidade" value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      {carregando ? <Carregando /> : erro ? <CaixaErro mensagem={erro} aoTentar={() => void recarregar()} /> : (
        <div className="cartao overflow-hidden">
          {dados!.length === 0 ? (
            <Vazio titulo={busca ? 'Nenhum cliente encontrado' : 'Nenhum cliente ainda'} texto={busca ? 'Tente outro nome ou limpe a busca.' : 'Cadastre o primeiro para começar a montar orçamentos.'} acao={!busca && <Botao onClick={() => abrir('novo')}>Novo cliente</Botao>} />
          ) : (
            <table className="w-full text-left text-[15px]">
              <thead className="hidden bg-gelo-50 text-sm text-tinta-soft sm:table-header-group">
                <tr><th className="px-5 py-3 font-medium">Nome</th><th className="px-5 py-3 font-medium">Contato</th><th className="px-5 py-3 font-medium">Cidade</th><th className="w-24" /></tr>
              </thead>
              <tbody className="divide-y divide-gelo-200">
                {dados!.map((c) => (
                  <tr key={c.id} className="hover:bg-gelo-50/60">
                    <td className="px-5 py-3.5"><p className="font-semibold text-noite-900">{c.nome}</p><p className="text-sm text-tinta-mute">{c.tipo === 'PJ' ? 'Empresa' : 'Pessoa física'}{c.documento ? ` · ${c.documento}` : ''}</p></td>
                    <td className="hidden px-5 py-3.5 text-tinta-soft sm:table-cell"><p>{c.email ?? '—'}</p><p className="text-sm text-tinta-mute">{c.telefone ?? ''}</p></td>
                    <td className="hidden px-5 py-3.5 text-tinta-soft sm:table-cell">{c.cidade ?? '—'}</td>
                    <td className="px-3 py-3.5"><div className="flex justify-end gap-1">
                      <button onClick={() => abrir(c)} aria-label={`Editar ${c.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-gelo-100 hover:text-tinta"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setExcluindo(c)} aria-label={`Excluir ${c.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal aberto={editando !== null} titulo={editando === 'novo' ? 'Novo cliente' : 'Editar cliente'} aoFechar={() => setEditando(null)} largo>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo rotulo="Nome" erro={erros.nome} className="sm:col-span-2">{(id, aria) => <input id={id} {...aria} className={`entrada ${erros.nome ? 'entrada-erro' : ''}`} value={form.nome} onChange={set('nome')} autoFocus />}</Campo>
          <Campo rotulo="Tipo" erro={erros.tipo}>{(id) => <select id={id} className="entrada" value={form.tipo} onChange={set('tipo')}><option value="PF">Pessoa física</option><option value="PJ">Empresa</option></select>}</Campo>
          <Campo rotulo="CPF ou CNPJ" erro={erros.documento}>{(id) => <input id={id} className="entrada" value={form.documento ?? ''} onChange={set('documento')} />}</Campo>
          <Campo rotulo="E-mail" erro={erros.email}>{(id, aria) => <input id={id} {...aria} type="email" className={`entrada ${erros.email ? 'entrada-erro' : ''}`} value={form.email ?? ''} onChange={set('email')} />}</Campo>
          <Campo rotulo="Telefone" erro={erros.telefone}>{(id) => <input id={id} className="entrada" value={form.telefone ?? ''} onChange={set('telefone')} />}</Campo>
          <Campo rotulo="Cidade" erro={erros.cidade} className="sm:col-span-2">{(id) => <input id={id} className="entrada" value={form.cidade ?? ''} onChange={set('cidade')} />}</Campo>
          <Campo rotulo="Observações" className="sm:col-span-2">{(id) => <textarea id={id} rows={3} className="entrada" value={form.observacoes ?? ''} onChange={set('observacoes')} />}</Campo>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
            <Botao type="submit" carregando={salvando}>Salvar cliente</Botao>
          </div>
        </form>
      </Modal>

      <Confirmar aberto={!!excluindo} titulo="Excluir cliente?" texto={`${excluindo?.nome ?? ''} será removido. Clientes que já têm orçamentos não podem ser excluídos.`} rotuloConfirmar="Excluir cliente" perigo aoConfirmar={() => void excluir()} aoFechar={() => setExcluindo(null)} />
    </>
  )
}
