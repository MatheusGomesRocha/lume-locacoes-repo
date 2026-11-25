# Lume Locações: demonstração online

Sistema de locação de equipamentos para eventos com **orçamentos, financeiro, painel, produtos e clientes**, e a assistente **Lumi**, um chat que tira dúvidas sobre o sistema.

**Demonstração:** https://matheusgomesrocha.github.io/lume-locacoes-repo/

Esta é a versão **só front-end**, feita para visualização e teste. Tudo o que você cadastra fica no `localStorage` do seu navegador, com dados fictícios de exemplo já carregados. O botão "Restaurar dados de exemplo", no menu lateral, volta ao início. A versão completa, com backend Laravel e banco de dados próprio, está em [lume-locacoes](https://github.com/MatheusGomesRocha/lume-locacoes).

## Tecnologias

React 18, TypeScript, Vite, Tailwind CSS, React Router (com `HashRouter`, por causa do GitHub Pages), Recharts e Vitest + Testing Library.

## A Lumi

O chat conversa com uma API em Python (FastAPI) hospedada no Render, que compara a pergunta com um FAQ por similaridade de texto. O código da API está no repositório da versão real, na pasta `ia-api`. No plano gratuito do Render a API "dorme" quando fica sem uso: a primeira pergunta pode levar até 1 minuto, e a tela mostra "digitando…" nesse tempo.

## Rodar local

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # 138 testes
npm run build
```

Para o chat funcionar local, suba a `ia-api` (porta 8001) ou aponte `VITE_IA_API_URL` para a API hospedada.

## CI/CD

O workflow `.github/workflows/ci-cd.yml` roda a cada push:

| Evento | O que acontece |
|--------|----------------|
| Pull request ou push em outra branch | Instala, roda os testes e confere se o build passa |
| Push na `main` | Roda os testes, compila e **publica no GitHub Pages** |

Configuração feita uma única vez no GitHub:

1. **Settings → Pages → Source:** `GitHub Actions`.
2. **Settings → Secrets and variables → Actions → Variables:** crie `IA_API_URL` com a URL da API no Render (por exemplo `https://lume-ia.onrender.com`).
3. No Render, em `IA_ORIGENS_PERMITIDAS`, informe `https://matheusgomesrocha.github.io`.

## Atenção

Esta pasta é **gerada** a partir do front da versão real (`scripts/exportar_pages.py`, no repositório da versão real). Mudanças de código devem ser feitas lá e exportadas para cá.
