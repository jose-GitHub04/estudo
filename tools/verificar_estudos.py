"""Verificação dos estudos de funções (logaritmos/dados/estudos.json), do widget «Estudo de uma função».

Correr (a partir da raiz do site):
    python -X utf8 -I tools/verificar_estudos.py
    opção: --verbose  (mostra também o que foi confirmado, função a função)

Imprime `FALHA: <função>: <o quê>` por cada problema e sai com código 1 se houver falhas.

O que se confirma, com cálculo independente das contas que estão no texto (só se usa a expressão
`expr` de cada função e as afirmações são confrontadas com números):
  derivadas     `d1` e `d2` (e os LaTeX `d1Tex`, `d2Tex`) contra diferenças finitas de `expr`
  tabelas       os valores de x das tabelas (zeros de f, de f' ou de f'') contra uma busca numérica de
                zeros; os sinais por amostragem de cada intervalo; setas e tags (máx., mín., P.I.) pela
                mudança de sinal; cada valor de f nos pontos críticos (em LaTeX e em expressão) e cada
                limite escrito nas pontas
  pontos        zeros, extremos e inflexões (`elementos`) contra f, f' e f'' numéricas e mudanças de sinal
  assíntotas    cada extremo do domínio é classificado numericamente (vertical, horizontal, oblíqua ou
                nenhuma) e tem de coincidir com as assíntotas e as ausências declaradas
  limites       `resultados.limites` por valores muito grandes ou muito perto da fronteira
  contradomínio varrimento do domínio contra o mínimo, o máximo e os limites declarados
  texto         7 passos, `descobre` e a ordem lógica, $ emparelhados, sem travessões nem pt-BR, cada
                aproximação «≈ 0,37» está em `aprox` com a expressão que a justifica (e arredonda certo),
                as derivadas escritas no texto são as de `d1Tex` e `d2Tex`

Também se usa de dentro de outro script: correr() devolve a lista de falhas.
"""
import json
import math
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FICHEIRO = RAIZ / "logaritmos" / "dados" / "estudos.json"

INF = math.inf
TRAVESSOS = ("\u2014", "\u2013", "\u2015", "\u2012")
PT_BR = ("tela", "arquivo", "você", "voce", "equipe", "ônibus", "celular", "pra ", "gente")
PASSOS = 7
CHAVES_PASSO = {"texto", "resumo", "legenda", "descobre", "tabela", "depois", "cuidado"}
TAGS = {"max": "máx.", "min": "mín.", "pi": "P.I."}
PAPEL_PASSO = {"zero": 2, "maximo": 4, "minimo": 4, "inflexao": 5}  # passo (1 a 7) em que aparece cada coisa
PASSO_ASSINTOTA = 6

_falhas = []
_confirmado = []
_nome = ["?"]


def falha(msg):
    linha = f"{_nome[0]}: {msg}"
    _falhas.append(linha)
    print("FALHA:", linha)


def ok(msg):
    _confirmado.append(f"{_nome[0]}: {msg}")


# ======================================================================================
# Expressões: Python (expr dos dados) e LaTeX (o que o aluno lê)
# ======================================================================================
ESPACO = {"e": math.e, "pi": math.pi, "ln": math.log, "log": math.log10, "exp": math.exp,
          "sqrt": math.sqrt, "abs": abs}


def compilar(expr):
    """x => número (ou None fora do domínio ou se transborda). A sintaxe é a do avaliador do site."""
    py = expr.replace("^", "**")
    codigo = compile(py, "<expr>", "eval")

    def f(x):
        try:
            v = eval(codigo, {"__builtins__": {}}, {**ESPACO, "x": x})
        except (ValueError, ZeroDivisionError, OverflowError):
            return None
        if isinstance(v, complex) or not math.isfinite(v):
            return None
        return float(v)
    return f


def num(texto):
    """'+inf', '-inf', '1/e', 'ln(2)'... -> float."""
    t = str(texto).strip()
    if t == "+inf":
        return INF
    if t == "-inf":
        return -INF
    return float(eval(t.replace("^", "**"), {"__builtins__": {}}, dict(ESPACO)))


_TOK = re.compile(r"\\(?:dfrac|tfrac|frac|sqrt|ln|times|cdot|left|right|pi|,|;|!| )|\d+(?:\{,\}\d+)?|\d+\.\d+|[ex]|[-+*/^(){}]")


