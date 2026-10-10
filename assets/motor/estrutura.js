// Cabeçalho, menu e rodapé partilhados pelas páginas do tema, e a lista de destinos
// da página inicial. Cada página tem <header id="barra"> e <footer id="rodape"> vazios
// e <body data-pagina="...">; isto preenche-os. Uma só fonte para o menu: para
// acrescentar uma página, acrescenta-a aqui e cria o .html.

export const PAGINAS = [
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

const escapar = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function montarBarra(el, atual) {
  const links = PAGINAS.map((p) => {
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
          <span class="marca__papel">Trigonometria</span>
        </span>
      </a>
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

function montarDestinos(el) {
  el.className = 'destinos';
  el.innerHTML = PAGINAS.map((p, i) => `
    <a class="destino" href="${p.href}">
      <span class="destino__numero" aria-hidden="true">${i + 1}</span>
      <span class="destino__texto">
        <span class="destino__titulo">${escapar(p.rotulo)}</span>
        <span class="destino__resumo">${escapar(p.resumo)}</span>
      </span>
    </a>`).join('');
}

/** Preenche barra, rodapé e (na página inicial) a grelha de destinos. */
export function montarEstrutura(atual) {
  const barra = document.getElementById('barra');
  if (barra) montarBarra(barra, atual);
  const rodape = document.getElementById('rodape');
  if (rodape) montarRodape(rodape);
  const destinos = document.getElementById('destinos');
  if (destinos) montarDestinos(destinos);
}
