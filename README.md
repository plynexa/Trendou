# Trendou

Cada site tem sua própria pasta e pode ser conectado a um projeto independente na Vercel.

| Pasta | Conteúdo | Estado |
| --- | --- | --- |
| sites/air-fryer | Landing page Air Fryer Todo Dia, imagens, estilos e checkout | Pronto |
| sites/vitrine | Reserva para a futura vitrine Trendou | Ainda sem site |

## Publicação atual — manter funcionando

O projeto Vercel que já usa a raiz do repositório continua usando a pasta de saída public e os mesmos caminhos. O comando node scripts/build.mjs copia a fonte de sites/air-fryer para public/air-fryer durante a publicação. public é somente saída gerada; não edite nem envie cópias dos arquivos ali.

A configuração de compatibilidade está no vercel.json da raiz. Se houver um Build Command substituído manualmente no painel Vercel, use node scripts/build.mjs ou remova a substituição para usar a configuração do arquivo. Não é necessário instalar dependências.

## Novo projeto Vercel independente para Air Fryer

- Repositório: plynexa/Trendou
- Branch: main
- Root Directory: sites/air-fryer
- Framework: Other
- Build Command: vazio
- Output Directory: . (definido no vercel.json da pasta)
- Endereço: nome escolhido no painel, sujeito à disponibilidade

A configuração da pasta mantém os caminhos /air-fryer/ usados pelos recursos da landing. A página abre em / e os recursos continuam funcionando.

## Próximos produtos

Crie sites/nome-do-produto com seus próprios arquivos e configurações. Importe o mesmo repositório em outro projeto Vercel e escolha essa pasta em Root Directory. Não substitua o conteúdo de outro produto.

A pasta sites/vitrine contém apenas um README para que o GitHub preserve a pasta; ainda não deve ser publicada como um site pronto.

## Oferta atual

150 receitas em PDF por R$29,90, com três bônus confirmados: tabela de tempo e temperatura, cardápio de 30 dias com uma sugestão por dia e lista de compras base. Imagens, banner e capa seguem a identidade em preto e dourado. O checkout foi preservado.

O PDF pago não fica no repositório. A entrega do material e os pagamentos dependem do checkout. Não armazene senhas ou chaves privadas no código.

## Verificação

A reorganização preserva os mesmos arquivos da landing, com imagens verificadas por hash. O comando de compatibilidade foi executado e sua saída conferida. A publicação na conta Vercel precisa concluir o novo deploy para refletir esta organização.