def tex_para_num(tex, x=None):
    """Lê o LaTeX restrito que usamos (frações, \\ln, e^{...}, potências, \\sqrt) e calcula-o.
    Levanta ValueError se não o conseguir ler (assim um erro de escrita não passa em silêncio)."""
    resto = tex
    toks = []
    while resto:
        resto = resto.lstrip()
        if not resto:
            break
        m = _TOK.match(resto)
        if not m:
            raise ValueError(f"não sei ler {resto[:12]!r} em {tex!r}")
        t = m.group(0)
        resto = resto[m.end():]
        if t in ("\\left", "\\right", "\\,", "\\;", "\\!", "\\ "):
            continue
        toks.append(t)
    pos = [0]

    def ver():
        return toks[pos[0]] if pos[0] < len(toks) else None

    def tirar():
        t = toks[pos[0]]
        pos[0] += 1
        return t

    def comeca_atomo(t):
        return t is not None and (re.match(r"\d", t) or t in ("e", "x", "(", "{", "\\pi", "\\ln", "\\sqrt", "\\dfrac", "\\tfrac", "\\frac"))

    def expr():
        esq = termo()
        while ver() in ("+", "-"):
            op = tirar()
            esq = f"({esq}{op}{termo()})"
        return esq

    def termo():
        esq = unario()
        while True:
            t = ver()
            if t in ("*", "\\times", "\\cdot"):
                tirar()
                esq = f"({esq}*{unario()})"
            elif t == "/":
                tirar()
                esq = f"({esq}/{unario()})"
            elif comeca_atomo(t):
                esq = f"({esq}*{potencia()})"
            else:
                return esq

    def unario():
        if ver() == "-":
            tirar()
            return f"(-{unario()})"
        if ver() == "+":
            tirar()
            return unario()
        return potencia()

    def potencia():
        base = atomo()
        if ver() == "^":
            tirar()
            return f"({base}**{atomo()})"
        return base

    def grupo():
        if ver() != "{":
            raise ValueError(f"esperava {{ em {tex!r}")
        tirar()
        v = expr()
        if ver() != "}":
            raise ValueError(f"esperava }} em {tex!r}")
        tirar()
        return v

    def atomo():
        t = ver()
        if t is None:
            raise ValueError(f"expressão incompleta: {tex!r}")
        tirar()
        if re.match(r"\d", t):
            return t.replace("{,}", ".")
        if t == "e":
            return "e"
        if t == "x":
            return "x"
        if t == "\\pi":
            return "pi"
        if t == "\\ln":
            return f"ln({potencia()})"
        if t == "\\sqrt":
            return f"sqrt({grupo()})"
        if t in ("\\dfrac", "\\tfrac", "\\frac"):
            a = grupo()
            b = grupo()
            return f"(({a})/({b}))"
        if t == "(":
            v = expr()
            if ver() != ")":
                raise ValueError(f"esperava ) em {tex!r}")
            tirar()
            return f"({v})"
        if t == "{":
            pos[0] -= 1
            return grupo()
        raise ValueError(f"símbolo inesperado {t!r} em {tex!r}")

    py = expr()
    if pos[0] != len(toks):
        raise ValueError(f"sobrou {toks[pos[0]:]} em {tex!r}")
    return float(eval(py, {"__builtins__": {}}, {**ESPACO, "x": x}))


def perto(a, b, rel=1e-9, ab=1e-12):
    if math.isinf(a) or math.isinf(b):
        return a == b
    return abs(a - b) <= max(ab, rel * max(abs(a), abs(b)))


# ======================================================================================
# Cálculo numérico independente
# ======================================================================================
def _passo(f, x, h):
    while h > 1e-12 and (f(x - h) is None or f(x + h) is None):
        h /= 2
    return h


def der1(f, x):
    """f'(x) por diferença central com extrapolação de Richardson."""
    h = _passo(f, x, min(1e-3 * max(abs(x), 0.5), abs(x) / 8 or 1))

    def d(p):
        a, b = f(x + p), f(x - p)
        return None if a is None or b is None else (a - b) / (2 * p)
    d1, d2 = d(h), d(h / 2)
    return None if d1 is None or d2 is None else (4 * d2 - d1) / 3


def der2(f, x):
    """f''(x) por diferença central de segunda ordem com extrapolação de Richardson."""
    h = _passo(f, x, min(4e-3 * max(abs(x), 0.5), abs(x) / 8 or 1))
    c = f(x)

    def d(p):
        a, b = f(x + p), f(x - p)
        return None if a is None or b is None or c is None else (a - 2 * c + b) / (p * p)
    d1, d2 = d(h), d(h / 2)
    return None if d1 is None or d2 is None else (4 * d2 - d1) / 3


def grelha(lo, hi, n=6000, caudas=False):
    """Pontos do interior do domínio (lo, hi) (pode ser ±inf): linear num intervalo moderado, mais densa
    junto de uma fronteira finita em 0 e, com caudas=True, com pontos muito afastados (para o varrimento)."""
    a = lo if math.isfinite(lo) else (hi - 25 if math.isfinite(hi) else -25.0)
    b = hi if math.isfinite(hi) else (lo + 25 if math.isfinite(lo) else 25.0)
    pts = [a + (b - a) * i / n for i in range(n + 1)]
    if lo == 0.0:
        pts += [10 ** (-6 + 6 * i / 600) for i in range(601)]
        if caudas:
            pts += [10 ** (-12 + 6 * i / 60) for i in range(61)]
    if caudas:
        for k in range(2, 8):
            if hi == INF:
                pts.append(10.0 ** k)
            if lo == -INF:
                pts.append(-(10.0 ** k))
    return sorted(set(p for p in pts if lo < p < hi))


def zeros_de(g, lo, hi):
    """Zeros de g em (lo, hi): mudanças de sinal numa grelha (um zero exato na grelha também conta), afinadas por bisseção."""
    ultimo = None  # (x, sinal) do último ponto com sinal diferente de zero
    raizes = []
    for x in grelha(lo, hi):
        v = g(x)
        if v is None:
            ultimo = None
            continue
        s = 0 if v == 0 else (1 if v > 0 else -1)
        if s == 0:
            raizes.append(x)
            continue
        if ultimo is not None and ultimo[1] != s:
            a, b, ga = ultimo[0], x, ultimo[1]
            for _ in range(200):
                m = (a + b) / 2
                gm = g(m)
                if gm is None or gm == 0:
                    break
                if (gm > 0) == (ga > 0):
                    a = m
                else:
                    b = m
            raizes.append((a + b) / 2)
        ultimo = (x, s)
    # um zero exato na grelha entre dois sinais iguais (raiz dupla) não conta como mudança de sinal
    limpas = []
    for r in raizes:
        if not limpas or abs(r - limpas[-1]) > 1e-9:
            limpas.append(r)
    return limpas


