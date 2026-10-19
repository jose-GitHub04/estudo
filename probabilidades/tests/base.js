// Ferramentas comuns das páginas de teste de probabilidades/tests/ (não é um tema do site).
// - carregarPagina(): abre uma página real num <iframe> do mesmo origem, com a largura pedida,
//   e apanha os erros de consola que ela produzir (inclusive os do arranque).
// - auditar(): scroll horizontal, alvos de toque, contraste, etiquetas de SVG sobrepostas ou
//   cortadas, nomes acessíveis, ids repetidos e regras de texto (pt-PT, sem travessões).
// - avaliarTex(): lê uma expressão em LaTeX (frações, \times, \div, potências, raízes) e devolve
//   o número; serve para conferir uma a uma as linhas das resoluções passo a passo.
// - corre os testes e escreve o resultado em <pre> com id resultado e data-testes="ok|falhou".

// ---------- esperar ----------

export const esperar = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export async function esperarPor(cond, ms = 15000, passo = 20) {
  const fim = performance.now() + ms;
  while (performance.now() < fim) {
    try { if (cond()) return true; } catch { /* ainda não */ }
    await esperar(passo);
  }
  return false;
}

export const quadros = (n = 2) => esperar(40 * n); // sem requestAnimationFrame: em tempo virtual não é fiável

// ---------- dados esperados (gerados em Python, independentes do JavaScript) ----------

export async function esperado() {
  return (await fetch(new URL('./esperado.json', import.meta.url))).json();
}

// ---------- páginas reais num iframe ----------

const palco = () => {
  let p = document.getElementById('palco');
  if (!p) {
    p = document.createElement('div');
    p.id = 'palco';
    document.body.append(p);
  }
  return p;
};

/**
 * carregarPagina('../materia.html', 390) -> { iframe, win, doc, erros, q, qa, fechar }.
 * O HTML é escrito no iframe com <base> e com ganchos de erro antes de qualquer script da página.
 */
export async function carregarPagina(caminho, largura = 390, altura = 900, { esperarPronto = true } = {}) {
  const url = new URL(caminho, location.href).href;
  const html = await (await fetch(url)).text();
  const iframe = document.createElement('iframe');
  iframe.style.cssText = `width:${largura}px;height:${altura}px;border:0;display:block;background:#fff;margin:0 0 8px`;
  iframe.title = caminho;
  iframe.setAttribute('scrolling', 'no'); // sem barra de scroll a roubar largura: como num telemóvel
  try { localStorage.removeItem('mat100-estudo-v1'); } catch { /* sem storage */ }
  palco().append(iframe);
  const win = iframe.contentWindow;
  const doc = iframe.contentDocument;
  const gancho = `<base href="${url}"><script>window.__erros=[];`
    + `addEventListener('error',function(e){__erros.push(e.message||'erro')});`
    + `addEventListener('unhandledrejection',function(e){__erros.push('promessa: '+(e.reason&&e.reason.message||e.reason))});`
    + `var _ce=console.error;console.error=function(){__erros.push('console.error: '+[].map.call(arguments,String).join(' '));_ce.apply(console,arguments)};`
    // pointer capture só existe para ponteiros reais: nos eventos de teste não faz nada
    + `Element.prototype.setPointerCapture=function(){};Element.prototype.releasePointerCapture=function(){};Element.prototype.hasPointerCapture=function(){return false};<\/script>`;
  doc.open();
  doc.write(html.replace(/<head>/i, `<head>${gancho}`));
  doc.close();
  const pronto = esperarPronto ? await esperarPor(() => doc.documentElement.dataset.pronto === 'sim', 20000) : await esperarPor(() => doc.readyState === 'complete', 10000);
  await quadros(2);
  return {
    iframe, win, doc, pronto,
    get erros() { return win.__erros || []; },
    q: (s) => doc.querySelector(s),
    qa: (s) => [...doc.querySelectorAll(s)],
    fechar: () => iframe.remove(),
  };
}

/** Simula um clique (como o toque do utilizador). */
export const clicar = (el) => el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));

