// radianos: radianos, comprimento de arco e área do setor circular.
// O desenho tem sempre o mesmo tamanho; o raio r só entra nas contas (c = αr, A = αr²/2).

import * as M from '../../assets/motor/matematica.js';
import { criar } from '../../assets/motor/svg.js';
import { tex } from '../../assets/motor/katex.js';

const R = 108; // raio desenhado, em unidades do viewBox
const VB = 150; // meia-largura do viewBox
const RAPIDOS = [30, 45, 60, 90, 120, 180, 270];

let contador = 0;

const n2 = (x) => Math.round(x * 100) / 100;
const ehInteiro = (g) => Math.abs(g - Math.round(g)) < 1e-9;
const decTex = (x, casas = 3) => M.fmt(x, casas).replace('−', '-').replace(',', '{,}');
/** «0,5000» -> «0,5»; só mexe em números com vírgula. */
const limpar = (s) => (s.includes(',') ? s.replace(/0+$/, '').replace(/,$/, '') : s);

const memoTex = new Map();
function texC(s) {
  let h = memoTex.get(s);
  if (h === undefined) {
    h = tex(s);
    memoTex.set(s, h);
  }
  return h;
}

function definirHtml(el, html) {
  if (el._h !== html) {
    el._h = html;
    el.innerHTML = html;
  }
}
function definirTexto(el, txt) {
  if (el.textContent !== txt) el.textContent = txt;
}

const at = (el, atrs) => {
  for (const [k, v] of Object.entries(atrs)) el.setAttribute(k, String(v));
};
const mostrar = (el, sim) => {
  el.style.display = sim ? '' : 'none';
};
const texto = (cls, x, y, s, ancora = 'middle') =>
  criar('text', { class: cls, x, y, 'text-anchor': ancora }, [s]);

/** Ponto da circunferência de raio r no ângulo `graus` (y do SVG para baixo). */
const ponto = (graus, r) => {
  const a = M.grausParaRad(graus);
  return [r * Math.cos(a), -r * Math.sin(a)];
};

/** Arco de raio r de 0 a `graus` (0 < graus <= 360). */
function arcoPath(r, graus) {
  if (graus >= 359.999) return `M${r} 0 A${r} ${r} 0 1 0 ${-r} 0 A${r} ${r} 0 1 0 ${r} 0`;
  const [ex, ey] = ponto(graus, r);
  return `M${r} 0 A${r} ${r} 0 ${graus > 180 ? 1 : 0} 0 ${n2(ex)} ${n2(ey)}`;
}

/** Lê «3π/4», «3pi/4», «0,5», «135°», «2 rad». */
function lerNumero(txt) {
  const s = String(txt).trim();
  if (!s) return { vazio: true };
  const limpo = s.replace(/°/g, '').replace(/\s*(graus?|rad(ianos?)?)\s*$/i, '');
  const r = M.avaliar(limpo);
  return r.ok ? { ok: true, valor: r.valor } : { ok: false };
}

/** Resultado da conversão em KaTeX, a partir dos graus. */
function resultadoTex(deg) {
  const rad = M.grausParaRad(deg);
  if (ehInteiro(deg)) {
    const g = Math.round(deg);
    const [p, q] = M.grausEmFracPi(g);
    return `${decTex(g, 0)}^\\circ=${M.fracPiTex(p, q)}\\text{ rad}${g === 0 ? '' : `\\approx ${decTex(rad, 3)}\\text{ rad}`}`;
  }
  return `${decTex(deg, 2)}^\\circ\\approx ${decTex(rad, 3)}\\text{ rad}`;
}

