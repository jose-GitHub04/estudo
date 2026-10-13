"""Verificação do widget «Equações exponenciais e logarítmicas» (logaritmos/dados/equacoes.json).

Correr (a partir da raiz do site):
    python -X utf8 -I tools/verificar_equacoes.py

Imprime `FALHA: <predefinida>: <o quê>` por cada problema e sai com código 1 se houver falhas.

Os dados de cada predefinida ficam num só sítio, o equacoes.json, e o widget lê esse ficheiro.
O que aqui se confere, para cada predefinida:
  modelo      a equação/inequação: o LaTeX do enunciado ('tex') tem de dar o mesmo que as
              expressões 'esq' e 'dir'; as soluções calculam-se por varrimento e bisseção
              e têm de coincidir com as listadas; satisfazem a equação original e estão
              no domínio; as rejeitadas estão fora do domínio e são raízes da equação
              transformada (a 'auxiliar', ou a própria equação em u); o LaTeX exato de cada
              solução vale o mesmo número; nas inequações o conjunto-solução confere-se em
              milhares de amostras e as extremidades são zeros da diferença ou fronteiras
              do domínio.
  parâmetro   (2^x = k, log2(x+1) = c) para todos os valores do slider: sem solução quando
              o domínio do parâmetro falha, uma só solução igual à fórmula quando não falha;
              o ponto fica sempre dentro da janela do gráfico.
  passos      TODAS as linhas de LaTeX dos passos são lidas e calculadas (leitor de LaTeX
              próprio, só para o vocabulário usado): identidades verdadeiras em todas as
              amostras do domínio comum, equivalências (⇔) com os mesmos zeros e a mesma
              verdade, implicações (⇒), cadeias com «≈» arredondadas ao número de casas
              escrito. Só as linhas marcadas "v": "txt" (conjuntos, texto) ficam sem conferir.
  gráficos    o 'tex' de cada curva é a mesma função que a 'expr' desenhada; os pontos
              pousam onde as duas curvas se cruzam e cabem na janela; as retas da vista
              «Voltar a x» são as soluções da equação em u.
  texto       '$' emparelhados, sem travessões, ids únicos, referências (vista, curva,
              solução, passo) que existem.

Sintaxe das expressões 'esq', 'dir', 'dominio', 'expr': a do avaliador do site (^, ln, log,
logb(a, x), sqrt, exp, e, pi). 'dominio' é a lista de argumentos que têm de ser > 0.
"""
import json
import math
import re
import sys
from decimal import Decimal, ROUND_HALF_UP
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
FICHEIRO = RAIZ / "logaritmos" / "dados" / "equacoes.json"
NAN = float("nan")
TOL = 1e-9

falhas = []
contagem = {"linhas": 0, "equivalencias": 0, "identidades": 0, "raizes": 0, "amostras": 0, "curvas": 0}


def falha(onde, msg):
    falhas.append(f"FALHA: {onde}: {msg}")


# ----------------------------------------------------------------------------
# Expressões na sintaxe do avaliador do site
# ----------------------------------------------------------------------------
def _pw(a, b):
    try:
        r = a ** b
    except (ZeroDivisionError, OverflowError, ValueError):
        return NAN
    return NAN if isinstance(r, complex) else r


def _ln(a):
    return math.log(a) if a > 0 else NAN


def _log10(a):
    return math.log10(a) if a > 0 else NAN


def _logb(b, a):
    return math.log(a) / math.log(b) if a > 0 and b > 0 and b != 1 else NAN


def _sqrt(a):
    return math.sqrt(a) if a >= 0 else NAN


def _exp(a):
    try:
        return math.exp(a)
    except OverflowError:
        return NAN


NS = {"ln": _ln, "log": _log10, "logb": _logb, "sqrt": _sqrt, "exp": _exp, "abs": abs,
      "e": math.e, "pi": math.pi}


def compilar(expr):
    if not re.fullmatch(r"[0-9a-z+\-*/^(). ,_]*", expr):
        raise ValueError(f"caracteres estranhos em {expr!r}")
    return compile(expr.replace("^", "**"), "<expr>", "eval")


def calcular(codigo, env):
    try:
        r = eval(codigo, {"__builtins__": {}}, {**NS, **env})
    except Exception:
        return NAN
    if isinstance(r, complex):
        return NAN
    try:
        r = float(r)
    except (TypeError, ValueError):
        return NAN
    return r if math.isfinite(r) else NAN


def funcao(expr, var, extra=None):
    """x -> float (NaN fora do domínio) para uma expressão na sintaxe do site."""
    codigo = compilar(expr)
    extra = extra or {}
    return lambda v: calcular(codigo, {**extra, var: v})


def perto(a, b, rel=TOL):
    return abs(a - b) <= rel * max(1.0, abs(a), abs(b))


def raizes(f, a, b, n=20001):
    """Zeros de f em [a, b] por varrimento (mudança de sinal) e bisseção. Ignora assíntotas."""
    xs = [a + (b - a) * i / n for i in range(n + 1)]
    ys = [f(x) for x in xs]
    out = []
    for i in range(n):
        y0, y1 = ys[i], ys[i + 1]
        if y0 != y0 or y1 != y1:
            continue
        if y0 == 0.0:
            out.append(xs[i])
            continue
        if y0 * y1 < 0:
            lo, hi, flo = xs[i], xs[i + 1], y0
            for _ in range(80):
                m = (lo + hi) / 2
                fm = f(m)
                if fm != fm:
                    break
                if (fm < 0) == (flo < 0):
                    lo, flo = m, fm
                else:
                    hi = m
            r = (lo + hi) / 2
            fr = f(r)
            if fr == fr and abs(fr) < 1e-6:
                out.append(r)
    if ys[-1] == 0.0:
        out.append(xs[-1])
    out.sort()
    uniq = []
    for r in out:
        if not uniq or abs(r - uniq[-1]) > 1e-9:
            uniq.append(r)
    contagem["raizes"] += len(uniq)
    return uniq


