import { MODULOS, TODAS_PERMISSOES, limparPermissoes, podeGerenciar } from './permissoes'

describe('catálogo de permissões', () => {
  it('é o mesmo do Laravel (Acesso::todas), na mesma ordem', () => {
    // espelho de backend/app/Support/Acesso.php (lá há o mesmo teste): se mudar um, mude o outro
    expect(TODAS_PERMISSOES).toEqual([
      'painel.ver',
      'orcamentos.ver', 'orcamentos.criar', 'orcamentos.editar', 'orcamentos.excluir', 'orcamentos.enviar', 'orcamentos.aprovar', 'orcamentos.finalizar', 'orcamentos.cancelar',
      'financeiro.ver', 'financeiro.baixar',
      'produtos.ver', 'produtos.criar', 'produtos.editar', 'produtos.excluir',
      'clientes.ver', 'clientes.criar', 'clientes.editar', 'clientes.excluir',
      'assistente.usar', 'assistente.conversas',
      'usuarios.ver', 'usuarios.criar', 'usuarios.editar', 'usuarios.excluir',
    ])
    expect(MODULOS).toHaveLength(7)
  })
  it('limparPermissoes tira repetidas e desconhecidas', () => {
    expect(limparPermissoes(['clientes.ver', 'clientes.ver', 'x.y'])).toEqual(['clientes.ver'])
  })
})

describe('podeGerenciar', () => {
  const m = { id: 1, papel: 'master' as const }, a = { id: 2, papel: 'admin' as const }, a2 = { id: 3, papel: 'admin' as const }, u = { id: 4, papel: 'usuario' as const }
  it('master mexe em todos; admin só em usuários; ninguém além dele mexe no master', () => {
    expect([podeGerenciar(m, a), podeGerenciar(m, u), podeGerenciar(m, m)]).toEqual([true, true, true])
    expect([podeGerenciar(a, u), podeGerenciar(a, a2), podeGerenciar(a, a), podeGerenciar(a, m)]).toEqual([true, false, false, false])
    expect([podeGerenciar(u, u), podeGerenciar(u, a)]).toEqual([false, false])
  })
})