export async function montar(el) {
  const uid = `rad${++contador}`;
  const est = { alfa: 60, r: 6, umRad: false };

  const raiz = document.createElement('div');
  raiz.className = 'widget rad';
  raiz.innerHTML = `
    <div class="rad-corpo">
      <div class="rad-fig">
        <div class="rad-svg-lugar"></div>
        <p class="rad-legenda" hidden>1 rad ≈ 57,3°: o arco tem o mesmo comprimento do raio</p>
      </div>
      <div class="rad-info">
        <div class="controlos rad-controlos">
          <div class="controlo">
            <div class="rad-linha"><label for="${uid}-a">Ângulo α</label><output for="${uid}-a" class="rad-sa"></output></div>
            <input id="${uid}-a" class="rad-alfa" type="range" min="0" max="360" step="5" value="${est.alfa}">
          </div>
          <div class="chips rad-rapidos" role="group" aria-label="Ângulos rápidos"></div>
          <div class="controlo">
            <div class="rad-linha"><label for="${uid}-r">Raio r</label><output for="${uid}-r" class="rad-sr"></output></div>
            <input id="${uid}-r" class="rad-raio" type="range" min="1" max="10" step="1" value="${est.r}">
          </div>
          <div class="chips"><button type="button" class="chip rad-umrad" aria-pressed="false">Mostrar 1 rad</button></div>
        </div>
        <div class="leituras rad-leituras">
          <div class="leitura"><span class="leitura__rotulo">α em graus</span><span class="leitura__valor" data-l="g"></span></div>
          <div class="leitura"><span class="leitura__rotulo">α em radianos</span><span class="leitura__valor" data-l="rad"></span></div>
          <div class="leitura rad-larga"><span class="leitura__rotulo">Comprimento do arco, c = αr</span><span class="leitura__valor rad-formula" data-l="c"></span></div>
          <div class="leitura rad-larga"><span class="leitura__rotulo">Área do setor, A = αr²/2</span><span class="leitura__valor rad-formula" data-l="a"></span></div>
          <div class="leitura rad-larga"><span class="leitura__rotulo">Para comparar, o círculo inteiro</span><span class="leitura__valor rad-formula" data-l="ref"></span></div>
        </div>
      </div>
    </div>
    <div class="rad-conv">
      <h4 class="rad-conv__titulo">Converter graus e radianos</h4>
      <div class="rad-conv__campos">
        <div class="controlo">
          <label for="${uid}-cg">Graus</label>
          <input id="${uid}-cg" class="campo rad-cg" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="135">
        </div>
        <div class="controlo">
          <label for="${uid}-cr">Radianos (aceita 3π/4, 3pi/4 ou 0,5)</label>
          <input id="${uid}-cr" class="campo rad-cr" type="text" autocomplete="off" spellcheck="false" value="3π/4">
        </div>
      </div>
      <p class="nota rad-erro" aria-live="polite"></p>
      <p class="rad-res"></p>
    </div>
  `;
  el.innerHTML = '';
  el.append(raiz);

  const $ = (sel) => raiz.querySelector(sel);
  const L = {};
  raiz.querySelectorAll('[data-l]').forEach((n) => {
    L[n.dataset.l] = n;
  });
  const sliderA = $('.rad-alfa');
  const sliderR = $('.rad-raio');
  const saida = $('.rad-sa');
  const saidaR = $('.rad-sr');
  const botaoUm = $('.rad-umrad');
  const legenda = $('.rad-legenda');
  const rapidos = $('.rad-rapidos');
  const cg = $('.rad-cg');
  const cr = $('.rad-cr');
  const erro = $('.rad-erro');
  const res = $('.rad-res');

  RAPIDOS.forEach((g) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
    b.dataset.g = String(g);
    b.textContent = `${g}°`;
    b.setAttribute('aria-pressed', 'false');
    rapidos.append(b);
  });
  const botoes = [...rapidos.querySelectorAll('button')];

  // ---------- SVG ----------

  const svg = criar('svg', {
    class: 'figura figura--fixa rad-svg',
    viewBox: `${-VB} ${-VB} ${2 * VB} ${2 * VB}`,
    role: 'img',
    'aria-label': '',
  });
  const E = {};
  E.disco = criar('circle', { class: 'rad-disco', r: R });
  E.setor = criar('path', { class: 'rad-setor' });
  E.eixos = criar('g', {}, [
    criar('line', { class: 'rad-eixo', x1: -R - 14, y1: 0, x2: R + 14, y2: 0 }),
    criar('line', { class: 'rad-eixo', x1: 0, y1: R + 14, x2: 0, y2: -R - 14 }),
  ]);
  E.circ = criar('circle', { class: 'rad-circ', r: R });

  // 1 rad (por baixo do arco do setor)
  E.umArco = criar('path', { class: 'rad-um-arco' });
  E.umT0 = criar('line', { class: 'rad-um-marca' });
  E.umT1 = criar('line', { class: 'rad-um-marca' });
  E.umRaio = criar('line', { class: 'rad-um-raio' });
  E.umRot = texto('rad-t-um', 0, 0, '1 rad');
  E.gUm = criar('g', {}, [E.umRaio, E.umArco, E.umT0, E.umT1, E.umRot]);

  E.r1 = criar('line', { class: 'rad-raio-l', x1: 0, y1: 0, x2: R, y2: 0 });
  E.r2 = criar('line', { class: 'rad-raio-l', x1: 0, y1: 0 });
  E.arco = criar('path', { class: 'rad-arco' });
  E.arcoAng = criar('path', { class: 'rad-arco-ang' });
  E.rotR1 = texto('rad-t-r', 0, 0, 'r');
  E.rotR2 = texto('rad-t-r', 0, 0, 'r');
  E.rotAng = texto('rad-t-ang', 0, 0, 'α');
  E.rotC = texto('rad-t-c', 0, 0, 'c');

  svg.append(E.disco, E.setor, E.eixos, E.circ, E.gUm, E.arco, E.r1, E.r2, E.arcoAng, E.rotR1, E.rotR2, E.rotAng, E.rotC);
  $('.rad-svg-lugar').append(svg);

  // ---------- desenho e leituras ----------

  function pintar() {
    const { alfa, r } = est;
    const tem = alfa > 0;

    // setor, arco, raios
    if (tem) {
      const [ex, ey] = ponto(alfa, R);
      const grande = alfa > 180 ? 1 : 0;
      at(E.setor, {
        d: alfa >= 360 ? `M0 0 L${R} 0 A${R} ${R} 0 1 0 ${-R} 0 A${R} ${R} 0 1 0 ${R} 0 Z` : `M0 0 L${R} 0 A${R} ${R} 0 ${grande} 0 ${n2(ex)} ${n2(ey)} Z`,
      });
      at(E.arco, { d: arcoPath(R, alfa) });
      at(E.r2, { x2: n2(ex), y2: n2(ey) });
      at(E.arcoAng, { d: arcoPath(30, alfa) });
    }
    [E.setor, E.arco, E.arcoAng, E.rotAng, E.rotC].forEach((n) => mostrar(n, tem));
    mostrar(E.r2, tem && alfa < 360);

    // rótulos «r»: o primeiro por baixo do eixo, o segundo para fora do setor
    // com α grande, o espaço por baixo do eixo é onde cai o segundo «r»: o primeiro passa para cima
    at(E.rotR1, { x: R / 2, y: alfa >= 300 && alfa < 360 ? -8 : 17 });
    if (tem && alfa < 360) {
      const a = M.grausParaRad(alfa);
      const mx = (R / 2) * Math.cos(a);
      const my = (-R / 2) * Math.sin(a);
      // normal para fora do setor: rodar a direção do raio 90° para o lado de fora; quando a fresta
      // entre o setor e o eixo é estreita (α perto de 360°), o rótulo passa para dentro do setor
      const lado = alfa >= 335 ? -1 : 1;
      at(E.rotR2, { x: n2(mx - lado * 13 * Math.sin(a)), y: n2(my - lado * 13 * Math.cos(a) + 5) });
      mostrar(E.rotR2, true);
    } else {
      mostrar(E.rotR2, false);
    }
    if (tem) {
      const meio = alfa >= 360 ? 180 : alfa / 2;
      const [lx, ly] = ponto(meio, R + 17);
      at(E.rotC, { x: n2(lx), y: n2(ly + 5) });
      const [ax, ay] = ponto(meio, 52);
      const comValor = alfa >= 45;
      definirTexto(E.rotAng, comValor ? `α = ${alfa}°` : 'α');
      at(E.rotAng, { x: n2(ax), y: n2(ay + 5) });
      mostrar(E.rotAng, alfa >= 10);
    }

    // 1 rad
    mostrar(E.gUm, est.umRad);
    if (est.umRad) {
      const grau1 = M.radParaGraus(1);
      at(E.umArco, { d: arcoPath(R, grau1) });
      const [x0a, y0a] = ponto(0, R - 10);
      const [x0b, y0b] = ponto(0, R + 10);
      const [x1a, y1a] = ponto(grau1, R - 10);
      const [x1b, y1b] = ponto(grau1, R + 10);
      at(E.umT0, { x1: n2(x0a), y1: n2(y0a), x2: n2(x0b), y2: n2(y0b) });
      at(E.umT1, { x1: n2(x1a), y1: n2(y1a), x2: n2(x1b), y2: n2(y1b) });
      const [rx, ry] = ponto(grau1, R);
      at(E.umRaio, { x1: 0, y1: 0, x2: n2(rx), y2: n2(ry) });
      // o rótulo fica a meio do arco, por fora; se o «c» do setor estiver lá perto, passa para o fim do arco
      const perto = tem && Math.abs(alfa / 2 - grau1 / 2) < 16;
      const [tx, ty] = perto ? ponto(grau1 + 6, R + 16) : ponto(grau1 / 2, R + 26);
      at(E.umRot, { x: n2(tx), y: n2(ty + 5), 'text-anchor': perto ? 'start' : 'middle' });
    }
    legenda.hidden = !est.umRad;
    botaoUm.setAttribute('aria-pressed', String(est.umRad));

    at(svg, {
      'aria-label': `Setor circular de ${alfa} graus num círculo de raio ${r}${est.umRad ? ', com o arco de 1 radiano assinalado' : ''}.`,
    });

    // controlos
    sliderA.value = String(alfa);
    sliderR.value = String(r);
    definirTexto(saida, `${alfa}°`);
    definirTexto(saidaR, String(r));
    at(sliderA, { 'aria-valuetext': `${alfa} graus` });
    at(sliderR, { 'aria-valuetext': `raio ${r}` });
    botoes.forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.g) === alfa)));

    leituras();
  }

  function leituras() {
    const { alfa, r } = est;
    const [p, q] = M.grausEmFracPi(alfa);
    const alfaTex = M.fracPiTex(p, q);
    const alfaRad = M.grausParaRad(alfa);
    const aprox = (x, casas) => (alfa === 0 ? '' : `\\approx ${decTex(x, casas)}`);

    definirHtml(L.g, `${alfa}°`);
    definirHtml(L.rad, texC(`${alfaTex}\\text{ rad}${aprox(alfaRad, 3)}`));

    const cExato = M.fracPiTex(p * r, q);
    const cDec = alfaRad * r;
    definirHtml(
      L.c,
      texC(`\\begin{aligned}c&=\\alpha r=${alfaTex}\\times ${r}\\\\&=${cExato}${aprox(cDec, 2)}\\end{aligned}`)
    );

    const aExato = M.fracPiTex(p * r * r, 2 * q);
    const aDec = (alfaRad * r * r) / 2;
    definirHtml(
      L.a,
      texC(`\\begin{aligned}A&=\\frac{\\alpha r^{2}}{2}=\\frac{${alfaTex}\\times ${r}^{2}}{2}\\\\&=${aExato}${aprox(aDec, 2)}\\end{aligned}`)
    );

    const perim = 2 * Math.PI * r;
    const area = Math.PI * r * r;
    definirHtml(
      L.ref,
      texC(`2\\pi r=${M.fracPiTex(2 * r)}\\approx ${decTex(perim, 2)}`) +
        '<br>' +
        texC(`\\pi r^{2}=${M.fracPiTex(r * r)}\\approx ${decTex(area, 2)}`)
    );
  }

  // ---------- conversor ----------

  function mostrarResultado(deg) {
    definirHtml(res, texC(resultadoTex(deg)));
    definirTexto(erro, '');
  }

  function limparResultado() {
    definirHtml(res, '');
  }

  function converter(origem) {
    const lido = lerNumero(origem === 'g' ? cg.value : cr.value);
    if (lido.vazio) {
      (origem === 'g' ? cr : cg).value = '';
      limparResultado();
      definirTexto(erro, '');
      return;
    }
    if (!lido.ok || Math.abs(lido.valor) > 1e7) {
      limparResultado();
      definirTexto(erro, 'não consegui ler isto');
      return;
    }
    if (origem === 'g') {
      const deg = lido.valor;
      const rad = M.grausParaRad(deg);
      if (ehInteiro(deg)) {
        const [p, q] = M.grausEmFracPi(Math.round(deg));
        cr.value = M.fracPiTexto(p, q);
      } else {
        cr.value = limpar(M.fmt(rad, 4));
      }
      mostrarResultado(deg);
    } else {
      let deg = M.radParaGraus(lido.valor);
      if (ehInteiro(deg)) deg = Math.round(deg);
      cg.value = ehInteiro(deg) ? M.fmt(Math.round(deg), 0) : limpar(M.fmt(deg, 4));
      mostrarResultado(deg);
    }
  }

  // ---------- eventos ----------

  sliderA.addEventListener('input', () => {
    est.alfa = Number(sliderA.value);
    pintar();
  });
  sliderR.addEventListener('input', () => {
    est.r = Number(sliderR.value);
    pintar();
  });
  botoes.forEach((b) =>
    b.addEventListener('click', () => {
      est.alfa = Number(b.dataset.g);
      pintar();
    })
  );
  botaoUm.addEventListener('click', () => {
    est.umRad = !est.umRad;
    pintar();
  });
  cg.addEventListener('input', () => converter('g'));
  cr.addEventListener('input', () => converter('r'));

  pintar();
  converter('g');
}