def amostras_intervalo(a, b, n=25):
    """Pontos no interior de (a, b), longe das pontas, para testar o sinal. Aceita ±inf."""
    ae = a if math.isfinite(a) else (b - 25 if math.isfinite(b) else -25.0)
    be = b if math.isfinite(b) else (a + 25 if math.isfinite(a) else 25.0)
    larg = be - ae
    pts = [ae + larg * (0.04 + 0.92 * i / (n - 1)) for i in range(n)]
    if a == 0.0:  # junto da fronteira do domínio, onde as coisas mudam depressa
        pts += [min(0.02, larg / 10), min(0.1, larg / 5)]
    return [p for p in pts if a < p < b]


def sinal(v, tol=1e-9):
    return None if v is None else (1 if v > tol else -1 if v < -tol else 0)


SEQ_INF = [10, 30, 100, 300, 1e3, 1e4, 1e5, 1e6, 1e7]
SEQ_ZERO = [1e-2, 1e-3, 1e-4, 1e-6, 1e-8, 1e-10]


def limite(f, onde):
    """onde: '+inf', '-inf', ('dir', c) ou ('esq', c). Devolve +inf, -inf ou um número (None se não deu)."""
    if onde == "+inf":
        xs = SEQ_INF
    elif onde == "-inf":
        xs = [-v for v in SEQ_INF]
    else:
        lado, c = onde
        xs = [c + v if lado == "dir" else c - v for v in SEQ_ZERO]
    vs = [(x, f(x)) for x in xs]
    vs = [(x, v) for x, v in vs if v is not None]
    if len(vs) < 4:
        return None
    v1, v2, v3 = vs[-3][1], vs[-2][1], vs[-1][1]
    d_ant, d_ult = abs(v2 - v1), abs(v3 - v2)
    escala = max(1.0, abs(v3))
    if d_ult <= 1e-3 * escala and d_ult <= d_ant and abs(v3) < 1e6:
        return v3  # converge para um número (as diferenças encolhem)
    # diverge: o módulo cresce sem parar (também o faz devagar, como um logaritmo) e já vai alto
    if abs(v3) > abs(v2) > abs(v1) and abs(v3) > 10 and (v3 > 0) == (v2 > 0) == (v1 > 0):
        return INF if v3 > 0 else -INF
    return None


def classificar_ponta(f, onde):
    """Classifica o comportamento numa ponta infinita: ('horizontal', y), ('obliqua', m, b) ou ('nenhuma', 'm'|'b')."""
    L = limite(f, onde)
    if L is None:
        return ("indecidido",)
    if math.isfinite(L):
        return ("horizontal", round(L, 4) + 0.0)
    sinal_x = 1 if onde == "+inf" else -1
    xs = [sinal_x * v for v in SEQ_INF]
    pts = [(x, f(x)) for x in xs]
    pts = [(x, v) for x, v in pts if v is not None]
    (x1, v1), (x2, v2) = pts[-2], pts[-1]
    r1, r2 = v1 / x1, v2 / x2
    if abs(r2) > 1e3 and abs(r2) > abs(r1) * 1.5:
        return ("nenhuma", "m")
    m = round(r2, 3) + 0.0
    d1, d2 = v1 - m * x1, v2 - m * x2
    if abs(d2 - d1) <= 1e-3 * max(1.0, abs(d2)) and abs(d2) < 1e6:
        return ("obliqua", m, round(d2, 3) + 0.0)
    return ("nenhuma", "b")


# ======================================================================================
# Verificações por função
# ======================================================================================
def texto_sem_formulas(s):
    return re.sub(r"\$\$[\s\S]+?\$\$|\$[^$]+?\$", " ", s)


def textos_da_funcao(F):
    """Todos os textos que o aluno lê (para as verificações de texto), com um nome para a mensagem."""
    for i, p in enumerate(F["passos"], 1):
        for campo in ("texto", "resumo", "legenda", "depois", "cuidado"):
            if campo in p:
                yield f"passo {i}, {campo}", p[campo]
        t = p.get("tabela")
        if t:
            yield f"passo {i}, legenda da tabela", t.get("legenda", "")
    yield "chip", F["chip"]
    yield "ler", F["ler"]