# ----------------------------------------------------------------------------
# Leitor de LaTeX (só o vocabulário usado nas linhas dos passos)
# ----------------------------------------------------------------------------
class ErroTex(Exception):
    pass


TOK = re.compile(r"\s+|(?P<n>\d+(?:\{,\}\d+)?)|(?P<c>\\[A-Za-z]+|\\[ ,;:!])|(?P<i>[A-Za-z])|(?P<o>[-+*/=<>^_(){}\[\]])")
ESPACOS = {"\\,", "\\;", "\\:", "\\!", "\\ ", "\\quad", "\\qquad"}
RELACOES = {("o", "="), ("o", "<"), ("o", ">"), ("c", "\\leq"), ("c", "\\le"), ("c", "\\geq"),
            ("c", "\\ge"), ("c", "\\neq"), ("c", "\\approx")}
NOME_REL = {"=": "=", "<": "<", ">": ">", "\\leq": "<=", "\\le": "<=", "\\geq": ">=", "\\ge": ">=",
            "\\neq": "!=", "\\approx": "~"}
INICIAM_PRIMARIO = {("c", "\\frac"), ("c", "\\tfrac"), ("c", "\\dfrac"), ("c", "\\sqrt"), ("c", "\\ln"),
                    ("c", "\\log"), ("c", "\\left"), ("o", "(")}


def tokenizar(s):
    pos, out = 0, []
    while pos < len(s):
        m = TOK.match(s, pos)
        if not m:
            raise ErroTex(f"símbolo desconhecido perto de {s[pos:pos + 12]!r}")
        pos = m.end()
        k = m.lastgroup
        if k is None:
            continue
        v = m.group(k)
        if k == "c" and v in ESPACOS:
            continue
        out.append((k, v))
    return out


class Leitor:
    def __init__(self, s):
        self.s = s
        self.t = tokenizar(s)
        self.i = 0

    def espreitar(self, k=0):
        j = self.i + k
        return self.t[j] if j < len(self.t) else (None, None)

    def seguinte(self):
        if self.i >= len(self.t):
            raise ErroTex(f"fim inesperado em {self.s!r}")
        tok = self.t[self.i]
        self.i += 1
        return tok

    def esperar(self, tok):
        t = self.seguinte()
        if t != tok:
            raise ErroTex(f"esperava {tok[1]!r} e li {t[1]!r} em {self.s!r}")

    def fim(self):
        if self.i != len(self.t):
            raise ErroTex(f"sobra {self.t[self.i][1]!r} em {self.s!r}")

    # --- fórmulas: ⇔ ⇒, ou, e, cadeias de relações
    def formula(self):
        partes, ops = [self.disjuncao()], []
        while self.espreitar() in (("c", "\\Leftrightarrow"), ("c", "\\Rightarrow")):
            ops.append(self.seguinte()[1])
            partes.append(self.disjuncao())
        self.fim()
        return ("formula", partes, ops)

    def disjuncao(self):
        itens = [self.conjuncao()]
        while self.espreitar() == ("c", "\\lor"):
            self.seguinte()
            itens.append(self.conjuncao())
        return itens[0] if len(itens) == 1 else ("ou", itens)

    def conjuncao(self):
        itens = [self.cadeia()]
        while self.espreitar() == ("c", "\\land"):
            self.seguinte()
            itens.append(self.cadeia())
        return itens[0] if len(itens) == 1 else ("e", itens)

    def cadeia(self):
        exprs, rels = [self.expr()], []
        while self.espreitar() in RELACOES:
            rels.append(NOME_REL[self.seguinte()[1]])
            exprs.append(self.expr())
        if not rels:
            raise ErroTex(f"falta uma relação em {self.s!r}")
        for r, e in zip(rels, exprs[1:]):
            if r == "~" and (e[0] != "num" or e[2] is None):
                raise ErroTex("depois de «\\approx» tem de vir um decimal escrito")
        return ("cad", exprs, rels)

    # --- expressões
    def expr(self):
        a = self.termo()
        while self.espreitar() in (("o", "+"), ("o", "-")):
            op = self.seguinte()[1]
            a = ("bin", op, a, self.termo())
        return a

    def termo(self):
        a = self.unario()
        while True:
            p = self.espreitar()
            if p in (("c", "\\cdot"), ("c", "\\times"), ("o", "*")):
                self.seguinte()
                a = ("bin", "*", a, self.unario())
            elif p == ("o", "/"):
                self.seguinte()
                a = ("bin", "/", a, self.unario())
            elif p[0] == "i" or p in INICIAM_PRIMARIO:
                a = ("bin", "*", a, self.potencia())  # multiplicação implícita
            else:
                return a

    def unario(self):
        if self.espreitar() in (("o", "-"), ("o", "+")):
            op = self.seguinte()[1]
            a = self.unario()
            return ("neg", a) if op == "-" else a
        return self.potencia()

    def potencia(self):
        base = self.primario()
        if self.espreitar() == ("o", "^"):
            self.seguinte()
            return ("pow", base, self.simbolo_ou_grupo())
        return base

    def grupo(self):
        self.esperar(("o", "{"))
        e = self.expr()
        self.esperar(("o", "}"))
        return e

    def simbolo_ou_grupo(self):
        """Como no TeX: {...} ou um só símbolo (um só dígito!)."""
        if self.espreitar() == ("o", "{"):
            return self.grupo()
        k, v = self.seguinte()
        if k == "n":
            if len(v) != 1:
                raise ErroTex(f"expoente/índice sem chavetas com vários dígitos ({v}) em {self.s!r}")
            return ("num", float(v), None)
        if k == "i":
            return ("var", v)
        raise ErroTex(f"expoente/índice inesperado {v!r} em {self.s!r}")

    def argumento(self):
        a = self.primario()
        if self.espreitar() == ("o", "^"):
            raise ErroTex(f"argumento de função seguido de expoente é ambíguo (usa parênteses) em {self.s!r}")
        return a

    def primario(self):
        k, v = self.seguinte()
        if k == "n":
            txt = v.replace("{,}", ".")
            dec = len(txt.split(".")[1]) if "." in txt else None
            return ("num", float(txt), dec)
        if k == "i":
            return ("var", v)
        if (k, v) == ("o", "("):
            e = self.expr()
            self.esperar(("o", ")"))
            return e
        if (k, v) == ("c", "\\left"):
            self.esperar(("o", "("))
            e = self.expr()
            self.esperar(("c", "\\right"))
            self.esperar(("o", ")"))
            return e
        if k == "c" and v in ("\\frac", "\\tfrac", "\\dfrac"):
            a = self.grupo()
            b = self.grupo()
            return ("bin", "/", a, b)
        if (k, v) == ("c", "\\sqrt"):
            ind = None
            if self.espreitar() == ("o", "["):
                self.seguinte()
                ind = self.expr()
                self.esperar(("o", "]"))
            return ("raiz", self.grupo(), ind)
        if (k, v) == ("c", "\\ln"):
            return ("ln", self.argumento())
        if (k, v) == ("c", "\\log"):
            if self.espreitar() == ("o", "_"):
                self.seguinte()
                base = self.simbolo_ou_grupo()
                return ("logb", base, self.argumento())
            return ("log10", self.argumento())
        raise ErroTex(f"não sei ler {v!r} em {self.s!r}")


