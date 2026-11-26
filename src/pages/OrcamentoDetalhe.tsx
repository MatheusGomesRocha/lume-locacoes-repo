import { ArrowLeft, Ban, CheckCircle2, PackageCheck, Pencil, Send, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../api/tipos'
import { mensagemDeErro } from '../components/Formulario'
import { Botao, CaixaErro, Carregando, Confirmar, Modal, Selo, useAviso } from '../components/ui'
import { dataBR, moeda, rotuloForma } from '../lib/format'
import type { Falta } from '../lib/regras'
import { podeAprovar, podeCancelar, podeEditar, podeEnviar, podeExcluir, podeFinalizar } from '../lib/regras'
import { useApi } from '../lib/servicos'
import { useSessao } from '../lib/sessao'
import { useCarregar } from '../lib/useCarregar'

type Acao = 'enviar' | 'aprovar' | 'finalizar' | 'cancelar' | 'excluir'
const textos: Record<Acao, { titulo: string; texto: string; botao: string; perigo?: boolean; ok: string }> = {
  enviar: { titulo: 'Marcar como enviado?', texto: 'Use quando a proposta já foi mandada ao cliente. Você ainda poderá editar.', botao: 'Marcar como enviado', ok: 'Orçamento marcado como enviado.' },
  aprovar: { titulo: 'Aprovar orçamento?', texto: 'Os itens ficam reservados no período e uma cobrança é criada com vencimento na data de retirada. Depois de aprovado, não dá mais para editar.', botao: 'Aprovar', ok: 'Orçamento aprovado. A cobrança foi criada no Financeiro.' },
  finalizar: { titulo: 'Finalizar locação?', texto: 'Confirma que os itens foram devolvidos. Eles voltam a ficar livres para outras locações.', botao: 'Finalizar', ok: 'Locação finalizada.' },
  cancelar: { titulo: 'Cancelar orçamento?', texto: 'Os itens são liberados e as cobranças pendentes são canceladas. Cobranças já pagas continuam registradas.', botao: 'Cancelar orçamento', perigo: true, ok: 'Orçamento cancelado.' },
  excluir: { titulo: 'Excluir orçamento?', texto: 'Ele some da lista e não dá para desfazer.', botao: 'Excluir', perigo: true, ok: 'Orçamento excluído.' },
}

export default function OrcamentoDetalhe() {
  const api = useApi()
  const { pode } = useSessao()
  const navegar = useNavigate()
  const avisar = useAviso()
  const { id } = useParams()
  const { dados: o, erro, carregando, recarregar } = useCarregar(() => api.orcamentos.obter(Number(id)), [api, id])
  const [acao, setAcao] = useState<Acao | null>(null)
  const [executando, setExecutando] = useState(false)
  const [faltas, setFaltas] = useState<Falta[] | null>(null)

  if (carregando) return <Carregando />
  if (erro || !o) return <CaixaErro mensagem={erro ?? 'Orçamento não encontrado.'} aoTentar={() => void recarregar()} />

  async function executar() {
    if (!acao) return
    setExecutando(true)
    try {
      await api.orcamentos[acao](o!.id)
      avisar(textos[acao].ok)
      if (acao === 'excluir') navegar('/orcamentos')
      else await recarregar()
    } catch (e) {
      if (e instanceof ApiError && e.detalhes.length) setFaltas(e.detalhes)
      else avisar(mensagemDeErro(e), 'erro')
    } finally {
      setExecutando(false)
      setAcao(null)
    }
  }

  const s = o.status
  return (
    <>
      <Link to="/orcamentos" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-tinta-soft hover:text-tinta"><ArrowLeft className="h-4 w-4" aria-hidden /> Orçamentos</Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3"><h1 className="text-[28px] font-bold leading-tight text-noite-900">Orçamento {o.numero}</h1><Selo status={s} /></div>
          <p className="mt-1 text-[15px] text-tinta-soft">{o.evento} · {o.cliente?.nome}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {pode('orcamentos.editar') && podeEditar(s) && <Link to={`/orcamentos/${o.id}/editar`}><Botao variante="secundario"><Pencil className="h-4 w-4" aria-hidden /> Editar</Botao></Link>}
          {pode('orcamentos.enviar') && podeEnviar(s) && <Botao variante="secundario" onClick={() => setAcao('enviar')}><Send className="h-4 w-4" aria-hidden /> Marcar como enviado</Botao>}
          {pode('orcamentos.aprovar') && podeAprovar(s) && <Botao onClick={() => setAcao('aprovar')}><CheckCircle2 className="h-4 w-4" aria-hidden /> Aprovar</Botao>}
          {pode('orcamentos.finalizar') && podeFinalizar(s) && <Botao onClick={() => setAcao('finalizar')}><PackageCheck className="h-4 w-4" aria-hidden /> Finalizar</Botao>}
          {pode('orcamentos.cancelar') && podeCancelar(s) && <Botao variante="secundario" onClick={() => setAcao('cancelar')}><Ban className="h-4 w-4" aria-hidden /> Cancelar</Botao>}
          {pode('orcamentos.excluir') && podeExcluir(s) && <Botao variante="fantasma" onClick={() => setAcao('excluir')}><Trash2 className="h-4 w-4" aria-hidden /> Excluir</Botao>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr]">
        <section className="cartao overflow-hidden" aria-labelledby="t-it">
          <h2 id="t-it" className="px-6 pt-5 text-lg font-bold text-noite-900">Itens</h2>
          <table className="mt-3 w-full text-left text-[15px]">
            <thead className="bg-gelo-50 text-sm text-tinta-soft"><tr><th className="px-6 py-2.5 font-medium">Produto</th><th className="px-3 py-2.5 text-right font-medium">Qtd.</th><th className="hidden px-3 py-2.5 text-right font-medium sm:table-cell">Diária</th><th className="px-6 py-2.5 text-right font-medium">Subtotal</th></tr></thead>
            <tbody className="divide-y divide-gelo-200">
              {o.itens.map((i) => (
                <tr key={i.produto_id}><td className="px-6 py-3"><p className="font-medium text-noite-900">{i.produto?.nome}</p><p className="text-sm text-tinta-mute">{i.produto?.codigo}</p></td><td className="px-3 py-3 text-right tabular-nums">{i.quantidade}</td><td className="hidden px-3 py-3 text-right tabular-nums text-tinta-soft sm:table-cell">{moeda(i.valor_diaria)}</td><td className="px-6 py-3 text-right font-semibold tabular-nums">{moeda(i.valor_diaria * i.quantidade)}</td></tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="space-y-6">
          <section className="cartao p-6" aria-label="Resumo">
            <dl className="space-y-2.5 text-[15px]">
              <div className="flex justify-between"><dt className="text-tinta-soft">Retirada</dt><dd>{dataBR(o.data_retirada)}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-soft">Devolução</dt><dd>{dataBR(o.data_devolucao)}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-soft">Diárias</dt><dd className="tabular-nums">{o.diarias}</dd></div>
              <div className="flex justify-between"><dt className="text-tinta-soft">Desconto</dt><dd className="tabular-nums">{moeda(o.desconto)}</dd></div>
              <div className="flex items-baseline justify-between border-t border-gelo-200 pt-3"><dt className="font-semibold">Total</dt><dd className="font-display text-[26px] font-bold tabular-nums text-noite-900">{moeda(o.total)}</dd></div>
            </dl>
            {o.observacoes && <p className="mt-4 rounded-xl bg-gelo-50 p-3 text-sm text-tinta-soft">{o.observacoes}</p>}
          </section>

          <section className="cartao p-6" aria-labelledby="t-cob">
            <h2 id="t-cob" className="text-lg font-bold text-noite-900">Cobranças</h2>
            {!o.pagamentos?.length ? <p className="mt-2 text-sm text-tinta-soft">A cobrança é criada quando o orçamento é aprovado.</p> : (
              <ul className="mt-3 divide-y divide-gelo-200">
                {o.pagamentos.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 py-3">
                    <div><p className="font-semibold tabular-nums">{moeda(p.valor)}</p><p className="text-sm text-tinta-mute">{p.status === 'pago' ? `Pago em ${dataBR(p.pago_em)} · ${rotuloForma[p.forma ?? ''] ?? ''}` : `Vence em ${dataBR(p.vencimento)}`}</p></div>
                    <Selo status={p.status} />
                  </li>
                ))}
              </ul>
            )}
            <Link to="/financeiro" className="mt-3 inline-block text-sm font-semibold text-lume-700 hover:text-lume-600">Ir para o Financeiro</Link>
          </section>
        </div>
      </div>

      {acao && <Confirmar aberto titulo={textos[acao].titulo} texto={textos[acao].texto} rotuloConfirmar={textos[acao].botao} perigo={textos[acao].perigo} carregando={executando} aoConfirmar={() => void executar()} aoFechar={() => setAcao(null)} />}

      <Modal aberto={!!faltas} titulo="Não há estoque suficiente" aoFechar={() => setFaltas(null)}>
        <p className="text-[15px] text-tinta-soft">Outros orçamentos aprovados já usam estes itens no mesmo período:</p>
        <ul className="mt-3 divide-y divide-gelo-200 rounded-xl border border-gelo-200">
          {faltas?.map((f) => <li key={f.produto_id} className="flex justify-between gap-3 px-4 py-3 text-sm"><span className="font-medium">{f.produto}</span><span className="text-tinta-soft">pediu {f.solicitado}, livre {f.disponivel}</span></li>)}
        </ul>
        <div className="mt-5 flex justify-end"><Botao onClick={() => setFaltas(null)}>Entendi</Botao></div>
      </Modal>
    </>
  )
}
