import { CheckCircle2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { ApiError } from '../api/tipos'
import { excluir, localizarParaExcluir, prepararCadastro, ROTULO_MODULO, type Alvo, type ModuloExclusao, type PreparoCadastro } from '../lib/ferramentas'
import { useApi } from '../lib/servicos'
import { avisarDadosAlterados } from '../lib/useCarregar'
import type { Chamada } from '../types'
import { FormCliente } from './formularios/FormCliente'
import { FormOrcamento } from './formularios/FormOrcamento'
import { FormProduto } from './formularios/FormProduto'
import { Botao } from './ui'
import type { Api } from '../api/tipos'

/** O que a conversa guarda de um cartão: o pedido e, quando termina, como terminou. */
export type Cartao =
  | { tipo: 'cadastro'; preparo: PreparoCadastro; fim?: Fim }
  | { tipo: 'exclusao'; alvos: Alvo[]; fim?: Fim }

export interface Fim { ok: boolean; texto: string }

const TITULO_CADASTRO = { cliente: 'Novo cliente', produto: 'Novo produto', orcamento: 'Novo orçamento' }

const AVISO_DA_REGRA: Record<ModuloExclusao, string> = {
  cliente: 'Clientes que já têm orçamentos não podem ser excluídos.',
  produto: 'Se o produto já foi usado em orçamentos, não dá para excluir: desmarque "Ativo" em vez disso.',
  orcamento: 'Só orçamentos em Rascunho ou Cancelado podem ser excluídos, e a exclusão é definitiva.',
}

/** Transforma o pedido do assistente em cartão (ou numa frase, se não achou nada). */
export async function montarCartao(api: Api, acao: Chamada): Promise<{ cartao: Cartao } | { texto: string }> {
  try {
    if (acao.nome === 'excluir_registro') {
      const modulo = acao.args.modulo as ModuloExclusao
      const busca = String(acao.args.busca ?? '')
      const alvos = await localizarParaExcluir(api, modulo, busca)
      if (!alvos.length) return { texto: `Não encontrei nenhum ${ROTULO_MODULO[modulo]} com “${busca}”.` }
      return { cartao: { tipo: 'exclusao', alvos: alvos.slice(0, 6) } }
    }
    const preparo = await prepararCadastro(api, acao)
    return preparo ? { cartao: { tipo: 'cadastro', preparo } } : { texto: 'Não consegui abrir esse formulário.' }
  } catch {
    return { texto: 'Não consegui preparar isso agora. Tente de novo em instantes.' }
  }
}

function Final({ fim }: { fim: Fim }) {
  const Icone = fim.ok ? CheckCircle2 : TriangleAlert
  return (
    <p role="status" className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-[14px] ring-1 ${fim.ok ? 'bg-emerald-50 text-emerald-800 ring-emerald-200' : 'bg-red-50 text-red-800 ring-red-200'}`}>
      <Icone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {fim.texto}
    </p>
  )
}

export function CartaoCadastro({ preparo, fim, aoFinalizar }: { preparo: PreparoCadastro; fim?: Fim; aoFinalizar: (f: Fim) => void }) {
  if (fim) return <Final fim={fim} />
  const cancelar = () => aoFinalizar({ ok: false, texto: `${TITULO_CADASTRO[preparo.modulo]} cancelado. Nada foi salvo.` })
  const salvo = (texto: string) => { avisarDadosAlterados(); aoFinalizar({ ok: true, texto }) }
  return (
    <section aria-label={TITULO_CADASTRO[preparo.modulo]} className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-gelo-200">
      <h3 className="text-[15px] font-bold text-noite-900">{TITULO_CADASTRO[preparo.modulo]}</h3>
      {preparo.avisos.length > 0 && (
        <ul className="mt-2 space-y-1 rounded-xl bg-amber-50 p-3 text-[13px] text-amber-900 ring-1 ring-amber-200">{preparo.avisos.map((a) => <li key={a}>{a}</li>)}</ul>
      )}
      <div className="mt-3">
        {preparo.modulo === 'cliente' && <FormCliente compacto inicial={preparo.inicial} aoCancelar={cancelar} aoSalvo={(c) => salvo(`Cliente “${c.nome}” cadastrado.`)} />}
        {preparo.modulo === 'produto' && <FormProduto compacto inicial={preparo.inicial} categorias={preparo.categorias} aoCancelar={cancelar} aoSalvo={(p) => salvo(`Produto “${p.nome}” cadastrado.`)} />}
        {preparo.modulo === 'orcamento' && <FormOrcamento compacto clientes={preparo.clientes} produtos={preparo.produtos} inicial={preparo.inicial} aoCancelar={cancelar} aoSalvo={(o) => salvo(`Orçamento ${o.numero} criado.`)} />}
      </div>
    </section>
  )
}

export function CartaoExclusao({ alvos, fim, aoFinalizar }: { alvos: Alvo[]; fim?: Fim; aoFinalizar: (f: Fim) => void }) {
  const api = useApi()
  const [escolhido, setEscolhido] = useState<Alvo | null>(alvos.length === 1 ? alvos[0] : null)
  const [excluindo, setExcluindo] = useState(false)
  if (fim) return <Final fim={fim} />

  async function confirmar() {
    if (!escolhido) return
    setExcluindo(true)
    try {
      await excluir(api, escolhido)
      avisarDadosAlterados()
      aoFinalizar({ ok: true, texto: `${escolhido.rotulo} foi excluído.` })
    } catch (e) {
      // A regra vem da própria API (a mesma das telas): mostramos a mensagem dela.
      aoFinalizar({ ok: false, texto: e instanceof ApiError || e instanceof Error ? e.message : 'Não foi possível excluir.' })
    }
  }

  if (!escolhido) {
    return (
      <section aria-label="Qual registro excluir" className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-gelo-200">
        <h3 className="text-[15px] font-bold text-noite-900">Encontrei mais de um. Qual deles?</h3>
        <ul className="mt-3 space-y-2">
          {alvos.map((a) => (
            <li key={a.id}><button onClick={() => setEscolhido(a)} className="w-full rounded-xl border border-gelo-300 px-3 py-2 text-left text-[14px] hover:border-lume-500 hover:bg-lume-50">{a.rotulo}</button></li>
          ))}
        </ul>
        <Botao variante="fantasma" pequeno className="mt-3" onClick={() => aoFinalizar({ ok: false, texto: 'Exclusão cancelada. Nada foi excluído.' })}>Cancelar</Botao>
      </section>
    )
  }

  return (
    <section aria-label="Confirmar exclusão" className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-red-200">
      <h3 className="text-[15px] font-bold text-noite-900">Excluir {ROTULO_MODULO[escolhido.modulo]}?</h3>
      <p className="mt-1.5 text-[14px] font-semibold text-noite-900">{escolhido.rotulo}</p>
      <p className="mt-1 text-[13px] text-tinta-soft">{AVISO_DA_REGRA[escolhido.modulo]}</p>
      <div className="mt-3 flex justify-end gap-2">
        <Botao variante="secundario" pequeno onClick={() => aoFinalizar({ ok: false, texto: 'Exclusão cancelada. Nada foi excluído.' })} disabled={excluindo}>Cancelar</Botao>
        <Botao variante="perigo" pequeno carregando={excluindo} onClick={() => void confirmar()}>Confirmar exclusão</Botao>
      </div>
    </section>
  )
}