def ler_formula(s):
    return Leitor(s).formula()


def ler_expr(s):
    r = Leitor(s)
    e = r.expr()
    r.fim()
    return e


def ev(n, env):
    t = n[0]
    if t == "num":
        return n[1]
    if t == "var":
        if n[1] in env:
            return env[n[1]]
        if n[1] == "e":
            return math.e
        raise ErroTex(f"variável sem valor: {n[1]}")
    if t == "neg":
        return -ev(n[1], env)
    if t == "bin":
        a, b = ev(n[2], env), ev(n[3], env)
        if n[1] == "+":
            return a + b
        if n[1] == "-":
            return a - b
        if n[1] == "*":
            return a * b
        return a / b if b != 0 else NAN
    if t == "pow":
        return _pw(ev(n[1], env), ev(n[2], env))
    if t == "raiz":
        a = ev(n[1], env)
        k = 2.0 if n[2] is None else ev(n[2], env)
        return _sqrt(a) if k == 2 else (_pw(a, 1.0 / k) if a >= 0 else NAN)
    if t == "ln":
        return _ln(ev(n[1], env))
    if t == "log10":
        return _log10(ev(n[1], env))
    if t == "logb":
        return _logb(ev(n[1], env), ev(n[2], env))
    raise ErroTex(f"nó desconhecido {t}")


def variaveis(n, acc=None):
    acc = set() if acc is None else acc
    if isinstance(n, tuple):
        if n and n[0] == "var" and n[1] != "e":
            acc.add(n[1])
        for x in n[1:]:
            if isinstance(x, (tuple, list)):
                variaveis(x, acc)
    elif isinstance(n, list):
        for x in n:
            variaveis(x, acc)
    return acc


def comparar(a, rel, b, direito=None):
    perto_ = abs(a - b) <= TOL * max(1.0, abs(a), abs(b))
    if rel == "=":
        return perto_
    if rel == "!=":
        return not perto_
    if rel == "<":
        return a < b and not perto_
    if rel == ">":
        return a > b and not perto_
    if rel == "<=":
        return a < b or perto_
    if rel == ">=":
        return a > b or perto_
    if rel == "~":
        d = direito[2]
        r = Decimal(repr(a)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP)
        return abs(float(r) - b) < 1e-12
    raise ErroTex(rel)


def verdade(n, env):
    """True, False ou None (indefinido: alguma expressão sai do domínio)."""
    t = n[0]
    if t == "cad":
        vals = [ev(e, env) for e in n[1]]
        if any(v != v for v in vals):
            return None
        return all(comparar(vals[i], r, vals[i + 1], n[1][i + 1]) for i, r in enumerate(n[2]))
    sub = [verdade(x, env) for x in n[1]]
    if t == "e":
        if any(s is False for s in sub):
            return False
        return None if any(s is None for s in sub) else True
    if t == "ou":
        if any(s is True for s in sub):
            return True
        return None if any(s is None for s in sub) else False
    raise ErroTex(t)


def igualdades(n, acc=None):
    """Lista de (esq, dir) de cada relação «=» dentro da fórmula (para achar os zeros)."""
    acc = [] if acc is None else acc
    if n[0] == "cad":
        for i, r in enumerate(n[2]):
            if r == "=":
                acc.append((n[1][i], n[1][i + 1]))
    elif n[0] in ("e", "ou"):
        for x in n[1]:
            igualdades(x, acc)
    elif n[0] == "formula":
        for x in n[1]:
            igualdades(x, acc)
    return acc