def verificar_texto(F, roteiro):
    aprox_decl = {}
    for a in F.get("aprox", []):
        aprox_decl[a["texto"]] = a["expr"]
        casas = len(a["texto"].split(",")[1]) if "," in a["texto"] else 0
        v = num(a["expr"])
        esperado = f"{v:.{casas}f}".replace(".", ",")
        if esperado != a["texto"]:
            falha(f"aprox: {a['expr']} = {v} arredonda para {esperado}, não para {a['texto']}")
    usados = set()
    for onde, s in list(textos_da_funcao(F)) + [(f"roteiro {i + 1}", r["titulo"] + " " + r["porque"]) for i, r in enumerate(roteiro)]:
        for t in TRAVESSOS:
            if t in s:
                falha(f"{onde}: travessão U+{ord(t):04X}")
        baixo = s.lower()
        for p in PT_BR:
            if re.search(r"\b" + re.escape(p.strip()) + (r"\b" if p.endswith(" ") else r"\b"), baixo):
                falha(f"{onde}: possível pt-BR ({p.strip()!r})")
        if s.count("$") % 2:
            falha(f"{onde}: $ desemparelhados")
        fora = texto_sem_formulas(s)
        if "&" in fora:
            falha(f"{onde}: «&» fora de fórmulas (escapa como &amp;)")
        for m in re.finditer(r"<(/?)([a-zA-Z0-9]*)", fora):
            if m.group(2).lower() not in ("p", "strong", "em", "br", "ul", "li", "sup", "sub"):
                falha(f"{onde}: «<» que não é uma etiqueta conhecida: {fora[max(0, m.start() - 10):m.start() + 20]!r}")
        for m in re.finditer(r"(?:\\approx\s*|≈\s*)(-?\d+(?:\{,\}|,)\d+)", s):
            t = m.group(1).replace("{,}", ",")
            usados.add(t)
            if t not in aprox_decl:
                falha(f"{onde}: aproximação {t} sem entrada em `aprox` (diz que expressão a justifica)")
        # fórmulas que nunca deviam ter ponto decimal
        for m in re.finditer(r"\$[^$]*?\d\.\d[^$]*?\$", s):
            falha(f"{onde}: ponto decimal numa fórmula (usa 0{{,}}37): {m.group(0)[:40]!r}")
    for t in aprox_decl:
        if t not in usados:
            falha(f"aprox {t} declarado mas não usado em nenhum texto")
    ok(f"texto: {len(usados)} aproximações conferidas, sem travessões nem pt-BR")


def verificar_derivadas(F, f, d1py, d2py, xs_teste):
    for nome, dpy, dtex, der in (("d1", d1py, F["d1Tex"], der1), ("d2", d2py, F["d2Tex"], der2)):
        for x in xs_teste:
            ref = der(f, x)
            if ref is None:
                continue
            a = dpy(x)
            b = tex_para_num(dtex, x)
            tol = 1e-5 * max(1.0, abs(ref))
            if a is None or abs(a - ref) > tol:
                falha(f"{nome} ({F[nome]}) difere da diferença finita em x={x:.4f}: {a} contra {ref}")
                break
            if abs(b - ref) > tol:
                falha(f"{nome}Tex ({dtex}) difere da diferença finita em x={x:.4f}: {b} contra {ref}")
                break
        else:
            ok(f"{nome} = {F[nome]} e {dtex} coincidem com as diferenças finitas")


def intervalos_do_dominio(f, dom):
    lo, hi = num(dom["min"]), num(dom["max"])
    return lo, hi


def verificar_dominio(F, f):
    dom = F["resultados"]["dominio"]
    lo, hi = num(dom["min"]), num(dom["max"])
    # dentro do domínio f existe
    for x in amostras_intervalo(lo, hi, 40):
        if f(x) is None:
            falha(f"f({x}) não existe mas devia (domínio {dom})")
            return lo, hi
    # fora do domínio, não
    if math.isfinite(lo):
        for x in (lo, lo - 1e-6, lo - 1, lo - 10):
            if f(x) is not None:
                falha(f"f({x}) existe mas está fora do domínio declarado")
        if f(lo + 1e-9) is None:
            falha("f não existe imediatamente à direita da fronteira do domínio")
    ok(f"domínio ]{dom['min']}, {dom['max']}[ confirmado")
    return lo, hi


