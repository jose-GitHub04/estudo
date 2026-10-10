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

| Parte | Ficheiro |
|---|---|
| Página do tema | `trigonometria/index.html` (o texto «Em resumo» de cada secção está aqui) |
| Triângulo e valores notáveis | `trigonometria/widgets/triangulo.js` |
| Circunferência trigonométrica | `trigonometria/widgets/circulo.js` |
| Radianos, arco e setor | `trigonometria/widgets/radianos.js` |
| Gráficos de sin, cos, tan | `trigonometria/widgets/graficos.js` |
| Flashcards (caixas de Leitner) | `trigonometria/widgets/flashcards.js` + `dados/cartoes.json` |
| Treino rápido | `trigonometria/widgets/treino.js` + `trigonometria/geradores.js` |
| Preencher a circunferência | `trigonometria/widgets/preencher.js` |
| Folha de consulta A4 | `trigonometria/folha.html` |
| Motor partilhado | `assets/motor/` (matemática pura, KaTeX, SVG, progresso) |

## Dados e verificação

- `trigonometria/dados/valores.json` é gerado por `tools/gerar_valores.py`.
- `trigonometria/dados/reducao.json` tem as 17 identidades de redução ao 1.º quadrante.
- `trigonometria/dados/cartoes.json` tem os cartões. Cada cartão pode trazer `verifica`: afirmações em Python (`ig(x, y)` = igual) que o verificador confronta com números aleatórios.

Depois de mexer em qualquer dado:

```
python -X utf8 -I tools/verificar.py
```

Compara cada valor exato e cada identidade com `math.sin/cos/tan`, confere os cartões e garante que não há travessões longos nos ficheiros que o aluno possa ler.

`tests.html` (abrir via servidor local) testa o avaliador de respostas e cada gerador de perguntas do treino.

## Acrescentar

- **Um cartão:** nova entrada em `cartoes.json` (`id` único, `grupo` de `assets/motor/grupos.js`, `frente`, `verso`, opcional `porque` e `verifica`). Fórmulas entre `$...$`.
- **Um tipo de pergunta no treino:** novo item em `TIPOS` de `trigonometria/geradores.js`; acrescentar o teste em `tests.html`.
- **Um tema novo:** pasta ao lado de `trigonometria/` com os mesmos ficheiros (`index.html`, `app.js`, `dados/`, `widgets/`) e uma entrada em `index.html` da raiz. O motor em `assets/` é partilhado.

## Regras de texto

pt-PT, o aluno é tratado por «tu», sem travessões longos (o sinal de menos da matemática é «−», outro carácter), notação `sin`, `cos`, `tan`. Os caminhos são sempre relativos, porque o site vive em `/estudo/`.

KaTeX 0.19.0, licença MIT (`assets/katex/LICENSE`).
