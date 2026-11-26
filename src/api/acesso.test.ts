import { criarApiLocal } from './local'
import { MASTER_EMAIL, SENHA_DEMO } from './acesso'
import { ApiError } from './tipos'
import { memoria, HOJE } from '../test/utils'
import { TODAS_PERMISSOES } from '../lib/permissoes'

const nova = () => criarApiLocal({ storage: memoria(), agora: () => HOJE })
const comoMaster = async () => { const a = nova(); await a.auth.entrar(MASTER_EMAIL, SENHA_DEMO); return a }
const entrarComo = async (a: ReturnType<typeof nova>, email: string) => a.auth.entrar(email, SENHA_DEMO)
const falhaCom = async (p: Promise<unknown>, status: number) => {
  const e = await p.then(() => null, (x) => x)
  expect(e).toBeInstanceOf(ApiError)
  expect((e as ApiError).status).toBe(status)
  return e as ApiError
}
const novoUsuario = (o = {}) => ({ nome: 'Novo', email: 'novo@lume.com', papel: 'usuario' as const, grupo_id: 3, ativo: true, senha: 'senha1234', ...o })

describe('login', () => {
  it('sem entrar, nenhuma ação de dados funciona (401)', async () => {
    const a = nova()
    await falhaCom(a.clientes.listar(), 401)
    await falhaCom(a.dashboard(), 401)
    await falhaCom(a.usuarios.listar(), 401)
  })
  it('e-mail ou senha errados dão a mesma mensagem', async () => {
    const a = nova()
    const e1 = await falhaCom(a.auth.entrar(MASTER_EMAIL, 'errada123'), 401)
    const e2 = await falhaCom(a.auth.entrar('ninguem@lume.com', SENHA_DEMO), 401)
    expect(e1.message).toBe(e2.message)
  })
  it('entra, guarda a sessão e sai', async () => {
    const a = nova()
    const s = await a.auth.entrar('MASTER@lume.com', SENHA_DEMO)
    expect(s.usuario).toMatchObject({ papel: 'master', email: MASTER_EMAIL })
    expect(s.usuario).not.toHaveProperty('senha_hash')
    expect(a.auth.salva()?.usuario.id).toBe(s.usuario.id)
    expect((await a.clientes.listar()).length).toBeGreaterThan(0)
    await a.auth.sair()
    expect(a.auth.salva()).toBeNull()
    await falhaCom(a.clientes.listar(), 401)
  })
  it('usuário desativado não entra', async () => {
    const a = await comoMaster()
    const u = await a.usuarios.criar(novoUsuario({ ativo: false }))
    await a.auth.sair()
    const e = await falhaCom(a.auth.entrar(u.email, 'senha1234'), 403)
    expect(e.message).toContain('desativado')
  })
  it('desativar quem está logado derruba a sessão na próxima ação', async () => {
    const a = await comoMaster()
    const u = await a.usuarios.criar(novoUsuario())
    await a.usuarios.atualizar(u.id, { ...novoUsuario(), ativo: false })
    await a.auth.sair()
    await falhaCom(a.auth.entrar(u.email, 'senha1234'), 403)
  })
})

