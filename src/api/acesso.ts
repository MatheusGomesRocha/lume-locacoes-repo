/**
 * Acesso da demonstração (GitHub Pages): usuários, grupos, login e sessão no localStorage.
 * Reproduz as regras do Laravel. NÃO é segurança de verdade: tudo roda no navegador e quem abre o DevTools pode mexer.
 * Serve para mostrar o fluxo; a proteção real está na versão com backend.
 */
import { MENSAGEM_SEM_PERMISSAO, MENSAGEM_SEM_SESSAO, PERMISSAO_SO_MASTER, TODAS_PERMISSOES, ehAdmin, limparPermissoes, podeGerenciar } from '../lib/permissoes'
import type { Grupo, GrupoForm, MinhaContaForm, Papel, Sessao, Usuario, UsuarioForm } from '../types'
import { ApiError, type Api } from './tipos'

export const CHAVE_ACESSO = 'lume:acesso:v1'
export const CHAVE_SESSAO = 'lume:sessao:v1'
export const MASTER_EMAIL = 'master@lume.com'
export const SENHA_DEMO = 'lume1234'
export const ID_GRUPO_MASTER = 1

interface UsuarioSalvo extends Omit<Usuario, 'grupo'> { senha_hash: string; sal: string }
interface Acesso { usuarios: UsuarioSalvo[]; grupos: Omit<Grupo, 'usuarios_count'>[] }

type Storage_ = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

const clonar = <T,>(v: T): T => JSON.parse(JSON.stringify(v))
const proximoId = (l: { id: number }[]) => l.reduce((m, x) => Math.max(m, x.id), 0) + 1
const mesmoEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
const falha = (campo: string, msg: string, status = 422) => new ApiError(msg, status, [], { [campo]: [msg] })

/** SHA-256 com sal; se o navegador não tiver crypto.subtle (http fora de localhost) cai num hash simples. Demonstração apenas. */
export async function hashSenha(senha: string, sal: string): Promise<string> {
  const texto = `${sal}:${senha}`
  if (globalThis.crypto?.subtle) {
    const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  }
  let h = 5381
  for (let i = 0; i < texto.length; i++) h = ((h << 5) + h + texto.charCodeAt(i)) | 0
  return `simples-${h >>> 0}`
}
const novoSal = () => Math.random().toString(36).slice(2, 10)

const permissoesDe = (u: { papel: Papel; grupo_id: number }, grupos: Acesso['grupos']): string[] =>
  u.papel === 'master' ? [...TODAS_PERMISSOES, PERMISSAO_SO_MASTER] : limparPermissoes(grupos.find((g) => g.id === u.grupo_id)?.permissoes ?? [])

export async function acessoDoSeed(): Promise<Acesso> {
  const grupos: Acesso['grupos'] = [
    { id: ID_GRUPO_MASTER, nome: 'Master', descricao: 'Acesso total. Não pode ser alterado.', permissoes: [...TODAS_PERMISSOES], sistema: true },
    { id: 2, nome: 'Administração', descricao: 'Tudo, inclusive cadastrar usuários.', permissoes: [...TODAS_PERMISSOES], sistema: false },
    { id: 3, nome: 'Atendimento', descricao: 'Monta orçamentos e cuida de clientes.', sistema: false, permissoes: ['painel.ver', 'orcamentos.ver', 'orcamentos.criar', 'orcamentos.editar', 'orcamentos.enviar', 'clientes.ver', 'clientes.criar', 'clientes.editar', 'produtos.ver', 'assistente.usar'] },
    { id: 4, nome: 'Financeiro', descricao: 'Acompanha e dá baixa nas cobranças.', sistema: false, permissoes: ['painel.ver', 'orcamentos.ver', 'financeiro.ver', 'financeiro.baixar', 'clientes.ver', 'assistente.usar'] },
  ]
  const criar = async (id: number, nome: string, email: string, papel: Papel, grupo_id: number, senha: string): Promise<UsuarioSalvo> => {
    const sal = novoSal()
    return { id, nome, email, papel, grupo_id, ativo: true, sal, senha_hash: await hashSenha(senha, sal) }
  }
  return {
    grupos,
    usuarios: [
      await criar(1, 'Master', MASTER_EMAIL, 'master', ID_GRUPO_MASTER, SENHA_DEMO),
      await criar(2, 'Ana Administradora', 'admin@lume.com', 'admin', 2, SENHA_DEMO),
      await criar(3, 'Bruno do Atendimento', 'atendimento@lume.com', 'usuario', 3, SENHA_DEMO),
      await criar(4, 'Carla do Financeiro', 'financeiro@lume.com', 'usuario', 4, SENHA_DEMO),
    ],
  }
}

