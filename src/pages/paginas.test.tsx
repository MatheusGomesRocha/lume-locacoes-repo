import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { criarApiLocal } from '../api/local'
import { MASTER_EMAIL, SENHA_DEMO } from '../api/acesso'
import { renderizar, servicosDeTeste, chatFalso, memoria, HOJE } from '../test/utils'

describe('Painel', () => {
  it('mostra indicadores, status e próximos eventos do seed', async () => {
    renderizar('/')
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument()
    expect(screen.getByText('Recebido no mês')).toBeInTheDocument()
    expect(screen.getByText('A receber')).toBeInTheDocument()
    expect(screen.getByText('Em atraso')).toBeInTheDocument()
    expect(screen.getByText('Orçamentos em aberto')).toBeInTheDocument()
    expect(screen.getByText('30 no total')).toBeInTheDocument()
    expect(screen.getByText('Próximos eventos')).toBeInTheDocument()
    expect(screen.getByText('Produtos mais alugados')).toBeInTheDocument()
  })
  it('mostra erro com botão de tentar de novo', async () => {
    const s = servicosDeTeste()
    s.api.dashboard = async () => { throw new Error('Falhou feio') }
    renderizar('/', s)
    expect(await screen.findByRole('alert')).toHaveTextContent('Falhou feio')
    expect(screen.getByRole('button', { name: 'Tentar de novo' })).toBeInTheDocument()
  })
})

