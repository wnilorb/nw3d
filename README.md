# NicWill Lab 3D — catálogo online

Catálogo responsivo de produtos de impressão 3D com busca, categorias, sacola e pedidos pelo WhatsApp. Este repositório contém o site público em `docs/`; o painel administrativo permanece no computador do proprietário e não faz parte do repositório público.

## Hospedagem indicada

Para este projeto, GitHub Pages é uma boa opção de hospedagem estática quando o catálogo e os testes locais estiverem prontos. Google Sites facilita páginas institucionais, mas limita a personalização e a integração do painel. A hospedagem não fornece banco de dados: gestão sincronizada e privada entre dispositivos exigirá backend autenticado.

### Identidade visual

O cabeçalho usa `docs/assets/logo.jpg` (~67 KB) e o ícone `docs/assets/favicon.png` (~3 KB). A identidade usa fundo azul-marinho quase preto, azul/ciano elétrico, laranja vivo e branco metálico, combinando com o brilho 3D do logo.

## Começar agora

1. Edite `docs/js/config.js` e confirme o nome e o WhatsApp do ateliê. O telefone deve estar no formato internacional, somente números — por exemplo, `55` + DDD + número.
2. No computador do proprietário, dê dois cliques em `abrir-admin.bat`: o atalho inicia o servidor local com SQLite e abre o painel em `http://127.0.0.1:8000/admin.html`. O catálogo local fica em `http://127.0.0.1:8000/docs/`. Não abra o HTML do admin diretamente como arquivo; ele precisa do servidor local para buscar JSON e gravar no banco.
3. Revise conteúdo, estoque, aparência e fluxos no navegador antes de publicar.
4. Quando a versão estiver aprovada, envie os arquivos públicos ao repositório GitHub correto, **sem `admin.html` nem `js/admin.js`**, e em **Settings → Pages** selecione **Deploy from a branch**, branch `main` e pasta `/docs`.

Não é necessário publicar enquanto o catálogo ainda estiver em construção. Use sempre o mesmo endereço local (`127.0.0.1`): `localhost`, `127.0.0.1` e o domínio publicado têm armazenamentos de navegador separados.

## Gerenciar produtos

Abra `http://127.0.0.1:8000/admin.html` no seu computador. Essa página e `js/admin.js` ficam somente no PC, são excluídos pelo `.gitignore` e **não devem ser enviados ao GitHub**. GitHub Pages publica apenas `docs/`, portanto compradores não terão a rota do admin. É possível adicionar, editar e ocultar produtos, incluir até seis fotos por produto e adicionar um link opcional de vídeo no YouTube, exibido dentro da ficha do produto. A categoria é escolhida em uma lista; use **＋ Categoria** para cadastrar uma nova sem criar variações por caixa, espaço ou acento. Preços e valores usam reais brasileiros (`R$`, vírgula decimal). As fotos selecionadas são reduzidas antes da publicação. Um produto com livro de estoque/histórico não pode ser excluído; oculte-o para preservar os movimentos.

Nas fichas, dimensões, material, cores disponíveis e cuidados são opcionais; quando preenchidos, aparecem no card/modal do cliente. Informe somente especificações confirmadas para cada peça. Links válidos do YouTube são reproduzidos dentro do modal, sem tirar o cliente do catálogo.

Se estiver migrando um repositório antigo, confirme que `admin.html` e `js/admin.js` não estejam versionados nele: `.gitignore` não remove arquivos já rastreados.

Nos campos monetários, informe o valor em reais com vírgula decimal, por exemplo `1.234,56`; o painel mostra o prefixo `R$` e mantém o valor numérico em centavos para vendas e repasses.

O painel também permite cadastrar categorias no botão ao lado do seletor; nomes equivalentes por acento, caixa ou espaços são tratados como a mesma categoria. A lista é salva localmente e publicada em `docs/data/categories.json`. A loja usa essa lista para ordenar filtros, mas esconde categorias sem produtos ativos. Parceiros são cadastrados uma vez e depois escolhidos no menu de consignação. Para publicação manual, baixe `products.json` e `categories.json` separadamente.

Ao movimentar consignações, escolha o parceiro no menu. Use **＋ Parceiro** para cadastrar um nome uma única vez; é possível renomear o cadastro e remover parceiros sem movimentos. Parceiros com histórico não podem ser removidos, para preservar os registros.

Ao abrir, o painel busca o catálogo publicado no GitHub e restaura o rascunho local. Produtos, categorias, estoque, parceiros e preferências do painel também são gravados no arquivo SQLite `nicwill-admin.sqlite3`, na raiz da pasta do projeto. O banco é local, fica fora do repositório e restaura os dados mesmo que o armazenamento do navegador seja limpo. Mantenha uma cópia de segurança do arquivo e use também **Backup do estoque**.

### Estoque, produção e vendas

1. No **Lançamento rápido**, registre o saldo inicial real de cada produto uma única vez.
2. Registre a produção concluída para somar unidades e a venda direta/atacado pago para baixar estoque e salvar o preço efetivamente praticado. No diálogo de estoque do produto, também é possível escolher o canal varejo/atacado.
3. O catálogo apenas abre o WhatsApp e não detecta compras automaticamente; registre a venda quando confirmá-la no atendimento.
4. Use **Ajuste de contagem** no estoque do produto para corrigir diferença. O painel impede movimentos que deixariam o saldo negativo.

