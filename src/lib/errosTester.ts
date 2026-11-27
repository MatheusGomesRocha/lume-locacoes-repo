import type { RelatorioEvolucao } from '../types'

export type TipoErroTester = 'caso_falhou' | 'checagem_falhou' | 'corrigido_pelo_codigo' | 'descartado_pelo_codigo' | 'duvida_do_tester' | 'aviso_do_revisor' | 'achado'

export interface ErroTester {
  relatorio: string
  titulo: string
  status: string
  veredito: string | null
  tipo: TipoErroTester
  /** Quem escreveu o caso que falhou: codigo, proposta (Analista) ou tester_llm. */
  origem?: string
  texto: string
}

const LINHA = /^\s*(?:[-•*]\s*)?(❌|🔧|🗑️|⚠️|⛔)\s*(.*)$/u

/**
 * Tudo o que deu errado ou foi corrigido no trabalho do Tester, tirado dos relatórios já guardados (nada novo precisa ser gravado).
 * É o arquivo que se manda para análise: cada linha é um erro, com o relatório de onde veio.
 */
export function errosDoTester(relatorios: RelatorioEvolucao[]): ErroTester[] {
  const saida: ErroTester[] = []
  for (const r of relatorios) {
    for (const linha of r.texto.split('\n')) {
      const m = LINHA.exec(linha)
      if (!m) continue
      const [, marca, resto] = m
      const base = { relatorio: r.id, titulo: r.titulo, status: r.status, veredito: r.veredito, texto: resto.trim() }
      const caso = /^\[(\w+)\]\s*(.*)$/u.exec(resto)
      if (marca === '❌' && caso) saida.push({ ...base, tipo: 'caso_falhou', origem: caso[1], texto: caso[2].trim() })
      else if (marca === '❌') saida.push({ ...base, tipo: 'checagem_falhou' })
      else if (marca === '🔧') saida.push({ ...base, tipo: 'corrigido_pelo_codigo' })
      else if (marca === '🗑️') saida.push({ ...base, tipo: 'descartado_pelo_codigo' })
      else if (/^T02\b/.test(resto)) saida.push({ ...base, tipo: 'duvida_do_tester' })
      else if (/^REV\b/.test(resto)) saida.push({ ...base, tipo: 'aviso_do_revisor' })
      else saida.push({ ...base, tipo: 'achado' })
    }
  }
  return saida
}
