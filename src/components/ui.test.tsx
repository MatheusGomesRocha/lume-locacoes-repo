import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Botao, AvisoProvider, Campo, Confirmar, Modal, Selo, Vazio, useAviso } from './ui'

describe('Botao', () => {
  it('desabilita e mostra carregando', () => {
    render(<Botao carregando>Salvar</Botao>)
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled()
  })
  it('dispara o clique', async () => {
    const f = vi.fn()
    render(<Botao onClick={f}>Ok</Botao>)
    await userEvent.click(screen.getByRole('button'))
    expect(f).toHaveBeenCalledOnce()
  })
})

describe('Campo', () => {
  it('liga rótulo e campo e mostra o erro com aria', () => {
    render(<Campo rotulo="Nome" erro="Obrigatório">{(id, aria) => <input id={id} {...aria} />}</Campo>)
    const campo = screen.getByLabelText('Nome')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByText('Obrigatório')).toBeInTheDocument()
    expect(campo.getAttribute('aria-describedby')).toBeTruthy()
  })
  it('mostra a dica só quando não há erro', () => {
    const { rerender } = render(<Campo rotulo="X" dica="Ajuda">{(id) => <input id={id} />}</Campo>)
    expect(screen.getByText('Ajuda')).toBeInTheDocument()
    rerender(<Campo rotulo="X" dica="Ajuda" erro="Ruim">{(id) => <input id={id} />}</Campo>)
    expect(screen.queryByText('Ajuda')).toBeNull()
  })
})

describe('Selo', () => {
  it('traduz o status', () => {
    render(<><Selo status="aprovado" /><Selo status="pendente" /></>)
    expect(screen.getByText('Aprovado')).toBeInTheDocument()
    expect(screen.getByText('A receber')).toBeInTheDocument()
  })
})

describe('Vazio', () => {
  it('mostra título, texto e ação', () => {
    render(<Vazio titulo="Nada aqui" texto="Crie algo" acao={<button>Criar</button>} />)
    expect(screen.getByText('Nada aqui')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar' })).toBeInTheDocument()
  })
})

describe('Modal', () => {
  it('não renderiza fechado, fecha com Esc e com o botão', async () => {
    const fechar = vi.fn()
    const { rerender } = render(<Modal aberto={false} titulo="T" aoFechar={fechar}>conteúdo</Modal>)
    expect(screen.queryByRole('dialog')).toBeNull()
    rerender(<Modal aberto titulo="T" aoFechar={fechar}>conteúdo</Modal>)
    expect(screen.getByRole('dialog', { name: 'T' })).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Fechar' }))
    expect(fechar).toHaveBeenCalledTimes(2)
  })
})

describe('Confirmar', () => {
  it('confirma ou volta', async () => {
    const ok = vi.fn(); const voltar = vi.fn()
    render(<Confirmar aberto titulo="Excluir?" texto="Certeza?" rotuloConfirmar="Excluir" perigo aoConfirmar={ok} aoFechar={voltar} />)
    await userEvent.click(screen.getByRole('button', { name: 'Excluir' }))
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(ok).toHaveBeenCalledOnce()
    expect(voltar).toHaveBeenCalledOnce()
  })
})

describe('Avisos', () => {
  function Disparador() {
    const avisar = useAviso()
    return <><button onClick={() => avisar('Salvo!')}>ok</button><button onClick={() => avisar('Falhou', 'erro')}>erro</button></>
  }
  it('mostra o aviso e some depois de alguns segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    render(<AvisoProvider><Disparador /></AvisoProvider>)
    await userEvent.click(screen.getByText('ok'))
    await userEvent.click(screen.getByText('erro'))
    expect(screen.getByText('Salvo!')).toBeInTheDocument()
    expect(screen.getByText('Falhou')).toBeInTheDocument()
    await act(async () => { vi.advanceTimersByTime(5000) })
    expect(screen.queryByText('Salvo!')).toBeNull()
    vi.useRealTimers()
  })
})
