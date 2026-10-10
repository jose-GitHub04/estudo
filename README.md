# Estudo, por Mat100limites

Material de estudo interativo de Matemática A para os alunos de José Pedro Costa. Primeiro tema: **Trigonometria** (12.º ano, Tema 3).

Site estático (HTML, CSS e JavaScript simples, sem build), publicado em GitHub Pages. Sem contas, sem analytics, sem pedidos a terceiros: o KaTeX está copiado em `assets/katex/`. O progresso do aluno fica no `localStorage` do próprio dispositivo.

## Ver no computador

Os módulos ES não funcionam abrindo o ficheiro com duplo clique, é preciso um servidor local:

```
python -m http.server 8000
```

e abrir `http://localhost:8000/`.

## O que há

Cada parte do tema tem a sua página (`trigonometria/`), com o mesmo cabeçalho e menu, montados por `assets/motor/estrutura.js`:

| Página | O que tem | Ficheiros |
|---|---|---|
| `index.html` | Início do tema: seis destinos | `estrutura.js` (lista `PAGINAS`) |
| `materia.html` | «Em resumo» de cada módulo, triângulo, circunferência, radianos e gráficos | `widgets/triangulo.js`, `circulo.js`, `radianos.js`, `graficos.js` |
| `cartoes.html` | Cartões com repetição espaçada (caixas de Leitner) e escolha de vários temas | `widgets/flashcards.js` + `dados/cartoes.json` |
| `perguntas.html` | Banco de perguntas de escolha múltipla; ao responder abre uma janela com a resposta e a explicação | `widgets/perguntas.js` + `dados/perguntas/<tema>.json` |
| `treino.html` | Treino rápido com perguntas geradas na hora | `widgets/treino.js` + `geradores.js` |
| `preencher.html` | Escrever sin, cos e tan de ângulos notáveis | `widgets/preencher.js` |
| `folha.html` | Folha de consulta A4 para imprimir | (página independente) |

Cada página declara no `<body>` o item do menu (`data-pagina`) e os ficheiros de dados de que precisa (`data-dados`); `trigonometria/app.js` carrega só esses e monta os widgets. O motor partilhado está em `assets/motor/` (matemática pura, KaTeX, SVG, progresso, estrutura).

## Dados e verificação

- `trigonometria/dados/valores.json` é gerado por `tools/gerar_valores.py`.
- `trigonometria/dados/reducao.json` tem as 17 identidades de redução ao 1.º quadrante.
- `trigonometria/dados/cartoes.json` tem os cartões. Cada cartão pode trazer `verifica`: afirmações em Python (`ig(x, y)` = igual) que o verificador confronta com números aleatórios.
- `trigonometria/dados/perguntas/<tema>.json` tem o banco de perguntas, um ficheiro por tema (ver `_exemplo.json`). Cada pergunta tem 4 opções e uma certa. Para a verificação numérica, a pergunta traz `ref` (cálculo independente da resposta) e cada opção um `valor`, ou então `verifica`. O verificador exige que pelo menos 55% das perguntas tenham uma das duas e recusa opções como «nenhuma das anteriores», porque as opções são baralhadas no ecrã.

Depois de mexer em qualquer dado:

```
python -X utf8 -I tools/verificar.py
```

Compara cada valor exato e cada identidade com `math.sin/cos/tan`, confere os cartões e garante que não há travessões longos nos ficheiros que o aluno possa ler.

`tests.html` (abrir via servidor local) testa o avaliador de respostas e cada gerador de perguntas do treino.

## Acrescentar

- **Um cartão:** nova entrada em `cartoes.json` (`id` único, `grupo` de `assets/motor/grupos.js`, `frente`, `verso`, opcional `porque` e `verifica`). Fórmulas entre `$...$`.
- **Uma pergunta do banco:** nova entrada no ficheiro do tema em `dados/perguntas/` (id com o prefixo do tema, por exemplo `val-15`), e correr `tools/verificar.py`.
- **Uma página nova:** criar o `.html` copiando uma existente, e acrescentá-la a `PAGINAS` em `assets/motor/estrutura.js`.
- **Um tipo de pergunta no treino:** novo item em `TIPOS` de `trigonometria/geradores.js`; acrescentar o teste em `tests.html`.
- **Um tema novo:** pasta ao lado de `trigonometria/` com os mesmos ficheiros (`index.html`, `app.js`, `dados/`, `widgets/`) e uma entrada em `index.html` da raiz. O motor em `assets/` é partilhado.

## Regras de texto

pt-PT, o aluno é tratado por «tu», sem travessões longos (o sinal de menos da matemática é «−», outro carácter), notação `sin`, `cos`, `tan`. Os caminhos são sempre relativos, porque o site vive em `/estudo/`.

KaTeX 0.19.0, licença MIT (`assets/katex/LICENSE`).
