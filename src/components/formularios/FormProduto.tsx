import { useState, type FormEvent } from 'react'
import { useApi } from '../../lib/servicos'
import type { Produto, ProdutoForm } from '../../types'
import { Botao, Campo, useAviso } from '../ui'
import { errosDeCampos, mensagemDeErro } from '../Formulario'

export const PRODUTO_VAZIO: ProdutoForm = { codigo: '', nome: '', categoria: '', descricao: '', valor_diaria: 0, valor_reposicao: 0, quantidade: 1, ativo: true }

interface Props {
  registro?: Produto | null
  inicial?: Partial<ProdutoForm>
  /** Categorias já existentes, para sugerir no campo. */
  categorias?: string[]
  aoSalvo: (produto: Produto) => void
  aoCancelar: () => void
  compacto?: boolean
}

/** O formulário de produto. É o mesmo na tela de Produtos e dentro do chat. */
export function FormProduto({ registro, inicial, categorias = [], aoSalvo, aoCancelar, compacto }: Props) {
  const api = useApi()
  const avisar = useAviso()
  const [form, setForm] = useState<ProdutoForm>(() =>
    registro
      ? { codigo: registro.codigo, nome: registro.nome, categoria: registro.categoria, descricao: registro.descricao ?? '', valor_diaria: registro.valor_diaria, valor_reposicao: registro.valor_reposicao, quantidade: registro.quantidade, ativo: registro.ativo }
      : { ...PRODUTO_VAZIO, ...inicial },
  )
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const largo = compacto ? '' : 'sm:col-span-2'

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErros({})
    try {
      const dados: ProdutoForm = { ...form, descricao: form.descricao || null, valor_diaria: Number(form.valor_diaria), valor_reposicao: Number(form.valor_reposicao) || 0, quantidade: Number(form.quantidade) }
      aoSalvo(registro ? await api.produtos.atualizar(registro.id, dados) : await api.produtos.criar(dados))
    } catch (err) {
      const campos = errosDeCampos(err)
      setErros(campos)
      if (!Object.keys(campos).length) avisar(mensagemDeErro(err), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  const set = (campo: keyof ProdutoForm) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [campo]: e.target.value }))
  const lista = compacto ? 'categorias-chat' : 'categorias'

  return (
    <form onSubmit={salvar} className={`grid gap-4 ${compacto ? '' : 'sm:grid-cols-2'}`} noValidate>
      <Campo rotulo="Código" erro={erros.codigo}>{(id, aria) => <input id={id} {...aria} className={`entrada ${erros.codigo ? 'entrada-erro' : ''}`} value={form.codigo} onChange={set('codigo')} autoFocus={!compacto} />}</Campo>
      <Campo rotulo="Categoria" erro={erros.categoria}>{(id, aria) => <input id={id} {...aria} list={lista} className={`entrada ${erros.categoria ? 'entrada-erro' : ''}`} value={form.categoria} onChange={set('categoria')} />}</Campo>
      <datalist id={lista}>{categorias.map((c) => <option key={c} value={c} />)}</datalist>
      <Campo rotulo="Nome" erro={erros.nome} className={largo}>{(id, aria) => <input id={id} {...aria} className={`entrada ${erros.nome ? 'entrada-erro' : ''}`} value={form.nome} onChange={set('nome')} />}</Campo>
      <Campo rotulo="Valor da diária (R$)" erro={erros.valor_diaria}>{(id, aria) => <input id={id} {...aria} type="number" min="0" step="0.01" className={`entrada ${erros.valor_diaria ? 'entrada-erro' : ''}`} value={form.valor_diaria} onChange={set('valor_diaria')} />}</Campo>
      <Campo rotulo="Valor de reposição (R$)" erro={erros.valor_reposicao} dica="Quanto custa repor se for danificado.">{(id) => <input id={id} type="number" min="0" step="0.01" className="entrada" value={form.valor_reposicao} onChange={set('valor_reposicao')} />}</Campo>
      <Campo rotulo="Quantidade em estoque" erro={erros.quantidade}>{(id, aria) => <input id={id} {...aria} type="number" min="0" step="1" className={`entrada ${erros.quantidade ? 'entrada-erro' : ''}`} value={form.quantidade} onChange={set('quantidade')} />}</Campo>
      <label className="flex items-center gap-2.5 self-end pb-2.5 text-[15px] font-medium"><input type="checkbox" className="h-4 w-4 rounded border-gelo-300 accent-lume-500" checked={form.ativo} onChange={(e) => setForm((f) => ({ ...f, ativo: e.target.checked }))} /> Ativo (aparece nos orçamentos)</label>
      <Campo rotulo="Descrição" className={largo}>{(id) => <textarea id={id} rows={2} className="entrada" value={form.descricao ?? ''} onChange={set('descricao')} />}</Campo>
      <div className={`mt-2 flex justify-end gap-2 ${largo}`}>
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
        <Botao type="submit" carregando={salvando}>Salvar produto</Botao>
      </div>
    </form>
  )
}
