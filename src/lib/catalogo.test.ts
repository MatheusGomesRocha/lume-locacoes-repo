import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { MASTER_EMAIL, SENHA_DEMO } from '../api/acesso'
import { criarApiLocal } from '../api/local'
import { HOJE, memoria } from '../test/utils'
import { criarClienteChat } from './chat'
import { ErroConsulta, carregarEntidade, executarSpec, type Linha, type SessaoConsulta, type SpecConsulta } from './catalogo'
import { executarConsulta } from './ferramentas'

interface Vetores {
  dados: Record<string, Linha[]>
  sessoes: Record<string, SessaoConsulta>
  casos: { nome: string; sessao: string; params: Record<string, unknown>; spec: SpecConsulta; esperado?: unknown; erro?: string }[]
}
// Os mesmos casos que a API Python (ia-api/tests/test_catalogo_chat.py) executa: os dois executores têm de concordar.
const vetores = JSON.parse(readFileSync(join(__dirname, '../test/catalogo_vetores.json'), 'utf-8')) as Vetores

describe('executor de consultas aprovadas (mesmos casos da API Python)', () => {
  it.each(vetores.casos)('$nome', (c) => {
    const sessao = vetores.sessoes[c.sessao]
    if (c.erro) {
      try {
        executarSpec(c.spec, c.params, vetores.dados, sessao)
        throw new Error('deveria ter falhado')
      } catch (e) {
        expect(e).toBeInstanceOf(ErroConsulta)
        expect((e as ErroConsulta).codigo).toBe(c.erro)
      }
    } else {
      expect(executarSpec(c.spec, c.params, vetores.dados, sessao)).toEqual(c.esperado)
    }
  })
})

const SPEC: SpecConsulta = {
  nome: 'contar_usuarios_por_perfil', entidade: 'usuarios', operacao: 'contar', permissao: 'usuarios.ver', papel_minimo: 'admin',
  parametros: { papel: { tipo: 'enum', valores: ['master', 'admin', 'usuario'], obrigatorio: true } },
  filtros: [{ campo: 'papel', op: 'igual', parametro: 'papel' }],
  exemplos: ['quantos usuários do tipo master eu tenho', 'quantos usuários admin existem', 'total de usuários do perfil usuario'],
}

const log = (pergunta: string) => ({ pergunta, resposta: 'não sei', tipo: 'nao_encontrou' as const, fonte_id: null, ferramenta: null, gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 10, voltas: 1 })
const relatorio = { id: 'EV-0001', titulo: 'Usuários por perfil', decisao_do_analista: 'criar_consulta', perguntas: ['quantos usuários do tipo master eu tenho?'], vezes: 1, status: 'pendente', veredito: 'aprovar_recomendado', texto: '# EV-0001', proposta: {}, pacote: { spec: SPEC }, avaliacao: null }

/** API da demo logada como master, com uma consulta já aprovada (a IA é simulada). */
async function apiComConsultaAprovada() {
  const buscar = (async (url: string) => (url.endsWith('/evolucao/propor') ? new Response(JSON.stringify({ relatorios: [relatorio] })) : new Response(JSON.stringify({ bloqueio: false, achados: [] })))) as unknown as typeof fetch
  const api = criarApiLocal({ storage: memoria(), agora: () => HOJE, iaUrl: 'http://ia', buscar })
  await api.auth.entrar(MASTER_EMAIL, SENHA_DEMO)
  await api.chatLogs.registrar(log('quantos usuários do tipo master eu tenho?'))
  await api.evolucao.analisar()
  await api.evolucao.decidir('EV-0001', true)
  return api
}

describe('consulta aprovada no chat, de ponta a ponta', () => {
  const json = (o: object) => new Response(JSON.stringify(o), { status: 200 })

  it('a API pede a consulta, o front executa pelas telas e devolve o número', async () => {
    const api = await apiComConsultaAprovada()
    const corpos: Record<string, unknown>[] = []
    const buscar = (async (_url: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body)) as Record<string, unknown>
      corpos.push(corpo)
      if (!corpo.resultados) return json({ encontrou: true, resposta: '', fonte: null, confianca: 1, relacionadas: [], consultas: [{ nome: 'catalogo', args: { nome: SPEC.nome, params: { papel: 'master' } } }] })
      return json({ encontrou: true, resposta: 'Você tem 1 usuário master.', fonte: null, confianca: 1, relacionadas: [] })
    }) as unknown as typeof fetch
    const chat = criarClienteChat({ tipo: 'direto', url: 'http://ia' }, buscar, 5000, (c) => executarConsulta(api, c))
    const r = await chat.perguntar('quantos usuários do tipo master eu tenho?', { historico: [], catalogo: await api.evolucao.paraAssistente() })
    expect(r.resposta).toContain('1 usuário master')
    expect(corpos[0].catalogo).toHaveLength(1) // a primeira volta levou o catálogo aprovado
    const volta = (corpos[1].resultados as { nome: string; resultado: { total: number } }[])[0]
    expect(volta.nome).toBe('catalogo')
    expect(volta.resultado.total).toBe(1) // o master do exemplo
  })

  it('consulta desativada deixa de existir para o chat', async () => {
    const api = await apiComConsultaAprovada()
    await api.evolucao.desativar('EV-0001')
    expect(await api.evolucao.catalogo()).toEqual([])
    const r = await executarConsulta(api, { nome: 'catalogo', args: { nome: SPEC.nome, params: { papel: 'master' } } })
    expect(r).toEqual({ erro: 'esta consulta não está mais aprovada' })
  })

  it('parâmetro inválido volta como erro legível, sem ler dados', async () => {
    const api = await apiComConsultaAprovada()
    expect(await executarConsulta(api, { nome: 'catalogo', args: { nome: SPEC.nome, params: { papel: 'root' } } })).toEqual({ erro: 'valor fora da lista: root' })
  })
})

describe('entidade grupos de permissão', () => {
  it('conta os grupos que a tela de grupos mostra e fica só para administrador', async () => {
    const api = criarApiLocal({ storage: memoria(), agora: () => HOJE })
    const sessao = await api.auth.entrar(MASTER_EMAIL, SENHA_DEMO)
    const spec: SpecConsulta = { nome: 'contar_grupos', entidade: 'grupos', operacao: 'contar', permissao: 'usuarios.ver', papel_minimo: 'admin', parametros: {}, filtros: [], exemplos: ['quantos grupos de permissão temos', 'total de grupos', 'quantos grupos existem'] }
    const linhas = await carregarEntidade(api, 'grupos')
    const ctx = { papel: sessao.usuario.papel, permissoes: sessao.permissoes }
    expect(executarSpec(spec, {}, { grupos: linhas }, ctx)).toEqual({ total: (await api.grupos.listar()).length })
    expect(() => executarSpec(spec, {}, { grupos: linhas }, { papel: 'usuario', permissoes: ['usuarios.ver'] })).toThrow(ErroConsulta)
  })
})
