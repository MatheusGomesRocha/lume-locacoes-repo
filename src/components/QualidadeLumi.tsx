import type { ChatLog } from '../types'
import { AMOSTRA_MINIMA, calcular, porSemana, porTipo, porVersao, variacao, type Linha, type Metrica } from '../lib/metricas'

const pct = (n: number | null) => (n === null ? '—' : `${Math.round(n * 100)}%`)
const num = (n: number | null) => (n === null ? '—' : n.toLocaleString('pt-BR'))
const usd = (n: number) => (n === 0 ? 'US$ 0' : `US$ ${n.toFixed(n < 0.01 ? 5 : 3)}`)

function Cartao({ rotulo, valor, detalhe }: { rotulo: string; valor: string; detalhe?: string }) {
  return (
    <div className="cartao p-4">
      <p className="text-sm text-tinta-soft">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-noite-900">{valor}</p>
      {detalhe && <p className="text-xs text-tinta-mute">{detalhe}</p>}
    </div>
  )
}

function Tabela({ titulo, nota, primeira, linhas, comparar = false }: { titulo: string; nota: string; primeira: string; linhas: Linha[]; comparar?: boolean }) {
  return (
    <section className="mb-6" aria-label={titulo}>
      <h3 className="font-bold text-noite-900">{titulo}</h3>
      <p className="mb-2 text-sm text-tinta-soft">{nota}</p>
      <div className="cartao overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gelo-50 text-tinta-soft">
            <tr>
              <th className="px-4 py-2.5 font-medium">{primeira}</th><th className="px-4 py-2.5 font-medium">Conversas</th><th className="px-4 py-2.5 font-medium">Taxa de acerto</th>
              {comparar && <th className="px-4 py-2.5 font-medium">Mudou vs. anterior</th>}
              <th className="px-4 py-2.5 font-medium">Tokens/conversa</th><th className="px-4 py-2.5 font-medium">Tokens</th><th className="px-4 py-2.5 font-medium">Custo estimado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gelo-200">
            {linhas.length === 0 ? <tr><td className="px-4 py-3 text-tinta-mute" colSpan={7}>Sem conversas ainda.</td></tr> : linhas.map((l, i) => {
              const v = comparar ? variacao(l.metrica, linhas[i + 1]?.metrica) : null
              return (
                <tr key={l.chave}>
                  <td className="px-4 py-2.5 font-semibold text-noite-900">{l.rotulo}</td>
                  <td className="px-4 py-2.5">{l.metrica.conversas}</td>
                  <td className="px-4 py-2.5">{pct(l.metrica.taxaAcerto)}</td>
                  {comparar && (
                    <td className="px-4 py-2.5">
                      {!v ? <span className="text-tinta-mute">primeira versão</span> : (
                        <span className={v.confiavel ? (v.acerto! > 0 ? 'font-semibold text-green-700' : v.acerto! < 0 ? 'font-semibold text-red-700' : '') : 'text-tinta-mute'}>
                          {v.acerto! > 0 ? '↑' : v.acerto! < 0 ? '↓' : '='} {Math.abs(v.acerto!)} p.p.{!v.confiavel && ` (poucas conversas: menos de ${AMOSTRA_MINIMA})`}
                        </span>
                      )}
                    </td>
                  )}
                  <td className="px-4 py-2.5">{num(l.metrica.tokensPorConversa)}</td>
                  <td className="px-4 py-2.5">{num(l.metrica.tokens)}</td>
                  <td className="px-4 py-2.5">{usd(l.metrica.custoUsd)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/** Painel de custo e qualidade da Lumi: totais, por tipo de pergunta, histórico por semana e evolução entre versões. */
export function QualidadeLumi({ logs }: { logs: ChatLog[] }) {
  const t: Metrica = calcular(logs)
  return (
    <>
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Cartao rotulo="Taxa de acerto" valor={pct(t.taxaAcerto)} detalhe={`${t.resolvidas} de ${t.conversas} conversas`} />
        <Cartao rotulo="Tokens gastos (total)" valor={num(t.tokens)} detalhe={`${num(t.tokensEntrada)} de entrada · ${num(t.tokensSaida)} de saída`} />
        <Cartao rotulo="Tokens por conversa" valor={num(t.tokensPorConversa)} detalhe={`${t.comModelo} de ${t.conversas} chamaram o modelo`} />
        <Cartao rotulo="Custo estimado" valor={usd(t.custoUsd)} detalhe="pelo preço do plano pago; o gratuito não cobra" />
      </div>
      <p className="mb-5 rounded-xl bg-gelo-50 p-3 text-sm text-tinta-soft">
        <strong className="text-noite-900">Como ler:</strong> uma conversa conta como <em>acerto</em> quando a Lumi deu uma resposta (não foi “não encontrei” nem erro) e ninguém marcou 👎.
        A comparação entre versões só é confiável com pelo menos {AMOSTRA_MINIMA} conversas de cada lado.
      </p>
      <Tabela titulo="Por tipo de pergunta" nota="Onde a Lumi acerta mais e onde mais gasta." primeira="Tipo" linhas={porTipo(logs)} />
      <Tabela titulo="Evolução entre versões" nota="Cada versão é um commit publicado da API. Setas comparam com a versão logo abaixo (a anterior)." primeira="Versão" linhas={porVersao(logs)} comparar />
      <Tabela titulo="Histórico semanal" nota="Semanas de segunda a domingo, da mais recente para a mais antiga." primeira="Semana" linhas={porSemana(logs)} comparar />
    </>
  )
}