/** Escreve num <input> e dispara `input` (e `change` se pedido). */
export function escrever(input, valor, change = false) {
  input.value = valor;
  input.dispatchEvent(new input.ownerDocument.defaultView.Event('input', { bubbles: true }));
  if (change) input.dispatchEvent(new input.ownerDocument.defaultView.Event('change', { bubbles: true }));
}

export function tecla(el, key) {
  el.dispatchEvent(new el.ownerDocument.defaultView.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
}

/** Evento de ponteiro (rato) em coordenadas do iframe: ponteiro(svg, 'pointerdown', x, y). */
export function ponteiro(el, tipo, x, y) {
  const W = el.ownerDocument.defaultView;
  el.dispatchEvent(new W.PointerEvent(tipo, {
    bubbles: true, cancelable: true, pointerId: 1, pointerType: 'mouse', isPrimary: true, clientX: x, clientY: y, buttons: tipo === 'pointerup' ? 0 : 1,
  }));
}

/** Ponto (x, y) das coordenadas do viewBox de um <svg> -> coordenadas do iframe. */
export function deSvg(svg, x, y) {
  const pt = svg.createSVGPoint();
  pt.x = x;
  pt.y = y;
  const r = pt.matrixTransform(svg.getScreenCTM());
  return { x: r.x, y: r.y };
}

/** Arrasta no <svg> de (x0, y0) até (x1, y1), em coordenadas do viewBox. */
export function arrastarSvg(svg, de, para, alvo = svg) {
  const a = deSvg(svg, de[0], de[1]);
  const b = deSvg(svg, para[0], para[1]);
  ponteiro(alvo, 'pointerdown', a.x, a.y);
  ponteiro(alvo, 'pointermove', (a.x + b.x) / 2, (a.y + b.y) / 2);
  ponteiro(alvo, 'pointermove', b.x, b.y);
  ponteiro(alvo, 'pointerup', b.x, b.y);
}

/** Pares [x, y] de um caminho SVG feito só de M e L: 'M1 2 L3 4 Z'. */
export function pontosDoCaminho(d) {
  const n = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  const p = [];
  for (let i = 0; i + 1 < n.length; i += 2) p.push([n[i], n[i + 1]]);
  return p;
}

/** Densidade da Normal (fórmula direta, só para os testes). */
export const densidadeNormal = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

/** Põe um <input type=range> no valor `v` e dispara `input`. */
export const slider = (el, v) => escrever(el, String(v));

export const texto = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : '');

/** Número escrito à portuguesa («0,6827», «−1,5», «1 000») -> número. */
export function numero(s) {
  const m = /[−-]?\d+(?:[  ]\d{3})*(?:,\d+)?/.exec(String(s));
  if (!m) return NaN;
  return Number(m[0].replace(/[  ]/g, '').replace(',', '.').replace('−', '-'));
}

// ---------- LaTeX -> número ----------

/** Todas as fórmulas (LaTeX original) dentro de `el`, na ordem em que aparecem. */
export function formulas(el) {
  return [...el.querySelectorAll('annotation[encoding="application/x-tex"]')].map((a) => a.textContent.trim());
}

class Erro extends Error {}

function tokens(s) {
  const t = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    let m = /^\d+(?:\.\d+)?/.exec(s.slice(i));
    if (m) { t.push({ k: 'n', v: Number(m[0]) }); i += m[0].length; continue; }
    m = /^\\([a-zA-Z]+)/.exec(s.slice(i));
    if (m) { t.push({ k: 'c', v: m[1] }); i += m[0].length; continue; }
    if (/[a-zA-Z]/.test(c)) { t.push({ k: 'v', v: c }); i++; continue; }
    t.push({ k: 'o', v: c });
    i++;
  }
  return t;
}

