// Cabeçalho, menu e rodapé partilhados pelas páginas de cada tema, e a lista de destinos
// da página inicial do tema. Cada página tem <header id="barra"> e <footer id="rodape"> vazios
// e <body data-pagina="..." data-tema="...">; isto preenche-os (sem data-tema, vale a
// trigonometria). Uma só fonte para o menu: para acrescentar uma página, acrescenta-a
// à lista do tema e cria o .html.

const PAGINAS_TRIGONOMETRIA = [
  { id: 'materia', href: 'materia.html', rotulo: 'Matéria',
    resumo: 'Lê o essencial e experimenta: triângulo, circunferência trigonométrica, radianos e gráficos.' },
  { id: 'cartoes', href: 'cartoes.html', rotulo: 'Cartões',
    resumo: 'Memoriza fórmulas e valores com repetição espaçada. Escolhes os temas que quiseres.' },
  { id: 'perguntas', href: 'perguntas.html', rotulo: 'Perguntas',
    resumo: 'Banco de perguntas de escolha múltipla. Respondes e vês logo a resposta e a explicação.' },
  { id: 'treino', href: 'treino.html', rotulo: 'Treino',
    resumo: 'Dez perguntas geradas na hora, com a correção explicada passo a passo.' },
  { id: 'preencher', href: 'preencher.html', rotulo: 'Preencher',
    resumo: 'Aparece um ângulo e escreves o seno, o cosseno e a tangente.' },
  { id: 'folha', href: 'folha.html', rotulo: 'Folha',
    resumo: 'Todas as fórmulas e valores numa folha A4, pronta a imprimir.' },
];

const PAGINAS_PROBABILIDADES = [
  { id: 'materia', href: 'materia.html', rotulo: 'Matéria',
    resumo: 'Tabela de distribuição, valor médio, desvio-padrão, urna e curva Normal, com desenhos para mexer.' },
  { id: 'exercicios', href: 'exercicios.html', rotulo: 'Exercícios',
    resumo: 'Quatro exercícios com resolução passo a passo e desenhos para mexer.' },
  { id: 'vf', href: 'verdadeiro-falso.html', rotulo: 'Verdadeiro ou falso',
    resumo: 'Afirmações para decidires se são verdadeiras ou falsas, com a explicação de cada uma.' },
];

const PAGINAS_LOGARITMOS = [
  { id: 'materia', href: 'materia.html', rotulo: 'Matéria',
    resumo: 'Da exponencial ao logaritmo: propriedades, equações, derivadas e limites, com desenhos para mexer.' },
  { id: 'cartoes', href: 'cartoes.html', rotulo: 'Cartões',
    resumo: 'Memoriza definições, regras e derivadas com repetição espaçada. Escolhes os temas que quiseres.' },
  { id: 'perguntas', href: 'perguntas.html', rotulo: 'Perguntas',
    resumo: 'Banco de perguntas de escolha múltipla. Respondes e vês logo a resposta e a explicação.' },
  { id: 'treino', href: 'treino.html', rotulo: 'Treino',
    resumo: 'Perguntas geradas na hora, com a correção explicada passo a passo.' },
  { id: 'exercicios', href: 'exercicios.html', rotulo: 'Exercícios',
    resumo: 'Tenta cada exercício primeiro e confere depois com a resolução passo a passo.' },
  { id: 'vf', href: 'verdadeiro-falso.html', rotulo: 'Verdadeiro ou falso',
    resumo: 'Afirmações para decidires se são verdadeiras ou falsas, com a explicação de cada uma.' },
  { id: 'folha', href: 'folha.html', rotulo: 'Folha',
    resumo: 'Todas as fórmulas e propriedades numa folha A4, pronta a imprimir.' },
];

export const TEMAS = {
  trigonometria: { rotulo: 'Trigonometria', paginas: PAGINAS_TRIGONOMETRIA },
  probabilidades: { rotulo: 'Probabilidades', paginas: PAGINAS_PROBABILIDADES },
  logaritmos: { rotulo: 'Exponenciais e logaritmos', paginas: PAGINAS_LOGARITMOS },
};

export const PAGINAS = PAGINAS_TRIGONOMETRIA;

const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function montarBarra(el, atual, tema) {
  const links = tema.paginas.map((p) => {
    const corrente = p.id === atual ? ' aria-current="page"' : '';
    return `<a href="${p.href}"${corrente}>${escapar(p.rotulo)}</a>`;
  }).join('');
  el.className = 'barra';
  el.innerHTML = `
    <div class="barra__interior">
      <a class="marca" href="index.html"${atual === 'inicio' ? ' aria-current="page"' : ''}>
        <img class="marca__logo" src="../assets/mat100_logo.png" alt="" width="44" height="38">
        <span>
          <span class="marca__nome">Mat100limites</span>
          <span class="marca__papel">${escapar(tema.rotulo)}</span>
        </span>
      </a>
      <a class="barra__temas" href="../">← Todos os temas</a>
      <nav class="menu" aria-label="Secções">${links}</nav>
    </div>`;
}

function montarRodape(el) {
  el.className = 'rodape';
  el.innerHTML = `
    <div class="envolve">
      <p class="rodape__nome">Mat100limites</p>
      <p>Um projeto de José Pedro Costa.</p>
      <p><a href="../">Todos os temas</a></p>
      <p class="rodape__fino">Sem contas e sem rastreio. O teu progresso fica guardado só neste dispositivo.</p>
    </div>`;
}

function montarDestinos(el, tema) {
  el.className = 'destinos';
  el.innerHTML = tema.paginas.map((p, i) => `
    <a class="destino" href="${p.href}">
      <span class="destino__numero" aria-hidden="true">${i + 1}</span>
      <span class="destino__texto">
        <span class="destino__titulo">${escapar(p.rotulo)}</span>
        <span class="destino__resumo">${escapar(p.resumo)}</span>
      </span>
    </a>`).join('');
}

/** Preenche barra, rodapé e (na página inicial) a grelha de destinos. */
export function montarEstrutura(atual, idTema = 'trigonometria') {
  const tema = TEMAS[idTema] || TEMAS.trigonometria;
  const barra = document.getElementById('barra');
  if (barra) montarBarra(barra, atual, tema);
  const rodape = document.getElementById('rodape');
  if (rodape) montarRodape(rodape);
  const destinos = document.getElementById('destinos');
  if (destinos) montarDestinos(destinos, tema);
}
