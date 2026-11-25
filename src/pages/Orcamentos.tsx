import { Plus, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { Botao, Cabecalho, CaixaErro, Carregando, Selo, Vazio } from '../components/ui'
import { dataBR, moeda, rotuloStatus } from '../lib/format'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'
import { STATUS_ORCAMENTO, type StatusOrcamento } from '../types'

export default function Orcamentos() {
  const api = useApi()
  const [params, setParams] = useSearchParams()
  const status = (params.get('status') ?? '') as StatusOrcamento | ''
  const busca = params.get('q') ?? ''
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.orcamentos.listar({ busca, status }), [api, busca, status])

  const atualizar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(params)
    if (valor) novo.set(chave, valor)
    else novo.delete(chave)
    setParams(novo, { replace: true })
  }

  return (
    <>
      <Cabecalho titulo="Orçamentos" descricao="Monte propostas, aprove e acompanhe cada locação." acoes={<Link to="/orcamentos/novo"><Botao><Plus className="h-4 w-4" aria-hidden /> Novo orçamento</Botao></Link>} />

      <div className="mb-4 space-y-3">
        <div className="relative max-w-md">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-tinta-mute" aria-hidden />
          <input aria-label="Buscar orçamentos" className="entrada pl-10" placeholder="Buscar por número, cliente ou evento" value={busca} onChange={(e) => atualizar('q', e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por status">
          {[['', 'Todos'] as const, ...STATUS_ORCAMENTO.map((s) => [s, rotuloStatus(s)] as const)].map(([valor, rotulo]) => (
            <button key={valor} onClick={() => atualizar('status', valor)} aria-pressed={status === valor} className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${status === valor ? 'bg-noite-900 text-white' : 'bg-white text-tinta-soft ring-1 ring-gelo-300 hover:bg-gelo-100'}`}>{rotulo}</button>
          ))}
        </div>
      </div>

      {carregando ? <Carregando /> : erro ? <CaixaErro mensagem={erro} aoTentar={() => void recarregar()} /> : (
        <div className="cartao overflow-hidden">
          {dados!.length === 0 ? (
            <Vazio titulo="Nenhum orçamento encontrado" texto={busca || status ? 'Mude os filtros para ver outros orçamentos.' : 'Crie o primeiro orçamento para começar.'} acao={!busca && !status && <Link to="/orcamentos/novo"><Botao>Novo orçamento</Botao></Link>} />
          ) : (
            <table className="w-full text-left text-[15px]">
              <thead className="hidden bg-gelo-50 text-sm text-tinta-soft md:table-header-group">
                <tr><th className="px-5 py-3 font-medium">Nº</th><th className="px-5 py-3 font-medium">Evento</th><th className="px-5 py-3 font-medium">Período</th><th className="px-5 py-3 text-right font-medium">Total</th><th className="px-5 py-3 font-medium">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-gelo-200">
                {dados!.map((o) => (
                  <tr key={o.id} className="relative hover:bg-gelo-50/60">
                    <td className="px-5 py-3.5 font-semibold tabular-nums"><Link to={`/orcamentos/${o.id}`} className="text-noite-900 after:absolute after:inset-0 hover:text-lume-700">{o.numero}</Link></td>
                    <td className="px-5 py-3.5"><p className="font-medium text-noite-900">{o.evento}</p><p className="text-sm text-tinta-mute">{o.cliente?.nome}</p></td>
                    <td className="hidden px-5 py-3.5 text-tinta-soft md:table-cell">{dataBR(o.data_retirada)} a {dataBR(o.data_devolucao)}<span className="block text-sm text-tinta-mute">{o.diarias} {o.diarias === 1 ? 'diária' : 'diárias'}</span></td>
                    <td className="px-5 py-3.5 text-right font-semibold tabular-nums">{moeda(o.total)}</td>
                    <td className="px-5 py-3.5"><Selo status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  )
}