describe('permissões por grupo', () => {
  it('master tem todas', async () => {
    const a = await comoMaster()
    expect((await a.auth.atualizar()).permissoes).toEqual(TODAS_PERMISSOES)
  })
  it('atendimento vê e cria clientes, mas não exclui, e não vê o financeiro', async () => {
    const a = nova()
    await entrarComo(a, 'atendimento@lume.com')
    expect((await a.clientes.listar()).length).toBeGreaterThan(0)
    await a.clientes.criar({ nome: 'Fulano', tipo: 'PF', documento: null, email: null, telefone: null, cidade: null, observacoes: null })
    await falhaCom(a.clientes.excluir(1), 403)
    await falhaCom(a.pagamentos.listar(), 403)
    await falhaCom(a.pagamentos.baixar(1, '2026-11-25', 'pix'), 403)
    await falhaCom(a.produtos.criar({ codigo: 'X', nome: 'X', categoria: 'Som', descricao: null, valor_diaria: 1, valor_reposicao: 0, quantidade: 1, ativo: true }), 403)
  })
  it('financeiro dá baixa, mas não aprova orçamento', async () => {
    const a = nova()
    await entrarComo(a, 'financeiro@lume.com')
    expect((await a.pagamentos.listar()).length).toBeGreaterThan(0)
    await falhaCom(a.orcamentos.aprovar(1), 403)
    await falhaCom(a.orcamentos.criar({ cliente_id: 1, evento: 'x', data_retirada: '2027-01-01', data_devolucao: '2027-01-02', desconto: 0, observacoes: '', itens: [] }), 403)
  })
  it('editar o grupo vale já na próxima ação, sem novo login', async () => {
    const m = await comoMaster()
    const mesmo = m // mesma sessão do navegador: troca de usuário simulada abaixo
    await m.auth.sair()
    await entrarComo(mesmo, 'atendimento@lume.com')
    await falhaCom(mesmo.pagamentos.listar(), 403)
    await mesmo.auth.sair()
    await entrarComo(mesmo, MASTER_EMAIL)
    const g = (await mesmo.grupos.listar()).find((x) => x.nome === 'Atendimento')!
    await mesmo.grupos.atualizar(g.id, { nome: g.nome, descricao: g.descricao, permissoes: [...g.permissoes, 'financeiro.ver'] })
    await mesmo.auth.sair()
    await entrarComo(mesmo, 'atendimento@lume.com')
    expect((await mesmo.pagamentos.listar()).length).toBeGreaterThan(0)
  })
  it('permissões desconhecidas são descartadas ao salvar o grupo', async () => {
    const a = await comoMaster()
    const g = await a.grupos.criar({ nome: 'Teste', descricao: null, permissoes: ['clientes.ver', 'clientes.ver', 'foo.bar'] })
    expect(g.permissoes).toEqual(['clientes.ver'])
  })
})

describe('hierarquia de usuários', () => {
  it('usuário comum não gerencia usuários nem grupos', async () => {
    const a = nova()
    await entrarComo(a, 'atendimento@lume.com')
    await falhaCom(a.usuarios.listar(), 403)
    await falhaCom(a.grupos.listar(), 403)
    await falhaCom(a.grupos.criar({ nome: 'x', descricao: null, permissoes: [] }), 403)
  })
  it('admin cadastra usuário comum, mas sempre como comum, e não mexe em grupos', async () => {
    const a = nova()
    await entrarComo(a, 'admin@lume.com')
    const u = await a.usuarios.criar(novoUsuario({ papel: 'admin' }))
    expect(u.papel).toBe('usuario')
    await falhaCom(a.grupos.criar({ nome: 'x', descricao: null, permissoes: [] }), 403)
    expect((await a.grupos.listar()).length).toBeGreaterThan(0) // pode ver, para escolher ao cadastrar
  })
  it('admin não edita nem exclui o master nem outro admin', async () => {
    const m = await comoMaster()
    const outro = await m.usuarios.criar(novoUsuario({ email: 'admin2@lume.com', papel: 'admin', grupo_id: 2 }))
    await m.auth.sair()
    const a = m
    await entrarComo(a, 'admin@lume.com')
    const lista = await a.usuarios.listar()
    const master = lista.find((u) => u.papel === 'master')!
    await falhaCom(a.usuarios.atualizar(master.id, { ...novoUsuario({ email: MASTER_EMAIL, nome: 'Hack' }) }), 403)
    await falhaCom(a.usuarios.excluir(master.id), 422)
    await falhaCom(a.usuarios.atualizar(outro.id, novoUsuario()), 403)
    await falhaCom(a.usuarios.excluir(outro.id), 403)
  })
  it('só o master promove a admin; ninguém cria outro master nem usa o grupo Master', async () => {
    const a = await comoMaster()
    const adm = await a.usuarios.criar(novoUsuario({ papel: 'admin', grupo_id: 2 }))
    expect(adm.papel).toBe('admin')
    await falhaCom(a.usuarios.criar(novoUsuario({ email: 'm2@lume.com', papel: 'master' })), 422)
    await falhaCom(a.usuarios.criar(novoUsuario({ email: 'm3@lume.com', grupo_id: 1 })), 422)
  })
  it('o master só altera nome, e-mail e senha; mantém papel e grupo', async () => {
    const a = await comoMaster()
    const eu = (await a.usuarios.listar()).find((u) => u.papel === 'master')!
    const r = await a.usuarios.atualizar(eu.id, { nome: 'Dono', email: MASTER_EMAIL, papel: 'usuario', grupo_id: 3, ativo: false, senha: 'outrasenha1' })
    expect(r).toMatchObject({ nome: 'Dono', papel: 'master', grupo_id: 1, ativo: true })
    await a.auth.sair()
    expect((await a.auth.entrar(MASTER_EMAIL, 'outrasenha1')).usuario.nome).toBe('Dono')
  })
  it('ninguém exclui a si mesmo; e-mail é único; senha mínima de 8; grupo é obrigatório', async () => {
    const a = await comoMaster()
    const eu = (await a.usuarios.listar()).find((u) => u.papel === 'master')!
    await falhaCom(a.usuarios.excluir(eu.id), 422)
    await falhaCom(a.usuarios.criar(novoUsuario({ email: 'ADMIN@lume.com' })), 422)
    await falhaCom(a.usuarios.criar(novoUsuario({ senha: 'curta' })), 422)
    await falhaCom(a.usuarios.criar(novoUsuario({ grupo_id: 0 })), 422)
  })
})

