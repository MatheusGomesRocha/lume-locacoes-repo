import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { errosDeCampos, mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, Campo, CaixaErro, Carregando, Modal, Selo, Vazio, useAviso } from '../components/ui'
import type { FiltroPagamento } from '../api/tipos'
import { dataBR, hojeISO, moeda, rotuloForma } from '../lib/format'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'
import { FORMAS, type FormaPagamento, type Pagamento } from '../types'

const filtros: [FiltroPagamento, string][] = [['todos', 'Todas'], ['pendente', 'A receber'], ['atrasado', 'Em atraso'], ['pago', 'Pagas'], ['cancelado', 'Canceladas']]

export default function Financeiro() {
  const api = useApi()
  const avisar = useAviso()
  const [filtro, setFiltro] = useState<FiltroPagamento>('todos')
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.pagamentos.listar(filtro), [api, filtro])
  const [baixando, setBaixando] = useState<Pagamento | null>(null)
  const [data, setData] = useState(hojeISO())
  const [forma, setForma] = useState<FormaPagamento>('pix')
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  const hoje = hojeISO()
  const situacao = (p: Pagamento) => (p.status === 'pendente' && p.vencimento < hoje ? 'atrasado' : p.status)
  const totalLista = (dados ?? []).filter((p) => p.status !== 'cancelado').reduce((s, p) => s + p.valor, 0)

  function abrir(p: Pagamento) {
    setErros({}); setData(hojeISO()); setForma('pix'); setBaixando(p)
  }

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (!baixando) return
    setSalvando(true)
    setErros({})
    try {
      await api.pagamentos.baixar(baixando.id, data, forma)
      avisar('Pagamento registrado.')
      setBaixando(null)
      await recarregar()
    } catch (err) {
      const campos = errosDeCampos(err)
      setErros(campos)
      if (!Object.keys(campos).length) avisar(mensagemDeErro(err), 'erro')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <>
      <Cabecalho titulo="Financeiro" descricao="Cobranças geradas quando os orçamentos são aprovados. Registre aqui o que já foi recebido." />

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar cobranças">
        {filtros.map(([valor, rotulo]) => (
          <button key={valor} onClick={() => setFiltro(valor)} aria-pressed={filtro === valor} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${filtro === valor ? 'bg-noite-900 text-white' : 'bg-white text-tinta-soft ring-1 ring-gelo-300 hover:bg-gelo-100'}`}>{rotulo}</button>
        ))}
      </div>

      {carregando ? <Carregando /> : erro ? <CaixaErro mensagem={erro} aoTentar={() => void recarregar()} /> : (
        <div className="cartao overflow-hidden">
          {dados!.length === 0 ? <Vazio titulo="Nenhuma cobrança aqui" texto="Aprove um orçamento para gerar a primeira cobrança." /> : (
            <>
              <table className="w-full text-left text-[15px]">
                <thead className="hidden bg-gelo-50 text-sm text-tinta-soft md:table-header-group"><tr><th className="px-5 py-3 font-medium">Orçamento</th><th className="px-5 py-3 font-medium">Vencimento</th><th className="px-5 py-3 text-right font-medium">Valor</th><th className="px-5 py-3 font-medium">Situação</th><th className="w-32" /></tr></thead>
                <tbody className="divide-y divide-gelo-200">
                  {dados!.map((p) => (
                    <tr key={p.id} className="hover:bg-gelo-50/60">
                      <td className="px-5 py-3.5"><Link to={`/orcamentos/${p.orcamento_id}`} className="font-semibold text-noite-900 hover:text-lume-700">{p.orcamento?.numero}</Link><p className="text-sm text-tinta-mute">{p.orcamento?.cliente?.nome}</p></td>
                      <td className="hidden px-5 py-3.5 text-tinta-soft md:table-cell">{dataBR(p.vencimento)}{p.pago_em && <span className="block text-sm text-tinta-mute">Pago em {dataBR(p.pago_em)}{p.forma ? ` · ${rotuloForma[p.forma]}` : ''}</span>}</td>
                      <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{moeda(p.valor)}</td>
                      <td className="px-5 py-3.5"><Selo status={situacao(p)} /></td>
                      <td className="px-5 py-3.5 text-right">{p.status === 'pendente' && <Botao pequeno variante="secundario" onClick={() => abrir(p)} aria-label={`Registrar pagamento do orçamento ${p.orcamento?.numero}`}>Registrar pagamento</Botao>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t border-gelo-200 bg-gelo-50 px-5 py-3 text-right text-sm text-tinta-soft">{dados!.length} {dados!.length === 1 ? 'cobrança' : 'cobranças'} · <span className="font-semibold tabular-nums text-noite-900">{moeda(totalLista)}</span> (sem canceladas)</p>
            </>
          )}
        </div>
      )}

      <Modal aberto={!!baixando} titulo="Registrar pagamento" aoFechar={() => setBaixando(null)}>
        <form onSubmit={confirmar} className="space-y-4" noValidate>
          <p className="text-[15px] text-tinta-soft">Orçamento {baixando?.orcamento?.numero} · <span className="font-semibold text-noite-900">{baixando ? moeda(baixando.valor) : ''}</span></p>
          <Campo rotulo="Data do pagamento" erro={erros.pago_em}>{(id, aria) => <input id={id} {...aria} type="date" max={hoje} className={`entrada ${erros.pago_em ? 'entrada-erro' : ''}`} value={data} onChange={(e) => setData(e.target.value)} />}</Campo>
          <Campo rotulo="Forma de pagamento" erro={erros.forma}>{(id) => <select id={id} className="entrada" value={forma} onChange={(e) => setForma(e.target.value as FormaPagamento)}>{FORMAS.map((f) => <option key={f} value={f}>{rotuloForma[f]}</option>)}</select>}</Campo>
          <div className="flex justify-end gap-2 pt-2"><Botao type="button" variante="secundario" onClick={() => setBaixando(null)}>Cancelar</Botao><Botao type="submit" carregando={salvando}>Confirmar pagamento</Botao></div>
        </form>
      </Modal>
    </>
  )
}