# ----------------------------------------------------------------------------
# Verificação das linhas dos passos
# ----------------------------------------------------------------------------
def valores_param(p):
    """Valores do slider a usar nas verificações (todos se forem poucos)."""
    n = round((p["max"] - p["min"]) / p["passo"])
    todos = [p["min"] + i * p["passo"] for i in range(n + 1)]
    return todos if len(todos) <= 9 else todos[:: max(1, len(todos) // 8)] + [todos[-1], p["inicial"]]


def procura_da_variavel(pred, var):
    if var == pred["modelo"]["variavel"]:
        return pred["modelo"]["procura"]
    for v in pred["vistas"]:
        if v.get("modelo", {}).get("variavel") == var:
            return v["modelo"]["procura"]
    return [-10, 10]


def verificar_linha(onde, pred, passo, linha):
    contagem["linhas"] += 1
    if linha.get("v") == "txt":
        return
    var = passo.get("var", "x")
    try:
        f = ler_formula(linha["tex"])
    except ErroTex as e:
        falha(onde, f"não consegui ler a linha ({e})")
        return
    nomes = variaveis(f)
    desconhecidas = nomes - {var} - ({pred["param"]["nome"]} if pred.get("param") else set())
    if desconhecidas:
        falha(onde, f"símbolos sem valor {sorted(desconhecidas)} em {linha['tex']!r}")
        return
    a, b = procura_da_variavel(pred, var)
    partes, ops = f[1], f[2]
    confere_equiv = bool(ops)
    ambientes = [{}]
    if pred.get("param"):
        ambientes = [{pred["param"]["nome"]: v} for v in valores_param(pred["param"])]
    usa_var = var in nomes
    definidos = 0
    for amb in ambientes:
        pontos = []
        if usa_var:
            n = 801
            pontos = [a + (b - a) * i / n for i in range(n + 1)]
            if confere_equiv:
                for esq, dir_ in igualdades(f):
                    def g(x, esq=esq, dir_=dir_, amb=amb):
                        return ev(esq, {**amb, var: x}) - ev(dir_, {**amb, var: x})
                    pontos += raizes(g, a, b, 4001)
                pontos.sort()
        else:
            pontos = [1.0]
        for x in pontos:
            env = {**amb, var: x}
            ts = [verdade(p, env) for p in partes]
            if any(t is None for t in ts):
                continue
            definidos += 1
            contagem["amostras"] += 1
            if not ops:
                if not ts[0]:
                    falha(onde, f"a linha {linha['tex']!r} é falsa com {var}={x:.6g} {amb or ''}")
                    return
                continue
            for i, op in enumerate(ops):
                p, q = ts[i], ts[i + 1]
                if op == "\\Leftrightarrow" and p != q:
                    falha(onde, f"equivalência falsa em {linha['tex']!r}: com {var}={x:.8g} {amb or ''} "
                                f"o 1.º lado é {p} e o 2.º é {q} (parte {i + 1} ⇔ parte {i + 2})")
                    return
                if op == "\\Rightarrow" and p and not q:
                    falha(onde, f"implicação falsa em {linha['tex']!r} com {var}={x:.8g}")
                    return
    minimo = 25 if usa_var else 1
    if definidos < minimo:
        falha(onde, f"a linha {linha['tex']!r} quase não tem pontos em que esteja definida ({definidos}): confere o domínio")
    contagem["equivalencias" if confere_equiv else "identidades"] += 1


# ----------------------------------------------------------------------------
# Modelos: equação/inequação, soluções, rejeitadas, conjunto
# ----------------------------------------------------------------------------
def intervalos_tex(s):
    """Intervalos \\left]a,b\\right[ de um LaTeX: [(abre_aberto, a, b, fecha_aberto)]."""
    out = []
    for m in re.finditer(r"\\left([\]\[])(.*?)\\right([\]\[])", s):
        corpo = m.group(2)
        nivel, corte = 0, None
        for i, ch in enumerate(corpo):
            if ch == "{":
                nivel += 1
            elif ch == "}":
                nivel -= 1
            elif ch == "," and nivel == 0:
                corte = i
                break
        if corte is None:
            continue
        out.append((m.group(1) == "]", corpo[:corte], corpo[corte + 1:], m.group(3) == "["))
    return out


def valor_extremo(txt):
    """Valor numérico de um extremo em LaTeX (None para ∞)."""
    if "\\infty" in txt:
        return None
    return ev(ler_expr(txt), {})


def verificar_modelo(onde, M, extra=None, rotulos=None, pred=None):
    """M: dicionário de modelo (com variavel, esq, dir, dominio, procura, soluções...)."""
    extra = extra or {}
    var = M["variavel"]
    a, b = M["procura"]
    esq = funcao(M["esq"], var, extra)
    dir_ = funcao(M["dir"], var, extra)
    doms = [funcao(d, var, extra) for d in M.get("dominio", [])]

    def no_dominio(x):
        return all(d(x) > 0 for d in doms)

    def dif(x):
        return esq(x) - dir_(x)

    rel = M["rel"]
    if rel == "=":
        sols = [s["v"] for s in M["solucoes"]]
        rejs = [r["v"] for r in M.get("rejeitadas", [])]
        R = raizes(dif, a, b)
        if M.get("auxiliar"):
            ae = funcao(M["auxiliar"]["esq"], var, extra)
            ad = funcao(M["auxiliar"]["dir"], var, extra)
            Rg = raizes(lambda x: ae(x) - ad(x), a, b)
            if len(R) != len(sols) or any(not perto(r, s, 1e-7) for r, s in zip(R, sorted(sols))):
                falha(onde, f"as raízes da equação original são {R} e as soluções listadas são {sorted(sols)}")
            esperado = sorted(sols + rejs)
            if len(Rg) != len(esperado) or any(not perto(r, s, 1e-7) for r, s in zip(Rg, esperado)):
                falha(onde, f"as raízes da equação transformada são {Rg} e soluções+rejeitadas são {esperado}")
            for r in rejs:
                ok_aux = abs(ae(r) - ad(r)) < 1e-9
                if not ok_aux:
                    falha(onde, f"a rejeitada {r} não é raiz da equação transformada")
        else:
            dentro = [r for r in R if no_dominio(r)]
            fora = [r for r in R if not no_dominio(r)]
            if len(dentro) != len(sols) or any(not perto(r, s, 1e-7) for r, s in zip(dentro, sorted(sols))):
                falha(onde, f"as raízes no domínio são {dentro} e as soluções listadas são {sorted(sols)}")
            if len(fora) != len(rejs) or any(not perto(r, s, 1e-7) for r, s in zip(fora, sorted(rejs))):
                falha(onde, f"as raízes fora do domínio são {fora} e as rejeitadas listadas são {sorted(rejs)}")
        for s in sols:
            if not no_dominio(s):
                falha(onde, f"a solução {s} está fora do domínio")
            d = dif(s)
            if d != d or abs(d) > 1e-9 * max(1.0, abs(esq(s))):
                falha(onde, f"a solução {s} não satisfaz a equação original (diferença {d})")
        for r in rejs:
            if no_dominio(r):
                falha(onde, f"a rejeitada {r} afinal está no domínio")
        for lista in (M["solucoes"], M.get("rejeitadas", [])):
            for item in lista:
                try:
                    vt = ev(ler_expr(item["tex"]), {})
                except ErroTex as e:
                    falha(onde, f"não li o LaTeX de {item}: {e}")
                    continue
                if not perto(vt, item["v"], 1e-9):
                    falha(onde, f"o LaTeX {item['tex']!r} vale {vt} mas 'v' é {item['v']}")
        # resposta: conjunto de soluções escrito
        if pred and not pred.get("param") and pred.get("resposta") and rotulos == "principal":
            conferir_resposta_conjunto(onde, pred["resposta"], sols)
    else:
        verificar_conjunto(onde, M, esq, dir_, no_dominio, dif, pred)


def separar_virgulas(corpo):
    """Parte por vírgulas fora de chavetas (a vírgula decimal 2{,}5 não conta)."""
    elementos, nivel, ini = [], 0, 0
    for i, ch in enumerate(corpo):
        if ch == "{":
            nivel += 1
        elif ch == "}":
            nivel -= 1
        elif ch == "," and nivel == 0 and corpo[i - 1:i] != "\\":  # «\,» é um espaço, não um separador
            elementos.append(corpo[ini:i])
            ini = i + 1
    elementos.append(corpo[ini:])
    return [e for e in (x.strip() for x in elementos) if e]


def conferir_resposta_conjunto(onde, resposta, sols):
    m = re.search(r"(?:\\left)?\\\{(.*?)(?:\\right)?\\\}", resposta)
    if not m:
        falha(onde, "a resposta devia ser um conjunto {...}")
        return
    try:
        vals = sorted(ev(ler_expr(e), {}) for e in separar_virgulas(m.group(1)))
    except ErroTex as e:
        falha(onde, f"não li a resposta: {e}")
        return
    if len(vals) != len(sols) or any(not perto(v, s, 1e-9) for v, s in zip(vals, sorted(sols))):
        falha(onde, f"a resposta escrita vale {vals} e as soluções são {sorted(sols)}")
    for ap in re.findall(r"\\approx\s*\\\{(.*?)\\\}", resposta):
        for e, s in zip(separar_virgulas(ap), sorted(sols)):
            lit = ler_expr(e)
            if lit[0] == "num" and lit[2] is not None:
                if not comparar(s, "~", lit[1], lit):
                    falha(onde, f"o valor aproximado {e} não é {s} arredondado")


def verificar_conjunto(onde, M, esq, dir_, no_dominio, dif, pred):
    rel = M["rel"]
    if rel not in ("<", ">", "<=", ">="):
        falha(onde, f"relação desconhecida {rel!r}")
        return
    estrita = rel in ("<", ">")
    conj = M["conjunto"]
    a, b = M["procura"]

    def vale(x):
        if not no_dominio(x):
            return False
        p, q = esq(x), dir_(x)
        if p != p or q != q:
            return False
        return comparar(p, rel, q)

    def dentro(x):
        for iv in conj:
            lo, hi = iv["de"], iv["ate"]
            ok_lo = lo is None or x > lo or (x == lo and not iv["abertoDe"])
            ok_hi = hi is None or x < hi or (x == hi and not iv["abertoAte"])
            if ok_lo and ok_hi:
                return True
        return False

    fins = [e for iv in conj for e in (iv["de"], iv["ate"]) if e is not None]
    pontos = [a + (b - a) * i / 8000 for i in range(8001)]
    for e in fins:
        pontos += [e - 1e-3, e + 1e-3, e - 1e-6, e + 1e-6]
    maus = 0
    for x in pontos:
        if any(abs(x - e) < 1e-9 for e in fins):
            continue
        contagem["amostras"] += 1
        if vale(x) != dentro(x):
            maus += 1
            if maus <= 3:
                falha(onde, f"conjunto-solução errado em x={x:.6g}: a desigualdade dá {vale(x)} e o conjunto dá {dentro(x)}")
    for iv in conj:
        for lado, e, aberto in (("de", iv["de"], iv["abertoDe"]), ("ate", iv["ate"], iv["abertoAte"])):
            if e is None:
                continue
            d = dif(e)
            e_zero = d == d and abs(d) < 1e-9 * max(1.0, abs(esq(e)))
            fronteira = no_dominio(e - 1e-7) != no_dominio(e + 1e-7)
            if not (e_zero or fronteira):
                falha(onde, f"o extremo {e} não é zero de esq-dir nem fronteira do domínio")
            if fronteira and not aberto:
                falha(onde, f"o extremo {e} é fronteira do domínio e devia ser aberto")
            if estrita and not aberto:
                falha(onde, f"a desigualdade é estrita e o extremo {e} devia ser aberto")
        # LaTeX do intervalo
    iv_tex = intervalos_tex(conj[0]["tex"])
    if len(iv_tex) != len(conj):
        falha(onde, "o LaTeX do conjunto não tem os intervalos todos")
    else:
        for iv, (abre, ta, tb, fecha) in zip(conj, iv_tex):
            try:
                va, vb = valor_extremo(ta), valor_extremo(tb)
            except ErroTex as e:
                falha(onde, f"não li o LaTeX do intervalo: {e}")
                continue
            for esperado, lido in ((iv["de"], va), (iv["ate"], vb)):
                if (esperado is None) != (lido is None) or (esperado is not None and not perto(esperado, lido, 1e-9)):
                    falha(onde, f"o LaTeX {conj[0]['tex']!r} não corresponde a ({iv['de']}, {iv['ate']})")
            if (abre != iv["abertoDe"]) or (fecha != iv["abertoAte"]):
                falha(onde, "os parênteses do intervalo não batem com abertoDe/abertoAte")
    # resposta
    if pred and pred.get("resposta"):
        ivs = intervalos_tex(pred["resposta"])
        if not ivs:
            falha(onde, "a resposta devia ser um intervalo")
        else:
            abre, ta, tb, fecha = ivs[0]
            try:
                va, vb = valor_extremo(ta), valor_extremo(tb)
                iv = conj[0]
                for esperado, lido in ((iv["de"], va), (iv["ate"], vb)):
                    if (esperado is None) != (lido is None) or (esperado is not None and not perto(esperado, lido, 1e-9)):
                        falha(onde, "a resposta escrita não é o conjunto-solução")
                for k, (abre2, ta2, tb2, fecha2) in enumerate(ivs[1:], start=1):
                    for esperado, txt in ((iv["de"], ta2), (iv["ate"], tb2)):
                        if esperado is None:
                            continue
                        lit = ler_expr(txt)
                        if not comparar(esperado, "~", lit[1], lit):
                            falha(onde, f"o valor aproximado {txt} não é {esperado} arredondado")
            except ErroTex as e:
                falha(onde, f"não li a resposta: {e}")


def verificar_parametro(onde, pred):
    p = pred["param"]
    M = pred["modelo"]
    nome = p["nome"]
    n = round((p["max"] - p["min"]) / p["passo"])
    todos = [p["min"] + i * p["passo"] for i in range(n + 1)]
    if p["inicial"] not in todos:
        falha(onde, "o valor inicial do slider não está na grelha do slider")
    esta_solucao = funcao(p["solucao"], nome)
    doms_p = [funcao(d, nome) for d in p.get("dominio", [])]
    # janela do gráfico
    vista = pred["vistas"][0]
    x0, x1 = vista["x"]
    y0, y1 = vista["y"]
    a, b = M["procura"]
    for v in todos:
        existe = all(d(v) > 0 for d in doms_p)
        env = {nome: v}
        esq = funcao(M["esq"], "x", env)
        dir_ = funcao(M["dir"], "x", env)
        doms = [funcao(d, "x", env) for d in M.get("dominio", [])]
        R = [r for r in raizes(lambda x: esq(x) - dir_(x), a, b, 8001) if all(d(r) > 0 for d in doms)]
        if existe:
            s = esta_solucao(v)
            if s != s:
                falha(onde, f"com {nome}={v} a fórmula da solução não dá número")
                continue
            if len(R) != 1 or not perto(R[0], s, 1e-7):
                falha(onde, f"com {nome}={v} as raízes são {R} e a fórmula dá {s}")
            if not all(d(s) > 0 for d in doms):
                falha(onde, f"com {nome}={v} a solução {s} está fora do domínio")
            if not (x0 <= s <= x1) or not (y0 <= dir_(s) <= y1):
                falha(onde, f"com {nome}={v} o ponto ({s}, {dir_(s)}) cai fora da janela do gráfico")
        else:
            if R:
                falha(onde, f"com {nome}={v} devia não haver solução mas há {R}")
    contagem["amostras"] += len(todos)


# ----------------------------------------------------------------------------
# Estrutura, gráficos e texto
# ----------------------------------------------------------------------------
FASES = {"dominio", "resolver", "verificar"}
TRAVESSOES = ("\u2014", "\u2013")


def textos(obj, caminho=""):
    if isinstance(obj, str):
        yield caminho, obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from textos(v, f"{caminho}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from textos(v, f"{caminho}[{i}]")


def verificar_texto(onde, obj):
    for caminho, s in textos(obj):
        if any(t in s for t in TRAVESSOES):
            falha(onde, f"travessão em {caminho}: {s[:50]!r}")
        # '$' emparelhados (os campos «tex» são só LaTeX, sem '$')
        if caminho.endswith(".tex") or caminho.endswith("expr") or caminho.endswith("resposta"):
            if "$" in s:
                falha(onde, f"«$» num campo só de LaTeX/expressão ({caminho})")
        elif s.count("$") % 2:
            falha(onde, f"«$» desemparelhado em {caminho}: {s[:60]!r}")
        if re.search(r"\b(tela|arquivo|você|equipe|celular|ônibus)\b", s):
            falha(onde, f"palavra de pt-BR em {caminho}")


def verificar_graficos(onde, pred):
    M = pred["modelo"]
    ids_vistas = [v["id"] for v in pred["vistas"]]
    if len(set(ids_vistas)) != len(ids_vistas):
        falha(onde, "ids de vistas repetidos")
    n_passos = len(pred["passos"])
    param = pred.get("param")
    amb = {param["nome"]: param["inicial"]} if param else {}
    for V in pred["vistas"]:
        vo = f"{onde}/vista {V['id']}"
        var = V.get("variavel", "x")
        MV = V.get("modelo", M)
        x0, x1 = V["x"]
        y0, y1 = V["y"]
        curvas = {}
        xs = [x0 + (x1 - x0) * i / 300 for i in range(301)]
        for c in V["curvas"]:
            contagem["curvas"] += 1
            try:
                fe = funcao(c["expr"], var, amb)
                ft = ler_expr(c["tex"])
            except (ErroTex, ValueError, SyntaxError) as e:
                falha(vo, f"curva {c['id']}: {e}")
                continue
            curvas[c["id"]] = fe
            definidos = 0
            for x in xs:
                vt = ev(ft, {**amb, var: x})
                ve = fe(x)
                if (vt != vt) != (ve != ve):
                    falha(vo, f"curva {c['id']}: o LaTeX e a expressão não estão definidos nos mesmos pontos (x={x})")
                    break
                if ve == ve:
                    definidos += 1
                    if not perto(vt, ve, 1e-9):
                        falha(vo, f"curva {c['id']}: o LaTeX {c['tex']!r} dá {vt} e a expressão {c['expr']!r} dá {ve} com {var}={x}")
                        break
            if definidos == 0:
                falha(vo, f"curva {c['id']} nunca está definida na janela")
            if c.get("desde") is not None and not (0 <= c["desde"] < n_passos):
                falha(vo, f"curva {c['id']}: 'desde' fora dos passos")
        # pontos
        sols = MV.get("solucoes", [])
        rejs = MV.get("rejeitadas", [])
        conj = MV.get("conjunto", [])
        esq_m = funcao(MV["esq"], var, amb)
        dir_m = funcao(MV["dir"], var, amb)
        for k, P in enumerate(V.get("pontos", [])):
            po = f"{vo}/ponto {k}"
            for campo in ("desde", "decide"):
                if P.get(campo) is not None and not (0 <= P[campo] < n_passos):
                    falha(po, f"'{campo}' fora dos passos")
            if P.get("decide") is not None and P.get("desde") is not None and P["decide"] < P["desde"]:
                falha(po, "'decide' antes de 'desde'")
            if P.get("em") not in curvas:
                falha(po, f"curva 'em' inexistente: {P.get('em')}")
                continue
            xs_p = []
            if "sol" in P:
                if P["sol"] >= len(sols):
                    falha(po, "'sol' fora da lista de soluções")
                    continue
                xs_p = [sols[P["sol"]]["v"]]
            elif "rej" in P:
                if P["rej"] >= len(rejs):
                    falha(po, "'rej' fora da lista de rejeitadas")
                    continue
                xs_p = [rejs[P["rej"]]["v"]]
            elif "fim" in P:
                i, lado = P["fim"]
                if i >= len(conj) or conj[i].get(lado) is None:
                    falha(po, "'fim' aponta para um extremo que não existe")
                    continue
                xs_p = [conj[i][lado]]
            elif P.get("x") == "param":
                if not param:
                    falha(po, "x='param' mas a predefinida não tem parâmetro")
                    continue
                continue  # a posição do ponto do parâmetro confere-se em verificar_parametro
            else:
                xs_p = [P["x"]]
            for xv in xs_p:
                yv = P["y"] if "y" in P else curvas[P["em"]](xv)
                if yv != yv:
                    falha(po, f"a curva '{P['em']}' não existe em x={xv}")
                    continue
                if not (x0 <= xv <= x1 and y0 <= yv <= y1):
                    falha(po, f"o ponto ({xv:.4g}, {yv:.4g}) cai fora da janela {V['x']} x {V['y']}")
                if "y" in P and not perto(curvas[P["em"]](xv), P["y"], 1e-9):
                    falha(po, f"o ponto ({xv}, {P['y']}) não está na curva '{P['em']}'")
                if "y" not in P:
                    referencia = dir_m(xv)
                    if referencia != referencia:
                        referencia = esq_m(xv)
                    if not perto(yv, referencia, 1e-9):
                        falha(po, f"o ponto devia estar à altura {referencia} (onde os membros se cruzam) e está a {yv}")
        if V.get("conjunto") and not conj:
            falha(vo, "a vista tem 'conjunto' mas o modelo não")
        for k, z in enumerate(V.get("zonas", [])):
            if z["eixo"] not in ("x", "y"):
                falha(vo, f"zona {k}: eixo inválido")
            if z.get("desde") is not None and not (0 <= z["desde"] < n_passos):
                falha(vo, f"zona {k}: 'desde' fora dos passos")
            # a zona proibida do eixo x tem de ser o complemento do domínio
            if z["eixo"] == "x" and var == MV["variavel"] and MV.get("dominio") and z.get("ate") is not None:
                doms = [funcao(d, var, amb) for d in MV["dominio"]]
                for xx in [x0 + (x1 - x0) * i / 400 + 1e-7 for i in range(401)]:
                    esta_dentro = all(d(xx) > 0 for d in doms)
                    na_zona = (z["de"] is None or xx > z["de"]) and xx < z["ate"]
                    if esta_dentro == na_zona and abs(xx - z["ate"]) > 1e-3:
                        falha(vo, f"zona {k}: x={xx:.4g} {'está' if na_zona else 'não está'} na zona e "
                                  f"{'está' if esta_dentro else 'não está'} no domínio")
                        break
            if z["eixo"] == "x" and var == "u" and z.get("ate") != 0:
                falha(vo, "a zona em u devia ser u ≤ 0")
            if "assintota" in z and z.get("ate") is None:
                falha(vo, "assíntota sem extremo finito")
    # a vista «Voltar a x»: as retas são as soluções da equação em u
    ponte = next((v for v in pred["vistas"] if v["id"] == "ponte"), None)
    vu = next((v for v in pred["vistas"] if v["id"] == "u"), None)
    if ponte and vu:
        mu = vu["modelo"]
        ys_ok = sorted(r["y"] for r in ponte.get("retasH", []) if "estado" not in r)
        ys_rej = sorted(r["y"] for r in ponte.get("retasH", []) if r.get("estado") == "rejeitada")
        if ys_ok != sorted(s["v"] for s in mu["solucoes"]):
            falha(f"{onde}/ponte", f"as retas aceites {ys_ok} não são as soluções em u")
        if ys_rej != sorted(s["v"] for s in mu.get("rejeitadas", [])):
            falha(f"{onde}/ponte", f"as retas rejeitadas {ys_rej} não são as rejeitadas em u")
        xs_sol = sorted(s["v"] for s in M["solucoes"])
        xs_pt = sorted(p["x"] for p in ponte["pontos"])
        if len(xs_pt) != len(xs_sol) or any(not perto(p, s) for p, s in zip(xs_pt, xs_sol)):
            falha(f"{onde}/ponte", f"os pontos {xs_pt} não são as soluções em x {xs_sol}")
        # a mudança de variável: u = base^x leva as soluções em x às soluções em u
        base = re.search(r"([0-9]+)\^x", ponte["curvas"][0]["expr"])
        if base:
            b = float(base.group(1))
            alvos = sorted(b ** s for s in xs_sol)
            if len(alvos) != len(ys_ok) or any(not perto(p, s, 1e-9) for p, s in zip(alvos, ys_ok)):
                falha(f"{onde}/ponte", f"{b}^x nas soluções dá {alvos} e as retas são {ys_ok}")


def verificar_estrutura(pred, grupos_ids):
    onde = pred.get("id", "?")
    for campo in ("id", "grupo", "chip", "tipo", "enunciado", "modelo", "vistas", "passos", "resposta"):
        if campo not in pred:
            falha(onde, f"falta o campo '{campo}'")
            return False
    if pred["grupo"] not in grupos_ids:
        falha(onde, f"grupo desconhecido {pred['grupo']}")
    if pred["tipo"] not in ("equacao", "inequacao"):
        falha(onde, "tipo inválido")
    if (pred["tipo"] == "equacao") != (pred["modelo"]["rel"] == "="):
        falha(onde, "o tipo não bate com a relação do modelo")
    if not 4 <= len(pred["passos"]) <= 8:
        falha(onde, f"{len(pred['passos'])} passos (devia haver entre 4 e 8)")
    ids_v = {v["id"] for v in pred["vistas"]}
    for i, p in enumerate(pred["passos"]):
        po = f"{onde}/passo {i + 1}"
        for campo in ("titulo", "fase", "texto", "linhas"):
            if campo not in p:
                falha(po, f"falta '{campo}'")
        if p.get("fase") not in FASES:
            falha(po, f"fase inválida {p.get('fase')}")
        if p.get("vista") and p["vista"] not in ids_v:
            falha(po, f"vista inexistente {p['vista']}")
        if p.get("var", "x") not in ("x", "u"):
            falha(po, "var inválida")
        if p.get("var") == "u" and "u" not in {v.get("variavel") for v in pred["vistas"]}:
            falha(po, "passo em u mas não há vista em u")
        if not p.get("linhas") and p.get("fase") != "dominio":
            falha(po, "passo sem linhas de LaTeX")
        if len(re.sub(r"\$[^$]*\$", "", p["titulo"]).split()) > 7:
            falha(po, "título demasiado longo")
    if pred["passos"][0]["fase"] != "dominio":
        falha(onde, "o 1.º passo tem de ser o domínio")
    if pred["passos"][-1]["fase"] != "verificar":
        falha(onde, "o último passo tem de ser a verificação")
    return True


def correr():
    if not FICHEIRO.is_file():
        falha("equacoes.json", "o ficheiro não existe")
        return
    bruto = FICHEIRO.read_text(encoding="utf-8")
    try:
        dados = json.loads(bruto)
    except json.JSONDecodeError as e:
        falha("equacoes.json", f"JSON inválido: {e}")
        return
    grupos_ids = [g["id"] for g in dados["grupos"]]
    ids = [p["id"] for p in dados["predefinidas"]]
    if len(set(ids)) != len(ids):
        falha("equacoes.json", "ids repetidos")
    if len(ids) < 8:
        falha("equacoes.json", f"só {len(ids)} predefinidas (o mínimo são 8)")
    verificar_texto("equacoes.json", dados)
    for pred in dados["predefinidas"]:
        onde = pred.get("id", "?")
        if not verificar_estrutura(pred, grupos_ids):
            continue
        M = pred["modelo"]
        # 1. o LaTeX do enunciado é a equação do modelo
        try:
            f = ler_formula(M["tex"])
            if f[0] != "formula" or f[2] or f[1][0][0] != "cad" or len(f[1][0][2]) != 1:
                falha(onde, "o enunciado devia ser uma só relação")
            else:
                rel_tex = f[1][0][2][0]
                if rel_tex != M["rel"]:
                    falha(onde, f"o enunciado tem a relação {rel_tex} e o modelo {M['rel']}")
                param = pred.get("param")
                amb = {param["nome"]: param["inicial"]} if param else {}
                a, b = M["procura"]
                esq = funcao(M["esq"], "x", amb)
                dir_ = funcao(M["dir"], "x", amb)
                n_ok = 0
                for i in range(401):
                    x = a + (b - a) * i / 400
                    env = {**amb, "x": x}
                    le, ld = ev(f[1][0][1][0], env), ev(f[1][0][1][1], env)
                    ve, vd = esq(x), dir_(x)
                    if (le != le) != (ve != ve) or (ld != ld) != (vd != vd):
                        falha(onde, f"o enunciado e as expressões não estão definidos nos mesmos pontos (x={x})")
                        break
                    if ve == ve:
                        n_ok += 1
                        if not perto(le, ve, 1e-9):
                            falha(onde, f"o lado esquerdo do enunciado dá {le} e 'esq' dá {ve} com x={x}")
                            break
                    if vd == vd and not perto(ld, vd, 1e-9):
                        falha(onde, f"o lado direito do enunciado dá {ld} e 'dir' dá {vd} com x={x}")
                        break
        except (ErroTex, ValueError, SyntaxError) as e:
            falha(onde, f"enunciado: {e}")
        # 2. o modelo
        try:
            if pred.get("param"):
                verificar_parametro(onde, pred)
            else:
                verificar_modelo(onde, M, rotulos="principal", pred=pred)
            for V in pred["vistas"]:
                if V.get("modelo"):
                    verificar_modelo(f"{onde}/vista {V['id']}", V["modelo"], pred=pred)
        except (ErroTex, ValueError, SyntaxError, KeyError) as e:
            falha(onde, f"modelo: {type(e).__name__}: {e}")
        # 3. gráficos
        try:
            verificar_graficos(onde, pred)
        except (ErroTex, ValueError, SyntaxError, KeyError) as e:
            falha(onde, f"gráficos: {type(e).__name__}: {e}")
        # 4. linhas dos passos
        for i, passo in enumerate(pred["passos"]):
            for j, linha in enumerate(passo.get("linhas", [])):
                verificar_linha(f"{onde}/passo {i + 1}/linha {j + 1}", pred, passo, linha)
    return dados


def main():
    dados = correr()
    n = len(dados["predefinidas"]) if dados else 0
    for f in falhas:
        print(f)
    print(f"equacoes: {n} predefinidas, {contagem['linhas']} linhas de LaTeX lidas "
          f"({contagem['equivalencias']} equivalências/implicações e {contagem['identidades']} identidades "
          f"conferidas em {contagem['amostras']} amostras), {contagem['curvas']} curvas, "
          f"{contagem['raizes']} zeros encontrados por bisseção: {len(falhas)} falha(s)")
    return 1 if falhas else 0


if __name__ == "__main__":
    sys.exit(main())
