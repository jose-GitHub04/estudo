# Estudo, por Mat100limites

Material de estudo interativo de Matemática A para os alunos de José Pedro Costa. Três temas do 12.º ano:

| Tema | Pasta | |
|---|---|---|
| **Trigonometria** | `trigonometria/` | Tema 3 |
| **Probabilidades** | `probabilidades/` | Tema 5 |
| **Exponenciais e logaritmos** | `logaritmos/` | Tema 8 |

Site estático (HTML, CSS e JavaScript simples, sem build), publicado em GitHub Pages. Sem contas, sem analytics, sem pedidos a terceiros: o KaTeX está copiado em `assets/katex/`. O progresso do aluno fica no `localStorage` do próprio dispositivo.

## Ver no computador

Os módulos ES não funcionam abrindo o ficheiro com duplo clique, é preciso um servidor local:

```
python -m http.server 8000
```

e abrir `http://localhost:8000/`.

## Como está organizado

```
index.html            escolha do tema
assets/               partilhado pelos três temas
  estilo.css          o aspeto de todas as páginas
  katex/              KaTeX 0.19.0
  motor/              o motor em JavaScript (ver mais abaixo)
trigonometria/        um tema: páginas, app.js, dados/, widgets/, geradores.js
probabilidades/       um tema: páginas, app.js, tema.css, dados/, widgets/, tests/
logaritmos/           um tema: páginas, app.js, grupos.js, tema.css, dados/, widgets/, geradores*.js, tests/
tools/                verificadores em Python e tools/vista.html
tests.html            testes da trigonometria (avaliador e geradores do treino)
```

Cada tema tem o seu `app.js` e as suas páginas, todas com o mesmo cabeçalho, menu e rodapé, montados por `assets/motor/estrutura.js`. Cada página declara no `<body>` o item do menu (`data-pagina`) e, quando precisa de dados, os ficheiros a carregar (`data-dados`); o `app.js` do tema carrega só esses e monta cada `<div data-widget="nome">` com `widgets/nome.js`, que exporta `montar(el, dados)`. Se um widget falhar, só essa parte mostra um aviso.

## O que há

### Trigonometria (`trigonometria/`)

| Página | O que tem | Ficheiros |
|---|---|---|
| `index.html` | Início do tema: seis destinos | `estrutura.js` (lista `PAGINAS_TRIGONOMETRIA`) |
| `materia.html` | «Em resumo» de cada módulo, triângulo, circunferência, radianos e gráficos | `widgets/triangulo.js`, `circulo.js`, `radianos.js`, `graficos.js` |
| `cartoes.html` | Cartões com repetição espaçada (caixas de Leitner) e escolha de vários temas | `widgets/flashcards.js` + `dados/cartoes.json` |
| `perguntas.html` | Banco de perguntas de escolha múltipla; ao responder abre uma janela com a resposta e a explicação | `widgets/perguntas.js` + `dados/perguntas/<tema>.json` |
| `treino.html` | Treino rápido com perguntas geradas na hora | `widgets/treino.js` + `geradores.js` |
| `preencher.html` | Escrever sin, cos e tan de ângulos notáveis | `widgets/preencher.js` |
| `folha.html` | Folha de consulta A4 para imprimir | (página independente) |

Dados: `valores.json` (gerado por `tools/gerar_valores.py`), `reducao.json` (as 17 identidades de redução ao 1.º quadrante), `cartoes.json` e um ficheiro de perguntas por tema (ver `perguntas/_exemplo.json`).

### Probabilidades (`probabilidades/`)

| Página | O que tem | Ficheiros |
|---|---|---|
| `index.html` | Início do tema | `estrutura.js` (lista `PAGINAS_PROBABILIDADES`) |
| `materia.html` | Tabela de distribuição, valor médio e desvio-padrão, urna, Normal e soma de dados, com desenhos para mexer | `widgets/tabela.js`, `urna.js`, `normal.js`, `dados.js` |
| `exercicios.html` | Quatro exercícios com resolução passo a passo e desenhos para mexer | `widgets/ex-tabela.js`, `ex-urna.js`, `ex-normal.js` |
| `verdadeiro-falso.html` | Afirmações para decidir se são verdadeiras ou falsas, com explicação | `widgets/vf.js` + `dados/verdadeiro-falso.json` |

Este tema não tem `data-dados`: só o verdadeiro ou falso lê um ficheiro, e fá-lo no próprio widget. A matemática exata (frações, tabelas, urna) está em `assets/motor/probabilidade.js`. Os testes de browser estão em `probabilidades/tests/`.

### Exponenciais e logaritmos (`logaritmos/`)

