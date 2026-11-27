import { describe, expect, it } from "vitest"
import { completarTextos } from "../lib/catalogo"

describe('completarTextos (parâmetro de texto vindo da pergunta)', () => {
  const spec = { nome: 'estoque_categoria', entidade: 'produtos', operacao: 'somar', campo_soma: 'quantidade', permissao: 'produtos.ver',
    filtros: [{ campo: 'categoria', op: 'igual', parametro: 'cat' }], parametros: { cat: { tipo: 'texto', obrigatorio: true } } } as never
  const linhas = [{ categoria: 'Mobiliário' }, { categoria: 'Iluminação' }, { categoria: 'Som' }]
  it('acha a categoria que existe, com ou sem acento e no plural', () => {
    expect(completarTextos(spec, {}, 'quanto tem de iluminacao?', linhas)).toEqual({ params: { cat: 'Iluminação' } })
  })
  it('não inventa: categoria que não existe vira pergunta com as opções reais', () => {
    const r = completarTextos(spec, {}, 'total da categoria Cadeiras', linhas)
    expect(r).toHaveProperty('pergunta')
    expect((r as { pergunta: string }).pergunta).toContain('Mobiliário')
  })
})