/** avaliarTex('\\frac{k}{4}+\\frac{1}{6}', { k: 1 }) -> 0.41666…; lança Erro se não souber ler. */
export function avaliarTex(tex, vars = {}) {
  const s = tex.replace(/\\left|\\right|\\!|\\,|\\;|\\:|\\displaystyle/g, '').replace(/\{,\}/g, '.');
  const t = tokens(s);
  let p = 0;
  const ver = () => t[p];
  const eo = (x, ...ops) => x && x.k === 'o' && ops.includes(x.v);
  const ec = (x, ...nomes) => x && x.k === 'c' && nomes.includes(x.v);
  const comecaAtomo = (x) => x && (x.k === 'n' || x.k === 'v' || (x.k === 'c' && ['frac', 'dfrac', 'tfrac', 'sqrt', 'mu', 'sigma'].includes(x.v)) || eo(x, '(', '{'));

  function chaveta() {
    if (!eo(ver(), '{')) throw new Erro('esperava {');
    p++;
    const v = soma();
    if (!eo(ver(), '}')) throw new Erro('esperava }');
    p++;
    return v;
  }
  function atomo() {
    const x = ver();
    if (!x) throw new Erro('fim inesperado');
    if (x.k === 'n') { p++; return x.v; }
    if (x.k === 'v') {
      p++;
      if (!(x.v in vars)) throw new Erro(`variável ${x.v}`);
      return vars[x.v];
    }
    if (x.k === 'c') {
      if (['frac', 'dfrac', 'tfrac'].includes(x.v)) { p++; const a = chaveta(); const b = chaveta(); return a / b; }
      if (x.v === 'sqrt') { p++; return Math.sqrt(chaveta()); }
      if (x.v === 'mu' || x.v === 'sigma') {
        p++;
        if (!(x.v in vars)) throw new Erro(`símbolo ${x.v}`);
        return vars[x.v];
      }
      throw new Erro(`comando \\${x.v}`);
    }
    if (eo(x, '(')) {
      p++;
      const v = soma();
      if (!eo(ver(), ')')) throw new Erro('esperava )');
      p++;
      return v;
    }
    if (eo(x, '{')) return chaveta();
    throw new Erro(`símbolo ${x.v}`);
  }
  function potencia() {
    let b = atomo();
    if (eo(ver(), '^')) {
      p++;
      const e = eo(ver(), '{') ? chaveta() : atomo();
      b = Math.pow(b, e);
    }
    return b;
  }
  function unario() {
    if (eo(ver(), '-')) { p++; return -unario(); }
    if (eo(ver(), '+')) { p++; return unario(); }
    return potencia();
  }
  function produto() {
    let v = unario();
    for (;;) {
      const x = ver();
      if (ec(x, 'times', 'cdot') || eo(x, '*')) { p++; v *= unario(); }
      else if (ec(x, 'div') || eo(x, '/', ':')) { p++; v /= unario(); }
      else if (comecaAtomo(x)) v *= potencia(); // multiplicação implícita: 2k, (a)(b), \frac{1}{4}k
      else return v;
    }
  }
  function soma() {
    let v = produto();
    while (eo(ver(), '+', '-')) {
      const op = t[p++].v;
      const w = produto();
      v = op === '+' ? v + w : v - w;
    }
    return v;
  }
  const r = soma();
  if (p < t.length) throw new Erro(`sobrou «${t[p].v}»`);
  return r;
}

/** Parte uma linha em lados, ao nível 0 de parênteses e chavetas: [{ lado, op }] com op antes do lado. */
function lados(tex) {
  const s = tex
    .replace(/\\left|\\right/g, '')
    .replace(/\\begin\{(?:gathered|aligned)\}|\\end\{(?:gathered|aligned)\}|&/g, '')
    .replace(/\\\\(?:\[[^\]]*\])?\s*(?=(?:=|\\approx|\+))/g, ' ') // linha que continua a anterior
    .replace(/\\\\(?:\[[^\]]*\])?/g, ' ; ') // linha nova: outra cadeia de igualdades
    .replace(/\\q?quad/g, ' ; ');
  const grupos = [];
  for (const parte of s.split(';')) {
    const out = [];
    let prof = 0;
    let atual = '';
    let op = null;
    for (let i = 0; i < parte.length; i++) {
      const c = parte[i];
      if ('({['.includes(c)) prof++;
      else if (')}]'.includes(c)) prof--;
      if (prof === 0 && c === '=') {
        out.push({ op, lado: atual });
        atual = '';
        op = '=';
        continue;
      }
      if (prof === 0 && parte.startsWith('\\approx', i)) {
        out.push({ op, lado: atual });
        atual = '';
        op = '≈';
        i += '\\approx'.length - 1;
        continue;
      }
      atual += c;
    }
    out.push({ op, lado: atual });
    grupos.push(out.map((x) => ({ op: x.op, lado: x.lado.replace(/^\s*\d+\.\d+\.(\\;|\s)*/, '').trim() })));
  }
  return grupos;
}

