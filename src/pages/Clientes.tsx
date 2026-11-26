import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { mensagemDeErro } from '../components/Formulario'
import { FormCliente } from '../components/formularios/FormCliente'
import { Botao, Cabecalho, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from '../components/ui'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'
import type { Cliente } from '../types'

export default function Clientes() {
  const api = useApi()
  const avisar = useAviso()
  const [busca, setBusca] = useState('')
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.clientes.listar(busca), [api, busca])
  const [editando, setEditando] = useState<Cliente | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Cliente | null>(null)

  function abrir(c: Cliente | 'novo') {
    setEditando(c)
  }

  async function aoSalvo() {
    avisar(editando === 'novo' ? 'Cliente cadastrado.' : 'Cliente atualizado.')
    setEditando(null)
    await recarregar()
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
        <FormCliente registro={editando === 'novo' ? null : editando} aoSalvo={() => void aoSalvo()} aoCancelar={() => setEditando(null)} />
      </Modal>

      <Confirmar aberto={!!excluindo} titulo="Excluir cliente?" texto={`${excluindo?.nome ?? ''} será removido. Clientes que já têm orçamentos não podem ser excluídos.`} rotuloConfirmar="Excluir cliente" perigo aoConfirmar={() => void excluir()} aoFechar={() => setExcluindo(null)} />
    </>
  )
}
