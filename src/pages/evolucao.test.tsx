import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderizar, servicosDeTeste } from '../test/utils'

const SPEC = { nome: 'contar_clientes_por_cidade', entidade: 'clientes', operacao: 'contar', permissao: 'clientes.ver', exemplos: ['a', 'b', 'c'] }
const relatorio = { id: 'EV-0001', titulo: 'Clientes por cidade', decisao_do_analista: 'criar_consulta', perguntas: ['quantos clientes em Fortaleza?'], vezes: 3, status: 'pendente', veredito: 'aprovar_recomendado', texto: '# EV-0001 · Clientes por cidade\n\n## 3. O que foi VERIFICADO\n- ✅ C01 · Nome válido', proposta: {}, pacote: { spec: SPEC }, avaliacao: null }

async function abrirAba() {
  const servicos = servicosDeTeste()
  const api = servicos.api as typeof servicos.api & { evolucao: { analisar: () => Promise<unknown> } }
  await api.chatLogs.registrar({ pergunta: 'quantos clientes em Fortaleza?', resposta: 'x', tipo: 'nao_encontrou', fonte_id: null, ferramenta: null, gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 1, voltas: 1 })
  // a IA é simulada: devolve a proposta pronta
  const original = globalThis.fetch
  globalThis.fetch = (async (url: string) => new Response(JSON.stringify(String(url).endsWith('/evolucao/propor') ? { relatorios: [relatorio] } : { bloqueio: false, achados: [] }))) as typeof fetch
  const r = renderizar('/assistente/conversas', servicos)
  await userEvent.click(await screen.findByRole('tab', { name: 'Evolução da Lumi' }))
  return { ...r, restaurar: () => { globalThis.fetch = original } }
}

describe('aba Evolução da Lumi (master)', () => {
  it('analisar mostra a proposta; ler relatório abre o texto; aprovar ativa', async () => {
    const { restaurar } = await abrirAba()
    try {
      await userEvent.click(await screen.findByRole('button', { name: /Analisar perguntas sem resposta/ }))
      expect(await screen.findByText('Clientes por cidade')).toBeInTheDocument()
      expect(screen.getByText(/Aguardando você/)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: /Ler relatório/ }))
      expect(await screen.findByText(/O que foi VERIFICADO/)).toBeInTheDocument()
      await userEvent.keyboard('{Escape}')
      await userEvent.click(screen.getByRole('button', { name: /^Aprovar/ }))
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Aprovar' }))
      await waitFor(() => expect(screen.getAllByText(/^Aprovada/).length).toBeGreaterThan(0))
      expect(screen.getByRole('button', { name: /Desativar/ })).toBeInTheDocument()
    } finally {
      restaurar()
    }
  })
})