/**
 * Confere uma fórmula do tipo «a = b = c ≈ d». `vars`: valores das variáveis; `rotulos`: valor
 * de lados que são nomes («P(X=2)» -> 0.3). Devolve { verificada, falhas: [texto], ignorada }.
 * Cada par de lados consecutivos que se sabe avaliar tem de ser igual (≈: dentro do arredondamento).
 */
export function conferirEquacao(tex, vars = {}, rotulos = {}) {
  const resultado = { verificada: 0, falhas: [], ignorada: true };
  for (const grupo of lados(tex)) {
    const valores = grupo.map(({ lado }) => {
      const chave = lado.replace(/\s+/g, '');
      if (chave in rotulos) return rotulos[chave];
      try { return avaliarTex(lado, vars); } catch { return null; }
    });
    for (let i = 1; i < grupo.length; i++) {
      if (valores[i] === null) continue;
      // o lado conhecido anterior (pode haver desconhecidos pelo meio)
      let j = i - 1;
      while (j >= 0 && valores[j] === null) j--;
      if (j < 0) continue;
      resultado.ignorada = false;
      resultado.verificada++;
      const a = valores[j];
      const b = valores[i];
      if (grupo[i].op === '=') {
        if (!(Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)))) {
          resultado.falhas.push(`${grupo[j].lado.trim()} = ${grupo[i].lado.trim()}  (${a} != ${b})`);
        }
      } else {
        // ≈: se o lado arredondado é só um número, a tolerância é meia unidade da última casa; senão, 1e-4 relativo
        const plano = /^-?\d+(\{,\}\d+)?$/.test(grupo[i].lado.trim());
        const casas = plano ? ((/\{,\}(\d+)$/.exec(grupo[i].lado.trim()) || [])[1] || '') : null;
        const tol = casas === null ? 1e-4 * Math.max(1, Math.abs(a)) : 0.5 * Math.pow(10, -casas.length) + 1e-12;
        if (!(Math.abs(a - b) <= tol)) resultado.falhas.push(`${grupo[j].lado.trim()} ≈ ${grupo[i].lado.trim()}  (${a} vs ${b}, tol ${tol})`);
      }
    }
  }
  return resultado;
}

// ---------- auditoria ----------

const ALVO_MIN = 44;
const TRACOS = new RegExp('[' + String.fromCharCode(0x2014, 0x2013) + ']'); // por código, para não pôr o travessão no ficheiro
const PTBR = /\b(tela|arquivo|celular|você|vocês|equipe|ônibus|mouse)\b/i;

