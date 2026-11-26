import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { mensagemDeErro } from '../components/Formulario'
import { FormProduto } from '../components/formularios/FormProduto'
import { Botao, Cabecalho, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from '../components/ui'
import { moeda } from '../lib/format'
import { useApi } from '../lib/servicos'
import { useSessao } from '../lib/sessao'
import { useCarregar } from '../lib/useCarregar'
import type { Produto } from '../types'

export default function Produtos() {
  const api = useApi()
  const avisar = useAviso()
  const { pode } = useSessao()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const todos = useCarregar(() => api.produtos.listar(), [api])
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.produtos.listar({ busca, categoria }), [api, busca, categoria])
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Produto | null>(null)

  const categorias = [...new Set((todos.dados ?? []).map((p) => p.categoria))].sort()

  function abrir(p: Produto | 'novo') {
    setEditando(p)
  }

  async function aoSalvo() {
    avisar(editando === 'novo' ? 'Produto cadastrado.' : 'Produto atualizado.')
    setEditando(null)
    await Promise.all([recarregar(), todos.recarregar()])
  }

  async function excluir() {
    if (!excluindo) return
    try {
      await api.produtos.excluir(excluindo.id)
      avisar('Produto excluído.')
      await Promise.all([recarregar(), todos.recarregar()])
    } catch (err) {
      avisar(mensagemDeErro(err), 'erro')
    }
    setExcluindo(null)
  }

  return (
    <>
      <Cabecalho titulo="Produtos" descricao="O acervo disponível para locação, com preço da diária e quantidade em estoque." acoes={pode('produtos.criar') ? <Botao onClick={() => abrir('novo')}><Plus className="h-4 w-4" aria-hidden /> Novo produto</Botao> : undefined} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-60 flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-mute" aria-hidden />
          <input aria-label="Buscar produtos" className="entrada pl-10" placeholder="Buscar por nome ou código" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <select aria-label="Filtrar por categoria" className="entrada w-auto min-w-48" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categorias.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>

      {carregando ? <Carregando /> : erro ? <CaixaErro mensagem={erro} aoTentar={() => void recarregar()} /> : (
        <div className="cartao overflow-hidden">
          {dados!.length === 0 ? (
            <Vazio titulo="Nenhum produto encontrado" texto="Ajuste a busca ou cadastre um novo produto." />
          ) : (
            <table className="w-full text-left text-[15px]">
              <thead className="hidden bg-gelo-50 text-sm text-tinta-soft sm:table-header-group">
                <tr><th className="px-5 py-3 font-medium">Produto</th><th className="px-5 py-3 font-medium">Categoria</th><th className="px-5 py-3 text-right font-medium">Diária</th><th className="px-5 py-3 text-right font-medium">Estoque</th><th className="w-24" /></tr>
              </thead>
              <tbody className="divide-y divide-gelo-200">
                {dados!.map((p) => (
                  <tr key={p.id} className={`hover:bg-gelo-50/60 ${p.ativo ? '' : 'opacity-60'}`}>
                    <td className="px-5 py-3.5"><p className="font-semibold text-noite-900">{p.nome}</p><p className="text-sm text-tinta-mute">{p.codigo}{p.ativo ? '' : ' · Inativo'}</p></td>
                    <td className="hidden px-5 py-3.5 text-tinta-soft sm:table-cell">{p.categoria}</td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{moeda(p.valor_diaria)}</td>
                    <td className="hidden px-5 py-3.5 text-right tabular-nums text-tinta-soft sm:table-cell">{p.quantidade} un.</td>
                    <td className="px-3 py-3.5"><div className="flex justify-end gap-1">
                      {pode('produtos.editar') && <button onClick={() => abrir(p)} aria-label={`Editar ${p.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-gelo-100 hover:text-tinta"><Pencil className="h-4 w-4" /></button>}
                      {pode('produtos.excluir') && <button onClick={() => setExcluindo(p)} aria-label={`Excluir ${p.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal aberto={editando !== null} titulo={editando === 'novo' ? 'Novo produto' : 'Editar produto'} aoFechar={() => setEditando(null)} largo>
        <FormProduto registro={editando === 'novo' ? null : editando} categorias={categorias} aoSalvo={() => void aoSalvo()} aoCancelar={() => setEditando(null)} />
      </Modal>

      <Confirmar aberto={!!excluindo} titulo="Excluir produto?" texto={`${excluindo?.nome ?? ''} será removido do acervo. Se já foi usado em orçamentos, desmarque "Ativo" em vez de excluir.`} rotuloConfirmar="Excluir produto" perigo aoConfirmar={() => void excluir()} aoFechar={() => setExcluindo(null)} />
    </>
  )
}
