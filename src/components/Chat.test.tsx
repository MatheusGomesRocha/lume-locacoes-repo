import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServicosProvider } from '../lib/servicos'
import { chatFalso, servicosDeTeste } from '../test/utils'
import { Chat } from './Chat'

function montar(chat = chatFalso(), esperar: (ms: number) => Promise<void> = async () => {}, atraso: (r: string) => number = () => 1500) {
  const servicos = servicosDeTeste({ chat })
  render(<ServicosProvider servicos={servicos}><Chat esperar={esperar} atraso={atraso} /></ServicosProvider>)
  return { chat }
}

describe('Chat com a Lumi', () => {
  it('começa com a saudação da Lumi', async () => {
    montar()
    expect(await screen.findByText(/Eu sou a Lumi/)).toBeInTheDocument()
    await act(async () => {})
  })

  it('mostra as sugestões vindas da API', async () => {
    montar(chatFalso({}, ['Como criar um orçamento?', 'Como cobrar?']))
    expect(await screen.findByRole('button', { name: /Como criar um orçamento\?/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Como cobrar\?/ })).toBeInTheDocument()
  })

  it('clicar numa sugestão envia a pergunta e some com as sugestões', async () => {
    const { chat } = montar(chatFalso({}, ['Como criar um orçamento?']))
    await userEvent.click(await screen.findByRole('button', { name: /Como criar/ }))
    expect(chat.perguntas).toEqual(['Como criar um orçamento?'])
    await waitFor(() => expect(screen.queryByRole('button', { name: /Como criar/ })).toBeNull())
  })

  it('mostra "digitando…" enquanto espera e só depois exibe a resposta', async () => {
    let liberar: () => void = () => {}
    const esperar = () => new Promise<void>((r) => { liberar = r })
    montar(chatFalso({ resposta: 'Abra o menu Orçamentos.' }), esperar)

    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'como criar orçamento')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }))

    expect(screen.getByText('como criar orçamento')).toBeInTheDocument()
    expect(await screen.findByRole('status', { name: 'Lumi está digitando' })).toBeInTheDocument()
    expect(screen.queryByText('Abra o menu Orçamentos.')).toBeNull()

    await act(async () => liberar())
    expect(await screen.findByText('Abra o menu Orçamentos.')).toBeInTheDocument()
    expect(screen.queryByRole('status', { name: 'Lumi está digitando' })).toBeNull()
  })

  it('espera o tempo simulado descontando o que a API já demorou', async () => {
    const esperas: number[] = []
    montar(chatFalso(), async (ms) => void esperas.push(ms), () => 1500)
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'oi tudo bem')
    await userEvent.keyboard('{Enter}')
    await screen.findByText('Resposta de teste.')
    expect(esperas).toHaveLength(1)
    expect(esperas[0]).toBeGreaterThan(1400)
    expect(esperas[0]).toBeLessThanOrEqual(1500)
  })

  it('bloqueia o envio durante a resposta e com texto muito curto', async () => {
    montar(chatFalso(), () => new Promise<void>(() => {}))
    const botao = screen.getByRole('button', { name: 'Enviar pergunta' })
    expect(botao).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'a')
    expect(botao).toBeDisabled()
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'bc')
    expect(botao).toBeEnabled()
    await userEvent.click(botao)
    await screen.findByRole('status', { name: 'Lumi está digitando' })
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'outra pergunta')
    expect(screen.getByRole('button', { name: 'Enviar pergunta' })).toBeDisabled()
  })

  it('oferece perguntas relacionadas e clicar nelas pergunta de novo', async () => {
    const { chat } = montar(chatFalso((p) => (p === 'primeira?' ? { resposta: 'R1', relacionadas: [{ id: 'x', pergunta: 'E a segunda?' }] } : { resposta: 'R2' })))
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'primeira?')
    await userEvent.keyboard('{Enter}')
    await userEvent.click(await screen.findByRole('button', { name: 'E a segunda?' }))
    expect(await screen.findByText('R2')).toBeInTheDocument()
    expect(chat.perguntas).toEqual(['primeira?', 'E a segunda?'])
  })

  it('quando não encontra, mostra a resposta e "Talvez você queira saber"', async () => {
    montar(chatFalso({ encontrou: false, resposta: 'Não encontrei isso.', relacionadas: [{ id: 'a', pergunta: 'Como aprovar?' }] }))
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'xyz abc')
    await userEvent.keyboard('{Enter}')
    expect(await screen.findByText('Não encontrei isso.')).toBeInTheDocument()
    expect(screen.getByText('Talvez você queira saber:')).toBeInTheDocument()
  })

  it('limpa o campo depois de enviar', async () => {
    montar()
    const campo = screen.getByLabelText('Sua pergunta') as HTMLInputElement
    await userEvent.type(campo, 'pergunta qualquer')
    await userEvent.keyboard('{Enter}')
    expect(campo.value).toBe('')
  })
})
