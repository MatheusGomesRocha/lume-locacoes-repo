import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import { criarServicos } from './api'
import App from './App'
import { AvisoProvider } from './components/ui'
import { ServicosProvider } from './lib/servicos'
import './index.css'

const servicos = criarServicos()
// GitHub Pages não sabe responder rotas como /orcamentos/3, então a demonstração usa "#/orcamentos/3"
const Roteador = servicos.api.modo === 'local' ? HashRouter : BrowserRouter

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ServicosProvider servicos={servicos}>
      <AvisoProvider>
        <Roteador>
          <App />
        </Roteador>
      </AvisoProvider>
    </ServicosProvider>
  </StrictMode>,
)
