# Trendou

Repositório de landing pages para produtos digitais.

## Air Fryer Todo Dia

Página baseada na direção visual da referência enviada pelo vendedor, com copy própria, personagem fictícia identificada como ilustrativa, 150 receitas e três bônus conferidos no PDF.

- Preço atual: **R$29,90** (preço anterior exibido: R$49,90).
- Código: `public/air-fryer/`.
- A página inicial `/` apresenta este produto por meio da regra em `vercel.json`.
- Novos produtos podem ter suas próprias pastas em `public/`.
- Todos os botões de compra levam ao checkout SyncPay fornecido pelo vendedor.

## Importar na Vercel

Importe este repositório e use a branch `main`. Mantenha a raiz do projeto na raiz do repositório, não na pasta do produto. O projeto é estático: preset Other, sem comando de instalação ou build. O arquivo `vercel.json` define a pasta de saída `public` e a página inicial.

O nome de projeto desejado pelo vendedor é `trendo`. O domínio `trendo.vercel.app` depende da disponibilidade e da configuração na conta Vercel; o nome do repositório não precisa ser igual ao nome do projeto.

## Manutenção

Edite `public/air-fryer/index.html` para mudar textos, preço e checkout; `styles.css` para aparência; `script.js` para encaminhamento dos parâmetros de campanha. Imagens estão em `assets/`.

O preço aparece na oferta e na barra móvel; atualize ambos juntos. O checkout deve apresentar os mesmos valores e benefícios. Não há cobrança nem entrega automática implementada neste repositório: ambas dependem do checkout e do fluxo de entrega do vendedor.

O PDF pago não está incluído no site. Antes de divulgar, confira o checkout, a entrega do material e acrescente contato real do vendedor e políticas aplicáveis. A personagem não representa uma autora, nutricionista ou cliente real. Não há depoimentos inventados, contagem regressiva ou promessa de emagrecimento.

## Verificação

Validados: sintaxe JavaScript, links e arquivos locais, 5 CTAs para o checkout informado, preço atualizado e configuração de saída. Não foi realizado pagamento real nem teste de entrega do PDF. A publicação e conferência final na Vercel são realizadas pelo proprietário.
