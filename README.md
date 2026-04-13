# 🦈 Loto-Shark

Plataforma de análise de loterias brasileiras com inteligência artificial. Analisa histórico real da Caixa Econômica Federal e gera previsões usando um ensemble de múltiplos modelos de IA.

## Funcionalidades

- Dashboard com todas as modalidades (Mega-Sena, Lotofácil, Quina, Lotomania e mais)
- Gerador inteligente de jogos com estratégias: aleatório, quente, frio, balanceado e IA
- Mapa de calor de frequência dos números
- Análise por ensemble de IA com múltiplos provedores simultâneos
- Chat com assistente Shark
- Histórico de resultados em tempo real (API da Caixa)
- Design futurista cyberpunk com animações

## Pré-requisitos

- [Node.js 24+](https://nodejs.org/)
- [pnpm](https://pnpm.io/)
- PostgreSQL (provisionado automaticamente no Replit)

## Configuração

### 1. Variáveis de Ambiente

Copie o arquivo de exemplo e preencha com suas chaves:

```bash
cp .env.example .env
```

Edite `.env` com suas chaves de API. **Pelo menos um provedor de IA deve estar configurado** para usar as funcionalidades de análise.

| Variável | Provedor | Link |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI (GPT) | https://platform.openai.com/api-keys |
| `ANTHROPIC_API_KEY` | Anthropic (Claude) | https://console.anthropic.com/ |
| `GOOGLE_API_KEY` | Google (Gemini) | https://aistudio.google.com/app/apikey |
| `GROQ_API_KEY` | Groq (LLaMA ultrarrápido) | https://console.groq.com/keys |
| `DEEPSEEK_API_KEY` | DeepSeek | https://platform.deepseek.com/ |
| `OPENROUTER_API_KEY` | OpenRouter (multi-modelo) | https://openrouter.ai/keys |
| `MISTRAL_API_KEY` | Mistral AI | https://console.mistral.ai/ |
| `COHERE_API_KEY` | Cohere | https://dashboard.cohere.com/api-keys |

> **No Replit:** use a aba **Secrets** do painel lateral para configurar as variáveis — nunca crie um arquivo `.env` manualmente no Replit.

### 2. Instalar dependências

```bash
pnpm install
```

### 3. Iniciar em desenvolvimento

```bash
# Frontend (porta 8080)
PORT=8080 BASE_PATH=/ pnpm --filter @workspace/loto-shark run dev

# API (porta 8081) — em outro terminal
PORT=8081 pnpm --filter @workspace/api-server run dev
```

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 19 + Vite + Tailwind CSS 4 |
| Backend | Express 5 + TypeScript |
| Banco de dados | PostgreSQL + Drizzle ORM |
| IA | Ensemble multi-provedor (OpenAI, Anthropic, Gemini, Groq…) |
| Monorepo | pnpm workspaces |

## Comandos úteis

```bash
pnpm run typecheck                        # Verificação de tipos em todos os pacotes
pnpm run build                            # Build completo
pnpm --filter @workspace/db run push      # Aplicar schema do banco (dev)
pnpm --filter @workspace/api-spec run codegen  # Regenerar hooks da API
```

## Segurança

- Chaves de API são lidas **exclusivamente** de variáveis de ambiente (`process.env`)
- O arquivo `.env` está no `.gitignore` e nunca deve ser versionado
- Use `.env.example` como modelo — ele não contém valores reais
