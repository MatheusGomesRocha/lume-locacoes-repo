import { criarServicos } from '.'

describe('criarServicos', () => {
  it('VITE_DRIVER=local usa o storage do navegador', () => {
    expect(criarServicos({ VITE_DRIVER: 'local' }).api.modo).toBe('local')
  })
  it('qualquer outro valor usa o Laravel', () => {
    expect(criarServicos({}).api.modo).toBe('http')
    expect(criarServicos({ VITE_DRIVER: 'http', VITE_API_URL: 'http://x/api' }).api.modo).toBe('http')
  })
})
