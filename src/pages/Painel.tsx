import { ArrowRight, CalendarDays } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Cabecalho, Carregando, CaixaErro, Vazio } from '../components/ui'
import { dataCurta, mesCurto, moeda, rotuloStatus } from '../lib/format'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'

function Indicador({ rotulo, valor, destaque, nota }: { rotulo: string; valor: string; destaque?: 'ok' | 'alerta'; nota?: string }) {
  return (
    <div className="cartao p-5">
      <p className="text-sm font-medium text-tinta-soft">{rotulo}</p>
      <p className={`mt-2 font-display text-[28px] font-bold tabular-nums leading-none ${destaque === 'alerta' ? 'text-red-600' : 'text-noite-900'}`}>{valor}</p>
      {nota && <p className="mt-2 text-xs text-tinta-mute">{nota}</p>}
    </div>
  )
}

export default function Painel() {
  const api = useApi()
  const { dados, erro, carregando, recarregar } = useCarregar(() => api.dashboard(), [api])

  if (carregando) return <Carregando />
  if (erro || !dados) return <CaixaErro mensagem={erro ?? 'Não foi possível carregar o painel.'} aoTentar={() => void recarregar()} />

  const grafico = dados.recebido_por_mes.map((m) => ({ ...m, rotulo: mesCurto(m.mes) }))
  const totalStatus = dados.orcamentos_por_status.reduce((s, x) => s + x.total, 0)
  const maxProduto = Math.max(1, ...dados.produtos_mais_alugados.map((p) => p.quantidade))

  return (
    <>
      <Cabecalho titulo="Painel" descricao="Como está o negócio hoje: o que entrou, o que falta receber e o que vem por aí." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador rotulo="Recebido no mês" valor={moeda(dados.recebido_mes)} />
        <Indicador rotulo="A receber" valor={moeda(dados.a_receber)} nota="Cobranças que ainda vão vencer" />
        <Indicador rotulo="Em atraso" valor={moeda(dados.em_atraso)} destaque={dados.em_atraso > 0 ? 'alerta' : undefined} nota={dados.em_atraso > 0 ? 'Vale cobrar essas hoje' : 'Nada atrasado'} />
        <Indicador rotulo="Orçamentos em aberto" valor={String(dados.orcamentos_em_aberto)} nota="Rascunhos e enviados" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <section className="cartao p-6" aria-labelledby="t-receb">
          <h2 id="t-receb" className="text-lg font-bold text-noite-900">Recebido por mês</h2>
          <p className="text-sm text-tinta-soft">Últimos 6 meses</p>
          <div className="mt-4 h-64" role="img" aria-label={`Recebimentos: ${grafico.map((g) => `${g.rotulo} ${moeda(g.total)}`).join(', ')}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={grafico} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="#E1E7F0" />
                <XAxis dataKey="rotulo" axisLine={false} tickLine={false} tick={{ fill: '#5B6785', fontSize: 13 }} />
                <YAxis axisLine={false} tickLine={false} width={52} tick={{ fill: '#5B6785', fontSize: 12 }} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v))} />
                <Tooltip cursor={{ fill: '#EEF2F8' }} formatter={(v: number) => [moeda(v), 'Recebido']} labelFormatter={(l) => String(l)} contentStyle={{ borderRadius: 12, border: '1px solid #E1E7F0', boxShadow: '0 6px 20px -8px rgba(16,28,61,.2)' }} />
                <Bar dataKey="total" fill="#F5A524" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="cartao p-6" aria-labelledby="t-status">
          <h2 id="t-status" className="text-lg font-bold text-noite-900">Orçamentos por status</h2>
          <p className="text-sm text-tinta-soft">{totalStatus} no total</p>
          <ul className="mt-4 space-y-3">
            {dados.orcamentos_por_status.map((s) => (
              <li key={s.status}>
                <Link to={`/orcamentos?status=${s.status}`} className="group block">
                  <div className="mb-1 flex justify-between text-sm"><span className="font-medium text-tinta">{rotuloStatus(s.status)}</span><span className="tabular-nums text-tinta-soft">{s.total}</span></div>
                  <div className="h-2 rounded-full bg-gelo-100"><div className="h-2 rounded-full bg-noite-700 transition-all group-hover:bg-lume-500" style={{ width: `${totalStatus ? (s.total / totalStatus) * 100 : 0}%` }} /></div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="cartao p-6" aria-labelledby="t-eventos">
          <div className="flex items-center justify-between"><h2 id="t-eventos" className="text-lg font-bold text-noite-900">Próximos eventos</h2><Link to="/orcamentos?status=aprovado" className="flex items-center gap-1 text-sm font-semibold text-lume-700 hover:text-lume-600">Ver aprovados <ArrowRight className="h-4 w-4" aria-hidden /></Link></div>
          {dados.proximos_eventos.length === 0 ? (
            <Vazio titulo="Nenhum evento marcado" texto="Quando um orçamento for aprovado, a retirada aparece aqui." />
          ) : (
            <ul className="mt-3 divide-y divide-gelo-200">
              {dados.proximos_eventos.map((e) => (
                <li key={e.id}>
                  <Link to={`/orcamentos/${e.id}`} className="-mx-2 flex items-center gap-4 rounded-xl px-2 py-3 hover:bg-gelo-50">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-lume-50 text-center font-display text-sm font-bold leading-tight text-lume-700"><span><CalendarDays className="mx-auto h-4 w-4" aria-hidden />{dataCurta(e.data_retirada)}</span></div>
                    <div className="min-w-0 flex-1"><p className="truncate font-semibold text-noite-900">{e.evento}</p><p className="truncate text-sm text-tinta-soft">{e.cliente} · {e.numero}</p></div>
                    <span className="text-sm font-semibold tabular-nums text-noite-900">{moeda(e.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="cartao p-6" aria-labelledby="t-prod">
          <h2 id="t-prod" className="text-lg font-bold text-noite-900">Produtos mais alugados</h2>
          <p className="text-sm text-tinta-soft">Unidades em orçamentos aprovados e finalizados</p>
          {dados.produtos_mais_alugados.length === 0 ? (
            <Vazio titulo="Ainda sem locações" />
          ) : (
            <ul className="mt-4 space-y-3.5">
              {dados.produtos_mais_alugados.map((p) => (
                <li key={p.produto_id}>
                  <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate font-medium text-tinta">{p.nome}</span><span className="shrink-0 tabular-nums text-tinta-soft">{p.quantidade} un.</span></div>
                  <div className="h-2 rounded-full bg-gelo-100"><div className="h-2 rounded-full bg-lume-500" style={{ width: `${(p.quantidade / maxProduto) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  )
}