def verificar_tabela(F, f, lo, hi, n_passo, tab, final):
    """Confere uma tabela contra a derivada certa. n_passo: 1 a 7."""
    tipo = tab["tipo"]
    xs_d = tab["x"]
    sinais = tab["sinais"]
    vals = tab["valores"]
    if len(xs_d) < 2 or len(sinais) != len(xs_d) - 1 or len(vals) != len(xs_d):
        falha(f"passo {n_passo}: tabela com tamanhos incoerentes (x={len(xs_d)}, sinais={len(sinais)}, valores={len(vals)})")
        return
    esperado_tipo = {2: "sinal", 3: "variacao", 5: "concavidade", 7: "variacao"}
    if esperado_tipo.get(n_passo) != tipo:
        falha(f"passo {n_passo}: tabela do tipo {tipo!r} (esperava {esperado_tipo.get(n_passo)!r})")
    if tipo == "sinal":
        g, g1 = f, None
    elif tipo == "variacao":
        g = lambda x: der1(f, x)
    else:
        g = lambda x: der2(f, x)
    xv = []
    for k, c in enumerate(xs_d):
        v = num(c["v"])
        xv.append(v)
        try:
            t = tex_para_num(c["tex"]) if (math.isfinite(v)) else None
        except ValueError as exc:
            falha(f"passo {n_passo}: x[{k}]: {exc}")
            continue
        if t is not None and not perto(t, v, 1e-12):
            falha(f"passo {n_passo}: x[{k}]: o LaTeX {c['tex']!r} dá {t} mas `v` dá {v}")
        if not math.isfinite(v):
            esperado = r"+\infty" if v > 0 else r"-\infty"
            if c["tex"] != esperado:
                falha(f"passo {n_passo}: x[{k}]: {c['tex']!r} devia ser {esperado!r}")
    if any(b <= a for a, b in zip(xv, xv[1:])):
        falha(f"passo {n_passo}: valores de x da tabela não estão por ordem crescente")
    if not (perto(xv[0], lo) and perto(xv[-1], hi)):
        falha(f"passo {n_passo}: a tabela tem de cobrir todo o domínio ({xv[0]} a {xv[-1]} em vez de {lo} a {hi})")
    # zeros interiores = zeros numéricos de g
    interior = xv[1:-1]
    numericos = zeros_de(g, lo, hi)
    if len(numericos) != len(interior) or any(not perto(a, b, 1e-7, 1e-7) for a, b in zip(sorted(numericos), interior)):
        falha(f"passo {n_passo}: pontos críticos da tabela {interior} contra zeros numéricos {numericos}")
    # sinais por amostragem
    for k, s in enumerate(sinais):
        if s not in ("+", "-"):
            falha(f"passo {n_passo}: sinal {s!r} inválido")
            continue
        esperado = 1 if s == "+" else -1
        pts = amostras_intervalo(xv[k], xv[k + 1])
        incoerentes = [p for p in pts if sinal(g(p), 1e-12) != esperado]
        if incoerentes:
            falha(f"passo {n_passo}: sinal {s} no intervalo {k + 1} mas g({incoerentes[0]:.4f}) = {g(incoerentes[0])}")
    # valores nos pontos críticos e nas pontas
    for k, c in enumerate(vals):
        interior_k = 0 < k < len(xv) - 1
        x = xv[k]
        if interior_k:
            if tipo == "sinal":
                if c is not None:
                    falha(f"passo {n_passo}: na tabela de sinal os valores são todos null")
                continue
            if c is None:
                falha(f"passo {n_passo}: falta o valor de f em x={x}")
                continue
            fx = f(x)
            if "limite" in c:
                falha(f"passo {n_passo}: `limite` num ponto interior")
                continue
            vexpr = num(c["v"])
            if fx is None or not perto(vexpr, fx, 1e-9, 1e-12):
                falha(f"passo {n_passo}: valor `v`={c['v']} ({vexpr}) mas f({x}) = {fx}")
            try:
                vtex = tex_para_num(c["tex"])
            except ValueError as exc:
                falha(f"passo {n_passo}: {exc}")
                continue
            if not perto(vtex, fx, 1e-9, 1e-12):
                falha(f"passo {n_passo}: o LaTeX {c['tex']!r} dá {vtex} mas f({x}) = {fx}")
            tag = c.get("tag")
            esq, dir_ = sinais[k - 1], sinais[k]
            if tipo == "variacao":
                certo = "max" if (esq, dir_) == ("+", "-") else "min" if (esq, dir_) == ("-", "+") else None
            else:
                certo = "pi" if esq != dir_ else None
            if tag != certo:
                falha(f"passo {n_passo}: x={x}: tag {tag!r} mas os sinais {esq}{dir_} dão {certo!r}")
        else:
            if final and tipo == "variacao":
                if c is None or "limite" not in c:
                    falha(f"passo {n_passo}: a tabela final tem de trazer o limite na ponta {k}")
                    continue
                onde = "+inf" if (x == INF) else "-inf" if (x == -INF) else (("dir", x) if k == 0 else ("esq", x))
                L = limite(f, onde)
                claim = num(c["limite"])
                if L is None or not (L == claim or (math.isfinite(L) and math.isfinite(claim) and abs(L - claim) < 1e-4)):
                    falha(f"passo {n_passo}: limite escrito {c['limite']} mas o cálculo numérico dá {L}")
                esperado_tex = {INF: r"+\infty", -INF: r"-\infty"}.get(claim)
                if esperado_tex and c["tex"] != esperado_tex:
                    falha(f"passo {n_passo}: limite {c['tex']!r} devia ser {esperado_tex!r}")
                if not esperado_tex:
                    try:
                        if not perto(tex_para_num(c["tex"]), claim, 1e-9, 1e-9):
                            falha(f"passo {n_passo}: limite {c['tex']!r} não é {claim}")
                    except ValueError as exc:
                        falha(f"passo {n_passo}: {exc}")
            elif c is not None:
                falha(f"passo {n_passo}: valores das pontas têm de ser null fora da tabela final")
    # se é a tabela final, a monotonia tem de bater certo com os limites: cada ramo vai de um valor ao outro
    ok(f"passo {n_passo}: tabela de {tipo} com {len(sinais)} intervalos confirmada")
    return xv


