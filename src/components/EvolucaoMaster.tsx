import { Bot, Check, FileText, Power, Sparkles, X, Download } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import { mensagemDeErro } from './Formulario'
import { Botao, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from './ui'
import { useApi } from '../lib/servicos'
import { estatisticasEvolucao } from '../lib/evolucao'
import { errosDoTester } from '../lib/errosTester'
import { ROTULO_PARECER, resumoDaAprovacao, comparar } from '../lib/aprovacao'
import { useCarregar } from '../lib/useCarregar'
import type { EstadoDoAprovador, RelatorioEvolucao, RevisaoEvolucao, VereditoEvolucao } from '../types'

const VEREDITO: Record<VereditoEvolucao, { texto: string; classe: string }> = {
  aprovar_recomendado: { texto: 'Tester recomenda aprovar', classe: 'bg-green-50 text-green-700' },
  revisar_com_atencao: { texto: 'Leia os avisos antes de aprovar', classe: 'bg-amber-50 text-amber-700' },
  reprovar_recomendado: { texto: 'Tester recomenda reprovar', classe: 'bg-red-50 text-red-700' },
}
const ROTULO_STATUS = { pendente: 'Aguardando você', aprovada: 'Aprovada', reprovada: 'Reprovada' } as const

/** Negrito (**texto**) e `código` dentro de uma linha. */
function emLinha(t: string): ReactNode[] {
  return t.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((p, i) =>
    p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i} className="rounded bg-gelo-100 px-1 text-[13px]">{p.slice(1, -1)}</code> : <Fragment key={i}>{p}</Fragment>)
}

/** O relatório vem em markdown simples (títulos, listas, negrito): desenha sem depender de biblioteca. */
export function RelatorioTexto({ texto }: { texto: string }) {
  return (
    <div className="space-y-1.5 text-[15px] text-tinta">
      {texto.split('\n').map((linha, i) => {
        if (linha.startsWith('# ')) return <h3 key={i} className="text-lg font-bold text-noite-900">{emLinha(linha.slice(2))}</h3>
        if (linha.startsWith('## ')) return <h4 key={i} className="pt-3 font-bold text-noite-900">{emLinha(linha.slice(3))}</h4>
        if (linha.startsWith('- ')) return <p key={i} className="pl-4 text-sm">• {emLinha(linha.slice(2))}</p>
        if (!linha.trim()) return <div key={i} className="h-1" />
        return <p key={i} className="text-sm">{emLinha(linha)}</p>
      })}
    </div>
  )
}

const COR_PARECER = { aprovar: 'bg-green-50 text-green-700', deixar_pendente: 'bg-amber-50 text-amber-700', reprovar: 'bg-red-50 text-red-700' } as const
const ROTULO_COMPARACAO = { concordou: 'Você e o Agent concordaram', conservadora: 'O Agent foi mais cauteloso que você', perigosa: 'DISCORDÂNCIA PERIGOSA: o Agent aprovaria o que você reprovou', aguardando: 'Aguardando a sua decisão para comparar' } as const
const ROTULO_MODO = { desligado: 'Desligado', sombra: 'Modo sombra: o Agent opina, você decide', automatico: 'Automático: o Agent aprova sozinho' } as const

/** O parecer do Agent 4, condição por condição: o que o código verificou e o que o modelo achou. */
function ParecerDoAgent({ revisao }: { revisao: RevisaoEvolucao }) {
  const m = revisao.parecer_do_modelo
  return (
    <div className="space-y-2 text-sm text-tinta">
      <p><strong>{ROTULO_PARECER[revisao.decisao]}.</strong> {revisao.motivo}</p>
      <h4 className="pt-2 font-bold text-noite-900">Condições (todas precisam valer)</h4>
      {revisao.condicoes.map((c) => <p key={c.id} className="pl-4">{c.ok ? '✅' : '❌'} <strong>{c.id}</strong> · {c.texto}{c.detalhe ? <span className="text-tinta-soft"> — {c.detalhe}</span> : null}</p>)}
      {revisao.risco && <p className="pl-4">Risco: <strong>{revisao.risco.nivel}</strong>{revisao.risco.motivos.length ? ` (${revisao.risco.motivos.join('; ')})` : ''}</p>}
      {m && <>
        <h4 className="pt-2 font-bold text-noite-900">O que o modelo aprovador conferiu</h4>
        {m.itens.map((i) => <p key={i.item} className="pl-4">{i.ok ? '✅' : '❌'} {i.item.replace(/_/g, ' ')} <span className="text-tinta-soft">— {i.evidencia}</span></p>)}
        {m.duvidas.length > 0 && <p className="pl-4">Dúvidas: {m.duvidas.join('; ')}</p>}
        {m.riscos.length > 0 && <p className="pl-4">Riscos: {m.riscos.join('; ')}</p>}
      </>}
      <p className="pt-2 text-xs text-tinta-mute">Este parecer não aprova nada por si: no modo sombra você continua decidindo, e a tela compara as duas decisões.</p>
    </div>
  )
}

