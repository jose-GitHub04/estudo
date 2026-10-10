// Preenche a circunferência: aparece um ângulo notável e escreves sin, cos e tan.
// Cada campo é corrigido com M.corrigir; as respostas certas vêm da tabela (M.exato).
// Guarda certas, total e a melhor sequência na secção «preencher» do progresso.

import * as M from '../../assets/motor/matematica.js';
import { tex } from '../../assets/motor/katex.js';
import * as progresso from '../../assets/motor/progresso.js';

const FUNCOES = ['sin', 'cos', 'tan'];
const NOME = { sin: 'seno', cos: 'cosseno', tan: 'tangente' };
const TEX_F = { sin: '\\sin', cos: '\\cos', tan: '\\tan' };

// teclas do teclado no ecrã: [texto a inserir ou ação, rótulo visível, nome para leitores de ecrã]
const TECLAS = [
  ['√', '√', 'raiz quadrada'],
  ['π', 'π', 'pi'],
  ['/', '/', 'barra de fração'],
  ['−', '−', 'menos'],
  ['(', '(', 'abre parêntese'],
  [')', ')', 'fecha parêntese'],
  ['apagar', '⌫', 'apagar'],
  ['limpar', 'Limpar', 'limpar o campo'],
];

/** Cria um elemento: h('button', { class: 'x', onclick: fn }, 'texto', outroNo). */
function h(tag, props = {}, ...filhos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : String(v));
  }
  for (const f of filhos.flat(Infinity)) {
    if (f !== null && f !== undefined && f !== false) e.append(f);
  }
  return e;
}

/** Ângulo em graus inteiros -> LaTeX em radianos e em graus. */
const radTex = (graus) => M.fracPiTex(...M.grausEmFracPi(graus));
const grausTex = (graus) => `${graus}^\\circ`;

/** Múltiplos de 30° e de 45° no intervalo do modo. */
function angulosDoModo(modo) {
  const [min, max] = modo === 'dificil' ? [-360, 720] : [0, 360];
  const lista = [];
  for (let g = min; g <= max; g++) if (g % 30 === 0 || g % 45 === 0) lista.push(g);
  return lista;
}

/** 1 se a função é positiva no quadrante q, -1 se negativa (medido num ângulo dentro dele). */
function sinalNoQuadrante(funcao, q) {
  return Math[funcao]((Math.PI / 180) * (37 + 90 * (q - 1))) > 0 ? 1 : -1;
}

/** Pista calculada (HTML): ângulo de referência, quadrante e sinais, ou o eixo em que está. */
function htmlPista(graus) {
  const g = M.normalizarGraus(graus);
  const q = M.quadrante(g);
  const partes = [];
  if (g !== graus) {
    partes.push(`Tirando voltas completas, este ângulo equivale a ${tex(radTex(g))} (${tex(grausTex(g))}).`);
  }
  if (q === 0) {
    const eixo = { 0: 'semieixo positivo Ox', 90: 'semieixo positivo Oy', 180: 'semieixo negativo Ox', 270: 'semieixo negativo Oy' }[g];
    partes.push(`Este ângulo fica sobre o ${eixo}. Lê as coordenadas do ponto ${tex('(\\cos,\\ \\sin)')} na circunferência trigonométrica e lembra-te de que ${tex('\\tan=\\frac{\\sin}{\\cos}')}.`);
  } else {
    const ref = [g, 180 - g, g - 180, 360 - g][q - 1];
    const sinal = (f) => (sinalNoQuadrante(f, q) > 0 ? 'positivo' : 'negativo');
    const sinalTan = sinalNoQuadrante('tan', q) > 0 ? 'positiva' : 'negativa';
    partes.push(`Ângulo de referência: ${tex(grausTex(ref))} (${tex(radTex(ref))}).`);
    partes.push(`Está no ${q}.º quadrante: seno ${sinal('sin')}, cosseno ${sinal('cos')} e tangente ${sinalTan}.`);
  }
  return partes.join(' ');
}