def verificar_elementos(F, f):
    j = F["janela"]
    for nome, e in F["elementos"].items():
        if e["tipo"] == "ponto":
            x, y = num(e["x"]), num(e["y"])
            fx = f(x)
            if fx is None or not perto(y, fx, 1e-9, 1e-12):
                falha(f"elemento {nome}: y={e['y']} ({y}) mas f({x}) = {fx}")
            papel = e["papel"]
            if papel == "zero":
                if abs(y) > 1e-12 or abs(fx) > 1e-9:
                    falha(f"elemento {nome}: zero com f = {fx}")
                a, b = f(x - 1e-3), f(x + 1e-3)
                if a is None or b is None or a * b >= 0:
                    falha(f"elemento {nome}: f não muda de sinal em {x}")
            elif papel in ("maximo", "minimo"):
                d = der1(f, x)
                if d is None or abs(d) > 1e-6:
                    falha(f"elemento {nome}: f'({x}) = {d}, devia ser 0")
                a, b = der1(f, x - 1e-3), der1(f, x + 1e-3)
                if a is None or b is None or (a > 0, b < 0) != ((papel == "maximo"), (papel == "maximo")):
                    falha(f"elemento {nome}: f' não muda de sinal como num {papel} ({a}, {b})")
                for dx in (-0.2, -0.05, 0.05, 0.2):
                    v = f(x + dx)
                    if v is not None and ((papel == "maximo" and v > fx) or (papel == "minimo" and v < fx)):
                        falha(f"elemento {nome}: f({x + dx}) = {v} passa o {papel} {fx}")
            elif papel == "inflexao":
                d = der2(f, x)
                if d is None or abs(d) > 1e-5:
                    falha(f"elemento {nome}: f''({x}) = {d}, devia ser 0")
                a, b = der2(f, x - 1e-2), der2(f, x + 1e-2)
                if a is None or b is None or a * b >= 0:
                    falha(f"elemento {nome}: f'' não muda de sinal em {x}")
            else:
                falha(f"elemento {nome}: papel {papel!r} desconhecido")
            if not (j["x"][0] <= x <= j["x"][1] and j["y"][0] <= y <= j["y"][1]):
                falha(f"elemento {nome}: ponto ({x}, {y}) fora da janela {j}")
        elif e["tipo"] == "assintota":
            o = e["orientacao"]
            if o == "vertical":
                x = num(e["x"])
                lado = e.get("sentido", "dir")
                L = limite(f, (lado, x))
                if L not in (INF, -INF):
                    falha(f"elemento {nome}: limite lateral em {x} dá {L}, não é infinito")
                if not (j["x"][0] <= x <= j["x"][1]):
                    falha(f"elemento {nome}: x={x} fora da janela")
            elif o == "horizontal":
                y = num(e["y"])
                L = limite(f, e["sentido"])
                if L is None or not math.isfinite(L) or abs(L - y) > 1e-4:
                    falha(f"elemento {nome}: limite em {e['sentido']} dá {L}, não {y}")
                if not (j["y"][0] <= y <= j["y"][1]):
                    falha(f"elemento {nome}: y={y} fora da janela")
            elif o == "obliqua":
                m, b = num(e["m"]), num(e["b"])
                c = classificar_ponta(f, e["sentido"])
                if c[0] != "obliqua" or abs(c[1] - m) > 1e-3 or abs(c[2] - b) > 1e-3:
                    falha(f"elemento {nome}: a classificação numérica dá {c}, não obliqua m={m} b={b}")
            else:
                falha(f"elemento {nome}: orientação {o!r} desconhecida")
        else:
            falha(f"elemento {nome}: tipo {e['tipo']!r} desconhecido")
    ok(f"{len(F['elementos'])} elementos gráficos confirmados")


def verificar_assintotas_completas(F, f, lo, hi):
    """Classifica cada extremo do domínio numericamente e compara com o que está declarado."""
    decl = set()
    for e in F["elementos"].values():
        if e["tipo"] != "assintota":
            continue
        if e["orientacao"] == "vertical":
            decl.add(("vertical", num(e["x"])))
        elif e["orientacao"] == "horizontal":
            decl.add(("horizontal", e["sentido"], round(num(e["y"]), 4) + 0.0))
        else:
            decl.add(("obliqua", e["sentido"], num(e["m"]), num(e["b"])))
    sem = set()
    for s in F["resultados"].get("sem", []):
        sem.add((s["tipo"], s["sentido"], s["motivo"]))
    achado, achado_sem = set(), set()
    for onde, x in (("-inf", lo), ("+inf", hi)):
        if math.isinf(x):
            c = classificar_ponta(f, onde)
            if c[0] == "horizontal":
                achado.add(("horizontal", onde, c[1]))
            elif c[0] == "obliqua":
                achado.add(("obliqua", onde, c[1], c[2]))
            elif c[0] == "nenhuma":
                achado_sem.add(("obliqua", onde, c[1]))
            else:
                falha(f"não consegui classificar o comportamento em {onde}")
        else:
            L = limite(f, ("dir", x) if onde == "-inf" else ("esq", x))
            if L in (INF, -INF):
                achado.add(("vertical", x))
    if decl != achado:
        falha(f"assíntotas declaradas {sorted(map(str, decl))} contra as calculadas {sorted(map(str, achado))}")
    # as ausências só valem onde não há assíntota (horizontal exclui oblíqua do mesmo lado)
    if sem != achado_sem:
        falha(f"ausências declaradas {sorted(sem)} contra as calculadas {sorted(achado_sem)}")
    ok("assíntotas (e ausências) coincidem com a classificação numérica das pontas")


def verificar_limites(F, f):
    for l in F["resultados"]["limites"]:
        em = l["em"]
        onde = em if em in ("+inf", "-inf") else ("dir", float(em[:-1])) if em.endswith("+") else ("esq", float(em[:-1]))
        L = limite(f, onde)
        claim = num(l["valor"])
        if L is None or not (L == claim or (math.isfinite(L) and math.isfinite(claim) and abs(L - claim) < 1e-4)):
            falha(f"limite em {em}: declarado {l['valor']} mas o cálculo dá {L}")
    ok(f"{len(F['resultados']['limites'])} limites confirmados por valores grandes")