| Página | O que tem | Ficheiros |
|---|---|---|
| `index.html` | Início do tema: sete destinos | `estrutura.js` (lista `PAGINAS_LOGARITMOS`) |
| `materia.html` | Oito módulos para mexer: exponencial, o logaritmo como expoente, inversa, propriedades, equações e inequações, derivadas, limites e estudo de uma função | `widgets/exponencial.js`, `logaritmo.js`, `inversa.js`, `propriedades.js`, `equacoes.js`, `derivadas.js`, `limites.js`, `estudo.js` |
| `cartoes.html` | Cartões com repetição espaçada, por tema | `widgets/flashcards.js` + `dados/cartoes/<grupo>.json` |
| `perguntas.html` | Perguntas de escolha múltipla com janela de explicação | `widgets/perguntas.js` + `dados/perguntas/<grupo>.json` |
| `treino.html` | Treino com perguntas geradas na hora, com a correção explicada | `widgets/treino.js` + `geradores.js` + `geradores-analise.js` |
| `exercicios.html` | Exercícios para tentar primeiro e conferir depois, passo a passo, com gráficos | `widgets/exercicios.js` + `dados/exercicios.json` (e `estudos.json`) |
| `verdadeiro-falso.html` | Afirmações verdadeiras ou falsas, com explicação, erro comum e, às vezes, um gráfico | `widgets/vf.js` + `dados/vf/<grupo>.json` |
| `folha.html` | Folha de consulta A4 (duas páginas) para imprimir, com dois gráficos em SVG | (página independente) |

- `grupos.js` lista os oito grupos (exponencial, logaritmo, propriedades, funcao, equacoes, derivadas, limites, estudo) com o prefixo dos ids. Cada grupo tem um ficheiro de cartões, um de perguntas e um de verdadeiro ou falso.
- `dados/equacoes.json` tem as equações e inequações predefinidas do módulo das equações (enunciado, soluções, passos e gráficos); `dados/estudos.json` tem as quatro funções do módulo do estudo.
- `tema.css` define as cores do tema (`--c-exp`, `--c-log`, `--c-id`, `--c-tg`, `--c-der`, `--c-assint`, `--c-zona`). Cada widget tem o seu `.css`, com um prefixo de classes só seu.
- `widgets/colocacao.js` e `rotulos.js` são ajudas dos widgets (pôr as etiquetas de um gráfico onde não tapam nada); `assets/motor/intervalos.js` escreve os intervalos à portuguesa dentro do KaTeX e o `katex.js` aplica-o sozinho em todo o site.
- `tests/` tem uma página de teste por widget, pelos geradores, pelo avaliador e pelo módulo de gráficos, mais `pratica.html`, que carrega as páginas reais num ecrã de 390 px.

## O motor partilhado (`assets/motor/`)

| Ficheiro | Para quê |
|---|---|
| `estrutura.js` | Cabeçalho, menu, rodapé e destinos de cada tema (`TEMAS`, uma lista de páginas por tema) |
| `matematica.js` | Matemática pura, sem DOM: frações de π, avaliador de respostas, correção, gerador de números aleatórios com semente |
| `grafico.js` | Gráficos cartesianos em SVG: curvas, retas, assíntotas, pontos (arrastáveis com rato, toque e setas), áreas e rótulos |
| `probabilidade.js` | Frações exatas, tabelas de distribuição, valor médio, variância e a urna |
| `progresso.js` | A única porta para o `localStorage` (`ler`, `guardar`), com `try/catch`: tudo funciona sem storage |
| `svg.js`, `katex.js`, `grupos.js` | Ajudas para SVG, ligação ao KaTeX e os grupos da trigonometria |

**O avaliador** (`avaliar(texto, vars)` e `corrigir(resposta, esperado)` em `matematica.js`) lê a resposta escrita do aluno sem usar `eval`. Aceita `+ - * / ^`, parênteses, `pi` e `e` (uma variável com o mesmo nome tem prioridade), multiplicação implícita (`2ln3`) e as funções `sqrt`/`√`/`raiz`, `ln`, `log` (base 10), `exp`, `abs` e `logb(base, x)`, além de `log_2(5)`, `log2 5`, `log₂ 5` e `ln 2`. Fora do domínio (`ln(0)`) dá `{ ok: false }`.

**`criarFuncao(expr, 'x', params)`** lê a expressão uma vez (e só aí pode lançar erro, se for ilegível) e devolve `x => número`, com `NaN` fora do domínio. É o que os gráficos, os exercícios, os estudos e as figuras dos V/F usam.

**`grafico.js`**: `criarGrafico({ x, y, ... })` devolve um objeto `g` com `g.svg` (já com a classe `figura`), `g.curva(fn, opcoes)`, `g.retaVertical`, `g.retaHorizontal`, `g.reta`, `g.segmento`, `g.ponto` (com `arrastavel`), `g.rotulo`, `g.area` e `g.definirJanela`, mais `arrastarNaCurva(g, fn, opcoes)`. A curva aceita uma expressão em texto ou uma função, parte o traço nas assíntotas e corta na janela. O cabeçalho do ficheiro tem a documentação completa.