type Decisao = { rel: RelatorioEvolucao; acao: 'aprovar' | 'reprovar' | 'desativar' }

/** Aba do master: consultas novas que os Agents propuseram para as perguntas sem resposta. Nada vale sem o "aprovar" dele. */
export function EvolucaoMaster() {
  const api = useApi()
  const avisar = useAviso()
  const lista = useCarregar(() => api.evolucao.listar(), [api])
  const [lendo, setLendo] = useState<RelatorioEvolucao | null>(null)
  const [decidindo, setDecidindo] = useState<Decisao | null>(null)
  const [analisando, setAnalisando] = useState(false)
  const [revisando, setRevisando] = useState(false)
  const [lendoParecer, setLendoParecer] = useState<RelatorioEvolucao | null>(null)
  const estado = useCarregar<EstadoDoAprovador>(() => api.evolucao.aprovador(), [api])

  /** Executa agora o Agent de Aprovação (a versão real roda isto sozinha de 5 em 5 minutos). */
  async function revisar() {
    setRevisando(true)
    try {
      const r = await api.evolucao.revisar()
      avisar(r.mensagem, r.erros && !r.revisadas ? 'erro' : 'ok')
      await Promise.all([lista.recarregar(), estado.recarregar()])
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    } finally {
      setRevisando(false)
    }
  }

  async function conferir(id: string) {
    try {
      await api.evolucao.conferir(id)
      avisar('Conferida. Obrigado.')
      await lista.recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    }
  }

  async function analisar() {
    setAnalisando(true)
    try {
      const r = await api.evolucao.analisar()
      avisar(r.semPerguntas ? 'Não há perguntas sem resposta novas para analisar.' : `${r.novos.length} proposta(s) para você decidir.`)
      await lista.recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    } finally {
      setAnalisando(false)
    }
  }

  async function confirmar() {
    if (!decidindo) return
    const { rel, acao } = decidindo
    setDecidindo(null)
    try {
      if (acao === 'desativar') await api.evolucao.desativar(rel.id)
      else await api.evolucao.decidir(rel.id, acao === 'aprovar')
      avisar(acao === 'aprovar' ? 'Aprovada. A Lumi já pode usar esta consulta.' : acao === 'reprovar' ? 'Reprovada. Nada foi ativado.' : 'Consulta desativada.')
      await lista.recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    }
  }

  const textoDaDecisao = (d: Decisao) =>
    d.acao === 'aprovar' ? `A consulta “${d.rel.pacote?.spec.nome}” passa a responder perguntas no chat para quem tem a permissão ${d.rel.pacote?.spec.permissao}. Ela só lê dados. Você pode desativá-la depois.`
      : d.acao === 'reprovar' ? 'Nada é ativado e a Lumi continua sem responder esta pergunta.' : 'A Lumi deixa de usar esta consulta. O registro da aprovação continua guardado.'

  /** Baixa tudo o que o Tester errou ou o código corrigiu, tirado dos relatórios guardados: é o arquivo que se manda para análise. */
  const baixarErros = () => {
    const itens = errosDoTester(lista.dados ?? [])
    const blob = new Blob([JSON.stringify({ gerado_em: new Date().toISOString(), total: itens.length, itens }, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `erros-do-tester-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-tinta-soft">
          Três Agents trabalham nas perguntas que a Lumi não soube responder: um propõe, outro cria a consulta, outro testa e revisa.
          Você lê o relatório e decide. <strong className="text-noite-900">Nada entra em uso sem a sua aprovação.</strong>
        </p>
        <div className="flex flex-wrap gap-2">
                  <Botao onClick={() => void analisar()} disabled={analisando}><Sparkles className="h-4 w-4" aria-hidden /> {analisando ? 'Os Agents estão trabalhando…' : 'Analisar perguntas sem resposta'}</Botao>
          <Botao variante="secundario" onClick={() => void revisar()} disabled={revisando || estado.dados?.modo === 'desligado'}><Bot className="h-4 w-4" aria-hidden /> {revisando ? 'O Agent está revisando…' : 'Executar Agent de Aprovação'}</Botao>
          <Botao variante="secundario" onClick={baixarErros} disabled={(lista.dados ?? []).length === 0}><Download className="h-4 w-4" aria-hidden /> Baixar erros do Tester</Botao>
        </div>
      </div>
      {analisando && <p role="status" className="mb-4 rounded-xl bg-gelo-50 p-3 text-sm text-tinta-soft">Isso pode levar 1 a 2 minutos: cada proposta passa por três Agents.</p>}

      {!lista.carregando && !lista.erro && (lista.dados ?? []).length > 0 && (() => {
        const e = estatisticasEvolucao(lista.dados ?? [])
        return (
          <section aria-label="Confiança nos Agents" className="mb-4 grid gap-3 rounded-xl bg-gelo-50 p-4 text-sm sm:grid-cols-4">
            <p><strong className="block text-xl text-noite-900">{e.taxaAprovacao === null ? '—' : `${Math.round(e.taxaAprovacao * 100)}%`}</strong>aprovadas por você ({e.aprovadas} de {e.decididas} decididas)</p>
            <p><strong className="block text-xl text-noite-900">{e.reprovadas}</strong>reprovadas · {e.pendentes} aguardando</p>
            <p><strong className="block text-xl text-noite-900">{e.decididas ? `${e.concordouComTester} de ${e.decididas}` : '—'}</strong>vezes em que você decidiu como o Tester recomendou</p>
            <p><strong className="block text-xl text-noite-900">{e.aprovadasSeguidas}</strong>aprovações seguidas (mais recentes)</p>
          </section>
        )
      })()}
      {!lista.carregando && !lista.erro && (lista.dados ?? []).some((r) => r.revisao) && (() => {
        const a = resumoDaAprovacao(lista.dados ?? [])
        return (
          <section aria-label="Teste de acertos do Agent de Aprovação" className="mb-4 rounded-xl border border-gelo-200 p-4 text-sm">
            <p className="font-semibold text-noite-900">Agent de Aprovação · {estado.dados ? ROTULO_MODO[estado.dados.modo] : '…'}
              {estado.dados?.modo === 'automatico' ? <span className="font-normal text-tinta-soft"> · {estado.dados.aprovadas_hoje} de {estado.dados.limite_dia} aprovações de hoje</span> : null}</p>
            <div className="mt-2 grid gap-3 sm:grid-cols-4">
              <p><strong className="block text-xl text-noite-900">{a.taxa === null ? '—' : `${Math.round(a.taxa * 100)}%`}</strong>de concordância com você ({a.concordaram} de {a.comparadas})</p>
              <p><strong className={`block text-xl ${a.perigosas ? 'text-red-700' : 'text-noite-900'}`}>{a.perigosas}</strong>discordância(s) perigosa(s)</p>
              <p><strong className="block text-xl text-noite-900">{a.conservadoras}</strong>vez(es) mais cauteloso que você</p>
              <p><strong className="block text-xl text-noite-900">{a.aguardandoVoce}</strong>com parecer, aguardando você</p>
            </div>
            <p className={`mt-3 rounded-lg p-2 ${a.pronto ? 'bg-green-50 text-green-700' : 'bg-gelo-50 text-tinta-soft'}`}>
              {a.pronto ? 'Os números permitem avaliar o modo automático. Quem liga é você (EVOLUCAO_APROVADOR_MODO=automatico no servidor).' : `Ainda não dá para liberar o modo automático: ${a.faltam.join('; ')}.`}
            </p>
            {a.paraConferir > 0 && <p className="mt-2 rounded-lg bg-amber-50 p-2 text-amber-700">{a.paraConferir} aprovação(ões) automática(s) sorteada(s) esperam a sua conferência.</p>}
          </section>
        )
      })()}
      {lista.carregando ? <Carregando /> : lista.erro ? <CaixaErro mensagem={lista.erro} aoTentar={() => void lista.recarregar()} /> : (
        <div className="cartao divide-y divide-gelo-200">
          {(lista.dados ?? []).length === 0 ? <Vazio titulo="Nenhuma proposta ainda" texto="Use “Analisar perguntas sem resposta” para os Agents proporem consultas novas." /> : (lista.dados ?? []).map((r) => (
            <div key={r.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-tinta-mute">{r.id}</span>
                <p className="font-semibold text-noite-900">{r.titulo}</p>
                <span className="rounded-full bg-gelo-100 px-2 py-0.5 text-xs font-medium text-tinta-soft">{ROTULO_STATUS[r.status]}{r.status === 'aprovada' && !r.ativa ? ' · desativada' : ''}</span>
                {r.veredito && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${VEREDITO[r.veredito].classe}`}>{VEREDITO[r.veredito].texto}</span>}
              </div>
              <p className="mt-1 text-sm text-tinta-soft">{r.perguntas.slice(0, 3).map((p) => `“${p}”`).join(' · ')}{r.vezes > 1 ? ` — perguntaram ${r.vezes} vezes` : ''}</p>
              {r.revisao && (
                <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded-full px-2 py-0.5 font-medium ${COR_PARECER[r.revisao.decisao]}`}>{ROTULO_PARECER[r.revisao.decisao]}</span>
                  {(() => { const k = comparar(r); return k && k !== 'aguardando' ? <span className={k === 'perigosa' ? 'font-semibold text-red-700' : 'text-tinta-mute'}>{ROTULO_COMPARACAO[k]}</span> : null })()}
                </p>
              )}
              {r.auto_aprovada && <p className="mt-1 text-xs text-tinta-mute">Aprovada pelo Agent de Aprovação{r.amostra ? ' · sorteada para você conferir' : r.conferida_por ? ` · conferida por ${r.conferida_por}` : ''}</p>}
              {!r.pacote && <p className="mt-1 text-sm text-tinta-soft">Sem consulta para aprovar: {r.motivo || 'o Analista não viu como resolver com segurança.'}</p>}
              {r.decisao && <p className="mt-1 text-xs text-tinta-mute">Decidida por {r.decisao.por}</p>}
              <div className="mt-2 flex flex-wrap gap-2">
                <Botao pequeno variante="secundario" onClick={() => setLendo(r)}><FileText className="h-4 w-4" aria-hidden /> Ler relatório</Botao>
                {r.revisao && <Botao pequeno variante="secundario" onClick={() => setLendoParecer(r)}><Bot className="h-4 w-4" aria-hidden /> Parecer do Agent</Botao>}
                {r.auto_aprovada && r.amostra && <Botao pequeno onClick={() => void conferir(r.id)}><Check className="h-4 w-4" aria-hidden /> Conferi</Botao>}
                {r.status === 'pendente' && r.pacote && (
                  <Botao pequeno onClick={() => setDecidindo({ rel: r, acao: 'aprovar' })} disabled={r.veredito === 'reprovar_recomendado'} title={r.veredito === 'reprovar_recomendado' ? 'O Tester encontrou bloqueios: só dá para reprovar.' : undefined}><Check className="h-4 w-4" aria-hidden /> Aprovar</Botao>
                )}
                {r.status === 'pendente' && <Botao pequeno variante="secundario" onClick={() => setDecidindo({ rel: r, acao: 'reprovar' })}><X className="h-4 w-4" aria-hidden /> Reprovar</Botao>}
                {r.status === 'aprovada' && r.ativa && <Botao pequeno variante="secundario" onClick={() => setDecidindo({ rel: r, acao: 'desativar' })}><Power className="h-4 w-4" aria-hidden /> Desativar</Botao>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal aberto={!!lendoParecer} titulo="Parecer do Agent de Aprovação" aoFechar={() => setLendoParecer(null)} largo>{lendoParecer?.revisao && <ParecerDoAgent revisao={lendoParecer.revisao} />}</Modal>
      <Modal aberto={!!lendo} titulo="Relatório da proposta" aoFechar={() => setLendo(null)} largo>{lendo && <RelatorioTexto texto={lendo.texto} />}</Modal>
      <Confirmar aberto={!!decidindo} titulo={decidindo?.acao === 'aprovar' ? 'Aprovar esta consulta?' : decidindo?.acao === 'reprovar' ? 'Reprovar esta proposta?' : 'Desativar esta consulta?'}
        texto={decidindo ? textoDaDecisao(decidindo) : ''} rotuloConfirmar={decidindo?.acao === 'aprovar' ? 'Aprovar' : decidindo?.acao === 'reprovar' ? 'Reprovar' : 'Desativar'}
        perigo={decidindo?.acao !== 'aprovar'} aoConfirmar={() => void confirmar()} aoFechar={() => setDecidindo(null)} />
    </>
  )
}