function cor(s) {
  const m = /rgba?\(([^)]+)\)/.exec(s || '');
  if (!m) return null;
  const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
}
const sobre = (f, fundo) => ({
  r: f.r * f.a + fundo.r * (1 - f.a), g: f.g * f.a + fundo.g * (1 - f.a), b: f.b * f.a + fundo.b * (1 - f.a), a: 1,
});
function luz(c) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
}
const razao = (a, b) => {
  const [x, y] = [luz(a), luz(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

function visivel(el) {
  if (!el.isConnected) return false;
  const win = el.ownerDocument.defaultView;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement) {
    const cs = win.getComputedStyle(e);
    if (cs.display === 'none') return false;
    if (e === el && cs.visibility === 'hidden') return false;
  }
  return el.getClientRects().length > 0 || el.tagName.toLowerCase() === 'svg';
}

/** Fundo efetivo de um elemento HTML: lista de cores possíveis (mais de uma se houver gradiente). */
function fundosHtml(el) {
  const win = el.ownerDocument.defaultView;
  const cadeia = [];
  for (let e = el; e; e = e.parentElement) cadeia.unshift(e);
  let bases = [{ r: 255, g: 255, b: 255, a: 1 }];
  for (const e of cadeia) {
    const cs = win.getComputedStyle(e);
    const bg = cor(cs.backgroundColor);
    let novas = null;
    if (cs.backgroundImage && cs.backgroundImage !== 'none') {
      const cores = [...cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)].map((m) => cor(m[0])).filter((c) => c && c.a >= 0.5);
      if (cores.length) novas = cores;
    }
    if (novas) bases = novas.flatMap((c) => bases.map((b) => sobre(c, b)));
    else if (bg && bg.a > 0) bases = bases.map((b) => sobre(bg, b));
  }
  return bases;
}

/** Fundo atrás de um <text> SVG num ponto do ecrã: o do HTML mais as formas do SVG que o cobrem (pela ordem de pintura). */
function fundosSvg(textEl, ponto) {
  const doc = textEl.ownerDocument;
  const win = doc.defaultView;
  const svg = textEl.ownerSVGElement;
  let bases = fundosHtml(svg);
  for (const f of svg.querySelectorAll('rect,circle,ellipse,path,polygon')) {
    if (!(textEl.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_PRECEDING)) continue;
    if (f.contains(textEl) || !visivel(f)) continue;
    const cs = win.getComputedStyle(f);
    const preenchimento = cor(cs.fill);
    if (!preenchimento || preenchimento.a === 0) continue;
    const m = f.getScreenCTM();
    if (!m || !f.isPointInFill) continue;
    const pt = svg.createSVGPoint();
    pt.x = ponto.x;
    pt.y = ponto.y;
    let dentro = false;
    try { dentro = f.isPointInFill(pt.matrixTransform(m.inverse())); } catch { dentro = false; }
    if (!dentro) continue;
    const alfa = preenchimento.a * Number(cs.fillOpacity) * Number(cs.opacity);
    bases = bases.map((b) => sobre({ ...preenchimento, a: alfa }, b));
  }
  return bases;
}

function opacidade(el) {
  const win = el.ownerDocument.defaultView;
  let o = 1;
  for (let e = el; e && e.nodeType === 1; e = e.parentElement || e.parentNode) {
    o *= Number(win.getComputedStyle(e).opacity);
    if (!e.parentElement) break;
  }
  return o;
}

function nomeAcessivel(el) {
  const doc = el.ownerDocument;
  if ((el.getAttribute('aria-label') || '').trim()) return true;
  const lb = el.getAttribute('aria-labelledby');
  if (lb && lb.split(/\s+/).some((id) => (doc.getElementById(id) || {}).textContent)) return true;
  if (el.id && doc.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return true;
  if (el.closest('label')) return true;
  if ((el.getAttribute('title') || '').trim()) return true;
  if (el.tagName === 'BUTTON' || el.tagName === 'A' || el.getAttribute('role') === 'button') return texto(el).length > 0;
  return false;
}

/**
 * Auditoria de uma página já carregada. Devolve { erros: [..], avisos: [..] }.
 * `nome` serve só para as mensagens; `largura` é a do iframe.
 */
export function auditar(doc, { nome = '', ignorarCabecalho = true } = {}) {
  const win = doc.defaultView;
  const erros = [];
  const avisos = [];
  const ctx = nome ? `${nome}: ` : '';
  const de = doc.documentElement;
  const vw = de.clientWidth;
  const descr = (el) => {
    const id = el.id ? `#${el.id}` : '';
    const cl = typeof el.className === 'string' && el.className ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : '';
    const tx = texto(el).slice(0, 26);
    return `<${el.tagName.toLowerCase()}${id}${cl}>${tx ? ` «${tx}»` : ''}`;
  };
  const doCabecalho = (el) => ignorarCabecalho && !!el.closest('.barra, .rodape, .saltar');

  // 1. scroll horizontal
  if (de.scrollWidth > vw + 1) erros.push(`${ctx}scroll horizontal da página (${de.scrollWidth} > ${vw})`);
  const emRolante = (el) => {
    for (let e = el.parentElement; e && e !== doc.body; e = e.parentElement) {
      const o = win.getComputedStyle(e).overflowX;
      if (o !== 'visible') return e;
    }
    return null;
  };
  let nFora = 0;
  for (const el of doc.body.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
    if (el.closest('.sr-only, .saltar, .katex-mathml') || el.closest('[hidden]')) continue;
    if (!visivel(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue;
    if (r.right > vw + 1 || r.left < -1) {
      const rol = emRolante(el);
      if (rol) {
        const rr = rol.getBoundingClientRect();
        if (rr.right <= vw + 1 && rr.left >= -1) continue; // fica dentro de um contentor com scroll próprio
      }
      if (nFora++ < 6) erros.push(`${ctx}${descr(el)} sai do ecrã (x ${Math.round(r.left)} a ${Math.round(r.right)}, ecrã ${vw})`);
    }
  }
  // conteúdo que só se vê com scroll dentro de uma caixa (não se nota num telemóvel): fica cortado
  for (const el of doc.body.querySelectorAll('*')) {
    if (el.closest('svg, .katex-mathml, .sr-only, .tabela-rolante, [hidden]') || !visivel(el)) continue;
    const o = win.getComputedStyle(el).overflowX;
    if (o === 'visible' || o === 'clip') continue;
    if (el.scrollWidth > el.clientWidth + 1) erros.push(`${ctx}conteúdo cortado (${el.scrollWidth} > ${el.clientWidth}) em ${descr(el)}`);
  }
  // tabelas que precisam de scroll próprio (informativo)
  for (const rol of doc.querySelectorAll('.tabela-rolante')) {
    if (visivel(rol) && rol.scrollWidth > rol.clientWidth + 1) avisos.push(`${ctx}tabela com scroll próprio (${rol.scrollWidth} > ${rol.clientWidth}) em ${descr(rol.querySelector('table') || rol)}`);
  }

  // 2. alvos de toque
  const alvos = doc.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=slider], [role=button]');
  for (const el of alvos) {
    if (!visivel(el) || el.disabled || el.closest('[hidden]')) continue;
    if (el.closest('.sr-only, .saltar')) continue;
    if (el.dataset.alvo === 'figura') continue; // bola de um desenho: o toque na faixa do eixo também a agarra
    { const r0 = el.getBoundingClientRect(); if (r0.width === 0 && r0.height === 0) continue; }
    if (doCabecalho(el)) {
      const r = el.getBoundingClientRect();
      if (Math.min(r.width, r.height) < ALVO_MIN - 0.5) avisos.push(`(partilhado, assets/) ${descr(el)} tem alvo ${Math.round(r.width)}×${Math.round(r.height)} px`);
      continue;
    }
    let r = el.getBoundingClientRect();
    const rotulo = el.tagName === 'INPUT' && /checkbox|radio/.test(el.type) ? el.closest('label') : null;
    if (rotulo) r = rotulo.getBoundingClientRect();
    if (el.tagName === 'A' && el.closest('p, li') && !el.classList.contains('destino') && !el.closest('.indice')) continue; // ligação no meio de texto
    if (el.tagName === 'INPUT' && el.type === 'text') { if (r.height < ALVO_MIN - 0.5) erros.push(`${ctx}${descr(el)} tem alvo ${Math.round(r.width)}×${Math.round(r.height)} px (< ${ALVO_MIN})`); continue; }
    if (Math.min(r.width, r.height) < ALVO_MIN - 0.5) erros.push(`${ctx}${descr(el)} tem alvo ${Math.round(r.width)}×${Math.round(r.height)} px (< ${ALVO_MIN})`);
  }

  // 3. nomes acessíveis e ids
  for (const el of doc.querySelectorAll('input:not([type=hidden]), select, textarea, button, [role=slider], [role=button]')) {
    if (!visivel(el)) continue;
    if (!nomeAcessivel(el)) erros.push(`${ctx}${descr(el)} sem nome acessível`);
  }
  for (const svg of doc.querySelectorAll('svg[role=img]')) {
    if (visivel(svg) && !(svg.getAttribute('aria-label') || '').trim()) erros.push(`${ctx}svg role=img sem aria-label (${descr(svg.parentElement)})`);
  }
  const vistos = new Set();
  for (const el of doc.querySelectorAll('[id]')) {
    if (vistos.has(el.id)) erros.push(`${ctx}id repetido «${el.id}»`);
    vistos.add(el.id);
  }

  // 4. contraste do texto HTML
  const verificarContraste = (el, cTexto, fundos, tamanho, negrito, etiqueta) => {
    if (!cTexto) return;
    const op = opacidade(el);
    const grande = tamanho >= 24 || (tamanho >= 18.66 && negrito >= 700);
    const minimo = grande ? 3 : 4.5;
    let pior = Infinity;
    for (const f of fundos) {
      const t = sobre({ ...cTexto, a: cTexto.a * op }, f);
      pior = Math.min(pior, razao(t, f));
    }
    if (pior < minimo - 0.01) erros.push(`${ctx}contraste ${pior.toFixed(2)}:1 (< ${minimo}) em ${etiqueta}`);
  };
  const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  const feitos = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.data.trim()) continue;
    const el = n.parentElement;
    if (!el || feitos.has(el)) continue;
    if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(el.tagName)) continue;
    if (el.closest('.katex-mathml, .sr-only, [hidden]') || el.closest('svg')) continue;
    if (!visivel(el) || el.closest('button:disabled, [aria-disabled=true]')) continue;
    feitos.add(el);
    const cs = win.getComputedStyle(el);
    verificarContraste(el, cor(cs.color), fundosHtml(el), parseFloat(cs.fontSize), Number(cs.fontWeight), descr(el));
  }

  // 5. SVG: etiquetas cortadas, sobrepostas, contraste e tamanho
  for (const svg of doc.querySelectorAll('svg')) {
    if (!visivel(svg) || svg.getAttribute('aria-hidden') === 'true' || svg.closest('[hidden]')) continue;
    const sr = svg.getBoundingClientRect();
    if (sr.width === 0) continue;
    const vb = svg.viewBox && svg.viewBox.baseVal;
    const escala = vb && vb.width ? sr.width / vb.width : 1;
    const ts = [...svg.querySelectorAll('text')].filter((t) => visivel(t) && t.textContent.trim());
    const caixas = ts.map((t) => ({ t, r: t.getBoundingClientRect() }));
    const onde = descr(svg.parentElement || svg);
    for (const { t, r } of caixas) {
      const tolerancia = 0.4 * parseFloat(win.getComputedStyle(t).fontSize) * escala; // a caixa do texto é maior do que os glifos
      if (r.left < sr.left - tolerancia || r.right > sr.right + tolerancia || r.top < sr.top - tolerancia || r.bottom > sr.bottom + tolerancia) {
        erros.push(`${ctx}etiqueta cortada «${texto(t).slice(0, 24)}» em ${onde} (caixa ${Math.round(r.left - sr.left)},${Math.round(r.top - sr.top)} a ${Math.round(r.right - sr.left)},${Math.round(r.bottom - sr.top)} em ${Math.round(sr.width)}×${Math.round(sr.height)})`);
      }
      const cs = win.getComputedStyle(t);
      const px = parseFloat(cs.fontSize) * escala;
      if (px < 9.6) avisos.push(`${ctx}etiqueta pequena (${px.toFixed(1)} px) «${texto(t).slice(0, 20)}» em ${onde}`);
      const c = cor(cs.fill);
      const fundos = [0.2, 0.5, 0.8].flatMap((f) => fundosSvg(t, { x: r.left + r.width * f, y: r.top + r.height / 2 }));
      verificarContraste(t, c, fundos, parseFloat(cs.fontSize) * escala, Number(cs.fontWeight), `«${texto(t).slice(0, 20)}» em ${onde}`);
    }
    for (let i = 0; i < caixas.length; i++) {
      for (let j = i + 1; j < caixas.length; j++) {
        const a = caixas[i].r;
        const b = caixas[j].r;
        const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        if (ox > 1.5 && oy > 0.35 * Math.min(a.height, b.height)) erros.push(`${ctx}etiquetas sobrepostas «${texto(caixas[i].t).slice(0, 20)}» e «${texto(caixas[j].t).slice(0, 20)}» em ${onde}`);
      }
    }
  }

  // 6. regras de texto no que o aluno lê
  const tw = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const el = n.parentElement;
    if (!el || ['SCRIPT', 'STYLE'].includes(el.tagName) || el.closest('.katex-mathml')) continue;
    const d = n.data;
    if (TRACOS.test(d)) erros.push(`${ctx}travessão no texto: «${d.trim().slice(0, 40)}»`);
    if (!el.closest('.katex') && /\d\.\d/.test(d.replace(/^\s*\d+\.\d+\.?\s*/, '').replace(/alínea \d+\.\d+/gi, ''))) erros.push(`${ctx}ponto decimal em vez de vírgula: «${d.trim().slice(0, 40)}»`);
    if (!el.closest('.katex') && PTBR.test(d)) erros.push(`${ctx}palavra de pt-BR: «${d.trim().slice(0, 40)}»`);
    if (!el.closest('.katex') && /\b(?:undefined|NaN|null|\[object)/.test(d)) erros.push(`${ctx}valor por preencher no texto: «${d.trim().slice(0, 40)}»`);
  }
  for (const k of doc.querySelectorAll('.katex-error')) erros.push(`${ctx}fórmula com erro: ${texto(k).slice(0, 40)}`);
  for (const a of doc.querySelectorAll('.aviso-erro')) {
    if (a.dataset.esperado === undefined && !a.closest('[aria-live]')) erros.push(`${ctx}aviso de erro visível: ${texto(a).slice(0, 50)}`);
  }


  return { erros, avisos };
}

