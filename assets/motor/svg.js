// Ajudas para desenhar SVG à mão e ler o ponteiro (rato ou toque).

const NS = 'http://www.w3.org/2000/svg';

/** criar('circle', { cx: 0, cy: 0, r: 1 }, [filhos]) -> elemento SVG. Filhos podem ser nós ou texto. */
export function criar(tag, atributos = {}, filhos = []) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(atributos)) {
    if (v !== undefined && v !== null) el.setAttribute(k, String(v));
  }
  for (const f of filhos) el.append(f);
  return el;
}

/** Ponto do evento nas coordenadas do viewBox do svg (já com o y do SVG, para baixo). */
export function pontoDoEvento(svg, evento) {
  const pt = svg.createSVGPoint();
  pt.x = evento.clientX;
  pt.y = evento.clientY;
  const m = svg.getScreenCTM();
  return m ? pt.matrixTransform(m.inverse()) : { x: 0, y: 0 };
}

/**
 * Faz o svg reagir a arrastar (rato, toque, caneta). `aoMover(ponto, evento)` é chamado
 * no pressionar e a cada movimento enquanto estiver premido.
 */
export function arrastar(svg, aoMover) {
  let ativo = false;
  svg.style.touchAction = 'none';
  svg.addEventListener('pointerdown', (e) => {
    ativo = true;
    svg.setPointerCapture(e.pointerId);
    aoMover(pontoDoEvento(svg, e), e);
    e.preventDefault();
  });
  svg.addEventListener('pointermove', (e) => {
    if (ativo) aoMover(pontoDoEvento(svg, e), e);
  });
  const fim = (e) => {
    ativo = false;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
  };
  svg.addEventListener('pointerup', fim);
  svg.addEventListener('pointercancel', fim);
}