def verificar_contradominio(F, f, lo, hi, criticos):
    c = F["resultados"]["contradominio"]
    pts = list(grelha(lo, hi, 20000, caudas=True)) + list(criticos)
    vs = [f(x) for x in pts]
    vs = [v for v in vs if v is not None]
    mn, mx = min(vs), max(vs)
    for lado, valor, incl in (("inf", mn, c.get("infIncl")), ("sup", mx, c.get("supIncl"))):
        decl = num(c[lado])
        if math.isinf(decl):
            if (lado == "inf" and valor > -1e3) or (lado == "sup" and valor < 1e3):
                falha(f"contradomínio: {lado} declarado infinito mas o varrimento só chega a {valor}")
        else:
            if not incl:
                falha(f"contradomínio: limite finito {lado} tem de ser incluído (`{lado}Incl`) neste verificador")
            if abs(valor - decl) > 1e-9:
                falha(f"contradomínio: {lado} declarado {decl} mas o varrimento dá {valor}")
    ok(f"contradomínio {c['tex']} confirmado por varrimento ({len(vs)} pontos)")


def verificar_ordem_passos(F):
    ps = F["passos"]
    if len(ps) != PASSOS:
        falha(f"tem {len(ps)} passos, devia ter {PASSOS}")
        return
    vistos = set()
    for i, p in enumerate(ps, 1):
        extra = set(p) - CHAVES_PASSO
        if extra:
            falha(f"passo {i}: chaves desconhecidas {sorted(extra)}")
        for chave in ("texto", "resumo", "legenda"):
            if not p.get(chave, "").strip():
                falha(f"passo {i}: falta `{chave}`")
        for nome in p["descobre"]:
            e = F["elementos"].get(nome)
            if e is None:
                falha(f"passo {i}: `descobre` refere {nome!r} que não existe")
                continue
            if nome in vistos:
                falha(f"passo {i}: {nome!r} aparece em dois passos")
            vistos.add(nome)
            esperado = PASSO_ASSINTOTA if e["tipo"] == "assintota" else PAPEL_PASSO[e["papel"]]
            if esperado != i:
                falha(f"passo {i}: {nome!r} ({e.get('papel', e['tipo'])}) devia aparecer no passo {esperado}")
        if p.get("tabela") and i not in (2, 3, 5, 7):
            falha(f"passo {i}: tabela num passo que não a leva")
        if i in (3, 5, 7) and not p.get("tabela"):
            falha(f"passo {i}: falta a tabela")
    for nome in F["elementos"]:
        if nome not in vistos:
            falha(f"elemento {nome!r} nunca é descoberto")
    if F["d1Tex"] not in ps[2]["texto"]:
        falha("o passo 3 não escreve a derivada d1Tex tal como está nos dados")
    if F["d2Tex"] not in ps[4]["texto"]:
        falha("o passo 5 não escreve a derivada d2Tex tal como está nos dados")
    # passo 3 e 4: o extremo escrito na tabela é o do elemento
    ok("7 passos, `descobre` pela ordem certa, derivadas do texto iguais às dos dados")


def verificar_funcao(F, roteiro):
    _nome[0] = F["id"]
    f = compilar(F["expr"])
    d1py, d2py = compilar(F["d1"]), compilar(F["d2"])
    lo, hi = verificar_dominio(F, f)
    cur = F["cursor"]
    xs_teste = [cur["min"] + (cur["max"] - cur["min"]) * i / 39 for i in range(40)]
    xs_teste = [x for x in xs_teste if lo < x < hi]
    verificar_derivadas(F, f, d1py, d2py, xs_teste)
    # janela e cursor
    j = F["janela"]
    for x in (cur["min"], cur["x0"], cur["max"]):
        v = f(x)
        if v is None or not (j["y"][0] <= v <= j["y"][1]) or not (j["x"][0] <= x <= j["x"][1]):
            falha(f"cursor: f({x}) = {v} fora da janela {j}")
    for fx in F.get("faixas", []):
        if not (math.isfinite(lo) and perto(fx["ate"], lo) and fx["de"] <= j["x"][0] + 1e-9):
            falha(f"faixa {fx} não é a zona fora do domínio ({lo})")
    if math.isfinite(lo) and not F.get("faixas"):
        falha("domínio com fronteira finita mas sem `faixas` a mostrar a zona fora do domínio")
    verificar_ordem_passos(F)
    # zeros declarados contra zeros numéricos e contra os elementos
    zs = sorted(num(z) for z in F["resultados"]["zeros"])
    zn = sorted(zeros_de(f, lo, hi))
    if len(zs) != len(zn) or any(not perto(a, b, 1e-7, 1e-7) for a, b in zip(zs, zn)):
        falha(f"zeros declarados {zs} contra zeros numéricos {zn}")
    ze = sorted(num(e["x"]) for e in F["elementos"].values() if e["tipo"] == "ponto" and e["papel"] == "zero")
    if ze != zs:
        falha(f"os pontos de zero dos elementos {ze} não são os zeros declarados {zs}")
    # tabelas
    ps = F["passos"]
    tabelas = {}
    for i, p in enumerate(ps, 1):
        if p.get("tabela"):
            tabelas[i] = verificar_tabela(F, f, lo, hi, i, p["tabela"], final=(i == 7))
    # pontos críticos das tabelas coincidem com os elementos
    crit = [num(e["x"]) for e in F["elementos"].values() if e["tipo"] == "ponto" and e["papel"] in ("maximo", "minimo")]
    if 3 in tabelas and tabelas[3] and not zs:
        pass
    if 3 in tabelas and tabelas[3]:
        t3 = sorted(tabelas[3][1:-1])
        if len(t3) != len(crit) or any(not perto(a, b, 1e-9, 1e-9) for a, b in zip(t3, sorted(crit))):
            falha(f"extremos nos elementos {sorted(crit)} contra os pontos críticos da tabela {t3}")
    infl = sorted(num(e["x"]) for e in F["elementos"].values() if e["tipo"] == "ponto" and e["papel"] == "inflexao")
    if 5 in tabelas and tabelas[5]:
        t5 = sorted(tabelas[5][1:-1])
        if len(t5) != len(infl) or any(not perto(a, b, 1e-9, 1e-9) for a, b in zip(t5, infl)):
            falha(f"inflexões nos elementos {infl} contra a tabela {t5}")
    # a tabela do passo 7 repete a do passo 3 (mesmos pontos, mesmos sinais)
    if 3 in tabelas and 7 in tabelas and ps[2]["tabela"]["sinais"] != ps[6]["tabela"]["sinais"]:
        falha("os sinais de f' no passo 7 diferem dos do passo 3")
    # as aproximações de zeros: se não há zeros, não pode haver tabela de sinal
    if not zs and 2 in tabelas and tabelas[2]:
        falha("tabela de sinal num estudo sem zeros")
    verificar_elementos(F, f)
    verificar_assintotas_completas(F, f, lo, hi)
    verificar_limites(F, f)
    verificar_contradominio(F, f, lo, hi, crit + infl + zs)
    verificar_texto(F, roteiro)


