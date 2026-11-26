import { paginar } from './paginacao'

describe('paginar (a demo pagina como o Laravel)', () => {
  const todos = Array.from({ length: 25 }, (_, i) => i + 1)
  it('corta a página e informa o total', () => {
    expect(paginar(todos, { pagina: 2, porPagina: 10 })).toEqual({ dados: [11, 12, 13, 14, 15, 16, 17, 18, 19, 20], total: 25, pagina: 2, por_pagina: 10, ultima_pagina: 3 })
    expect(paginar(todos, { pagina: 3, porPagina: 10 }).dados).toHaveLength(5)
  })
  it('página fora do limite vira a última; lista vazia tem 1 página; o tamanho é limitado a 100', () => {
    expect(paginar(todos, { pagina: 99, porPagina: 10 }).pagina).toBe(3)
    expect(paginar([], { pagina: 1, porPagina: 10 })).toMatchObject({ dados: [], total: 0, ultima_pagina: 1 })
    expect(paginar(todos, { pagina: 1, porPagina: 5000 }).por_pagina).toBe(100)
  })
})
