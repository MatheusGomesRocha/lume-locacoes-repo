import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import Assistente from './pages/Assistente'
import Clientes from './pages/Clientes'
import Financeiro from './pages/Financeiro'
import OrcamentoDetalhe from './pages/OrcamentoDetalhe'
import OrcamentoForm from './pages/OrcamentoForm'
import Orcamentos from './pages/Orcamentos'
import Painel from './pages/Painel'
import Produtos from './pages/Produtos'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Painel />} />
        <Route path="orcamentos" element={<Orcamentos />} />
        <Route path="orcamentos/novo" element={<OrcamentoForm />} />
        <Route path="orcamentos/:id" element={<OrcamentoDetalhe />} />
        <Route path="orcamentos/:id/editar" element={<OrcamentoForm />} />
        <Route path="financeiro" element={<Financeiro />} />
        <Route path="produtos" element={<Produtos />} />
        <Route path="clientes" element={<Clientes />} />
        <Route path="assistente" element={<Assistente />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