describe('grupos', () => {
  it('o grupo Master não muda nem sai; grupo com usuários não é excluído', async () => {
    const a = await comoMaster()
    const grupos = await a.grupos.listar()
    const master = grupos.find((g) => g.sistema)!
    expect(master.permissoes).toEqual(TODAS_PERMISSOES)
    await falhaCom(a.grupos.atualizar(master.id, { nome: 'x', descricao: null, permissoes: [] }), 403)
    await falhaCom(a.grupos.excluir(master.id), 403)
    const atendimento = grupos.find((g) => g.nome === 'Atendimento')!
    await falhaCom(a.grupos.excluir(atendimento.id), 409)
    const vazio = await a.grupos.criar({ nome: 'Vazio', descricao: null, permissoes: [] })
    await a.grupos.excluir(vazio.id)
    expect((await a.grupos.listar()).some((g) => g.id === vazio.id)).toBe(false)
  })
  it('nome é obrigatório e único', async () => {
    const a = await comoMaster()
    await falhaCom(a.grupos.criar({ nome: ' ', descricao: null, permissoes: [] }), 422)
    await falhaCom(a.grupos.criar({ nome: 'atendimento', descricao: null, permissoes: [] }), 422)
  })
})

describe('minha conta', () => {
  it('troca a senha só com a senha atual correta', async () => {
    const a = nova()
    await entrarComo(a, 'atendimento@lume.com')
    const base = { nome: 'Bruno', email: 'atendimento@lume.com' }
    await falhaCom(a.auth.alterarMinhaConta({ ...base, senha_atual: 'errada', nova_senha: 'novasenha1' }), 422)
    await falhaCom(a.auth.alterarMinhaConta({ ...base, senha_atual: SENHA_DEMO, nova_senha: 'curta' }), 422)
    await a.auth.alterarMinhaConta({ ...base, senha_atual: SENHA_DEMO, nova_senha: 'novasenha1' })
    await a.auth.sair()
    expect((await a.auth.entrar('atendimento@lume.com', 'novasenha1')).usuario.nome).toBe('Bruno')
  })
  it('não dá para trocar o próprio papel ou grupo por aqui, nem usar e-mail de outro', async () => {
    const a = nova()
    await entrarComo(a, 'atendimento@lume.com')
    await falhaCom(a.auth.alterarMinhaConta({ nome: 'B', email: 'admin@lume.com' }), 422)
    const s = await a.auth.alterarMinhaConta({ nome: 'B', email: 'atendimento@lume.com', ...({ papel: 'master', grupo_id: 1 } as object) })
    expect(s.usuario).toMatchObject({ papel: 'usuario', grupo_id: 3 })
  })
})
