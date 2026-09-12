# Métricas Trendou — ativação

Implementação preparada para o projeto existente na Vercel, com raiz no repositório OU em `sites/air-fryer`. Não mude a Root Directory do projeto que já está no ar.

## Configurar antes de ativar

1. Na Vercel, abra o projeto Air Fryer → Storage/Marketplace → Neon. Crie ou conecte um banco dedicado. Confira o plano e os limites antes de contratar. Não foi criado banco automaticamente neste trabalho.
2. No SQL Editor do Neon, execute `sites/air-fryer/db/analytics.sql` uma vez.
3. Em Settings → Environment Variables do projeto, configure para Production: `DATABASE_URL` (conexão Neon), `ANALYTICS_ADMIN_KEY` (chave aleatória com pelo menos 32 caracteres, preferencialmente 64), `ANALYTICS_ORIGIN=https://trendou-airfryer.vercel.app` e `ANALYTICS_ENABLED=true`.
4. Não publique essas credenciais no GitHub, não coloque prefixos públicos nelas e não as envie no chat. Gere a chave com um gerenciador de senhas. O administrador digita essa chave no painel; o navegador só a mantém em memória e a transmite por HTTPS no cabeçalho `x-api-key`.
5. Adicione no Vercel Firewall uma regra de rate limiting para `/api/analytics`, sobretudo `action=collect`. Origem e payload são validados e cada visita tem teto de atualizações, mas clientes externos podem falsificar Origin/identificadores. A coleta é pública, não é prova antifraude. Ajuste limites ao tráfego legítimo; não bloqueie todos os visitantes de redes compartilhadas.
6. Faça Redeploy. Abra `/api/analytics?action=status`: deve responder `enabled: true`.
7. Em uma aba nova, visite a landing com `?utm_source=teste&utm_campaign=validacao&utm_content=imagem`, permita métricas, role a página e clique numa dúvida. Acesse `/admin`, informe a chave e confira a visita. Teste também recusar: nenhum POST de coleta deve ocorrer. Confirme que a API de relatório sem `x-api-key` responde 401 e que nenhuma credencial está em arquivos públicos. Uma chamada administrativa direta usa `x-api-key: SUA_CHAVE`; `/api/analytics` retorna JSON com visitas, tempo médio, página, origens, seções, cliques e visitas recentes.
8. Confira que assets e checkout continuam funcionando. Teste o projeto com a Root Directory que você já utiliza. Não há verificação de banco real/deploy concluída até essas etapas serem executadas.

## O que mede

Uma visita por abertura/recarregamento, sem identificar pessoas ou ligar dispositivos. Seções com ao menos 100 px (ou a altura completa quando menor) na tela por pelo menos 1 segundo. Tempo aproximado somente com aba visível e interação nos últimos 30 segundos. Relatórios de rolagem máxima, origem/campanha/criativo, cliques únicos por alvo e detalhes das últimas 100 visitas. A ordem de seções e cliques é um conjunto, não uma linha do tempo. Dimensões limitadas a códigos de campanha sem dados pessoais. Nenhum formulário, texto livre, IP, fingerprint ou replay é salvo por esta implementação. Cookies do Pixel não são gerenciados por esta preferência.

A coleta depende da autorização e pode ser bloqueada pelo navegador ou perder o último envio ao fechar a página. Origem não informada ou acesso sem UTM não permite atribuição confiável. Checkout não dispara Purchase e não comprova venda; pagamento real exige integração posterior com o provedor.

Dados são consultados por até 90 dias e excluídos quando um administrador abre o relatório. Para uma política de exclusão independente do uso do painel, agende no provedor `DELETE FROM trendou_visits WHERE created_at < now() - interval '90 days'`. Não há cron ativado.

## Operação

Desativar: `ANALYTICS_ENABLED=false` e Redeploy. Rodar localmente: `npm install`, `npx vercel dev` com variáveis locais. Build estático da raiz: `node scripts/build.mjs`; build da subpasta: `node build.mjs`. O build copia somente arquivos públicos e mantém server/db/env fora do output. O banco e a chave devem ser configurados somente no projeto usado para produção.

## Referências

- https://github.com/neondatabase/serverless — driver HTTP e consultas parametrizadas.
- https://vercel.com/docs/functions/runtimes/node-js — funções em api e dependências.


## Secrets no Cloudflare Worker

Cadastre os valores no Worker, nunca em `wrangler.toml`, JavaScript, HTML ou GitHub:

```bash
npx wrangler secret put ANALYTICS_ADMIN_KEY
npx wrangler secret put DATABASE_URL
npx wrangler secret put SYNCPAY_CLIENT_ID
npx wrangler secret put SYNCPAY_CLIENT_SECRET
```

A integração atual da SyncPay usa duas credenciais (`SYNCPAY_CLIENT_ID` e `SYNCPAY_CLIENT_SECRET`), e não uma chave única no código. O Worker deve receber esses bindings como secrets. `ANALYTICS_ORIGIN` e `ANALYTICS_ENABLED` não são segredos e podem ser variáveis normais. Não use prefixos públicos como `VITE_`, `NEXT_PUBLIC_` ou equivalentes.