export interface OpcoesAcesso {
  storage: Storage_
  /** Storage da sessão (por padrão o mesmo). */
  sessaoStorage?: Storage_
  /** E-mail já logado ao criar (usado nos testes). */
  sessaoInicial?: string
}

export type ParteAcesso = Pick<Api, 'auth' | 'usuarios' | 'grupos'> & {
  /** Permissões de quem está logado agora (vazio se ninguém). Usado pelo protetor de API. */
  permissoesAtuais(): Promise<string[] | null>
}

export function criarAcessoLocal({ storage, sessaoStorage = storage, sessaoInicial }: OpcoesAcesso): ParteAcesso {
  let cache: Acesso | null = null
  let pronto: Promise<Acesso> | null = null

  /** O seed precisa de hash assíncrono, então a primeira leitura é assíncrona; depois fica em memória. */
  function carregar(): Promise<Acesso> {
    if (cache) return Promise.resolve(cache)
    pronto ??= (async () => {
      const bruto = storage.getItem(CHAVE_ACESSO)
      if (bruto) {
        try { cache = JSON.parse(bruto) as Acesso; return cache } catch { /* recomeça */ }
      }
      cache = await acessoDoSeed()
      storage.setItem(CHAVE_ACESSO, JSON.stringify(cache))
      return cache
    })().then((a) => {
      // testes: já nasce logado
      const u = sessaoInicial && !sessaoStorage.getItem(CHAVE_SESSAO) ? a.usuarios.find((x) => mesmoEmail(x.email, sessaoInicial)) : undefined
      if (u) sessaoStorage.setItem(CHAVE_SESSAO, String(u.id))
      return a
    })
    return pronto
  }
  const gravar = (a: Acesso) => { cache = a; storage.setItem(CHAVE_ACESSO, JSON.stringify(a)) }

  const publico = (u: UsuarioSalvo, a: Acesso): Usuario => {
    const { senha_hash: _h, sal: _s, ...resto } = u
    const g = a.grupos.find((x) => x.id === u.grupo_id)
    return { ...resto, grupo: g ? { id: g.id, nome: g.nome } : undefined }
  }
  const sessaoDe = (u: UsuarioSalvo, a: Acesso): Sessao => ({ usuario: publico(u, a), permissoes: permissoesDe(u, a.grupos) })

  const idLogado = (): number | null => {
    const v = sessaoStorage.getItem(CHAVE_SESSAO)
    return v ? Number(v) || null : null
  }

  /** Quem está logado, relido do storage a cada chamada (grupo ou ativo podem ter mudado). */
  async function atual(): Promise<{ a: Acesso; eu: UsuarioSalvo }> {
    const a = await carregar()
    const eu = a.usuarios.find((u) => u.id === idLogado())
    if (!eu || !eu.ativo) {
      sessaoStorage.removeItem(CHAVE_SESSAO)
      throw new ApiError(MENSAGEM_SEM_SESSAO, 401)
    }
    return { a, eu }
  }
  async function exigirAdmin(perm: string) {
    const r = await atual()
    if (!ehAdmin(r.eu.papel) || !permissoesDe(r.eu, r.a.grupos).includes(perm)) throw new ApiError(MENSAGEM_SEM_PERMISSAO, 403)
    return r
  }
  async function exigirMaster() {
    const r = await atual()
    if (r.eu.papel !== 'master') throw new ApiError(MENSAGEM_SEM_PERMISSAO, 403)
    return r
  }

  function validarUsuario(a: Acesso, d: Partial<UsuarioForm>, ignorarId?: number, exigirSenha = false) {
    const campos: Record<string, string[]> = {}
    if (!d.nome?.trim()) campos.nome = ['O campo nome é obrigatório.']
    if (!d.email?.trim()) campos.email = ['O campo e-mail é obrigatório.']
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(d.email.trim())) campos.email = ['O campo e-mail deve ser um endereço de e-mail válido.']
    else if (a.usuarios.some((u) => u.id !== ignorarId && mesmoEmail(u.email, d.email!))) campos.email = ['Já existe um usuário com este e-mail.']
    if (!a.grupos.some((g) => g.id === Number(d.grupo_id))) campos.grupo_id = ['Escolha um grupo de permissões.']
    if (exigirSenha || d.senha) {
      if (!d.senha) campos.senha = ['O campo senha é obrigatório.']
      else if (d.senha.length < 8) campos.senha = ['A senha deve ter pelo menos 8 caracteres.']
    }
    if (Object.keys(campos).length) throw new ApiError(Object.values(campos)[0][0], 422, [], campos)
  }

  return {
    async permissoesAtuais() {
      const a = await carregar()
      const eu = a.usuarios.find((u) => u.id === idLogado())
      return eu?.ativo ? permissoesDe(eu, a.grupos) : null
    },

    auth: {
      salva() {
        if (!cache) return null
        const eu = cache.usuarios.find((u) => u.id === idLogado())
        return eu?.ativo ? sessaoDe(eu, cache) : null
      },
      async pronta() { await carregar() },
      async entrar(email, senha) {
        const a = await carregar()
        const u = a.usuarios.find((x) => mesmoEmail(x.email, email))
        // mesma mensagem para e-mail inexistente e senha errada: não revela quais e-mails existem
        if (!u || (await hashSenha(senha, u.sal)) !== u.senha_hash) throw new ApiError('E-mail ou senha incorretos.', 401)
        if (!u.ativo) throw new ApiError('Este usuário está desativado. Fale com um administrador.', 403)
        sessaoStorage.setItem(CHAVE_SESSAO, String(u.id))
        return sessaoDe(u, a)
      },
      async sair() { sessaoStorage.removeItem(CHAVE_SESSAO) },
      async atualizar() {
        const { a, eu } = await atual()
        return sessaoDe(eu, a)
      },
      async alterarMinhaConta(d: MinhaContaForm) {
        const { a, eu } = await atual()
        validarUsuario(a, { nome: d.nome, email: d.email, grupo_id: eu.grupo_id }, eu.id)
        if (d.nova_senha) {
          if (d.nova_senha.length < 8) throw falha('nova_senha', 'A senha deve ter pelo menos 8 caracteres.')
          if (!d.senha_atual || (await hashSenha(d.senha_atual, eu.sal)) !== eu.senha_hash) throw falha('senha_atual', 'A senha atual não confere.')
          eu.sal = novoSal()
          eu.senha_hash = await hashSenha(d.nova_senha, eu.sal)
        }
        eu.nome = d.nome.trim()
        eu.email = d.email.trim()
        gravar(a)
        return sessaoDe(eu, a)
      },
    },

    usuarios: {
      async listar() {
        const { a } = await exigirAdmin('usuarios.ver')
        return a.usuarios.map((u) => publico(u, a))
      },
      async criar(d) {
        const { a, eu } = await exigirAdmin('usuarios.criar')
        validarUsuario(a, d, undefined, true)
        const papel: Papel = eu.papel === 'master' ? d.papel : 'usuario'
        if (papel === 'master') throw falha('papel', 'Só existe um master.')
        if (Number(d.grupo_id) === ID_GRUPO_MASTER) throw falha('grupo_id', 'O grupo Master é só do master.')
        const sal = novoSal()
        const novo: UsuarioSalvo = { id: proximoId(a.usuarios), nome: d.nome.trim(), email: d.email.trim(), papel, grupo_id: Number(d.grupo_id), ativo: d.ativo, sal, senha_hash: await hashSenha(d.senha!, sal) }
        a.usuarios.push(novo)
        gravar(a)
        return publico(novo, a)
      },
      async atualizar(id, d) {
        const { a, eu } = await exigirAdmin('usuarios.editar')
        const alvo = a.usuarios.find((u) => u.id === id)
        if (!alvo) throw new ApiError('Usuário não encontrado.', 404)
        if (alvo.papel === 'master' && eu.id !== alvo.id) throw new ApiError('Só o próprio master pode alterar os dados do master.', 403)
        if (alvo.papel !== 'master' && !podeGerenciar(eu, alvo)) throw new ApiError(MENSAGEM_SEM_PERMISSAO, 403)
        validarUsuario(a, { ...d, grupo_id: alvo.papel === 'master' ? ID_GRUPO_MASTER : d.grupo_id }, id)
        if (alvo.papel === 'master') {
          // o master só muda nome, e-mail e senha
          alvo.nome = d.nome.trim()
          alvo.email = d.email.trim()
        } else {
          const papel: Papel = eu.papel === 'master' ? d.papel : alvo.papel
          if (papel === 'master') throw falha('papel', 'Só existe um master.')
          if (Number(d.grupo_id) === ID_GRUPO_MASTER) throw falha('grupo_id', 'O grupo Master é só do master.')
          if (alvo.id === eu.id && (!d.ativo || papel !== alvo.papel)) throw new ApiError('Você não pode desativar ou rebaixar a si mesmo.', 422)
          Object.assign(alvo, { nome: d.nome.trim(), email: d.email.trim(), papel, grupo_id: Number(d.grupo_id), ativo: d.ativo })
        }
        if (d.senha) { alvo.sal = novoSal(); alvo.senha_hash = await hashSenha(d.senha, alvo.sal) }
        gravar(a)
        return publico(alvo, a)
      },
      async excluir(id) {
        const { a, eu } = await exigirAdmin('usuarios.excluir')
        const alvo = a.usuarios.find((u) => u.id === id)
        if (!alvo) throw new ApiError('Usuário não encontrado.', 404)
        if (alvo.id === eu.id || alvo.papel === 'master') throw new ApiError('Esta conta não pode ser excluída.', 422)
        if (!podeGerenciar(eu, alvo)) throw new ApiError(MENSAGEM_SEM_PERMISSAO, 403)
        a.usuarios = a.usuarios.filter((u) => u.id !== id)
        gravar(a)
      },
    },

    grupos: {
      async listar() {
        const { a, eu } = await atual()
        // administradores precisam ver os grupos para escolher um ao cadastrar usuários
        if (!ehAdmin(eu.papel)) throw new ApiError(MENSAGEM_SEM_PERMISSAO, 403)
        return a.grupos.map((g) => ({ ...clonar(g), usuarios_count: a.usuarios.filter((u) => u.grupo_id === g.id).length }))
      },
      async criar(d) {
        const { a } = await exigirMaster()
        validarGrupo(a, d)
        const novo = { id: proximoId(a.grupos), nome: d.nome.trim(), descricao: d.descricao?.trim() || null, permissoes: limparPermissoes(d.permissoes), sistema: false }
        a.grupos.push(novo)
        gravar(a)
        return { ...clonar(novo), usuarios_count: 0 }
      },
      async atualizar(id, d) {
        const { a } = await exigirMaster()
        const g = a.grupos.find((x) => x.id === id)
        if (!g) throw new ApiError('Grupo não encontrado.', 404)
        if (g.sistema) throw new ApiError('O grupo Master não pode ser alterado.', 403)
        validarGrupo(a, d, id)
        Object.assign(g, { nome: d.nome.trim(), descricao: d.descricao?.trim() || null, permissoes: limparPermissoes(d.permissoes) })
        gravar(a)
        return { ...clonar(g), usuarios_count: a.usuarios.filter((u) => u.grupo_id === id).length }
      },
      async excluir(id) {
        const { a } = await exigirMaster()
        const g = a.grupos.find((x) => x.id === id)
        if (!g) throw new ApiError('Grupo não encontrado.', 404)
        if (g.sistema) throw new ApiError('O grupo Master não pode ser excluído.', 403)
        if (a.usuarios.some((u) => u.grupo_id === id)) throw new ApiError('Este grupo tem usuários. Mude o grupo deles antes de excluir.', 409)
        a.grupos = a.grupos.filter((x) => x.id !== id)
        gravar(a)
      },
    },
  }
}

function validarGrupo(a: Acesso, d: GrupoForm, ignorarId?: number) {
  const campos: Record<string, string[]> = {}
  if (!d.nome?.trim()) campos.nome = ['O campo nome é obrigatório.']
  else if (a.grupos.some((g) => g.id !== ignorarId && mesmoEmail(g.nome, d.nome))) campos.nome = ['Já existe um grupo com este nome.']
  if (Object.keys(campos).length) throw new ApiError(Object.values(campos)[0][0], 422, [], campos)
}