describe('Clientes', () => {
  it('lista, busca, cria e valida', async () => {
    renderizar('/clientes')
    expect(await screen.findByText('Buffet Sabor & Arte')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Buscar clientes'), 'Buffet Sabor')
    await waitFor(() => expect(screen.queryAllByRole('row').length).toBeLessThan(5))
    await userEvent.clear(screen.getByLabelText('Buscar clientes'))

    await userEvent.click(screen.getByRole('button', { name: 'Novo cliente' }))
    const modal = await screen.findByRole('dialog', { name: 'Novo cliente' })
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cliente' }))
    expect(await within(modal).findByText('O campo nome é obrigatório.')).toBeInTheDocument()

    await userEvent.type(within(modal).getByLabelText('Nome'), 'Zélia Teste')
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cliente' }))
    expect(await screen.findByText('Cliente cadastrado.')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Buscar clientes'), 'Zélia') // ordem alfabética: o novo cliente cai na página 2
    expect(await screen.findByText('Zélia Teste')).toBeInTheDocument()
  })
  it('edita um cliente', async () => {
    renderizar('/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Editar Buffet Sabor & Arte' }))
    const modal = await screen.findByRole('dialog', { name: 'Editar cliente' })
    const nome = within(modal).getByLabelText('Nome')
    await userEvent.clear(nome)
    await userEvent.type(nome, 'Buffet Renomeado')
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar cliente' }))
    expect(await screen.findByText('Buffet Renomeado')).toBeInTheDocument()
  })
  it('não exclui cliente com orçamentos e explica por quê', async () => {
    renderizar('/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Agência Quadro Branco' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir cliente' }))
    expect(await screen.findByText('Este cliente já tem orçamentos e não pode ser excluído.')).toBeInTheDocument()
  })
  it('exclui cliente sem orçamentos', async () => {
    renderizar('/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir Buffet Sabor & Arte' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Excluir cliente' }))
    expect(await screen.findByText('Cliente excluído.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Buffet Sabor & Arte')).toBeNull())
  })
})

describe('Produtos', () => {
  it('lista, filtra por categoria e cadastra com validação de código único', async () => {
    renderizar('/produtos')
    expect(await screen.findByRole('heading', { name: 'Produtos' })).toBeInTheDocument()

    await userEvent.selectOptions(await screen.findByLabelText('Filtrar por categoria'), 'Iluminação')
    expect(await screen.findByText('Refletor LED RGB 200W')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Caixa de som ativa 15"')).toBeNull())

    await userEvent.click(screen.getByRole('button', { name: 'Novo produto' }))
    const modal = await screen.findByRole('dialog', { name: 'Novo produto' })
    await userEvent.type(within(modal).getByLabelText('Código'), 'LUZ-001')
    await userEvent.type(within(modal).getByLabelText('Categoria'), 'Iluminação')
    await userEvent.type(within(modal).getByLabelText('Nome'), 'Outro refletor')
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar produto' }))
    expect(await within(modal).findByText('Já existe um registro com este valor em código.')).toBeInTheDocument()

    const codigo = within(modal).getByLabelText('Código')
    await userEvent.clear(codigo)
    await userEvent.type(codigo, 'LUZ-777')
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar produto' }))
    expect(await screen.findByText('Produto cadastrado.')).toBeInTheDocument()
  })
})

describe('Orçamentos', () => {
  it('lista e filtra por status pela URL', async () => {
    renderizar('/orcamentos?status=cancelado')
    expect(await screen.findByRole('heading', { name: 'Orçamentos' })).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(4)) // cabeçalho + 3 cancelados do seed
    expect(screen.getByRole('button', { name: 'Cancelado' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('cria um orçamento, calcula o total ao vivo, aprova e vê a cobrança', async () => {
    renderizar('/orcamentos/novo')
    await screen.findByRole('heading', { name: 'Novo orçamento' })

    await userEvent.click(screen.getByRole('button', { name: 'Criar orçamento' }))
    expect(await screen.findByText('O valor escolhido em cliente é inválido ou está inativo.')).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Cliente'), '1')
    await userEvent.type(screen.getByLabelText('Evento'), 'Festa de teste')
    await userEvent.selectOptions(screen.getByLabelText('Adicionar produto'), '1') // LUZ-001, R$ 85,00
    await userEvent.click(screen.getByRole('button', { name: 'Adicionar' }))
    const qtd = screen.getByLabelText(/Quantidade de/)
    await userEvent.clear(qtd)
    await userEvent.type(qtd, '2')
    // 2 × 85 × 1 diária (padrão: retirada +7, devolução +8) = 170
    expect(within(screen.getByLabelText('Resumo')).getAllByText('R$ 170,00').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: 'Criar orçamento' }))
    expect(await screen.findByRole('heading', { name: /Orçamento 2026\/00\d+/ })).toBeInTheDocument()
    expect(screen.getByText('Rascunho')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Aprovar/ }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Aprovar orçamento?' })).getByRole('button', { name: 'Aprovar' }))
    expect(await screen.findByText('Aprovado')).toBeInTheDocument()
    expect(await screen.findByText(/Vence em/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull()
    expect(screen.getByRole('button', { name: /Finalizar/ })).toBeInTheDocument()
  })

  it('mostra o estoque que falta ao tentar aprovar sem disponibilidade', async () => {
    const s = servicosDeTeste()
    const base = { cliente_id: 1, evento: 'A', data_retirada: '2027-03-10', data_devolucao: '2027-03-12', desconto: 0, observacoes: '' }
    const produto = (await s.api.produtos.listar())[0]
    const a = await s.api.orcamentos.criar({ ...base, itens: [{ produto_id: produto.id, quantidade: produto.quantidade }] })
    await s.api.orcamentos.aprovar(a.id)
    const b = await s.api.orcamentos.criar({ ...base, evento: 'B', itens: [{ produto_id: produto.id, quantidade: 1 }] })

    renderizar(`/orcamentos/${b.id}`, s)
    await userEvent.click(await screen.findByRole('button', { name: /Aprovar/ }))
    await userEvent.click(within(await screen.findByRole('dialog', { name: 'Aprovar orçamento?' })).getByRole('button', { name: 'Aprovar' }))
    const modal = await screen.findByRole('dialog', { name: 'Não há estoque suficiente' })
    expect(within(modal).getByText(produto.nome)).toBeInTheDocument()
    expect(within(modal).getByText(/pediu 1, livre 0/)).toBeInTheDocument()
  })

  it('edita e cancela um rascunho; botões mudam conforme o status', async () => {
    const s = servicosDeTeste()
    const rascunho = (await s.api.orcamentos.listar({ status: 'rascunho' }))[0]
    renderizar(`/orcamentos/${rascunho.id}`, s)
    expect(await screen.findByRole('link', { name: /Editar/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Marcar como enviado/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Finalizar/ })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: /^Cancelar$/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar orçamento' }))
    expect(await screen.findByText('Orçamento cancelado.')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Excluir/ })).toBeInTheDocument()
  })

  it('orçamento inexistente mostra erro', async () => {
    renderizar('/orcamentos/9999')
    expect(await screen.findByRole('alert')).toHaveTextContent('Registro não encontrado.')
  })
})

describe('Financeiro', () => {
  it('lista cobranças, filtra atrasadas e registra um pagamento', async () => {
    renderizar('/financeiro')
    expect(await screen.findByRole('heading', { name: 'Financeiro' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Em atraso' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Em atraso' })).toHaveAttribute('aria-pressed', 'true'))

    const botoes = await screen.findAllByRole('button', { name: /Registrar pagamento do orçamento/ })
    const antes = botoes.length
    await userEvent.click(botoes[0])
    const modal = await screen.findByRole('dialog', { name: 'Registrar pagamento' })
    await userEvent.selectOptions(within(modal).getByLabelText('Forma de pagamento'), 'boleto')
    await userEvent.click(within(modal).getByRole('button', { name: 'Confirmar pagamento' }))
    expect(await screen.findByText('Pagamento registrado.')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryAllByRole('button', { name: /Registrar pagamento do orçamento/ })).toHaveLength(antes - 1))
  })
})

describe('Assistente e navegação', () => {
  it('a página do assistente mostra a Lumi e responde perguntas', async () => {
    const chat = chatFalso({ resposta: 'Vá em Orçamentos e clique em Novo.' })
    renderizar('/assistente', servicosDeTeste({ chat }))
    expect(await screen.findByRole('heading', { name: 'Oi, eu sou a Lumi' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Abrir assistente' })).toBeNull() // sem o botão flutuante nesta página
  })

  it('cada pergunta vira um registro, com avaliação, e aparece na tela de conversas', async () => {
    const servicos = servicosDeTeste({ chat: chatFalso({ resposta: 'Vá em Orçamentos.' }) })
    const { unmount } = renderizar('/assistente', servicos)
    await userEvent.type(await screen.findByPlaceholderText(/Pergunte algo/i), 'Como crio um orçamento?{enter}')
    await userEvent.click(await screen.findByRole('button', { name: 'Resposta útil' }, { timeout: 4000 }))
    await waitFor(async () => expect((await servicos.api.chatLogs.listar())[0]).toMatchObject({ pergunta: 'Como crio um orçamento?', tipo: 'ajuda', feedback: 'positivo' }))
    unmount()
    renderizar('/assistente/conversas', servicos)
    expect(await screen.findByRole('heading', { name: 'Conversas do assistente' })).toBeInTheDocument()
    expect(await screen.findByText('Como crio um orçamento?')).toBeInTheDocument()
    expect(screen.getByText('Útil')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Apagar registros/ }))
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Apagar' }))
    expect(await screen.findByText('Nenhum registro')).toBeInTheDocument()
  })

  it('o master responde uma pergunta sem resposta e ela entra na base; ignorar tira da lista', async () => {
    const servicos = servicosDeTeste()
    const registrar = (pergunta: string) => servicos.api.chatLogs.registrar({ pergunta, resposta: 'Não encontrei', tipo: 'nao_encontrou', fonte_id: null, ferramenta: null, gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 5, voltas: 1 })
    await registrar('como adiciono uma pessoa no sistema')
    await registrar('receita de bolo')
    renderizar('/assistente/conversas', servicos)

    expect(await screen.findByText('2 aguardando resposta')).toBeInTheDocument()
    const linha = screen.getByText('como adiciono uma pessoa no sistema').closest('tr') as HTMLElement
    await userEvent.click(within(linha).getByRole('button', { name: /Responder/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Responder pergunta' })
    expect(within(dialogo).getByLabelText('Pergunta')).toHaveValue('Como adiciono uma pessoa no sistema?')
    await userEvent.type(within(dialogo).getByLabelText('Resposta'), 'Peça ao master para cadastrar você em Usuários.')
    await userEvent.click(within(dialogo).getByRole('button', { name: 'Salvar resposta' }))

    expect(await screen.findByText('Respostas que você escreveu')).toBeInTheDocument()
    expect(await screen.findByText('Já respondida')).toBeInTheDocument()
    expect(await screen.findByText('1 aguardando resposta')).toBeInTheDocument()
    expect((await servicos.api.faq.paraAssistente())[0]).toMatchObject({ resposta: 'Peça ao master para cadastrar você em Usuários.', palavras_chave: ['como adiciono uma pessoa no sistema'] })

    await userEvent.click(screen.getByRole('button', { name: /Ignorar/ }))
    expect(await screen.findByText('0 aguardando resposta')).toBeInTheDocument()
    expect(screen.getByText('Ignorada')).toBeInTheDocument()
  })

  it('quem não é master vê as conversas, mas sem Responder, Ignorar nem a lista de respostas', async () => {
    const api = criarApiLocal({ storage: memoria(), agora: () => HOJE, sessaoInicial: MASTER_EMAIL })
    await api.chatLogs.registrar({ pergunta: 'como faço backup', resposta: 'Não encontrei', tipo: 'nao_encontrou', fonte_id: null, ferramenta: null, gerada_por_llm: false, em_cache: false, usou_contexto: false, latencia_ms: 5, voltas: 1 })
    const grupo = await api.grupos.criar({ nome: 'Só conversas', descricao: null, permissoes: ['assistente.conversas'] })
    await api.usuarios.criar({ nome: 'Ana', email: 'ana@lume.com', papel: 'usuario', grupo_id: grupo.id, ativo: true, senha: 'senha1234' })
    await api.auth.sair()
    await api.auth.entrar('ana@lume.com', 'senha1234')
    renderizar('/assistente/conversas', servicosDeTeste({ api }))

    expect(await screen.findByText('como faço backup')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Responder/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Ignorar/ })).toBeNull()
    expect(screen.queryByText('Respostas que você escreveu')).toBeNull()
  })

  it('o botão flutuante abre e fecha a conversa nas outras telas', async () => {
    renderizar('/clientes')
    await userEvent.click(await screen.findByRole('button', { name: 'Abrir assistente' }))
    expect(screen.getByRole('region', { name: 'Conversa com a Lumi' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Fechar conversa' }))
    expect(screen.queryByRole('region', { name: 'Conversa com a Lumi' })).toBeNull()
  })

  it('o menu leva às seções', async () => {
    renderizar('/')
    await userEvent.click(within(await screen.findByRole('navigation', { name: 'Principal' })).getByRole('link', { name: 'Financeiro' }))
    expect(await screen.findByRole('heading', { name: 'Financeiro' })).toBeInTheDocument()
  })

  it('a demonstração oferece restaurar os dados de exemplo', async () => {
    renderizar('/')
    expect(await screen.findByText('Versão de demonstração')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Restaurar dados de exemplo/ }))
    expect(await screen.findByRole('dialog', { name: 'Restaurar dados de exemplo?' })).toBeInTheDocument()
  })

  it('rota desconhecida volta ao painel', async () => {
    renderizar('/qualquer-coisa')
    expect(await screen.findByRole('heading', { name: 'Painel' })).toBeInTheDocument()
  })
})

describe('Acesso', () => {
  const semLogin = () => servicosDeTeste({ api: criarApiLocal({ storage: memoria(), agora: () => HOJE }) })
  const entrar = async (email: string) => {
    await userEvent.type(await screen.findByLabelText('E-mail'), email)
    await userEvent.type(screen.getByLabelText('Senha'), SENHA_DEMO)
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
  }

  it('sem login só aparece a tela de entrada; senha errada mostra erro', async () => {
    renderizar('/clientes', semLogin())
    await userEvent.type(await screen.findByLabelText('E-mail'), 'master@lume.com')
    await userEvent.type(screen.getByLabelText('Senha'), 'errada1234')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.')
    expect(screen.queryByRole('navigation', { name: 'Principal' })).toBeNull()
  })

  it('atendimento entra e só vê no menu o que o grupo permite', async () => {
    renderizar('/', semLogin())
    await entrar('atendimento@lume.com')
    const menu = await screen.findByRole('navigation', { name: 'Principal' })
    expect(within(menu).getByRole('link', { name: 'Orçamentos' })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: 'Clientes' })).toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: 'Financeiro' })).toBeNull()
    expect(within(menu).queryByRole('link', { name: 'Usuários' })).toBeNull()
    expect(within(menu).queryByRole('link', { name: 'Grupos' })).toBeNull()
  })

  it('digitar a rota de uma tela sem permissão mostra aviso, não os dados', async () => {
    const s = semLogin()
    renderizar('/financeiro', s)
    await entrar('atendimento@lume.com')
    expect(await screen.findByText('Você não tem acesso a esta tela')).toBeInTheDocument()
  })

  it('sem permissão de excluir/criar, os botões não aparecem', async () => {
    renderizar('/clientes', semLogin())
    await entrar('atendimento@lume.com')
    expect(await screen.findByRole('button', { name: 'Novo cliente' })).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /^Editar / }).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: /^Excluir / })).toBeNull()
  })

  it('o master vê Usuários e Grupos e cria um grupo com permissões', async () => {
    renderizar('/grupos', semLogin())
    await entrar('master@lume.com')
    expect(await screen.findByRole('heading', { name: 'Grupos de permissões' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Novo grupo' }))
    const modal = await screen.findByRole('dialog', { name: 'Novo grupo' })
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar grupo' }))
    expect(await within(modal).findByText('O campo nome é obrigatório.')).toBeInTheDocument()
    await userEvent.type(within(modal).getByLabelText('Nome do grupo'), 'Só leitura')
    await userEvent.click(within(modal).getByRole('checkbox', { name: 'Clientes: Ver' }))
    await userEvent.click(within(modal).getByRole('button', { name: 'Salvar grupo' }))
    expect(await screen.findByText('Só leitura')).toBeInTheDocument()
    expect(screen.getByText(/1 permissões · 0 usuários/)).toBeInTheDocument()
  })

  it('o admin vê Usuários, mas não Grupos; o grupo Master não tem botões de editar', async () => {
    renderizar('/usuarios', semLogin())
    await entrar('admin@lume.com')
    expect(await screen.findByRole('heading', { name: 'Usuários' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Grupos' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Editar Master' })).toBeNull() // admin não mexe no master
    expect(screen.getByRole('button', { name: 'Editar Bruno do Atendimento' })).toBeInTheDocument()
  })

  it('sair volta para a tela de entrada', async () => {
    renderizar('/', semLogin())
    await entrar('master@lume.com')
    await userEvent.click(await screen.findByRole('button', { name: /Sair/ }))
    expect(await screen.findByRole('button', { name: 'Entrar' })).toBeInTheDocument()
  })
})

describe('Paginação das listas', () => {
  it('mostra 10 por página, anda entre páginas e deixa trocar o tamanho', async () => {
    localStorage.clear()
    renderizar('/produtos')
    const nav = await screen.findByRole('navigation', { name: 'Paginação' })
    const total = Number(/de (\d+)/.exec(nav.textContent ?? '')?.[1])
    expect(total).toBeGreaterThan(10)
    expect(nav).toHaveTextContent(`1–10 de ${total}`)
    await waitFor(() => expect(screen.getAllByRole('row')).toHaveLength(11)) // cabeçalho + 10

    await userEvent.click(screen.getByRole('button', { name: 'Próxima página' }))
    expect(await screen.findByText(new RegExp(`11–${Math.min(20, total)} de ${total}`))).toBeInTheDocument()

    await userEvent.selectOptions(screen.getByLabelText('Itens por página'), '100')
    expect(await screen.findByText(new RegExp(`1–${total} de ${total}`))).toBeInTheDocument() // volta para a página 1
    expect(localStorage.getItem('lume.por_pagina')).toBe('100')
    localStorage.clear()
  })
})

describe('Qualidade e custo da Lumi', () => {
  it('mostra tokens, custo e taxa de acerto das conversas, por tipo e por versão', async () => {
    const api = criarApiLocal({ storage: memoria(), agora: () => HOJE, sessaoInicial: undefined })
    await api.auth.entrar(MASTER_EMAIL, SENHA_DEMO)
    const base = { resposta: 'ok', fonte_id: null, ferramenta: null, gerada_por_llm: true, em_cache: false, usou_contexto: false, latencia_ms: 200, voltas: 1 }
    await api.chatLogs.registrar({ ...base, pergunta: 'quantos clientes?', tipo: 'consulta', tokens_entrada: 1000, tokens_saida: 100, custo_usd: 0.00014, versao: 'aaa1111' })
    await api.chatLogs.registrar({ ...base, pergunta: 'como crio?', tipo: 'ajuda', gerada_por_llm: false, versao: 'aaa1111' })
    await api.chatLogs.registrar({ ...base, pergunta: 'isso não existe', tipo: 'nao_encontrou', versao: 'bbb2222' })
    renderizar('/assistente/conversas', servicosDeTeste({ api }))
    await userEvent.click(await screen.findByRole('tab', { name: 'Qualidade e custo' }))
    expect(await screen.findByText('Tokens gastos (total)')).toBeInTheDocument()
    expect(screen.getAllByText('1.100').length).toBeGreaterThan(0) // 1000 de entrada + 100 de saída
    expect(screen.getAllByText('67%').length).toBeGreaterThan(0) // 2 de 3 conversas resolvidas
    const versoes = screen.getByRole('region', { name: 'Evolução entre versões' })
    expect(within(versoes).getByText('aaa1111')).toBeInTheDocument()
    expect(within(versoes).getByText('bbb2222')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Por tipo de pergunta' })).toBeInTheDocument()
  })
})
