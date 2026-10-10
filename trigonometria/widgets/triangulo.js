// triangulo: razões trigonométricas num triângulo retângulo ABC (ângulo reto em B,
// α em A, β em C) e tabela dos valores notáveis para descobrir clicando.

import * as M from '../../assets/motor/matematica.js';
import { criar, arrastar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const VB_W = 410;
const VB_H = 336;
const A = { x: 80, y: 272 };
const L = 236; // comprimento da hipotenusa no desenho, em px
const HIP = 10; // comprimento da hipotenusa, em unidades (fixo)
const ALFA_MIN = 5;
const ALFA_MAX = 85;
const NOTAVEIS = [30, 45, 60];
const FUNCOES = ['sin', 'cos', 'tan'];
const NOME_PAPEL = { oposto: 'cateto oposto', adjacente: 'cateto adjacente', hipotenusa: 'hipotenusa' };

const rad = (g) => (g * Math.PI) / 180;
const limitar = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const graus = (v, casas = 1) => `${M.fmt(v, casas)}°`;
const decTex = (v) => M.fmt(v, 3).replace(',', '{,}');

function h(tag, props = {}, ...filhos) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') n.className = v;
    else if (v === true) n.setAttribute(k, '');
    else n.setAttribute(k, v);
  }
  n.append(...filhos);
  return n;
}

/** «raiz de 3 sobre 2», para leitores de ecrã. */
function falado(expr) {
  return expr.replace(/sqrt\((\d+)\)/g, 'raiz de $1').replace('/', ' sobre ');
}

let contador = 0;