## Dados e verificação

Em JSON, cada barra do LaTeX vai dobrada (`"$\\log_2 8=3$"`). Fórmulas entre `$...$` (em linha) ou `$$...$$`. Cada cartão, pergunta ou afirmação pode trazer o que o verificador confronta com números aleatórios:

- **Cartões e V/F:** `verifica`, uma lista de afirmações em Python (por exemplo `"ig(logb(a, x*y), logb(a, x)+logb(a, y))"`).
- **Perguntas:** `ref` (cálculo independente da resposta certa) e um `valor` em cada opção numérica, ou então `verifica`. O verificador recusa opções como «nenhuma das anteriores», porque as opções são baralhadas no ecrã.
- **V/F com gráfico:** `figura` (curvas, retas, pontos), que o verificador confere com o enunciado.

Depois de mexer em qualquer dado:

```
python -X utf8 -I tools/verificar.py
```

Tem de acabar em «Tudo certo.». O que cada verificador confere:

| Script | O que confere |
|---|---|
| `tools/verificar.py` | Trigonometria: cada valor exato e cada identidade de redução contra `math.sin/cos/tan`, os cartões e as perguntas. Probabilidades: urna, jogo, exercícios e verdadeiro ou falso recalculados com frações exatas. Corre também `verificar_log.py` e, no fim, garante que nenhum ficheiro do site tem travessões |
| `tools/verificar_log.py` | Logaritmos, em `logaritmos/dados/`: estrutura, ids, `$` emparelhados, texto sem pt-BR, `ref`/`valor`/`verifica` de cartões, perguntas e V/F (cada afirmação em 40 amostras aleatórias), curvas e pontos das figuras, e os exercícios (cada linha de LaTeX dos passos que se consegue ler, os decimais e as figuras). Mostra `FALHA` (faz falhar) e `AVISO` (contagens por grupo, falta de `erroComum`...). Chama os dois seguintes |
| `tools/verificar_equacoes.py` | `equacoes.json`: soluções por varrimento e bisseção, domínio, soluções rejeitadas, parâmetros dos sliders, todas as linhas de LaTeX dos passos e as curvas dos gráficos |
| `tools/verificar_estudos.py` | `estudos.json`: derivadas por diferenças finitas, tabelas de variação, extremos, inflexões, assíntotas, limites e contradomínio de cada função |
| `tools/verificar_prob.py` | Probabilidades, de forma mais completa (com `--navegador` corre também as páginas de `probabilidades/tests/` no Edge sem janela) |
| `tools/gerar_valores.py` | Gera `trigonometria/dados/valores.json` (correr o `verificar.py` a seguir) |

`tools/verificar_log.py f1.json f2.json` confere só esses ficheiros, o que é útil a meio do trabalho.

## Testar

- **`tests.html`** (abrir por um servidor local) testa o avaliador e os geradores do treino da trigonometria.
- **`logaritmos/tests/` e `probabilidades/tests/`** têm uma página por parte. Cada uma escreve o resultado em `<pre id="resultado">` e `data-testes="ok"` ou `"falhou"` no elemento `<html>`.
- **Sem abrir o browser**, com o servidor a correr numa porta só tua:

  ```
  msedge --headless=new --disable-gpu --user-data-dir=<pasta nova> --virtual-time-budget=60000 --dump-dom http://127.0.0.1:8000/logaritmos/tests/motor.html
  ```

  e procurar `data-testes="ok"` no que sai. Usa uma pasta de perfil nova (`--user-data-dir`) de cada vez: o Edge guarda páginas em cache e alguns testes apagam o progresso guardado nesse browser.
- **`tools/vista.html`** mostra uma página numa largura exata, porque o Edge sem janela não desce de uns 500 px. Para ver uma secção a 390 px: `/tools/vista.html?u=/logaritmos/materia.html&s=<id-da-secção>&w=390&h=900`, tirando o screenshot com `--screenshot=<ficheiro.png> --window-size=390,900`. Para ver uma janela (`<dialog>`) acrescenta `&ih=900`.
- **Folhas A4:** `msedge --headless=new --disable-gpu --user-data-dir=<pasta nova> --print-to-pdf=<ficheiro.pdf> --no-pdf-header-footer http://127.0.0.1:8000/logaritmos/folha.html` e contar as páginas do PDF (a dos logaritmos tem de ficar em duas).

## Acrescentar

