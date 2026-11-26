import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServicosProvider } from '../lib/servicos'
import { chatFalso, servicosDeTeste } from '../test/utils'
import { AvisoProvider } from './ui'
import { Chat } from './Chat'

/** O servidor de mentira conta a conversa do agente: resumo → (sim) → gravação confirmada. */
function conversa() {
  const estado = { fluxo: 'orcamento', aguardando: 'confirmar' }
  return chatFalso((p) => {
    if (/crie um orçamento/i.test(p)) return { resposta: 'Confira o orçamento antes de eu criar:\n• Total: R$ 170,00\n\nPosso criar?', agente: estado, opcoes: ['Confirmar', 'Cancelar'] }
    if (/^(sim|Confirmar)$/i.test(p)) return { resposta: 'Confirmado. Estou criando agora.', agente: null, executar: [{ nome: 'criar_orcamento', args: { cliente_id: 1, cliente_novo: false, evento: 'Evento do Agente', data_retirada: '2026-11-26', data_devolucao: '2026-11-26', desconto: 0, observacoes: '', itens: [{ produto_id: 1, quantidade: 2 }] } }] }
    if (/cancelar/i.test(p)) return { resposta: 'Tudo bem, cancelei. Nada foi criado nem alterado.', agente: null }
    return { resposta: 'Responda “sim” para eu criar ou “não” para cancelar.', agente: estado, opcoes: ['Confirmar', 'Cancelar'] }
  })
}

async function abrir(chat = conversa()) {
  const servicos = servicosDeTeste({ chat })
  render(<ServicosProvider servicos={servicos}><AvisoProvider><Chat esperar={async () => {}} atraso={() => 1} /></AvisoProvider></ServicosProvider>)
  const dizer = async (t: string) => { await userEvent.type(screen.getByLabelText('Sua pergunta'), t); await userEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' })) }
  return { ...servicos, chat, dizer }
}

describe('Chat com o agente conversacional', () => {
  it('mostra o resumo e NÃO grava nada até o usuário confirmar', async () => {
    const { api, dizer } = await abrir()
    await dizer('crie um orçamento para João Victor')
    expect(await screen.findByText(/Total: R\$ 170,00/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument()
    expect(await api.orcamentos.listar({ busca: 'Evento do Agente' })).toHaveLength(0)
  })

  it('o estado do agente volta na mensagem seguinte e só o "sim" grava, pela mesma API das telas', async () => {
    const { api, chat, dizer } = await abrir()
    await dizer('crie um orçamento para João Victor')
    await screen.findByText(/Posso criar/)
    await dizer('sim')
    expect(await screen.findByText(/Orçamento .* criado como rascunho/)).toBeInTheDocument()
    expect(chat.contextos[1]?.agente).toEqual({ fluxo: 'orcamento', aguardando: 'confirmar' })
    expect(await api.orcamentos.listar({ busca: 'Evento do Agente' })).toMatchObject([{ status: 'rascunho', total: 170 }])
  })

  it('clicar em “Confirmar” equivale a digitar sim', async () => {
    const { api, dizer } = await abrir()
    await dizer('crie um orçamento para João Victor')
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar' }))
    expect(await screen.findByText(/criado como rascunho/)).toBeInTheDocument()
    expect(await api.orcamentos.listar({ busca: 'Evento do Agente' })).toHaveLength(1)
  })

  it('cancelar encerra a conversa sem gravar e a próxima mensagem já não leva o estado', async () => {
    const { api, chat, dizer } = await abrir()
    await dizer('crie um orçamento para João Victor')
    await screen.findByText(/Posso criar/)
    await dizer('cancelar')
    expect(await screen.findByText(/cancelei/)).toBeInTheDocument()
    await dizer('como cobrar?')
    await waitFor(() => expect(chat.contextos).toHaveLength(3))
    expect(chat.contextos[2]?.agente).toBeUndefined()
    expect(await api.orcamentos.listar({ busca: 'Evento do Agente' })).toHaveLength(0)
  })

  it('aceita resposta de um caractere (escolher a opção 2) enquanto o agente espera', async () => {
    const { chat, dizer } = await abrir()
    await dizer('crie um orçamento para João Victor')
    await screen.findByText(/Posso criar/)
    await dizer('2')
    await waitFor(() => expect(chat.perguntas).toContain('2'))
  })

  it('sem agente em andamento, uma letra só continua não sendo enviada', async () => {
    const { chat } = await abrir()
    await userEvent.type(screen.getByLabelText('Sua pergunta'), '2')
    expect(screen.getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled()
    expect(chat.perguntas).toEqual([])
  })

  it('uma gravação que a API recusa aparece como erro, sem fingir que deu certo', async () => {
    const chat = chatFalso((p) => (/crie/.test(p) ? { resposta: 'Posso criar?', agente: { a: 1 }, opcoes: ['Confirmar', 'Cancelar'] } : { resposta: 'ok', agente: null, executar: [{ nome: 'criar_orcamento', args: { cliente_id: 999, cliente_novo: false, evento: 'Evento do Agente', data_retirada: '2026-11-26', data_devolucao: '2026-11-26', itens: [{ produto_id: 1, quantidade: 1 }] } }] }))
    const { api, dizer } = await abrir(chat)
    await dizer('crie')
    await screen.findByText('Posso criar?')
    await dizer('sim')
    expect(await screen.findByText(/Não consegui concluir/)).toBeInTheDocument()
    expect(await api.orcamentos.listar({ busca: 'Evento do Agente' })).toHaveLength(0)
  })
})
