import { render, screen } from '@testing-library/react'
import { Lumi } from './Lumi'

describe('Lumi', () => {
  it('tem texto alternativo e estado padrão ocioso', () => {
    render(<Lumi />)
    const svg = screen.getByRole('img', { name: 'Lumi, o assistente' })
    expect(svg).toHaveAttribute('data-estado', 'ocioso')
  })
  it('avisa quando está pensando', () => {
    render(<Lumi estado="pensando" />)
    expect(screen.getByRole('img', { name: 'Lumi está pensando' })).toHaveAttribute('data-estado', 'pensando')
  })
  it('aceita tamanho e animação de flutuar', () => {
    render(<Lumi tamanho={80} flutuando />)
    const svg = screen.getByRole('img')
    expect(svg).toHaveAttribute('width', '80')
    expect(svg.getAttribute('class')).toContain('animate-flutuar')
  })
  it('feliz desenha sorriso preenchido', () => {
    const { container } = render(<Lumi estado="feliz" />)
    expect(container.querySelector('path[fill="#101C3D"]')).not.toBeNull()
  })
})
