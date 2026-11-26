import { EyeOff, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { mensagemDeErro } from '../components/Formulario'
import { EvolucaoMaster } from '../components/EvolucaoMaster'
import { Botao, Cabecalho, Campo, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from '../components/ui'
import { errosDeCampos } from '../components/Formulario'
import { ROTULO_TIPO, pendentesDeResposta, quantasVezesPerguntaram, resumirLogs, sugerirPergunta } from '../lib/logs'
import { PERMISSAO_SO_MASTER } from '../lib/permissoes'
import { useApi } from '../lib/servicos'
import { useSessao } from '../lib/sessao'
import { useCarregar } from '../lib/useCarregar'
import { QualidadeLumi } from '../components/QualidadeLumi'
import { usePaginaLocal } from '../lib/usePaginado'
import { Paginacao } from '../components/Paginacao'
import { MODULOS_FAQ, TIPOS_LOG, type FaqItem, type TipoLog } from '../types'

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

/** Resposta do master: entra direto na base de ajuda da Lumi. A pergunta original vira uma forma alternativa de perguntar. */
function FormResposta({ item, perguntaDoUsuario, aoSalvo, aoCancelar }: { item: FaqItem | null; perguntaDoUsuario: string; aoSalvo: () => void; aoCancelar: () => void }) {
  const api = useApi()
  const [modulo, setModulo] = useState(item?.modulo ?? MODULOS_FAQ[0])
  const [pergunta, setPergunta] = useState(item?.pergunta ?? sugerirPergunta(perguntaDoUsuario))
  const [resposta, setResposta] = useState(item?.resposta ?? '')
  const [outras, setOutras] = useState((item?.palavras_chave ?? (perguntaDoUsuario ? [perguntaDoUsuario] : [])).join('\n'))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [geral, setGeral] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErros({}); setGeral(''); setEnviando(true)
    const dados = { modulo, pergunta, resposta, palavras_chave: outras.split('\n').map((l) => l.trim()).filter(Boolean) }
    try {
      if (item) await api.faq.atualizar(item.id, dados)
      else await api.faq.criar(dados)
      aoSalvo()
    } catch (err) {
      const campos = errosDeCampos(err)
      setErros(campos)
      if (!Object.keys(campos).length) setGeral(mensagemDeErro(err))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      {perguntaDoUsuario && <p className="rounded-xl bg-gelo-50 p-3 text-sm text-tinta-soft">Perguntaram: <strong className="text-noite-900">{perguntaDoUsuario}</strong></p>}
      <Campo rotulo="Módulo" erro={erros.modulo}>
        {(id, aria) => <select id={id} {...aria} className="entrada" value={modulo} onChange={(e) => setModulo(e.target.value)}>{MODULOS_FAQ.map((m) => <option key={m}>{m}</option>)}</select>}
      </Campo>
      <Campo rotulo="Pergunta" erro={erros.pergunta} dica="Como ela aparece nas sugestões e na lista de relacionadas.">
        {(id, aria) => <input id={id} {...aria} className="entrada" value={pergunta} onChange={(e) => setPergunta(e.target.value)} />}
      </Campo>
      <Campo rotulo="Resposta" erro={erros.resposta} dica="Escreva o passo a passo, como você explicaria a um colega. A Lumi usa só este texto.">
        {(id, aria) => <textarea id={id} {...aria} rows={5} className="entrada" value={resposta} onChange={(e) => setResposta(e.target.value)} />}
      </Campo>
      <Campo rotulo="Outras formas de perguntar" erro={erros.palavras_chave} dica="Uma por linha. Ajuda a Lumi a achar esta resposta quando usarem outras palavras.">
        {(id, aria) => <textarea id={id} {...aria} rows={3} className="entrada" value={outras} onChange={(e) => setOutras(e.target.value)} />}
      </Campo>
      {geral && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{geral}</p>}
      <div className="flex justify-end gap-3">
        <Botao type="button" variante="secundario" onClick={aoCancelar}>Cancelar</Botao>
        <Botao type="submit" carregando={enviando}>Salvar resposta</Botao>
      </div>
    </form>
  )
}

export default function LogsAssistente() {
  const api = useApi()
  const avisar = useAviso()
  const [tipo, setTipo] = useState<TipoLog | ''>('')
  const [soRuins, setSoRuins] = useState(false)
  const [limpando, setLimpando] = useState(false)
  const [aba, setAba] = useState<'conversas' | 'qualidade' | 'evolucao'>('conversas')
  const { pode } = useSessao()
  const master = pode(PERMISSAO_SO_MASTER)
  const [respondendo, setRespondendo] = useState<{ item: FaqItem | null; pergunta: string } | null>(null)
  const [excluindoFaq, setExcluindoFaq] = useState<FaqItem | null>(null)
  const todos = useCarregar(() => api.chatLogs.listar(), [api])
  const faq = useCarregar(() => (master ? api.faq.listar() : Promise.resolve([] as FaqItem[])), [api, master])
  const pendentes = new Set(master ? pendentesDeResposta(todos.dados ?? [], faq.dados ?? []).map((l) => l.id) : [])
  const filtrada = (todos.dados ?? []).filter((l) => (!tipo || l.tipo === tipo) && (!soRuins || l.feedback === 'negativo' || l.tipo === 'nao_encontrou' || l.tipo === 'erro'))
  const { dados: lista, controle } = usePaginaLocal(filtrada, [tipo, soRuins])
  const r = resumirLogs(todos.dados ?? [])

  async function ignorar(id: number) {
    try {
      await api.chatLogs.atualizar(id, { desfecho: 'ignorado' })
      avisar('Pergunta ignorada. Ela some da lista de pendentes.')
      await todos.recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    }
  }

  async function excluirFaq() {
    if (!excluindoFaq) return
    try {
      await api.faq.excluir(excluindoFaq.id)
      avisar('Resposta excluída.')
      await faq.recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    }
    setExcluindoFaq(null)
  }

  async function aoSalvarResposta() {
    setRespondendo(null)
    avisar('Resposta salva. A Lumi já pode usá-la.')
    await Promise.all([faq.recarregar(), todos.recarregar()])
  }

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

      {(
        <div role="tablist" aria-label="Seções" className="mb-5 flex gap-2 border-b border-gelo-200">
          {([['conversas', 'Conversas'], ['qualidade', 'Qualidade e custo'], ...(master ? [['evolucao', 'Evolução da Lumi']] : [])] as [typeof aba, string][]).map(([id, rotulo]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setAba(id)}
              className={`-mb-px border-b-2 px-4 py-2 text-[15px] font-semibold ${aba === id ? 'border-lume-600 text-lume-700' : 'border-transparent text-tinta-soft hover:text-tinta'}`}>{rotulo}</button>
          ))}
        </div>
      )}

      {master && aba === 'evolucao' ? <EvolucaoMaster /> : aba === 'qualidade' ? (todos.carregando ? <Carregando /> : <QualidadeLumi logs={todos.dados ?? []} />) : todos.carregando ? <Carregando /> : todos.erro ? <CaixaErro mensagem={todos.erro} aoTentar={() => void todos.recarregar()} /> : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicador rotulo="Perguntas" valor={r.total} detalhe={`${r.comModelo} usaram o modelo`} />
            <Indicador rotulo="Em cache" valor={r.emCache} detalhe={r.total ? `${Math.round((r.emCache / r.total) * 100)}% do total` : undefined} />
            <Indicador rotulo="Sem resposta" valor={r.semResposta} detalhe={master ? `${pendentes.size} aguardando resposta` : 'não encontrou ou erro'} />
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
                        {pendentes.has(l.id) && (
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <Botao pequeno onClick={() => setRespondendo({ item: null, pergunta: l.pergunta })}><MessageSquarePlus className="h-4 w-4" aria-hidden /> Responder</Botao>
                            <Botao pequeno variante="secundario" onClick={() => void ignorar(l.id)}><EyeOff className="h-4 w-4" aria-hidden /> Ignorar</Botao>
                            {quantasVezesPerguntaram(todos.dados ?? [], l.pergunta) > 1 && <span className="text-xs font-medium text-amber-700">perguntaram {quantasVezesPerguntaram(todos.dados ?? [], l.pergunta)} vezes</span>}
                          </div>
                        )}
                        {master && l.tipo === 'nao_encontrou' && !pendentes.has(l.id) && <p className="mt-1 text-xs font-medium text-lume-700">{l.desfecho === 'ignorado' ? 'Ignorada' : 'Já respondida'}</p>}
                      </td>
                      <td className="px-5 py-3.5 text-sm">{ROTULO_TIPO[l.tipo]}{l.ferramenta ? <span className="block text-xs text-tinta-mute">{l.ferramenta}</span> : l.fonte_id ? <span className="block text-xs text-tinta-mute">{l.fonte_id}</span> : null}</td>
                      <td className="px-5 py-3.5 text-sm text-tinta-soft">
                        {ms(l.latencia_ms)}
                        <span className="block text-xs text-tinta-mute">{[l.em_cache ? 'cache' : l.gerada_por_llm ? 'modelo' : 'FAQ', l.usou_contexto ? 'com contexto' : '', (l.tokens_entrada ?? 0) + (l.tokens_saida ?? 0) > 0 ? `${((l.tokens_entrada ?? 0) + (l.tokens_saida ?? 0)).toLocaleString('pt-BR')} tokens` : '', l.desfecho ?? ''].filter(Boolean).join(' · ')}</span>
                      </td>
                      <td className="px-5 py-3.5 text-sm">{l.feedback === 'positivo' ? 'Útil' : l.feedback === 'negativo' ? 'Ruim' : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Paginacao {...controle} />
          </div>

          {master && (
            <section className="mt-8" aria-labelledby="titulo-faq">
              <h2 id="titulo-faq" className="mb-1 text-lg font-bold text-noite-900">Respostas que você escreveu</h2>
              <p className="mb-3 text-sm text-tinta-soft">Valem na hora para todo mundo que usa a Lumi. Só o master vê e edita esta lista.</p>
              <div className="cartao divide-y divide-gelo-200">
                {(faq.dados ?? []).length === 0 ? <Vazio titulo="Nenhuma resposta ainda" texto="Use o botão Responder nas perguntas sem resposta para ensinar a Lumi." /> : (faq.dados ?? []).map((i) => (
                  <div key={i.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div>
                      <p className="font-semibold text-noite-900">{i.pergunta} <span className="ml-1 text-xs font-normal text-tinta-mute">{i.modulo}</span></p>
                      <p className="mt-0.5 line-clamp-2 text-sm text-tinta-soft">{i.resposta}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setRespondendo({ item: i, pergunta: '' })} aria-label={`Editar ${i.pergunta}`} className="rounded-lg p-2 text-tinta-mute hover:bg-gelo-100 hover:text-tinta"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setExcluindoFaq(i)} aria-label={`Excluir ${i.pergunta}`} className="rounded-lg p-2 text-tinta-mute hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
      <Modal aberto={!!respondendo} titulo={respondendo?.item ? 'Editar resposta' : 'Responder pergunta'} aoFechar={() => setRespondendo(null)} largo>
        {respondendo && <FormResposta item={respondendo.item} perguntaDoUsuario={respondendo.pergunta} aoSalvo={() => void aoSalvarResposta()} aoCancelar={() => setRespondendo(null)} />}
      </Modal>
      <Confirmar aberto={!!excluindoFaq} titulo="Excluir esta resposta?" texto="A Lumi deixa de usá-la. A pergunta original volta a aparecer como sem resposta." rotuloConfirmar="Excluir" perigo aoConfirmar={() => void excluirFaq()} aoFechar={() => setExcluindoFaq(null)} />
      <Confirmar aberto={limpando} titulo="Apagar todos os registros?" texto="O histórico de perguntas do assistente será apagado. Isso não afeta clientes, produtos nem orçamentos." rotuloConfirmar="Apagar" perigo aoConfirmar={() => void limpar()} aoFechar={() => setLimpando(false)} />
    </>
  )
}