export async function montar(el, dados) {
  const tabela = dados.valores;
  const rng = M.criarRng();
  const uid = Math.random().toString(36).slice(2, 8);

  const guardado = progresso.ler('preencher', {});
  const num = (x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
  const stats = { certas: num(guardado.certas), total: num(guardado.total), melhor: num(guardado.melhor) };
  let sequencia = 0; // sequência atual (só nesta visita)
  let modo = 'normal';
  let graus = 0;
  let finalizada = false;
  let campos = []; // { f, input, fb, esperado, final, aceite }
  let ultimo = null; // último campo focado

  const raiz = h('div', { class: 'widget pre' });
  el.replaceChildren(raiz);

  // ---------- peças fixas ----------

  const chipNormal = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'true', onclick: () => mudarModo('normal') }, 'Normal (0° a 360°)');
  const chipDificil = h('button', { type: 'button', class: 'chip', 'aria-pressed': 'false', onclick: () => mudarModo('dificil') }, 'Difícil (−360° a 720°)');
  const modos = h('div', { class: 'chips pre-modos', role: 'group', 'aria-label': 'Dificuldade' }, chipNormal, chipDificil);

  const angulo = h('p', { class: 'pre-angulo__valor' });
  const blocoAngulo = h('div', { class: 'pre-angulo', 'aria-live': 'polite', 'aria-atomic': 'true' },
    h('p', { class: 'pre-angulo__rotulo' }, 'Ângulo'),
    angulo);

  const linhas = FUNCOES.map((f) => {
    const id = `pre-${uid}-${f}`;
    const input = h('input', {
      type: 'text', id, class: 'campo pre-campo', inputmode: 'text', enterkeyhint: 'go',
      autocomplete: 'off', autocapitalize: 'none', autocorrect: 'off', spellcheck: 'false',
      'aria-describedby': `${id}-fb${f === 'tan' ? ` ${id}-dica` : ''}`,
    });
    const fb = h('div', { class: 'pre-fb', id: `${id}-fb`, 'aria-live': 'polite' });
    const rotulo = h('label', { class: 'pre-rotulo', for: id }, h('span', { 'aria-hidden': 'true' }, f), h('span', { class: 'sr-only' }, NOME[f]));
    const dica = f === 'tan' ? h('p', { class: 'nota pre-dica', id: `${id}-dica` }, 'Escreve n.d. se não estiver definida.') : null;
    input.addEventListener('focus', () => { ultimo = input; });
    input.addEventListener('keydown', (ev) => {
      if (ev.key !== 'Enter') return;
      ev.preventDefault();
      if (finalizada) seguinte(); else verificar();
    });
    const linha = h('div', { class: 'pre-linha' }, rotulo, input, fb, dica);
    return { f, input, fb, linha };
  });
  const blocoCampos = h('div', { class: 'pre-campos' }, linhas.map((l) => l.linha));

  const teclado = h('div', { class: 'pre-teclado', role: 'group', 'aria-label': 'Teclado com símbolos' },
    TECLAS.map(([acao, rotulo, nome]) => {
      const b = h('button', { type: 'button', class: `pre-tecla${acao === 'limpar' ? ' pre-tecla--larga' : ''}`, 'aria-label': nome, onclick: () => tecla(acao) }, rotulo);
      // não deixa o botão roubar o foco ao campo (mantém o teclado do telemóvel aberto)
      b.addEventListener('mousedown', (ev) => ev.preventDefault());
      return b;
    }));

  const botaoVerificar = h('button', { type: 'button', class: 'botao pre-verificar', onclick: verificar }, 'Verificar');
  const botaoSeguinte = h('button', { type: 'button', class: 'botao pre-seguinte', onclick: seguinte, hidden: true }, 'Seguinte');
  const botaoPista = h('button', { type: 'button', class: 'botao botao--suave pre-pista-botao', onclick: pedirPista }, 'Pista');
  const acoes = h('div', { class: 'pre-acoes' }, botaoVerificar, botaoSeguinte, botaoPista);
  const pista = h('div', { class: 'pre-pista', 'aria-live': 'polite' });
  const contadores = h('p', { class: 'pre-contadores' });
  const avisoGuardar = h('p', { class: 'nota', hidden: true }, 'Não consegui guardar o progresso neste dispositivo (por exemplo, numa janela privada). Os contadores só valem enquanto esta página estiver aberta.');

  raiz.append(modos, blocoAngulo, blocoCampos, teclado, acoes, pista, contadores, avisoGuardar);

  // ---------- lógica ----------

  function atualizarContadores() {
    contadores.textContent = `Certas: ${stats.certas} de ${stats.total}. Sequência atual: ${sequencia}. Melhor sequência: ${stats.melhor}.`;
  }

  function mudarModo(novo) {
    modo = novo;
    chipNormal.setAttribute('aria-pressed', String(novo === 'normal'));
    chipDificil.setAttribute('aria-pressed', String(novo === 'dificil'));
    novoAngulo(true);
  }

  function novoAngulo(focar) {
    const lista = angulosDoModo(modo);
    let g = M.escolher(rng, lista);
    for (let i = 0; i < 10 && g === graus; i++) g = M.escolher(rng, lista);
    graus = g;
    finalizada = false;
    angulo.innerHTML = `${tex(radTex(graus) + '\\ \\text{rad}')} <span class="pre-angulo__igual">=</span> ${tex(grausTex(graus))}`;
    pista.replaceChildren();
    botaoVerificar.hidden = false;
    botaoSeguinte.hidden = true;
    campos = linhas.map(({ f, input, fb }) => {
      const ex = M.exato(tabela, graus, f);
      input.value = '';
      input.readOnly = false;
      input.removeAttribute('aria-invalid');
      input.classList.remove('pre-campo--certo', 'pre-campo--errado');
      fb.replaceChildren();
      return { f, input, fb, esperado: ex ? { expr: ex.expr } : { naoDefinida: true }, tex: ex ? ex.tex : null, final: false, aceite: false };
    });
    ultimo = linhas[0].input;
    if (focar) linhas[0].input.focus();
  }

  const msg = (classe, icone, ...resto) => h('p', { class: `pre-fb__msg ${classe}` }, h('span', { class: 'pre-fb__icone', 'aria-hidden': 'true' }, icone), ' ', ...resto);

  /** Corrige um campo e escreve o feedback. Devolve true se o campo ficou fechado (certo ou errado). */
  function corrigirCampo(c) {
    const texto = c.input.value.trim();
    if (texto === '') {
      c.fb.replaceChildren(msg('pre-fb--aviso', '!', 'Escreve uma resposta neste campo.'));
      c.input.setAttribute('aria-invalid', 'true');
      return false;
    }
    const r = M.corrigir(texto, c.esperado);
    c.input.removeAttribute('aria-invalid');
    const valorCerto = c.tex ? h('span', { class: 'pre-fb__tex', html: tex(c.tex) }) : null;
    if (r.estado === 'certo') {
      c.fb.replaceChildren(msg('pre-fb--certo', '✓', h('strong', {}, 'Certo')));
      fechar(c, true);
    } else if (r.estado === 'certo-forma') {
      c.fb.replaceChildren(msg('pre-fb--certo', '✓', h('strong', {}, 'Certo'), ', a forma pedida é ', valorCerto, '.'));
      fechar(c, true);
    } else if (r.estado === 'errado') {
      c.fb.replaceChildren(c.tex
        ? msg('pre-fb--errado', '✗', h('strong', {}, 'Errado'), '. O valor certo é ', valorCerto, '.')
        : msg('pre-fb--errado', '✗', h('strong', {}, 'Errado'), '. Para este ângulo a tangente não está definida, escreve n.d.'));
      c.input.setAttribute('aria-invalid', 'true');
      fechar(c, false);
    } else if (r.estado === 'decimal') {
      c.fb.replaceChildren(msg('pre-fb--aviso', '!', 'Está certo em decimal, escreve a forma exata.'));
      c.input.setAttribute('aria-invalid', 'true');
      return false;
    } else {
      c.fb.replaceChildren(msg('pre-fb--aviso', '!', 'Não consegui ler isto. Usa os botões √ e π, e / para frações.'));
      c.input.setAttribute('aria-invalid', 'true');
      return false;
    }
    return true;
  }

  function fechar(c, aceite) {
    c.final = true;
    c.aceite = aceite;
    c.input.readOnly = true;
    c.input.classList.add(aceite ? 'pre-campo--certo' : 'pre-campo--errado');
  }

  function verificar() {
    if (finalizada) return;
    for (const c of campos) {
      if (!c.final) corrigirCampo(c);
    }
    const pendente = campos.find((c) => !c.final);
    if (pendente) {
      pendente.input.focus();
      return;
    }
    // as três respostas estão fechadas: conta a ronda
    finalizada = true;
    const completo = campos.every((c) => c.aceite);
    stats.total += 1;
    if (completo) {
      stats.certas += 1;
      sequencia += 1;
      stats.melhor = Math.max(stats.melhor, sequencia);
    } else {
      sequencia = 0;
    }
    if (!progresso.guardar('preencher', { certas: stats.certas, total: stats.total, melhor: stats.melhor })) {
      avisoGuardar.hidden = false;
    }
    atualizarContadores();
    botaoVerificar.hidden = true;
    botaoSeguinte.hidden = false;
    botaoSeguinte.focus();
  }

  function seguinte() {
    if (!finalizada) return;
    novoAngulo(true);
  }

  function pedirPista() {
    pista.innerHTML = `<p class="pre-pista__texto"><strong>Pista:</strong> ${htmlPista(graus)}</p>`;
  }

  /** Campo onde as teclas do ecrã escrevem: o que tem o foco, o último focado, ou o primeiro ainda aberto. */
  function campoAtivo() {
    const abertos = campos.filter((c) => !c.final).map((c) => c.input);
    if (abertos.includes(document.activeElement)) return document.activeElement;
    if (ultimo && abertos.includes(ultimo)) return ultimo;
    return abertos[0] || null;
  }

  function tecla(acao) {
    const input = campoAtivo();
    if (!input) return;
    input.focus();
    let ini = input.selectionStart ?? input.value.length;
    let fim = input.selectionEnd ?? input.value.length;
    if (acao === 'limpar') {
      input.value = '';
      ini = fim = 0;
    } else if (acao === 'apagar') {
      if (ini === fim && ini > 0) ini -= 1;
      input.setRangeText('', ini, fim, 'end');
    } else {
      input.setRangeText(acao, ini, fim, 'end');
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  atualizarContadores();
  novoAngulo(false);
}