export async function montar(el, dados) {
  const id = `tri${++contador}`;
  let alfa = 35;
  let ref = 'alfa'; // ângulo de referência: 'alfa' (em A) ou 'beta' (em C)

  // ---------- desenho ----------
  const cunha = criar('path', { class: 'tri-cunha' });
  const ladoAB = criar('line');
  const ladoBC = criar('line');
  const ladoAC = criar('line');
  const recto = criar('path', { class: 'tri-recto' });
  const arcoA = criar('path');
  const arcoC = criar('path');
  const txtAlfa = criar('text', { class: 'tri-grego', 'text-anchor': 'middle' }, ['α']);
  const txtBeta = criar('text', { class: 'tri-grego', 'text-anchor': 'middle' }, ['β']);
  const letraA = criar('text', { class: 'tri-vertice', 'text-anchor': 'middle' }, ['A']);
  const letraB = criar('text', { class: 'tri-vertice', 'text-anchor': 'start' }, ['B']);
  const letraC = criar('text', { class: 'tri-vertice', 'text-anchor': 'middle' }, ['C']);
  const nomeAB = criar('g');
  const nomeBC = criar('g');
  const nomeAC = criar('g');
  const pegaAlvo = criar('circle', { class: 'tri-pega-alvo', r: 24 });
  const pega = criar('circle', { class: 'tri-pega', r: 8 });

  const svg = criar('svg', { class: 'figura tri-fig', viewBox: `0 0 ${VB_W} ${VB_H}`, role: 'img' },
    [cunha, ladoAB, ladoBC, ladoAC, recto, arcoA, arcoC, txtAlfa, txtBeta,
      letraA, letraB, letraC, nomeAB, nomeBC, nomeAC, pegaAlvo, pega]);

  function linhasTexto(g, linhas, x, y0, anchor, passo = 16) {
    g.replaceChildren(...linhas.map((l, i) =>
      criar('text', { x: x.toFixed(1), y: (y0 + i * passo).toFixed(1), 'text-anchor': anchor, class: l.classe }, [l.txt])));
  }

  // ---------- controlos ----------
  const chipAlfa = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', 'data-ref': 'alfa' }, 'α em A');
  const chipBeta = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', 'data-ref': 'beta' }, 'β em C');
  const grupoRef = h('div', { class: 'tri-grupo' },
    h('span', { class: 'tri-grupo__rotulo', id: `${id}-ref` }, 'Ver a partir de:'),
    h('div', { class: 'chips tri-chips', role: 'group', 'aria-labelledby': `${id}-ref` }, chipAlfa, chipBeta));

  const slider = h('input', { type: 'range', id: `${id}-alfa`, min: ALFA_MIN, max: ALFA_MAX, step: 0.5, 'data-param': 'alfa' });
  const saida = h('output', { for: `${id}-alfa` });
  const controloAlfa = h('div', { class: 'controlo tri-controlo' },
    h('div', { class: 'tri-controlo__linha' }, h('label', { for: `${id}-alfa` }, 'Ângulo α'), saida), slider);

  const rotuloAtalhos = h('span', { class: 'tri-grupo__rotulo', id: `${id}-atalhos` });
  const botoesAtalho = NOTAVEIS.map((g) => {
    const b = h('button', { type: 'button', class: 'botao botao--suave botao--mini tri-atalho', 'data-graus': g }, `${g}°`);
    b.addEventListener('click', () => definir(ref === 'alfa' ? g : 90 - g));
    return b;
  });
  const grupoAtalhos = h('div', { class: 'tri-grupo' }, rotuloAtalhos,
    h('div', { class: 'tri-atalhos', role: 'group', 'aria-labelledby': `${id}-atalhos` }, ...botoesAtalho));

  // ---------- leituras ----------
  const nos = {};
  const leiturasEl = h('div', { class: 'leituras tri-leituras', 'aria-live': 'polite' });
  for (const [chave, rotulo, classe, larga] of [
    ['angulos', 'Ângulos', '', true],
    ['sin', 'Seno', 'leitura--seno', true],
    ['cos', 'Cosseno', 'leitura--cosseno', true],
    ['tan', 'Tangente', 'leitura--tangente', true],
    ['notavel', 'Valor notável', '', true],
  ]) {
    const rot = h('span', { class: 'leitura__rotulo' }, rotulo);
    const val = h('span', { class: 'leitura__valor' });
    const caixa = h('div', { class: `leitura tri-leitura ${classe}${larga ? ' tri-leitura--larga' : ''}`, 'data-leitura': chave }, rot, val);
    nos[chave] = { rot, valor: val };
    leiturasEl.append(caixa);
  }
  const notaArred = h('p', { class: 'nota' },
    'As razões usam os comprimentos exatos; na figura estão arredondados às centésimas.');

  const painel = h('div', { class: 'tri-painel' }, grupoRef, controloAlfa, grupoAtalhos, leiturasEl, notaArred);
  const dica = h('p', { class: 'nota tri-dica' }, 'Arrasta o desenho (ou o vértice C) para mudar o ângulo α.');
  const coluna = h('div', { class: 'tri-coluna' }, svg, dica);
  const cartao = h('div', { class: 'widget tri' },
    h('p', { class: 'widget__titulo' }, 'Triângulo retângulo'),
    h('div', { class: 'tri-layout' }, coluna, painel));

  // ---------- tabela dos valores notáveis ----------
  const reveladas = new Set();
  const celulas = {};
  const cabecalhos = {};
  const contagem = h('p', { class: 'nota tri-contagem', 'aria-live': 'polite' });
  const exatoDe = (f, g) => M.exato(dados.valores, g, f);

  function pintarCelula(f, g) {
    const b = celulas[`${f}${g}`];
    const aberta = reveladas.has(`${f}${g}`);
    const v = exatoDe(f, g);
    b.dataset.aberta = aberta ? 'sim' : 'nao';
    if (aberta) {
      b.innerHTML = tex(v.tex);
      b.setAttribute('aria-label', `${f} ${g}° = ${falado(v.expr)}. Carrega para esconder.`);
    } else {
      b.textContent = '?';
      b.setAttribute('aria-label', `${f} ${g}°: escondido. Carrega para revelar.`);
    }
  }
  function atualizarContagem() {
    contagem.textContent = `Reveladas: ${reveladas.size} de ${FUNCOES.length * NOTAVEIS.length}`;
  }
  function alternar(f, g) {
    const k = `${f}${g}`;
    if (reveladas.has(k)) reveladas.delete(k); else reveladas.add(k);
    pintarCelula(f, g);
    atualizarContagem();
  }
  function todas(mostrar) {
    for (const f of FUNCOES) {
      for (const g of NOTAVEIS) {
        if (mostrar) reveladas.add(`${f}${g}`); else reveladas.delete(`${f}${g}`);
        pintarCelula(f, g);
      }
    }
    atualizarContagem();
  }

  const cabecaTr = h('tr', {}, h('td', { class: 'tri-canto' }, h('span', { class: 'sr-only' }, 'Função')));
  for (const g of NOTAVEIS) {
    const [p, q] = M.grausEmFracPi(g);
    const th = h('th', { scope: 'col' }, `${g}°`, h('span', { class: 'tri-rad' }, M.fracPiTexto(p, q)));
    cabecalhos[g] = th;
    cabecaTr.append(th);
  }
  const corpo = h('tbody');
  for (const f of FUNCOES) {
    const tr = h('tr', {}, h('th', { scope: 'row' }, f));
    for (const g of NOTAVEIS) {
      const b = h('button', { type: 'button', class: 'tri-celula', 'data-f': f, 'data-g': g });
      b.addEventListener('click', () => alternar(f, g));
      celulas[`${f}${g}`] = b;
      tr.append(h('td', {}, b));
    }
    corpo.append(tr);
  }
  const tabela = h('table', { class: 'tabela tri-tabela' },
    h('caption', { class: 'sr-only' }, 'Valores notáveis de sin, cos e tan. Carrega numa célula para revelar o valor.'),
    h('thead', {}, cabecaTr), corpo);
  const btnTudo = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Mostrar tudo');
  const btnNada = h('button', { type: 'button', class: 'botao botao--suave botao--mini' }, 'Esconder tudo');
  btnTudo.addEventListener('click', () => todas(true));
  btnNada.addEventListener('click', () => todas(false));
  const cartaoTabela = h('div', { class: 'widget tri-valores' },
    h('p', { class: 'widget__titulo' }, 'Valores notáveis'),
    h('p', { class: 'nota tri-intro' }, 'Tenta lembrar-te do valor e carrega na célula para confirmar.'),
    h('div', { class: 'tabela-rolante' }, tabela),
    h('div', { class: 'tri-acoes' }, btnTudo, btnNada, contagem));

  el.replaceChildren(cartao, cartaoTabela);
  for (const f of FUNCOES) for (const g of NOTAVEIS) pintarCelula(f, g);
  atualizarContagem();

  // ---------- atualização ----------
  function render() {
    const a = rad(alfa);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    const beta = 90 - alfa;
    const B = { x: A.x + L * cos, y: A.y };
    const C = { x: B.x, y: A.y - L * sin };
    const refA = ref === 'alfa';

    const papelAB = refA ? 'adjacente' : 'oposto';
    const papelBC = refA ? 'oposto' : 'adjacente';
    const comp = { AB: HIP * cos, BC: HIP * sin, AC: HIP };
    const poe = (ln, p, q) => {
      ln.setAttribute('x1', p.x.toFixed(1)); ln.setAttribute('y1', p.y.toFixed(1));
      ln.setAttribute('x2', q.x.toFixed(1)); ln.setAttribute('y2', q.y.toFixed(1));
    };
    poe(ladoAB, A, B); poe(ladoBC, B, C); poe(ladoAC, A, C);
    ladoAB.setAttribute('class', `tri-lado tri-lado--${papelAB}`);
    ladoBC.setAttribute('class', `tri-lado tri-lado--${papelBC}`);
    ladoAC.setAttribute('class', 'tri-lado tri-lado--hipotenusa');

    // ângulo reto
    recto.setAttribute('d', `M${(B.x - 14).toFixed(1)} ${B.y}L${(B.x - 14).toFixed(1)} ${B.y - 14}L${B.x.toFixed(1)} ${B.y - 14}`);

    // arcos de α (em A) e de β (em C)
    const rA = 40;
    const rC = 34;
    const pA1 = { x: A.x + rA, y: A.y };
    const pA2 = { x: A.x + rA * cos, y: A.y - rA * sin };
    const pC1 = { x: C.x, y: C.y + rC };
    const pC2 = { x: C.x - rC * cos, y: C.y + rC * sin };
    const dArcoA = `M${pA1.x.toFixed(1)} ${pA1.y.toFixed(1)}A${rA} ${rA} 0 0 0 ${pA2.x.toFixed(1)} ${pA2.y.toFixed(1)}`;
    const dArcoC = `M${pC1.x.toFixed(1)} ${pC1.y.toFixed(1)}A${rC} ${rC} 0 0 1 ${pC2.x.toFixed(1)} ${pC2.y.toFixed(1)}`;
    arcoA.setAttribute('d', dArcoA);
    arcoC.setAttribute('d', dArcoC);
    arcoA.setAttribute('class', `tri-arco${refA ? ' tri-arco--ref' : ''}`);
    arcoC.setAttribute('class', `tri-arco${refA ? '' : ' tri-arco--ref'}`);
    cunha.setAttribute('d', refA
      ? `M${A.x} ${A.y}L${dArcoA.slice(1)}Z`
      : `M${C.x.toFixed(1)} ${C.y.toFixed(1)}L${dArcoC.slice(1)}Z`);
    txtAlfa.setAttribute('class', `tri-grego${refA ? ' tri-grego--ref' : ''}`);
    txtBeta.setAttribute('class', `tri-grego${refA ? '' : ' tri-grego--ref'}`);

    // letras α e β ao longo das bissetrizes
    const meio = rad(alfa / 2);
    txtAlfa.setAttribute('x', (A.x + 64 * Math.cos(meio)).toFixed(1));
    txtAlfa.setAttribute('y', (A.y - 64 * Math.sin(meio) + 5).toFixed(1));
    const bx = -cos;
    const by = 1 + sin;
    const bn = Math.hypot(bx, by);
    txtBeta.setAttribute('x', (C.x + (56 * bx) / bn).toFixed(1));
    txtBeta.setAttribute('y', (C.y + (56 * by) / bn + 5).toFixed(1));

    // vértices
    letraA.setAttribute('x', A.x - 16); letraA.setAttribute('y', A.y + 18);
    letraB.setAttribute('x', (B.x + 8).toFixed(1)); letraB.setAttribute('y', B.y + 18);
    letraC.setAttribute('x', C.x.toFixed(1)); letraC.setAttribute('y', (C.y - 10).toFixed(1));

    // rótulos dos lados
    const nome = (papel) => ({ txt: NOME_PAPEL[papel], classe: `tri-nome tri-nome--${papel}` });
    const medida = (lado) => ({ txt: `${lado} = ${M.fmt(comp[lado], 2)}`, classe: 'tri-medida' });
    linhasTexto(nomeAB, [nome(papelAB), medida('AB')], (A.x + B.x) / 2, A.y + 36, 'middle');
    const cy = Math.min((B.y + C.y) / 2, B.y - 34);
    const partes = NOME_PAPEL[papelBC].split(' ');
    linhasTexto(nomeBC, [
      { txt: partes[0], classe: `tri-nome tri-nome--${papelBC}` },
      { txt: partes[1], classe: `tri-nome tri-nome--${papelBC}` },
      medida('BC'),
    ], B.x + 18, cy - 12, 'start');
    // hipotenusa: o bloco de texto fica do lado de fora, afastado da reta
    const mx = (A.x + C.x) / 2;
    const my = (A.y + C.y) / 2;
    const nx = -sin;
    const ny = -cos;
    const dist = 12 + Math.abs(nx) * 38 + Math.abs(ny) * 16;
    linhasTexto(nomeAC, [nome('hipotenusa'), medida('AC')], mx + nx * dist, my + ny * dist - 4, 'middle');

    pega.setAttribute('cx', C.x.toFixed(1)); pega.setAttribute('cy', C.y.toFixed(1));
    pegaAlvo.setAttribute('cx', C.x.toFixed(1)); pegaAlvo.setAttribute('cy', C.y.toFixed(1));

    svg.setAttribute('aria-label',
      `Triângulo retângulo ABC com ângulo reto em B. α = ${graus(alfa)}, β = ${graus(beta)}. `
      + `AC = ${M.fmt(comp.AC, 2)}, BC = ${M.fmt(comp.BC, 2)}, AB = ${M.fmt(comp.AB, 2)}.`);

    // controlos
    slider.value = alfa;
    slider.setAttribute('aria-valuetext', graus(alfa));
    saida.textContent = graus(alfa);
    chipAlfa.setAttribute('aria-pressed', String(refA));
    chipBeta.setAttribute('aria-pressed', String(!refA));
    rotuloAtalhos.textContent = refA ? 'Pôr α a:' : 'Pôr β a:';

    // leituras
    const angRef = refA ? alfa : beta;
    const simb = refA ? '\\alpha' : '\\beta';
    const opo = refA ? 'BC' : 'AB';
    const adj = refA ? 'AB' : 'BC';
    nos.angulos.valor.textContent = `α = ${graus(alfa)}, β = ${graus(beta)}`;
    const razoes = {
      sin: { tex: `\\sin${simb}=\\frac{${opo}}{AC}`, v: Math.sin(rad(angRef)) },
      cos: { tex: `\\cos${simb}=\\frac{${adj}}{AC}`, v: Math.cos(rad(angRef)) },
      tan: { tex: `\\tan${simb}=\\frac{${opo}}{${adj}}`, v: Math.tan(rad(angRef)) },
    };
    for (const f of FUNCOES) {
      const { tex: t, v } = razoes[f];
      const exacto = Math.abs(v - Number(v.toFixed(3))) < 1e-9;
      nos[f].valor.innerHTML = tex(`${t}${exacto ? '=' : '\\approx'}${decTex(v)}`);
      nos[f].valor.dataset.valor = v.toFixed(6);
    }
    const notavel = NOTAVEIS.find((n) => Math.abs(angRef - n) < 0.5);
    if (notavel) {
      nos.notavel.valor.replaceChildren(...FUNCOES.map((f) => {
        const s = h('span', { class: 'tri-notavel' });
        s.innerHTML = tex(`\\${f}\\,${notavel}^\\circ=${exatoDe(f, notavel).tex}`);
        return s;
      }));
      nos.notavel.valor.dataset.notavel = String(notavel);
    } else {
      nos.notavel.valor.textContent = `Leva ${refA ? 'α' : 'β'} a 30°, 45° ou 60° para veres o valor exato.`;
      delete nos.notavel.valor.dataset.notavel;
    }
    for (const g of NOTAVEIS) cabecalhos[g].classList.toggle('tri-col--ativa', g === notavel);
  }

  function definir(v) {
    alfa = limitar(Math.round(v * 2) / 2, ALFA_MIN, ALFA_MAX);
    render();
  }

  slider.addEventListener('input', () => definir(Number(slider.value)));
  chipAlfa.addEventListener('click', () => { ref = 'alfa'; render(); });
  chipBeta.addEventListener('click', () => { ref = 'beta'; render(); });
  arrastar(svg, (p) => {
    definir((Math.atan2(A.y - p.y, p.x - A.x) * 180) / Math.PI);
  });

  render();
}