// ---------- corredor de testes ----------

const MAX_ERROS = new URLSearchParams(location.search).has('todos') ? 400 : 6;

export function criarTestes(titulo) {
  const saida = document.getElementById('resultado');
  const linhas = [];
  let nFalhas = 0;
  let nTestes = 0;
  const t0 = performance.now();
  const avisosGerais = [];

  const api = {
    avisos: avisosGerais,
    async teste(nome, fn) {
      nTestes++;
      const erros = [];
      let total = 0;
      let n = 0;
      const ok = (cond, msg) => {
        n++;
        if (!cond) { total++; if (erros.length < MAX_ERROS) erros.push(msg); }
        return !!cond;
      };
      try {
        await fn(ok);
      } catch (e) {
        total++;
        erros.push('exceção: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
      }
      if (total) {
        nFalhas++;
        linhas.push(`FALHOU ${nome} (${n} comprovações): ${total} problema(s)`);
        for (const e of erros) linhas.push(`    - ${e}`);
        if (total > erros.length) linhas.push(`    ... e mais ${total - erros.length}`);
      } else {
        linhas.push(`ok     ${nome} (${n} comprovações)`);
      }
      saida.textContent = linhas.join('\n') + '\n...';
    },
    fim() {
      for (const a of [...new Set(avisosGerais)].slice(0, 80)) linhas.push(`aviso  ${a}`);
      linhas.push(`${titulo}: ${nTestes} testes, ${nFalhas} falha(s), ${Math.round(performance.now() - t0)} ms`);
      saida.textContent = linhas.join('\n');
      document.documentElement.dataset.testes = nFalhas ? 'falhou' : 'ok';
    },
  };
  return api;
}

/** Atalho: junta os erros da auditoria a `ok` e os avisos à lista geral. */
export function aplicarAuditoria(r, ok, t) {
  ok(true, '');
  for (const e of r.erros) ok(false, e);
  for (const a of r.avisos) t.avisos.push(a);
}