O resumo separa unidades produzidas/vendidas hoje, valor bruto das vendas do dia e do mês, potencial do estoque central ao preço varejo, unidades consignadas e repasses pendentes. O potencial do estoque não é faturamento realizado nem lucro; para calcular lucro seriam necessários custos por produto. O checkout mostra os itens e miniaturas antes de preparar a mensagem do WhatsApp.

Para consignação, registre o envio ao parceiro com o preço atacado acordado. Isso reduz o estoque do ateliê e aumenta o saldo consignado, sem contar como venda ainda. Quando o parceiro informar vendas, registre as unidades: o painel calcula o repasse pelo preço dos lotes enviados (FIFO) e exibe o pendente. Registre o valor recebido para abatê-lo. Se o parceiro comprar e pagar no ato, use **Venda atacado paga na entrega**; não precisa abrir um controle consignado.

O cliente vê apenas **Pronta entrega**, **Sob encomenda** com a estimativa de produção em dias úteis, ou **Consulte a disponibilidade**. A entrega/retirada e a confirmação final continuam combinadas no WhatsApp.

Depois de entrar em operação, registre cada movimento no painel e publique o catálogo para atualizar o status que os visitantes veem. A prévia local atualiza no mesmo navegador imediatamente; clientes em outros dispositivos só recebem o novo status após publicar.

O histórico de estoque, nomes de parceiros, vendas e repasses fica no SQLite local e não é enviado ao catálogo público. O JSON publicado contém somente o estado de disponibilidade e o prazo estimado de produção. Guarde cópias do `nicwill-admin.sqlite3` fora do repositório público; para uma cópia consistente, feche o painel antes de copiar o arquivo. Use também **Backup do estoque** regularmente. Não há sincronização automática desse histórico entre computadores.

### Publicar direto no GitHub

1. No GitHub, abra **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
2. Limite o acesso somente ao repositório do catálogo e conceda apenas **Contents: Read and write**.
3. No painel aberto localmente, confirme `usuario/repositorio` e branch (`main`, salvo se seu repositório usar outra), cole o token no campo protegido e clique em **Publicar catálogo agora**.
4. O painel envia novas fotos com nomes únicos por conteúdo, depois atualiza `docs/data/categories.json` e salva `docs/data/products.json` por último. Se uma etapa falhar, o catálogo/produtos locais não ficam parcialmente substituídos; uploads de foto já concluídos podem sobrar sem referência e não alteram a página atual.

O token não é salvo em `localStorage`, no JSON nem nos arquivos do projeto; o campo é apagado após a tentativa. Use o menor escopo, não compartilhe o token e revogue-o no GitHub quando não for mais necessário. Os botões **Baixar catálogo** e **Baixar categorias** continuam disponíveis como alternativa manual; coloque cada arquivo em `docs/data/`.

As alterações não ficam visíveis aos clientes até serem publicadas. O painel não é servido pelo GitHub Pages. Se o repositório GitHub for público, os arquivos-fonte na raiz ainda podem ser vistos no próprio GitHub; não há senha/admin online nesta arquitetura.

### Recuperar um rascunho criado no painel antigo

O rascunho antigo só existe no armazenamento do navegador e endereço onde foi criado. Antes de mudar a configuração do GitHub Pages para `/docs`, recupere/exporte qualquer rascunho criado no antigo `admin.html` publicado; depois da mudança, esse endereço deixa de ser servido pelo Pages. Não limpe os dados do navegador antes de recuperar o rascunho.

### Quem pode editar

O GitHub Pages não tem banco de dados nem autenticação própria. O painel roda localmente no computador do proprietário; a publicação direta usa um token restrito ao repositório, digitado apenas no painel local. Essa separação impede que compradores abram a página administrativa pelo site. Se o repositório for público, os arquivos de código na raiz continuam visíveis no GitHub.

Limpar os dados do navegador pode apagar o livro local; mantenha cópias de backup.

## Pedidos

 O cliente adiciona um ou mais itens, confere o resumo com miniaturas, informa nome, WhatsApp, cidade e observações, e envia a mensagem pré-preenchida pelo WhatsApp. Preço exibido é subtotal estimado; disponibilidade, personalização, entrega e pagamento são confirmados diretamente no atendimento. Não há pagamento ou checkout financeiro no site.

## Arquivos principais

- `docs/index.html` — catálogo público (fonte do GitHub Pages).
- Painel administrativo — mantido localmente pelo proprietário; não está neste repositório.
- `docs/data/products.json` — catálogo publicado (fonte de verdade do site).
- `docs/data/categories.json` — lista controlada de categorias usada pelo admin.
- `docs/assets/products/` — fotos dos produtos publicadas pelo painel local.
- `docs/assets/logo.jpg` / `docs/assets/favicon.png` — logo otimizada e ícone leve do site.
- `docs/js/inventory.js` e `docs/css/inventory.css` — regras de disponibilidade e apresentação.
- `.gitignore` — ignora arquivos locais de backup e artefatos do sistema.
- `docs/js/config.js` — nome e WhatsApp do ateliê.
- `docs/css/` e `docs/assets/` — identidade visual e ilustrações públicas.

O catálogo vem com produtos e imagens ilustrativas de exemplo. Substitua nomes, valores, fotos, descrições e categorias antes de divulgar.
