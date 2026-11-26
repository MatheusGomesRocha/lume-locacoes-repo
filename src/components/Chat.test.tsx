import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ServicosProvider } from '../lib/servicos'
import { AvisoProvider } from './ui'
import { criarApiLocal } from '../api/local'
import { chatFalso, servicosDeTeste, memoria, HOJE } from '../test/utils'
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

  it('envia o contexto da conversa: perguntas anteriores e a última resposta', async () => {
    const chat = chatFalso((p) => ({ fonte: { id: p.includes('produtos') ? 'prod-excluir' : 'orc-excluir', modulo: 'x', pergunta: 'y' } }))
    montar(chat)
    const campo = screen.getByLabelText('Sua pergunta')

    await userEvent.type(campo, 'mas e pra excluir produtos?')
    await userEvent.keyboard('{Enter}')
    await screen.findByText('Resposta de teste.')
    await userEvent.type(campo, 'mas eu quero excluir')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(chat.perguntas).toHaveLength(2))

    expect(chat.contextos[0]).toEqual({ historico: [], ultimoId: null })
    expect(chat.contextos[1]).toEqual({ historico: ['mas e pra excluir produtos?'], ultimoId: 'prod-excluir' })
  })
})

describe('cadastros e exclusões dentro do chat', () => {
  const acao = (nome: string, args: Record<string, unknown>, resposta = 'Pronto.') => ({ resposta, acoes: [{ nome, args }] })

  async function abrir(respostas: Parameters<typeof chatFalso>[0]) {
    const servicos = servicosDeTeste({ chat: chatFalso(respostas) })
    render(<ServicosProvider servicos={servicos}><AvisoProvider><Chat esperar={async () => {}} atraso={() => 1} /></AvisoProvider></ServicosProvider>)
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'faça isso')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }))
    return servicos
  }

  it('cadastro de cliente abre o mesmo formulário, já preenchido, e salva pela mesma API', async () => {
    const { api } = await abrir(acao('cadastrar_cliente', { nome: 'Padaria Sol', tipo: 'PJ', cidade: 'Fortaleza' }))
    const nome = await screen.findByLabelText('Nome')
    expect(nome).toHaveValue('Padaria Sol')
    expect(screen.getByLabelText('Tipo')).toHaveValue('PJ')
    expect(screen.getByLabelText('Cidade')).toHaveValue('Fortaleza')
    expect(await api.clientes.listar('Padaria')).toHaveLength(0) // nada foi gravado só por abrir

    await userEvent.type(screen.getByLabelText('E-mail'), 'contato@padariasol.com')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))

    expect(await screen.findByText('Cliente “Padaria Sol” cadastrado.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Nome')).toBeNull()
    expect(await api.clientes.listar('Padaria')).toMatchObject([{ nome: 'Padaria Sol', tipo: 'PJ', email: 'contato@padariasol.com' }])
  })

  it('o cadastro pelo chat segue as mesmas regras da tela (nome obrigatório, e-mail válido)', async () => {
    const { api } = await abrir(acao('cadastrar_cliente', { cidade: 'Sobral' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar cliente' }))
    expect(await screen.findByText('O campo nome é obrigatório.')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Nome'), 'Anastácia Zeta')
    await userEvent.type(screen.getByLabelText('E-mail'), 'invalido')
    await userEvent.click(screen.getByRole('button', { name: 'Salvar cliente' }))
    expect(await screen.findByText(/e-mail válido/)).toBeInTheDocument()
    expect(await api.clientes.listar('Anastácia')).toHaveLength(0)
  })

  it('cancelar o formulário não grava nada', async () => {
    const { api } = await abrir(acao('cadastrar_cliente', { nome: 'Ana Teste' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText(/cancelado\. Nada foi salvo/)).toBeInTheDocument()
    expect(await api.clientes.listar('Ana Teste')).toHaveLength(0)
  })

  it('cadastro de produto vem com os valores e sugere as categorias existentes', async () => {
    const { api } = await abrir(acao('cadastrar_produto', { codigo: 'TRI-001', nome: 'Tripé', categoria: 'Som', valor_diaria: 25, quantidade: 4 }))
    expect(await screen.findByLabelText('Nome')).toHaveValue('Tripé')
    expect(screen.getByLabelText('Valor da diária (R$)')).toHaveValue(25)
    await userEvent.click(screen.getByRole('button', { name: 'Salvar produto' }))
    expect(await screen.findByText('Produto “Tripé” cadastrado.')).toBeInTheDocument()
    expect((await api.produtos.listar({ busca: 'TRI-001' }))[0]).toMatchObject({ nome: 'Tripé', quantidade: 4, valor_diaria: 25 })
  })

  it('cadastro de produto com código repetido mostra o erro da API no cartão', async () => {
    await abrir(acao('cadastrar_produto', { codigo: 'LUZ-001', nome: 'Outro', categoria: 'Som', valor_diaria: 10 }))
    await userEvent.click(await screen.findByRole('button', { name: 'Salvar produto' }))
    expect(await screen.findByText(/já está em uso|já existe|já foi/i)).toBeInTheDocument()
  })

  it('novo orçamento vem com cliente, evento e itens escolhidos e mostra o total', async () => {
    const { api } = await abrir(acao('cadastrar_orcamento', { cliente: 'Hotel Pôr do Sol', evento: 'Réveillon', data_retirada: '2026-12-30', data_devolucao: '2026-12-31', itens: [{ produto: 'Cadeira Tiffany', quantidade: 10 }] }))
    expect(await screen.findByLabelText('Evento')).toHaveValue('Réveillon')
    expect(screen.getByLabelText('Cliente')).toHaveDisplayValue('Hotel Pôr do Sol')
    expect(screen.getByLabelText('Quantidade de Cadeira Tiffany Branca')).toHaveValue(10)
    await userEvent.click(screen.getByRole('button', { name: 'Criar orçamento' }))
    expect(await screen.findByText(/Orçamento \d{4}\/\d{4} criado\./)).toBeInTheDocument()
    expect((await api.orcamentos.listar({ busca: 'Réveillon' }))[0]).toMatchObject({ status: 'rascunho', evento: 'Réveillon' })
  })

  it('novo orçamento sem itens é recusado pela mesma regra da tela', async () => {
    await abrir(acao('cadastrar_orcamento', { cliente: 'Hotel Pôr do Sol', evento: 'Sem itens' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Criar orçamento' }))
    expect(await screen.findByText(/pelo menos 1 item/)).toBeInTheDocument()
  })

  it('cliente inexistente no pedido de orçamento aparece como aviso no cartão', async () => {
    await abrir(acao('cadastrar_orcamento', { cliente: 'Zé Ninguém' }))
    expect(await screen.findByText(/Não encontrei o cliente “Zé Ninguém”/)).toBeInTheDocument()
  })

  it('exclusão só acontece depois do botão de confirmação', async () => {
    const servicos = servicosDeTeste({ chat: chatFalso(acao('excluir_registro', { modulo: 'produto', busca: 'Tripé' })) })
    const novo = await servicos.api.produtos.criar({ codigo: 'TRI-9', nome: 'Tripé de Teste', categoria: 'Som', descricao: null, valor_diaria: 5, valor_reposicao: 0, quantidade: 1, ativo: true })
    render(<ServicosProvider servicos={servicos}><AvisoProvider><Chat esperar={async () => {}} atraso={() => 1} /></AvisoProvider></ServicosProvider>)
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'exclui o tripé')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }))

    expect(await screen.findByText('Tripé de Teste (TRI-9)')).toBeInTheDocument()
    expect(screen.getByText(/Se o produto já foi usado em orçamentos/)).toBeInTheDocument()
    expect(await servicos.api.produtos.listar({ busca: 'TRI-9' })).toHaveLength(1) // ainda não excluiu

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar exclusão' }))
    expect(await screen.findByText('Tripé de Teste (TRI-9) foi excluído.')).toBeInTheDocument()
    expect(await servicos.api.produtos.listar({ busca: 'TRI-9' })).toHaveLength(0)
    expect(novo.id).toBeGreaterThan(0)
  })

  it('cancelar a exclusão não exclui', async () => {
    const servicos = await abrir(acao('excluir_registro', { modulo: 'cliente', busca: 'Mariana Albuquerque' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar' }))
    expect(await screen.findByText(/Exclusão cancelada/)).toBeInTheDocument()
    expect(await servicos.api.clientes.listar('Mariana')).toHaveLength(1)
  })

  it('as regras de hoje continuam valendo: cliente com orçamento mostra a mensagem da API e nada é excluído', async () => {
    const servicos = await abrir(acao('excluir_registro', { modulo: 'cliente', busca: 'Hotel Pôr do Sol' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar exclusão' }))
    expect(await screen.findByText(/já tem orçamentos e não pode ser excluído/)).toBeInTheDocument()
    expect(await servicos.api.clientes.listar('Hotel Pôr do Sol')).toHaveLength(1)
  })

  it('orçamento aprovado não pode ser excluído, mesmo confirmando', async () => {
    const servicos = servicosDeTeste()
    const aprovado = (await servicos.api.orcamentos.listar({ status: 'aprovado' }))[0]
    const completo = servicosDeTeste({ api: servicos.api, chat: chatFalso(acao('excluir_registro', { modulo: 'orcamento', busca: aprovado.numero })) })
    render(<ServicosProvider servicos={completo}><AvisoProvider><Chat esperar={async () => {}} atraso={() => 1} /></AvisoProvider></ServicosProvider>)
    await userEvent.type(screen.getByLabelText('Sua pergunta'), 'apague o orçamento')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Confirmar exclusão' }))
    expect(await screen.findByText(/Só orçamentos|não pode ser excluído|rascunho|cancelado/i)).toBeInTheDocument()
    expect((await servicos.api.orcamentos.obter(aprovado.id)).id).toBe(aprovado.id)
  })

  it('quando há mais de um registro parecido, pergunta qual antes de pedir a confirmação', async () => {
    const servicos = await abrir(acao('excluir_registro', { modulo: 'produto', busca: 'Tenda' }))
    expect(await screen.findByText(/mais de um/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Tenda 10x10 m/ }))
    expect(await screen.findByRole('button', { name: 'Confirmar exclusão' })).toBeInTheDocument()
    expect(await servicos.api.produtos.listar({ busca: 'Tenda' })).toHaveLength(2)
  })

  it('registro que não existe vira uma frase, sem botão de excluir', async () => {
    await abrir(acao('excluir_registro', { modulo: 'cliente', busca: 'Fulano Inexistente' }))
    expect(await screen.findByText('Não encontrei nenhum cliente com “Fulano Inexistente”.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar exclusão' })).toBeNull()
  })

  it('o assistente não faz o que o usuário não poderia fazer nas telas', async () => {
    const api = criarApiLocal({ storage: memoria(), agora: () => HOJE, sessaoInicial: 'atendimento@lume.com' }) // grupo Atendimento: não exclui clientes
    const chat = chatFalso({ encontrou: true, resposta: 'Vou excluir.', acoes: [{ nome: 'excluir_registro', args: { modulo: 'cliente', busca: 'Buffet' } }] })
    render(<ServicosProvider servicos={{ api, chat }}><AvisoProvider><Chat esperar={async () => {}} atraso={() => 1} /></AvisoProvider></ServicosProvider>)
    await userEvent.type(await screen.findByLabelText('Sua pergunta'), 'exclui o cliente Buffet')
    await userEvent.click(screen.getByRole('button', { name: 'Enviar pergunta' }))
    expect(await screen.findByText(/não tem permissão para fazer isso/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar exclusão' })).toBeNull()
  })
})
