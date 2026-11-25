import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errosDeCampos, mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, Campo, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from '../components/ui'
import { moeda } from '../lib/format'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'
import type { Produto, ProdutoForm } from '../types'

const vazio: ProdutoForm = { codigo: '', nome: '', categoria: '', descricao: '', valor_diaria: 0, valor_reposicao: 0, quantidade: 1, ativo: true }

export default function Produtos() {
  const api = useApi()
  const avisar = useAviso()
  const [busca, setBusca] = useState('')
  const [categoria, setCategoria] = useState('')
  const todos = useCarregar(() => api.produtos.listar(), [api])
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.produtos.listar({ busca, categoria }), [api, busca, categoria])
  const [editando, setEditando] = useState<Produto | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Produto | null>(null)
  const [form, setForm] = useState<ProdutoForm>(vazio)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const categorias = [...new Set((todos.dados ?? []).map((p) => p.categoria))].sort()

  function abrir(p: Produto | 'novo') {
    setErros({})
    setForm(p === 'novo' ? vazio : { codigo: p.codigo, nome: p.nome, categoria: p.categoria, descricao: p.descricao ?? '', valor_diaria: p.valor_diaria, valor_reposicao: p.valor_reposicao, quantidade: p.quantidade, ativo: p.ativo })
    setEditando(p)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErros({})
    try {
      const dados: ProdutoForm = { ...form, descricao: form.descricao || null, valor_diaria: Number(form.valor_diaria), valor_reposicao: Number(form.valor_reposicao) || 0, quantidade: Number(form.quantidade) }
      if (editando === 'novo') await api.produtos.criar(dados)
      else if (editando) await api.produtos.atualizar(editando.id, dados)
      avisar(editando === 'novo' ? 'Produto cadastrado.' : 'Produto atualizado.')
      setEditando(null)
      await Promise.all([recarregar(), todos.recarregar()])
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
      await api.produtos.excluir(excluindo.id)
      avisar('Produto excluído.')
      await Promise.all([recarregar(), todos.recarregar()])
    } catch (err) {
      avisar(mensagemDeErro(err), 'erro')
    }
    setExcluindo(null)
  }

  const set = (campo: keyof ProdutoForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [campo]: e.target.value }))

  return (
    <>
      <Cabecalho titulo="Produtos" descricao="O acervo disponível para locação, com preço da diária e quantidade em estoque." acoes={<Botao onClick={() => abrir('novo')}><Plus className="h-4 w-4" aria-hidden /> Novo produto</Botao>} />

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
                      <button onClick={() => abrir(p)} aria-label={`Editar ${p.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-gelo-100 hover:text-tinta"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setExcluindo(p)} aria-label={`Excluir ${p.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      <Modal aberto={editando !== null} titulo={editando === 'novo' ? 'Novo produto' : 'Editar produto'} aoFechar={() => setEditando(null)} largo>
        <form onSubmit={salvar} className="grid gap-4 sm:grid-cols-2" noValidate>
          <Campo rotulo="Código" erro={erros.codigo}>{(id, aria) => <input id={id} {...aria} className={`entrada ${erros.codigo ? 'entrada-erro' : ''}`} value={form.codigo} onChange={set('codigo')} autoFocus />}</Campo>
          <Campo rotulo="Categoria" erro={erros.categoria}>{(id, aria) => <input id={id} {...aria} list="categorias" className={`entrada ${erros.categoria ? 'entrada-erro' : ''}`} value={form.categoria} onChange={set('categoria')} />}</Campo>
          <datalist id="categorias">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
          <Campo rotulo="Nome" erro={erros.nome} className="sm:col-span-2">{(id, aria) => <input id={id} {...aria} className={`entrada ${erros.nome ? 'entrada-erro' : ''}`} value={form.nome} onChange={set('nome')} />}</Campo>
          <Campo rotulo="Valor da diária (R$)" erro={erros.valor_diaria}>{(id, aria) => <input id={id} {...aria} type="number" min="0" step="0.01" className={`entrada ${erros.valor_diaria ? 'entrada-erro' : ''}`} value={form.valor_diaria} onChange={set('valor_diaria')} />}</Campo>
          <Campo rotulo="Valor de reposição (R$)" erro={erros.valor_reposicao} dica="Quanto custa repor se for danificado.">{(id) => <input id={id} type="number" min="0" step="0.01" className="entrada" value={form.valor_reposicao} onChange={set('valor_reposicao')} />}</Campo>
          <Campo rotulo="Quantidade em estoque" erro={erros.quantidade}>{(id, aria) => <input id={id} {...aria} type="number" min="0" step="1" className={`entrada ${erros.quantidade ? 'entrada-erro' : ''}`} value={form.quantidade} onChange={set('quantidade')} />}</Campo>
          <label className="flex items-center gap-2.5 self-end pb-2.5 text-[15px] font-medium"><input type="checkbox" className="h-4 w-4 rounded border-gelo-300 accent-lume-500" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} /> Ativo (aparece nos orçamentos)</label>
          <Campo rotulo="Descrição" className="sm:col-span-2">{(id) => <textarea id={id} rows={2} className="entrada" value={form.descricao ?? ''} onChange={set('descricao')} />}</Campo>
          <div className="mt-2 flex justify-end gap-2 sm:col-span-2">
            <Botao type="button" variante="secundario" onClick={() => setEditando(null)}>Cancelar</Botao>
            <Botao type="submit" carregando={salvando}>Salvar produto</Botao>
          </div>
        </form>
      </Modal>

      <Confirmar aberto={!!excluindo} titulo="Excluir produto?" texto={`${excluindo?.nome ?? ''} será removido do acervo. Se já foi usado em orçamentos, desmarque "Ativo" em vez de excluir.`} rotuloConfirmar="Excluir produto" perigo aoConfirmar={() => void excluir()} aoFechar={() => setExcluindo(null)} />
    </>
  )
}
