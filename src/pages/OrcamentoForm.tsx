import { useNavigate, useParams } from 'react-router-dom'
import { FormOrcamento } from '../components/formularios/FormOrcamento'
import { Cabecalho, CaixaErro, Carregando, useAviso } from '../components/ui'
import { useApi } from '../lib/servicos'
import { useCarregar } from '../lib/useCarregar'

export default function OrcamentoForm() {
  const api = useApi()
  const navegar = useNavigate()
  const avisar = useAviso()
  const { id } = useParams()
  const editando = id !== undefined

  const apoio = useCarregar(async () => {
    const [clientes, produtos, atual] = await Promise.all([api.clientes.listar(), api.produtos.listar({ ativo: true }), editando ? api.orcamentos.obter(Number(id)) : null])
    return { clientes, produtos, atual }
  }, [api, id])

  if (apoio.carregando) return <Carregando />
  if (apoio.erro || !apoio.dados) return <CaixaErro mensagem={apoio.erro ?? 'Não foi possível carregar o formulário.'} aoTentar={() => void apoio.recarregar()} />
  const { clientes, produtos, atual } = apoio.dados

  return (
    <>
      <Cabecalho titulo={editando ? `Editar orçamento ${atual?.numero ?? ''}` : 'Novo orçamento'} descricao="Escolha o cliente, o período e os itens. O total é calculado por diária." />
      <FormOrcamento
        clientes={clientes}
        produtos={produtos}
        registro={atual}
        aoSalvo={(salvo) => {
          avisar(editando ? 'Orçamento atualizado.' : `Orçamento ${salvo.numero} criado.`)
          navegar(`/orcamentos/${salvo.id}`)
        }}
        aoCancelar={() => navegar(-1)}
      />
    </>
  )
}
