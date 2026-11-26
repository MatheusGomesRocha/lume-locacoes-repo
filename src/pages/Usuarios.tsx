import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { ID_GRUPO_MASTER } from '../api/acesso'
import { errosDeCampos, mensagemDeErro } from '../components/Formulario'
import { Botao, Cabecalho, Campo, CaixaErro, Carregando, Confirmar, Modal, Vazio, useAviso } from '../components/ui'
import { podeGerenciar } from '../lib/permissoes'
import { useApi } from '../lib/servicos'
import { useSessao } from '../lib/sessao'
import { useCarregar } from '../lib/useCarregar'
import { usePaginado } from '../lib/usePaginado'
import { Paginacao } from '../components/Paginacao'
import { ROTULO_PAPEL, type Grupo, type Papel, type Usuario, type UsuarioForm } from '../types'

const VAZIO: UsuarioForm = { nome: '', email: '', papel: 'usuario', grupo_id: 0, ativo: true, senha: '' }

function FormUsuario({ registro, grupos, aoSalvo, aoCancelar }: { registro: Usuario | null; grupos: Grupo[]; aoSalvo: () => void; aoCancelar: () => void }) {
  const api = useApi()
  const { sessao } = useSessao()
  const souMaster = sessao?.usuario.papel === 'master'
  const ehMaster = registro?.papel === 'master'
  const [d, setD] = useState<UsuarioForm>(registro ? { nome: registro.nome, email: registro.email, papel: registro.papel, grupo_id: registro.grupo_id, ativo: registro.ativo, senha: '' } : VAZIO)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [geral, setGeral] = useState('')
  const set = <K extends keyof UsuarioForm>(k: K, v: UsuarioForm[K]) => setD((x) => ({ ...x, [k]: v }))
  const escolhiveis = grupos.filter((g) => g.id !== ID_GRUPO_MASTER)

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setErros({}); setGeral(''); setEnviando(true)
    try {
      const dados = { ...d, grupo_id: Number(d.grupo_id), senha: d.senha || undefined }
      if (registro) await api.usuarios.atualizar(registro.id, dados)
      else await api.usuarios.criar(dados)
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
      <Campo rotulo="Nome" erro={erros.nome}>{(id, aria) => <input id={id} {...aria} className="entrada" value={d.nome} onChange={(e) => set('nome', e.target.value)} />}</Campo>
      <Campo rotulo="E-mail" erro={erros.email}>{(id, aria) => <input id={id} {...aria} type="email" className="entrada" value={d.email} onChange={(e) => set('email', e.target.value)} />}</Campo>
      <Campo rotulo={registro ? 'Nova senha' : 'Senha'} erro={erros.senha} dica={registro ? 'Deixe em branco para manter a atual. Mínimo de 8 caracteres.' : 'Mínimo de 8 caracteres.'}>
        {(id, aria) => <input id={id} {...aria} type="password" autoComplete="new-password" className="entrada" value={d.senha ?? ''} onChange={(e) => set('senha', e.target.value)} />}
      </Campo>
      {!ehMaster && (
        <>
          {souMaster && (
            <Campo rotulo="Nível" erro={erros.papel} dica="Administradores cadastram usuários comuns. Só o master promove alguém a administrador.">
              {(id, aria) => (
                <select id={id} {...aria} className="entrada" value={d.papel} onChange={(e) => set('papel', e.target.value as Papel)}>
                  <option value="usuario">{ROTULO_PAPEL.usuario}</option>
                  <option value="admin">{ROTULO_PAPEL.admin}</option>
                </select>
              )}
            </Campo>
          )}
          <Campo rotulo="Grupo de permissões" erro={erros.grupo_id} dica="Define o que a pessoa pode ver e fazer. Sem grupo, ela não acessa o sistema.">
            {(id, aria) => (
              <select id={id} {...aria} className="entrada" value={d.grupo_id} onChange={(e) => set('grupo_id', Number(e.target.value))}>
                <option value={0}>Escolha um grupo</option>
                {escolhiveis.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}
              </select>
            )}
          </Campo>
          <label className="flex items-center gap-2 text-sm text-tinta"><input type="checkbox" checked={d.ativo} onChange={(e) => set('ativo', e.target.checked)} /> Pode entrar no sistema</label>
        </>
      )}
      {geral && <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-200">{geral}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Botao variante="secundario" type="button" onClick={aoCancelar}>Cancelar</Botao>
        <Botao type="submit" carregando={enviando}>Salvar usuário</Botao>
      </div>
    </form>
  )
}

export default function Usuarios() {
  const api = useApi()
  const avisar = useAviso()
  const { sessao, pode } = useSessao()
  const eu = sessao!.usuario
  const lista = usePaginado((pg) => api.usuarios.pagina(pg), [api])
  const grupos = useCarregar(() => api.grupos.listar(), [api])
  const [editando, setEditando] = useState<Usuario | 'novo' | null>(null)
  const [excluindo, setExcluindo] = useState<Usuario | null>(null)

  async function excluir() {
    if (!excluindo) return
    try {
      await api.usuarios.excluir(excluindo.id)
      avisar('Usuário excluído.')
      await lista.recarregar()
    } catch (e) {
      avisar(mensagemDeErro(e), 'erro')
    }
    setExcluindo(null)
  }

  return (
    <>
      <Cabecalho titulo="Usuários" descricao="Quem entra no sistema e com quais permissões."
        acoes={pode('usuarios.criar') ? <Botao onClick={() => setEditando('novo')}><Plus className="h-4 w-4" aria-hidden /> Novo usuário</Botao> : undefined} />
      {lista.carregando || grupos.carregando ? <Carregando /> : lista.erro ? <CaixaErro mensagem={lista.erro} aoTentar={() => void lista.recarregar()} /> : (
        <div className="cartao overflow-hidden">
          {lista.dados!.length === 0 ? <Vazio titulo="Nenhum usuário" /> : (
            <table className="w-full text-left text-[15px]">
              <thead className="hidden bg-gelo-50 text-sm text-tinta-soft sm:table-header-group">
                <tr><th className="px-5 py-3 font-medium">Nome</th><th className="px-5 py-3 font-medium">Nível</th><th className="px-5 py-3 font-medium">Grupo</th><th className="w-24" /></tr>
              </thead>
              <tbody className="divide-y divide-gelo-200">
                {lista.dados!.map((u) => {
                  const meu = u.id === eu.id
                  const gerencia = podeGerenciar(eu, u)
                  return (
                    <tr key={u.id} className="hover:bg-gelo-50/60">
                      <td className="px-5 py-3.5"><p className="font-semibold text-noite-900">{u.nome}{meu && <span className="ml-2 text-xs font-normal text-tinta-mute">você</span>}</p><p className="text-sm text-tinta-mute">{u.email}{u.ativo ? '' : ' · desativado'}</p></td>
                      <td className="hidden px-5 py-3.5 text-tinta-soft sm:table-cell">{ROTULO_PAPEL[u.papel]}</td>
                      <td className="hidden px-5 py-3.5 text-tinta-soft sm:table-cell">{u.grupo?.nome ?? '—'}</td>
                      <td className="px-3 py-3.5"><div className="flex justify-end gap-1">
                        {gerencia && pode('usuarios.editar') && <button onClick={() => setEditando(u)} aria-label={`Editar ${u.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-gelo-100 hover:text-tinta"><Pencil className="h-4 w-4" /></button>}
                        {gerencia && !meu && u.papel !== 'master' && pode('usuarios.excluir') && <button onClick={() => setExcluindo(u)} aria-label={`Excluir ${u.nome}`} className="rounded-lg p-2 text-tinta-mute hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>}
                      </div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <Paginacao {...lista.controle} />
        </div>
      )}
      <Modal aberto={editando !== null} titulo={editando === 'novo' ? 'Novo usuário' : 'Editar usuário'} aoFechar={() => setEditando(null)}>
        <FormUsuario registro={editando === 'novo' ? null : editando} grupos={grupos.dados ?? []} aoCancelar={() => setEditando(null)}
          aoSalvo={() => { avisar(editando === 'novo' ? 'Usuário cadastrado.' : 'Usuário atualizado.'); setEditando(null); void lista.recarregar() }} />
      </Modal>
      <Confirmar aberto={!!excluindo} titulo="Excluir usuário?" texto={`${excluindo?.nome ?? ''} perde o acesso ao sistema. Para só bloquear a entrada, desative o usuário.`} rotuloConfirmar="Excluir usuário" perigo aoConfirmar={() => void excluir()} aoFechar={() => setExcluindo(null)} />
    </>
  )
}
