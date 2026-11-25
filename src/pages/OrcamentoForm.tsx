import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { errosDeCampos, mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, Campo, CaixaErro, Carregando, useAviso } from '../components/ui'
import { hojeISO, moeda } from '../lib/format'
import { calcularTotal, diarias } from '../lib/regras'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'
import type { OrcamentoForm as Form } from '../types'

interface Linha { produto_id: number; quantidade: number; valor_diaria?: number }

export default function OrcamentoForm() {
  const api = useApi()
  const navegar = useNavigate()
  const avisar = useAviso()
  const { id } = useParams()
  const editando = id !== undefined

  const apoio = useCarregar(async () => {
    const [clientes, produtos, atual] = await Promise.all([api.clientes.listar(), api.produtos.listar({ ativo: true }), editando ? api.orcamentos.obter(Number(id)) : null])
    return { clientes, produtos, atual }
  }, [api, id])

  const [clienteId, setClienteId] = useState(0)
  const [evento, setEvento] = useState('')
  const [retirada, setRetirada] = useState(hojeISO(7))
  const [devolucao, setDevolucao] = useState(hojeISO(8))
  const [desconto, setDesconto] = useState(0)
  const [observacoes, setObservacoes] = useState('')
  const [linhas, setLinhas] = useState<Linha[]>([])
  const [novoProduto, setNovoProduto] = useState(0)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    const o = apoio.dados?.atual
    if (!o) return
    setClienteId(o.cliente_id); setEvento(o.evento); setRetirada(o.data_retirada); setDevolucao(o.data_devolucao)
    setDesconto(o.desconto); setObservacoes(o.observacoes ?? '')
    setLinhas(o.itens.map((i) => ({ produto_id: i.produto_id, quantidade: i.quantidade, valor_diaria: i.valor_diaria })))
  }, [apoio.dados])

  if (apoio.carregando) return <Carregando />
  if (apoio.erro || !apoio.dados) return <CaixaErro mensagem={apoio.erro ?? 'Não foi possível carregar o formulário.'} aoTentar={() => void apoio.recarregar()} />
  const { clientes, produtos } = apoio.dados

  const nomeProduto = (pid: number) => produtos.find((p) => p.id === pid)
  // mesmo critério do servidor: item já existente mantém o preço congelado; item novo usa o preço atual
  const precoDe = (l: Linha) => l.valor_diaria ?? nomeProduto(l.produto_id)?.valor_diaria ?? 0
  const nDiarias = diarias(retirada, devolucao)
  const subtotal = calcularTotal(linhas.map((l) => ({ quantidade: l.quantidade, valor_diaria: precoDe(l) })), 1)
  const total = calcularTotal(linhas.map((l) => ({ quantidade: l.quantidade, valor_diaria: precoDe(l) })), nDiarias, desconto)
  const disponiveis = produtos.filter((p) => !linhas.some((l) => l.produto_id === p.id))

  function adicionar() {
    if (!novoProduto) return
    setLinhas((l) => [...l, { produto_id: novoProduto, quantidade: 1 }])
    setNovoProduto(0)
  }

  async function salvar(e: FormEvent) {
    e.preventDefault()
    setSalvando(true)
    setErros({})
    const dados: Form = { cliente_id: clienteId, evento, data_retirada: retirada, data_devolucao: devolucao, desconto: Number(desconto) || 0, observacoes, itens: linhas.map((l) => ({ produto_id: l.produto_id, quantidade: Number(l.quantidade) })) }
    try {
      const salvo = editando ? await api.orcamentos.atualizar(Number(id), dados) : await api.orcamentos.criar(dados)
      avisar(editando ? 'Orçamento atualizado.' : `Orçamento ${salvo.numero} criado.`)
      navegar(`/orcamentos/${salvo.id}`)
    } catch (err) {
      const campos = errosDeCampos(err)
      setErros(campos)
      if (!Object.keys(campos).length) avisar(mensagemDeErro(err), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <form onSubmit={salvar} noValidate>
      <Cabecalho titulo={editando ? `Editar orçamento ${apoio.dados.atual?.numero ?? ''}` : 'Novo orçamento'} descricao="Escolha o cliente, o período e os itens. O total é calculado por diária." />

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <div className="space-y-6">
          <section className="cartao grid gap-4 p-6 sm:grid-cols-2" aria-label="Dados do evento">
            <Campo rotulo="Cliente" erro={erros.cliente_id}>{(i, aria) => (
              <select id={i} {...aria} className={`entrada ${erros.cliente_id ? 'entrada-erro' : ''}`} value={clienteId} onChange={(e) => setClienteId(Number(e.target.value))}>
                <option value={0}>Selecione…</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>)}</Campo>
            <Campo rotulo="Evento" erro={erros.evento}>{(i, aria) => <input id={i} {...aria} className={`entrada ${erros.evento ? 'entrada-erro' : ''}`} placeholder="Ex.: Casamento Ana e Pedro" value={evento} onChange={(e) => setEvento(e.target.value)} />}</Campo>
            <Campo rotulo="Retirada" erro={erros.data_retirada}>{(i, aria) => <input id={i} {...aria} type="date" className={`entrada ${erros.data_retirada ? 'entrada-erro' : ''}`} value={retirada} onChange={(e) => setRetirada(e.target.value)} />}</Campo>
            <Campo rotulo="Devolução" erro={erros.data_devolucao}>{(i, aria) => <input id={i} {...aria} type="date" min={retirada} className={`entrada ${erros.data_devolucao ? 'entrada-erro' : ''}`} value={devolucao} onChange={(e) => setDevolucao(e.target.value)} />}</Campo>
            <Campo rotulo="Observações" className="sm:col-span-2">{(i) => <textarea id={i} rows={2} className="entrada" value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />}</Campo>
          </section>

          <section className="cartao p-6" aria-labelledby="t-itens">
            <h2 id="t-itens" className="text-lg font-bold text-noite-900">Itens</h2>
            {erros.itens && <p role="alert" className="mt-2 text-sm font-medium text-red-600">{erros.itens}</p>}
            {linhas.length === 0 ? (
              <p className="mt-3 rounded-xl bg-gelo-50 p-4 text-sm text-tinta-soft">Nenhum item ainda. Escolha um produto abaixo para adicionar.</p>
            ) : (
              <ul className="mt-3 divide-y divide-gelo-200">
                {linhas.map((l, n) => {
                  const p = nomeProduto(l.produto_id)
                  const erroLinha = erros[`itens.${n}.produto_id`] ?? erros[`itens.${n}.quantidade`]
                  return (
                    <li key={l.produto_id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-40 flex-1"><p className="font-semibold text-noite-900">{p?.nome ?? `Produto ${l.produto_id}`}</p><p className="text-sm text-tinta-mute">{p?.codigo} · {moeda(precoDe(l))} por diária</p>{erroLinha && <p className="text-xs font-medium text-red-600">{erroLinha}</p>}</div>
                      <label className="sr-only" htmlFor={`qtd-${l.produto_id}`}>Quantidade de {p?.nome}</label>
                      <input id={`qtd-${l.produto_id}`} type="number" min={1} className="entrada w-24 text-right" value={l.quantidade} onChange={(e) => setLinhas((ls) => ls.map((x, i) => (i === n ? { ...x, quantidade: Number(e.target.value) } : x)))} />
                      <p className="w-28 text-right font-semibold tabular-nums">{moeda(precoDe(l) * l.quantidade)}</p>
                      <button type="button" onClick={() => setLinhas((ls) => ls.filter((_, i) => i !== n))} aria-label={`Remover ${p?.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="mt-4 flex gap-2">
              <label className="sr-only" htmlFor="add-produto">Adicionar produto</label>
              <select id="add-produto" className="entrada flex-1" value={novoProduto} onChange={(e) => setNovoProduto(Number(e.target.value))}>
                <option value={0}>Adicionar produto…</option>
                {disponiveis.map((p) => <option key={p.id} value={p.id}>{p.codigo} · {p.nome} · {moeda(p.valor_diaria)}</option>)}
              </select>
              <Botao type="button" variante="secundario" onClick={adicionar} disabled={!novoProduto}><Plus className="h-4 w-4" aria-hidden /> Adicionar</Botao>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <section className="cartao p-6" aria-label="Resumo">
            <h2 className="text-lg font-bold text-noite-900">Resumo</h2>
            <dl className="mt-4 space-y-2.5 text-[15px]">
              <div className="flex justify-between"><dt className="text-tinta-soft">Itens por diária</dt><dd className="tabular-nums">{moeda(subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-soft">Diárias</dt><dd className="tabular-nums">× {nDiarias}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-tinta-soft"><label htmlFor="desconto">Desconto (R$)</label></dt><dd><input id="desconto" type="number" min={0} step="0.01" className={`entrada w-32 text-right ${erros.desconto ? 'entrada-erro' : ''}`} value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} /></dd></div>
              <div className="flex items-baseline justify-between border-t border-gelo-200 pt-3"><dt className="font-semibold">Total</dt><dd className="font-display text-[28px] font-bold tabular-nums text-noite-900">{moeda(total)}</dd></div>
            </dl>
            {erros.desconto && <p className="mt-1 text-xs font-medium text-red-600">{erros.desconto}</p>}
            <Botao type="submit" carregando={salvando} className="mt-5 w-full">{editando ? 'Salvar alterações' : 'Criar orçamento'}</Botao>
            <Botao type="button" variante="fantasma" className="mt-2 w-full" onClick={() => navegar(-1)}>Cancelar</Botao>
          </section>
        </aside>
      </div>
    </form>
  )
}
