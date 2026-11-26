import { Lock } from 'lucide-react'
import { Vazio } from '../components/ui'

export default function SemPermissao() {
  return (
    <div className="cartao mt-6">
      <Vazio titulo="Você não tem acesso a esta tela" texto="Peça a um administrador para incluir este módulo no seu grupo de permissões." acao={<Lock className="mx-auto h-6 w-6 text-tinta-mute" aria-hidden />} />
    </div>
  )
}
