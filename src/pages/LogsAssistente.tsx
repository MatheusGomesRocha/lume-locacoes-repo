import { Trash2 } from 'lucide-react'
import { useState } from 'react'
import { mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, CaixaErro, Carregando, Confirmar, Vazio, useAviso } from '../components/ui'
import { ROTULO_TIPO, resumirLogs } from '../lib/logs'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'
import { TIPOS_LOG, type TipoLog } from '../types'

const ms = (v: number | null) => (v === null ? '—' : v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} s` : `${v} ms`)
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

function Indicador({ rotulo, valor, detalhe }: { rotulo: string; valor: string | number; detalhe?: string }) {
  return (
    <div className="cartao p-4">
      <p className="text-sm text-tinta-soft">{rotulo}</p>
      <p className="mt-1 text-2xl font-bold text-noite-900">{valor}</p>
      {detalhe && <p className="text-xs text-tinta-mute">{detalhe}</p>}
    </div>
  )
}

export default function LogsAssistente() {
  const api = useApi()
  const avisar = useAviso()
  const [tipo, setTipo] = useState<TipoLog | ''>('')
  const [soRuins, setSoRuins] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const todos = useCarregar(() => api.chatLogs.listar(), [api])
  const lista = (todos.dados ?? []).filter((l) => (!tipo || l.tipo === tipo) && (!soRuins || l.feedback === 'negativo' || l.tipo === 'nao_encontrou' || l.tipo === 'erro'))
  const r = resumirLogs(todos.dados ?? [])

  async function limpar() {
    try {
      await api.chatLogs.limpar()
      avisar('Registros apagados.')
      await todos.recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    }
    setLimpando(false)
  }

  return (
    <>
      <Cabecalho titulo="Conversas do assistente" descricao="O que foi perguntado, como foi respondido e quanto custou. Perguntas sem resposta mostram o que falta no FAQ."
        acoes={<Botao variante="secundario" onClick={() => setLimpando(true)} disabled={!r.total}><Trash2 className="h-4 w-4" aria-hidden /> Apagar registros</Botao>} />

      {todos.carregando ? <Carregando /> : todos.erro ? <CaixaErro mensagem={todos.erro} aoTentar={() => void todos.recarregar()} /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Perguntas" valor={r.total} detalhe={`${r.comModelo} usaram o modelo`} />
            <Indicador rotulo="Em cache" valor={r.emCache} detalhe={r.total ? `${Math.round((r.emCache / r.total) * 100)}% do total` : undefined} />
            <Indicador rotulo="Sem resposta" valor={r.semResposta} detalhe="não encontrou ou erro" />
            <Indicador rotulo="Tempo" valor={ms(r.latenciaMediaMs)} detalhe={`p95: ${ms(r.latenciaP95Ms)}`} />
          </div>
          <p className="mb-4 text-sm text-tinta-soft">Avaliações: {r.positivos} úteis · {r.negativos} ruins</p>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <select aria-label="Filtrar por tipo" className="entrada max-w-[200px]" value={tipo} onChange={(e) => setTipo(e.target.value as TipoLog | '')}>
              <option value="">Todos os tipos</option>
              {TIPOS_LOG.map((t) => <option key={t} value={t}>{ROTULO_TIPO[t]} ({r.porTipo[t]})</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm text-tinta-soft">
              <input type="checkbox" checked={soRuins} onChange={(e) => setSoRuins(e.target.checked)} /> Só os que merecem revisão
            </label>
          </div>

          <div className="cartao overflow-hidden">
            {lista.length === 0 ? <Vazio titulo="Nenhum registro" texto="As perguntas feitas à Lumi aparecem aqui." /> : (
              <table className="w-full text-left text-[15px]">
                <thead className="hidden bg-gelo-50 text-sm text-tinta-soft md:table-header-group">
                  <tr><th className="px-5 py-3 font-medium">Pergunta</th><th className="px-5 py-3 font-medium">Tipo</th><th className="px-5 py-3 font-medium">Como foi</th><th className="px-5 py-3 font-medium">Avaliação</th></tr>
                </thead>
                <tbody className="divide-y divide-gelo-200">
                  {lista.map((l) => (
                    <tr key={l.id} className="align-top">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-noite-900">{l.pergunta}</p>
                        <p className="mt-0.5 line-clamp-2 text-sm text-tinta-soft">{l.resposta}</p>
                        <p className="mt-0.5 text-xs text-tinta-mute">{quando(l.criado_em)}</p>
                      </td>
                      <td className="px-5 py-3.5 text-sm">{ROTULO_TIPO[l.tipo]}{l.ferramenta ? <span className="block text-xs text-tinta-mute">{l.ferramenta}</span> : l.fonte_id ? <span className="block text-xs text-tinta-mute">{l.fonte_id}</span> : null}</td>
                      <td className="px-5 py-3.5 text-sm text-tinta-soft">
                        {ms(l.latencia_ms)}
                        <span className="block text-xs text-tinta-mute">{[l.em_cache ? 'cache' : l.gerada_por_llm ? 'modelo' : 'FAQ', l.usou_contexto ? 'com contexto' : '', l.desfecho ?? ''].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm">{l.feedback === 'positivo' ? 'Útil' : l.feedback === 'negativo' ? 'Ruim' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      <Confirmar aberto={limpando} titulo="Apagar todos os registros?" texto="O histórico de perguntas do assistente será apagado. Isso não afeta clientes, produtos nem orçamentos." rotuloConfirmar="Apagar" perigo aoConfirmar={() => void limpar()} aoFechar={() => setLimpando(false)} />
    </>
  )
}
