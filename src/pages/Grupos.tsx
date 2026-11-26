import { Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { errosDeCampos, mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, Campo, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from '../components/ui'
import { MODULOS, chave } from '../lib/permissoes'
import { useApi } from '../lib/servicos'
import { usePaginado } from '../lib/usePaginado'
import { Paginacao } from '../components/Paginacao'
import type { Grupo } from '../types'

function FormGrupo({ registro, aoSalvo, aoCancelar }: { registro: Grupo | null; aoSalvo: () => void; aoCancelar: () => void }) {
  const api = useApi()
  const [nome, setNome] = useState(registro?.nome ?? '')
  const [descricao, setDescricao] = useState(registro?.descricao ?? '')
  const [marcadas, setMarcadas] = useState<Set<string>>(new Set(registro?.permissoes ?? []))
  const [erros, setErros] = useState<Record<string, string>>({})
  const [geral, setGeral] = useState('')
  const [enviando, setEnviando] = useState(false)

  const alternar = (p: string) => setMarcadas((m) => { const n = new Set(m); if (n.has(p)) n.delete(p); else n.add(p); return n })
  const alternarModulo = (ids: string[]) => setMarcadas((m) => { const n = new Set(m); const todas = ids.every((p) => n.has(p)); ids.forEach((p) => (todas ? n.delete(p) : n.add(p))); return n })

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErros({}); setGeral(''); setEnviando(true)
    try {
      const dados = { nome, descricao: descricao || null, permissoes: [...marcadas] }
      if (registro) await api.grupos.atualizar(registro.id, dados)
      else await api.grupos.criar(dados)
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
      <Campo rotulo="Nome do grupo" erro={erros.nome}>{(id, aria) => <input id={id} {...aria} className="entrada" value={nome} onChange={(e) => setNome(e.target.value)} />}</Campo>
      <Campo rotulo="Descrição" dica="Opcional. Ajuda a lembrar para quem é este grupo.">{(id) => <input id={id} className="entrada" value={descricao} onChange={(e) => setDescricao(e.target.value)} />}</Campo>
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-tinta">Permissões por módulo</legend>
        <div className="space-y-3">
          {MODULOS.map((m) => {
            const ids = m.acoes.map((a) => chave(m.id, a.id))
            const todas = ids.every((p) => marcadas.has(p))
            return (
              <div key={m.id} role="group" aria-label={m.nome} className="rounded-xl bg-gelo-50 p-3 ring-1 ring-gelo-200">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-noite-900">{m.nome}{m.soAdmin && <span className="ml-2 text-xs font-normal text-tinta-mute">só vale para administradores</span>}</p>
                  <button type="button" onClick={() => alternarModulo(ids)} className="text-xs font-semibold text-lume-700 hover:underline">{todas ? 'Limpar' : 'Marcar tudo'}</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                  {m.acoes.map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm text-tinta">
                      <input type="checkbox" checked={marcadas.has(chave(m.id, a.id))} onChange={() => alternar(chave(m.id, a.id))} aria-label={`${m.nome}: ${a.nome}`} /> {a.nome}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </fieldset>
      {geral && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{geral}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Botao variante="secundario" type="button" onClick={aoCancelar}>Cancelar</Botao>
        <Botao type="submit" carregando={enviando}>Salvar grupo</Botao>
      </div>
    </form>
  )
}

export default function Grupos() {
  const api = useApi()
  const avisar = useAviso()
  const { dados, erro, carregando, recarregar, controle } = usePaginado((pg) => api.grupos.pagina(pg), [api])
  const [editando, setEditando] = useState<Grupo | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Grupo | null>(null)

  async function excluir() {
    if (!excluindo) return
    try {
      await api.grupos.excluir(excluindo.id)
      avisar('Grupo excluído.')
      await recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    }
    setExcluindo(null)
  }

  return (
    <>
      <Cabecalho titulo="Grupos de permissões" descricao="Cada usuário pertence a um grupo, que define o que ele pode fazer em cada módulo."
        acoes={<Botao onClick={() => setEditando('novo')}><Plus className="h-4 w-4" aria-hidden /> Novo grupo</Botao>} />
      {carregando ? <Carregando /> : erro ? <CaixaErro mensagem={erro} aoTentar={() => void recarregar()} /> : (
        <div className="cartao overflow-hidden">
          {dados!.length === 0 ? <Vazio titulo="Nenhum grupo" /> : (
            <ul className="divide-y divide-gelo-200">
              {dados!.map((g) => (
                <li key={g.id} className="flex items-center justify-between gap-3 px-5 py-4">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 font-semibold text-noite-900">{g.nome}{g.sistema && <Lock className="h-3.5 w-3.5 text-tinta-mute" aria-label="Grupo do sistema" />}</p>
                    <p className="text-sm text-tinta-mute">{g.descricao ?? 'Sem descrição'} · {g.permissoes.length} permissões · {g.usuarios_count} {g.usuarios_count === 1 ? 'usuário' : 'usuários'}</p>
                  </div>
                  {!g.sistema && (
                    <div className="flex shrink-0 gap-1">
                      <button onClick={() => setEditando(g)} aria-label={`Editar ${g.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-gelo-100 hover:text-tinta"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setExcluindo(g)} aria-label={`Excluir ${g.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <Paginacao {...controle} />
        </div>
      )}
      <Modal aberto={editando !== null} titulo={editando === 'novo' ? 'Novo grupo' : 'Editar grupo'} aoFechar={() => setEditando(null)} largo>
        <FormGrupo registro={editando === 'novo' ? null : editando} aoCancelar={() => setEditando(null)}
          aoSalvo={() => { avisar(editando === 'novo' ? 'Grupo criado.' : 'Grupo atualizado.'); setEditando(null); void recarregar() }} />
      </Modal>
      <Confirmar aberto={!!excluindo} titulo="Excluir grupo?" texto={`${excluindo?.nome ?? ''} será removido. Grupos que ainda têm usuários não podem ser excluídos.`} rotuloConfirmar="Excluir grupo" perigo aoConfirmar={() => void excluir()} aoFechar={() => setExcluindo(null)} />
    </>
  )
}
