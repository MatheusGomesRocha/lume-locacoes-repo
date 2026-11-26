import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Carregando } from './components/ui'
import { useSessao } from './lib/sessao'
import Assistente from './pages/Assistente'
import Conta from './pages/Conta'
import Grupos from './pages/Grupos'
import Login from './pages/Login'
import SemPermissao from './pages/SemPermissao'
import Usuarios from './pages/Usuarios'
import Clientes from './pages/Clientes'
import Financeiro from './pages/Financeiro'
import OrcamentoDetalhe from './pages/OrcamentoDetalhe'
import OrcamentoForm from './pages/OrcamentoForm'
import LogsAssistente from './pages/LogsAssistente'
import Orcamentos from './pages/Orcamentos'
import Painel from './pages/Painel'
import Produtos from './pages/Produtos'

/** Só mostra a tela se o usuário tiver alguma das permissões (a regra de verdade está na API). */
function Exige({ permissao, so, children }: { permissao?: string | string[]; so?: 'master'; children: ReactNode }) {
  const { pode, sessao } = useSessao()
  const lista = permissao === undefined ? [] : Array.isArray(permissao) ? permissao : [permissao]
  const liberado = so === 'master' ? sessao?.usuario.papel === 'master' : lista.length === 0 || pode(...lista)
  return liberado ? <>{children}</> : <SemPermissao />
}

export default function App() {
  const { sessao } = useSessao()
  if (sessao === undefined) return <div className="grid min-h-screen place-items-center"><Carregando /></div>
  if (sessao === null) return <Login />
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Exige permissao="painel.ver"><Painel /></Exige>} />
        <Route path="orcamentos" element={<Exige permissao="orcamentos.ver"><Orcamentos /></Exige>} />
        <Route path="orcamentos/novo" element={<Exige permissao="orcamentos.criar"><OrcamentoForm /></Exige>} />
        <Route path="orcamentos/:id" element={<Exige permissao="orcamentos.ver"><OrcamentoDetalhe /></Exige>} />
        <Route path="orcamentos/:id/editar" element={<Exige permissao="orcamentos.editar"><OrcamentoForm /></Exige>} />
        <Route path="financeiro" element={<Exige permissao="financeiro.ver"><Financeiro /></Exige>} />
        <Route path="produtos" element={<Exige permissao="produtos.ver"><Produtos /></Exige>} />
        <Route path="clientes" element={<Exige permissao="clientes.ver"><Clientes /></Exige>} />
        <Route path="assistente" element={<Exige permissao="assistente.usar"><Assistente /></Exige>} />
        <Route path="usuarios" element={<Exige permissao="usuarios.ver"><Usuarios /></Exige>} />
        <Route path="grupos" element={<Exige so="master"><Grupos /></Exige>} />
        <Route path="conta" element={<Conta />} />
        <Route path="assistente/conversas" element={<Exige permissao="assistente.conversas"><LogsAssistente /></Exige>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