- **Um cartão (logaritmos):** nova entrada em `logaritmos/dados/cartoes/<grupo>.json`, com `id` que começa pelo prefixo do grupo (`exp-contradominio`), `frente`, `verso` e, se quiseres, `porque` e `verifica`. Um cartão faz uma só pergunta de memória.
- **Um cartão (trigonometria):** nova entrada em `trigonometria/dados/cartoes.json` (`id` único, `grupo` de `assets/motor/grupos.js`).
- **Uma pergunta do banco:** nova entrada no ficheiro do grupo em `dados/perguntas/` (id com o prefixo, por exemplo `val-15` ou `log-07`): 4 opções, `certa` entre 0 e 3, explicação, e `ref` com `valor` nas opções ou `verifica`. Os distratores devem ser erros reais de alunos. Correr `tools/verificar.py`.
- **Uma afirmação de verdadeiro ou falso:** nova entrada em `logaritmos/dados/vf/<grupo>.json` (ou em `probabilidades/dados/verdadeiro-falso.json`), com `texto`, `verdadeira`, `explicacao` (com um contraexemplo, se for falsa), `erroComum` (só nas falsas) e `verifica`.
- **Um grupo novo de cartões, perguntas e V/F:** acrescentar a `GRUPOS` em `logaritmos/grupos.js` (ou em `assets/motor/grupos.js` na trigonometria), criar os três ficheiros JSON e o prefixo em `tools/verificar_log.py`.
- **Um exercício:** nova entrada em `logaritmos/dados/exercicios.json` (`id`, `titulo`, `tema`, `nivel`, `enunciado`, `passos` ou `alineas`, `resposta`, e `verifica`); cada passo diz o que se faz e porquê. As figuras usam o esquema `figura` de `grafico.js`.
- **Um tipo de pergunta no treino:** escrever o gerador (uma função que recebe `rng`, devolve a pergunta e traz os dados para o teste recalcular) e acrescentar um item a `TIPOS` (`{ id, nome, tema, gerar }`) em `trigonometria/geradores.js`, `logaritmos/geradores.js` ou, para limites, derivadas e monotonia, `logaritmos/geradores-analise.js`. Acrescentar o teste em `tests.html` ou em `logaritmos/tests/geradores.html` (`geradores-analise.html`), que resolve de novo a resposta sem passar pelo gerador.
- **Um módulo (widget) novo:** `<tema>/widgets/<nome>.js` com `export async function montar(el, dados)`, o seu `.css` com um prefixo de classes único, um `<div data-widget="<nome>">` na página e o `<link>` do `.css`. O cabeçalho do `.js` diz o que faz, o contrato e o estado que guarda.
- **Uma página nova:** criar o `.html` copiando uma existente do mesmo tema e acrescentá-la à lista desse tema em `assets/motor/estrutura.js`.
- **Um tema novo:** pasta ao lado das outras com `index.html`, as páginas, `app.js` (a chamar `montarEstrutura(document.body.dataset.pagina, '<id-do-tema>')`), `dados/` e `widgets/`; uma entrada em `TEMAS` em `assets/motor/estrutura.js` com a lista de páginas; um cartão em `index.html` da raiz; e, se tiver dados, um `tools/verificar_<tema>.py` (o `verificar.py` pode chamá-lo, como faz com o `verificar_log.py`). O motor em `assets/` é partilhado: não se muda por causa de um só tema.
- **O progresso:** só através de `assets/motor/progresso.js` (`ler`, `guardar`). O armazenamento é partilhado por todos os temas, por isso as secções dos logaritmos começam por `log-` (`log-flashcards`, `log-vf`...); um tema novo escolhe o seu prefixo.

## Regras de texto

- pt-PT, o aluno é tratado por «tu», frases curtas. Nada de pt-BR.
- Sem travessões, nem o longo (U+2014, o `verificar.py` falha) nem o curto (U+2013), em nenhum ficheiro do site; usa vírgula, dois pontos ou reescreve a frase. O sinal de menos da matemática é outro carácter: em LaTeX o `-`, em texto o «−».
- Vírgula decimal: «0,5» em texto e `0{,}5` em LaTeX. Intervalos à portuguesa: `]a,b[`, `]-\infty,2]` (dentro do KaTeX, `\mathopen{]}` para o espaçamento ficar certo). Multiplicação com `\times`.
- Notação: `sin`, `cos`, `tan` na trigonometria; `\ln` (base `e`), `\log` (base 10) e `\log_a x` nos logaritmos; `f'(x)` para a derivada.
- O repositório é público: nada de nomes nem dados de alunos, e todo o texto, número, figura e exercício é escrito de raiz para este site.
- Os caminhos são sempre relativos, porque o site vive em `/estudo/`. Nada de CDN, fontes ou scripts de terceiros.
- Toda a afirmação matemática, número e resolução é conferida por código antes de entrar. Um erro de matemática é pior do que uma página a menos.

KaTeX 0.19.0, licença MIT (`assets/katex/LICENSE`).