def estrutura(dados):
    if not isinstance(dados, dict) or "funcoes" not in dados or "roteiro" not in dados:
        falha("o ficheiro tem de ter `roteiro` e `funcoes`")
        return False
    if len(dados["roteiro"]) != PASSOS:
        falha(f"`roteiro` tem {len(dados['roteiro'])} passos, devia ter {PASSOS}")
        return False
    if len(dados["funcoes"]) != 4:
        falha(f"há {len(dados['funcoes'])} funções, devia haver 4")
    ids = [F.get("id") for F in dados["funcoes"]]
    if len(set(ids)) != len(ids):
        falha("ids de funções repetidos")
    obrigatorios = {"id", "nome", "expr", "chip", "ler", "d1", "d2", "d1Tex", "d2Tex", "janela", "cursor",
                    "elementos", "passos", "resultados", "aprox"}
    for F in dados["funcoes"]:
        _nome[0] = F.get("id", "?")
        em_falta = obrigatorios - set(F)
        if em_falta:
            falha(f"faltam chaves: {sorted(em_falta)}")
            return False
    return True


def variedade(dados):
    """As 4 funções têm de cobrir os 4 casos pedidos (verificado a partir dos resultados, não dos nomes)."""
    _nome[0] = "variedade"
    casos = set()
    for F in dados["funcoes"]:
        res = F["resultados"]
        lo = num(res["dominio"]["min"])
        els = [e for e in F["elementos"].values() if e["tipo"] == "assintota"]
        ori = {e["orientacao"] for e in els}
        if lo == -INF and "horizontal" in ori:
            casos.add("R com horizontal")
        if lo == 0 and "vertical" in ori and "horizontal" in ori:
            casos.add("R+ com vertical e horizontal")
        for e in els:
            if e["orientacao"] == "obliqua" and any(s["tipo"] == "obliqua" and s["sentido"] != e["sentido"] for s in res.get("sem", [])):
                casos.add("oblíqua num só sentido")
        if any(e["papel"] == "minimo" for e in F["elementos"].values() if e["tipo"] == "ponto") and "horizontal" not in ori:
            casos.add("mínimo sem horizontal")
    for c in ("R com horizontal", "R+ com vertical e horizontal", "oblíqua num só sentido", "mínimo sem horizontal"):
        if c not in casos:
            falha(f"falta uma função do tipo «{c}»")


def correr(verbose=False):
    _falhas.clear()
    _confirmado.clear()
    if not FICHEIRO.exists():
        print("(ainda não existe logaritmos/dados/estudos.json)")
        return []
    texto = FICHEIRO.read_text(encoding="utf-8")
    _nome[0] = "estudos.json"
    for t in TRAVESSOS:
        if t in texto:
            falha(f"o ficheiro tem o travessão U+{ord(t):04X}")
    try:
        dados = json.loads(texto)
    except json.JSONDecodeError as exc:
        falha(f"JSON inválido: {exc}")
        return list(_falhas)
    if not estrutura(dados):
        return list(_falhas)
    for F in dados["funcoes"]:
        try:
            verificar_funcao(F, dados["roteiro"])
        except Exception as exc:  # um erro de escrita nos dados não deve esconder as outras funções
            _nome[0] = F["id"]
            falha(f"exceção a verificar: {type(exc).__name__}: {exc}")
    variedade(dados)
    if verbose:
        for linha in _confirmado:
            print("OK:", linha)
    return list(_falhas)


if __name__ == "__main__":
    falhas = correr("--verbose" in sys.argv)
    if falhas:
        print(f"\n{len(falhas)} falha(s)")
        sys.exit(1)
    print(f"Estudos: tudo certo ({len(_confirmado)} verificações).")
