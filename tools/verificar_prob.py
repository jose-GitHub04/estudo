"""Verificação do tema «Probabilidades» (probabilidades/**), sem browser por omissão.

Correr (a partir da raiz do site):
    python -X utf8 -I tools/verificar_prob.py               dados e texto (rápido)
    python -X utf8 -I tools/verificar_prob.py --navegador   + todas as páginas de probabilidades/tests/
    python -X utf8 -I tools/verificar_prob.py --gerar       reescreve probabilidades/tests/esperado.json

O que confere, tudo recalculado de forma independente do código JavaScript (frações exatas,
contagem de casos por força bruta, math.erf):
  1. verdadeiro-falso.json: estrutura, ids, $ equilibrados e, para cada uma das 14
     afirmações, resolve-a aqui e compara com o campo `verdadeira`; confere também os números
     escritos nas explicações e nas figuras.
  2. Os 4 exercícios (probabilidades/widgets/ex-*.js): enunciado e solução resolvidos de novo
     (k, a e b, tabela da caixa, probabilidade condicionada, μ, σ, Normal e número esperado).
  3. Matéria: urna 3V + 4A, jogo do saco, soma de n dados, regra 68-95-99,7, valores da
     Normal usados nos exemplos.
  4. probabilidades/tests/esperado.json (os números que as páginas de teste esperam) tem de
     ser exatamente o que se recalcula aqui.
  5. Texto: sem os dois travessões (U+2014 e U+2013), sem pt-BR nos ficheiros do tema.
  6. Com --navegador, abre cada página de probabilidades/tests/ no Edge sem janela (servidor
     local numa porta livre) e exige data-testes="ok".

Também se usa de dentro de tools/verificar.py: correr() devolve a lista de falhas.
"""
import itertools
import json
import math
import re
import subprocess
import sys
import tempfile
import threading
from fractions import Fraction as Fr
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
TEMA = RAIZ / "probabilidades"
TESTES = TEMA / "tests"
ESPERADO = TESTES / "esperado.json"
EDGE = Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")

falhas = []


def falha(msg):
    falhas.append(msg)
    print("FALHA:", msg)


def exigir(cond, msg):
    if not cond:
        falha(msg)
    return bool(cond)


def phi(z):
    """Função de distribuição da Normal padrão."""
    return 0.5 * (1 + math.erf(z / math.sqrt(2)))


def cdf(x, mu, sigma):
    return phi((x - mu) / sigma)


def densidade(x, mu, sigma):
    return math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * math.sqrt(2 * math.pi))


def fr(texto):
    """'3/10' -> Fraction; aceita também inteiros e decimais com ponto."""
    return Fr(texto)


def fstr(f):
    return str(f.numerator) if f.denominator == 1 else f"{f.numerator}/{f.denominator}"


# ---------------------------------------------------------------------------------------
# Probabilidades por força bruta (independentes de assets/motor/probabilidade.js)
# ---------------------------------------------------------------------------------------

def urna_bruta(vermelhas, outras):
    """X = bolas tiradas, sem repor, até sair vermelha. Conta todas as ordens possíveis."""
    n = vermelhas + outras
    # bolas numeradas: as n! ordens são equiprováveis (as primeiras `vermelhas` são vermelhas)
    total = 0
    cont = {}
    for perm in itertools.permutations(range(n)):
        total += 1
        k = next(i for i, b in enumerate(perm) if b < vermelhas) + 1
        cont[k] = cont.get(k, 0) + 1
    return {k: Fr(c, total) for k, c in sorted(cont.items())}


def media_var(tab):
    mu = sum(Fr(x) * p for x, p in tab.items())
    var = sum(p * (Fr(x) - mu) ** 2 for x, p in tab.items())
    return mu, var


def soma_dados(n):
    """Distribuição exata da soma de n dados: convolução (e, até n = 5, força bruta)."""
    d = {0: Fr(1)}
    for _ in range(n):
        e = {}
        for t, q in d.items():
            for f in range(1, 7):
                e[t + f] = e.get(t + f, 0) + q / 6
        d = e
    if n <= 5:
        cont = {}
        for faces in itertools.product(range(1, 7), repeat=n):
            s = sum(faces)
            cont[s] = cont.get(s, 0) + 1
        bruta = {s: Fr(c, 6 ** n) for s, c in cont.items()}
        exigir(bruta == d, f"dados: convolução e força bruta diferem para n = {n}")
    return dict(sorted(d.items()))


def dentro_dados(n, k):
    d = soma_dados(n)
    mu, var = media_var(d)
    sd = math.sqrt(var)
    return float(sum(p for s, p in d.items() if abs(float(s) - float(mu)) < k * sd - 1e-9))


# ---------------------------------------------------------------------------------------
# Enunciados dos exercícios, escritos de forma independente do código dos widgets
# ---------------------------------------------------------------------------------------

def resolver_ex1():
    """X = -1, 0, 1, 2 com P = k/4, 1/6, k/3, 1/4. Cada P é c*k + d."""
    xs = [-1, 0, 1, 2]
    cd = [(Fr(1, 4), Fr(0)), (Fr(0), Fr(1, 6)), (Fr(1, 3), Fr(0)), (Fr(0), Fr(1, 4))]
    c = sum(a for a, _ in cd)
    d = sum(b for _, b in cd)
    k = (1 - d) / c
    ps = [a * k + b for a, b in cd]
    mu = sum(Fr(x) * p for x, p in zip(xs, ps))
    return {"x": xs, "k": k, "p": ps, "mu": mu, "c": c, "d": d}


def resolver_ex2():
    """X = 1, 2, 3 com P = a, b, 1/4 e μ = 1,9."""
    # a + b = 3/4 ;  a + 2b + 3/4 = 19/10  ->  a + 2b = 23/20 -> b = 23/20 - 3/4 = 2/5
    sistema = [(Fr(1), Fr(1), 1 - Fr(1, 4)), (Fr(1), Fr(2), Fr(19, 10) - 3 * Fr(1, 4))]
    (a1, b1, r1), (a2, b2, r2) = sistema
    det = a1 * b2 - a2 * b1
    a = (r1 * b2 - r2 * b1) / det
    b = (a1 * r2 - a2 * r1) / det
    return {"x": [1, 2, 3], "a": a, "b": b, "mu": Fr(19, 10)}


def resolver_ex3():
    tab = urna_bruta(2, 3)
    mu, var = media_var(tab)
    p3 = tab[3]
    ge2 = sum(p for k, p in tab.items() if k >= 2)
    return {"tab": [tab[k] for k in sorted(tab)], "mu": mu, "var": var, "sigma": math.sqrt(var),
            "p3": p3, "ge2": ge2, "cond": p3 / ge2}


def resolver_ex4():
    mu, sigma = 20, 2
    p41 = cdf(22, mu, sigma) - cdf(18, mu, sigma)
    p42 = 1 - cdf(24, mu, sigma)
    return {"mu": mu, "sigma": sigma, "p41": p41, "p42": p42, "p43": 400 * p42,
            "p42_milesimas": round(p42, 3), "esperadas_inteiro": round(400 * p42),
            "centro": cdf(24, mu, sigma) - cdf(16, mu, sigma)}


# ---------------------------------------------------------------------------------------
# 1. Verdadeiro ou falso
# ---------------------------------------------------------------------------------------

def _tabelas_aleatorias(n=60):
    """Tabelas de distribuição aleatórias (probabilidades racionais que somam 1)."""
    import random
    rnd = random.Random(12345)
    for _ in range(n):
        m = rnd.randint(2, 6)
        pesos = [rnd.randint(0, 9) for _ in range(m)]
        if sum(pesos) == 0:
            pesos[0] = 1
        xs = sorted(rnd.sample(range(-5, 10), m))
        t = sum(pesos)
        yield {x: Fr(p, t) for x, p in zip(xs, pesos)}


def resolver_vf():
    """Para cada id, devolve (valor de verdade calculado aqui, pormenores a conferir)."""
    r = {}
    # t-soma: a soma das probabilidades é sempre 1 numa tabela de distribuição
    r["t-soma"] = all(sum(t.values()) == 1 for t in _tabelas_aleatorias())
    # t-media-valor: contraexemplo da moeda (X=0 ou 1, 1/2 cada): μ = 1/2 não é valor de X
    moeda = {0: Fr(1, 2), 1: Fr(1, 2)}
    mu_moeda, _ = media_var(moeda)
    r["t-media-valor"] = all(media_var(t)[0] in t for t in _tabelas_aleatorias()) and mu_moeda in moeda
    exigir(mu_moeda == Fr(1, 2), "t-media-valor: μ da moeda devia ser 0,5")
    # t-var-negativa: a variância nunca é negativa; só é 0 se X é constante
    r["t-var-negativa"] = all(media_var(t)[1] >= 0 for t in _tabelas_aleatorias())
    exigir(media_var({3: Fr(1)})[1] == 0, "t-var-negativa: X constante devia ter variância 0")
    # t-unidades: Y = cX: σ(Y) = |c| σ(X) (mesma unidade) e σ²(Y) = c² σ²(X) (unidade ao quadrado)
    ok = True
    for t in _tabelas_aleatorias(30):
        c = Fr(7, 3)
        tc = {x * c: p for x, p in t.items()}
        v, vc = media_var(t)[1], media_var(tc)[1]
        ok = ok and vc == c * c * v and math.isclose(math.sqrt(vc), float(c) * math.sqrt(v), rel_tol=1e-12)
    r["t-unidades"] = ok
    # t-media-zero: contraexemplo X = -1 ou 1 com 1/2 cada: μ = 0 e variância 1
    sim = {-1: Fr(1, 2), 1: Fr(1, 2)}
    m, v = media_var(sim)
    exigir((m, v) == (0, 1), "t-media-zero: X = ±1 devia ter μ = 0 e σ² = 1")
    r["t-media-zero"] = not (m == 0 and 0 not in sim)   # «μ = 0 implica todos os valores 0» é falso
    # t-equitativo: valor médio do ganho = 0 <=> jogo equitativo. Jogo do saco com amarela a -5 €
    ganho = {2: Fr(5, 10), -5: Fr(2, 10), 0: Fr(3, 10)}
    exigir(media_var(ganho)[0] == 0, "t-equitativo: o jogo do saco com −5 € devia ter μ = 0")
    ganho_mau = {2: Fr(5, 10), -3: Fr(2, 10), 0: Fr(3, 10)}
    exigir(media_var(ganho_mau)[0] > 0, "t-equitativo: com −3 € devia favorecer o jogador (μ > 0)")
    r["t-equitativo"] = True   # definição de jogo equitativo; os dois casos acima ilustram-na
    # t-condicionada: X=1,2,3,4 com 2/5, 3/10, 1/5, 1/10; P(X=3|X>=2) = 1/3 != P(X=3) = 1/5
    tc = {1: Fr(2, 5), 2: Fr(3, 10), 3: Fr(1, 5), 4: Fr(1, 10)}
    exigir(sum(tc.values()) == 1, "t-condicionada: a tabela não soma 1")
    p3 = tc[3]
    pge2 = sum(p for k, p in tc.items() if k >= 2)
    cond = p3 / pge2
    exigir((p3, pge2, cond) == (Fr(1, 5), Fr(3, 5), Fr(1, 3)), "t-condicionada: contas da explicação não batem")
    r["t-condicionada"] = (cond == p3)
    # t-k: probabilidades k, 2k e 0,4: a equação é a soma, k = 0,2
    k = (1 - Fr(4, 10)) / 3
    exigir(k == Fr(1, 5), "t-k: k + 2k + 0,4 = 1 dá k = 0,2")
    r["t-k"] = False   # igualar CADA probabilidade a 1 é errado: k = 1 e 2k = 1 são incompatíveis
    exigir(2 * Fr(1) != 1, "t-k: k = 1 e 2k = 1 não podem ser verdadeiras ao mesmo tempo")
    # n-area: a área total é 1 para qualquer (μ, σ): integração numérica
    ok = True
    for mu, sg in ((0, 1), (3, 2), (-5, 0.5), (10, 4)):
        n = 20000
        a, b = mu - 12 * sg, mu + 12 * sg
        h = (b - a) / n
        area = sum(densidade(a + (i + 0.5) * h, mu, sg) for i in range(n)) * h
        ok = ok and abs(area - 1) < 1e-9
    r["n-area"] = ok
    # n-sigma: com σ maior a curva é MAIS BAIXA (pico 1/(σ√2π)) e mais larga
    p1 = densidade(0, 0, 1)
    p2 = densidade(0, 0, 2)
    exigir(math.isclose(p2, p1 / 2, rel_tol=1e-12), "n-sigma: a curva de σ = 2 devia ter metade da altura da de σ = 1")
    r["n-sigma"] = p2 > p1
    # n-mu: N(μ+3, σ) é N(μ, σ) deslocada 3 para a direita, mesma forma
    ok = all(math.isclose(densidade(x + 3, 3, 1.7), densidade(x, 0, 1.7), rel_tol=1e-12) for x in (-4, -1, 0, 0.3, 2, 5))
    r["n-mu"] = ok
    # n-dois-sigma: P(μ-2σ<X<μ+2σ) ≈ 0,9545 (não 0,6827), para vários μ, σ
    ok_falso = True
    for mu, sg in ((0, 1), (100, 10), (-3, 0.5)):
        p = cdf(mu + 2 * sg, mu, sg) - cdf(mu - 2 * sg, mu, sg)
        exigir(abs(p - 0.9545) < 5e-5, f"n-dois-sigma: P(μ±2σ) = {p:.5f} devia ser 0,9545")
        ok_falso = ok_falso and abs(p - 0.6827) < 5e-5
    r["n-dois-sigma"] = ok_falso
    # n-simetria: P(X<μ) = P(X>μ) = 0,5
    r["n-simetria"] = all(abs(cdf(mu, mu, sg) - 0.5) < 1e-12 and abs((1 - cdf(mu, mu, sg)) - 0.5) < 1e-12
                          for mu, sg in ((0, 1), (10, 3), (-2, 0.7)))
    # n-ponto: X ~ N(10, 3): P(X=10) = 0 (limite de P(10-h<X<10+h) quando h->0), e P(X>10) = 0,5
    pequenos = [cdf(10 + h, 10, 3) - cdf(10 - h, 10, 3) for h in (1e-2, 1e-4, 1e-6)]
    exigir(pequenos[0] > pequenos[1] > pequenos[2] and pequenos[2] < 1e-5, "n-ponto: P(10-h<X<10+h) devia tender para 0")
    exigir(abs((1 - cdf(10, 10, 3)) - 0.5) < 1e-12, "n-ponto: P(X>10) devia ser 0,5")
    r["n-ponto"] = abs(pequenos[2] - 0.5) < 1e-9   # «P(X=10) = 0,5» é falso
    return r


def verificar_vf():
    caminho = TEMA / "dados" / "verdadeiro-falso.json"
    d = json.loads(caminho.read_text(encoding="utf-8"))
    afs = d["afirmacoes"]
    ids = [a["id"] for a in afs]
    exigir(len(ids) == len(set(ids)), "verdadeiro-falso.json: ids repetidos")
    temas = {t["id"] for t in d["temas"]}
    for a in afs:
        for campo in ("id", "tema", "texto", "verdadeira", "explicacao"):
            exigir(campo in a, f"verdadeiro-falso.json: {a.get('id', '?')} sem «{campo}»")
        exigir(a["tema"] in temas, f"verdadeiro-falso.json: {a['id']}: tema «{a['tema']}» desconhecido")
        exigir(isinstance(a["verdadeira"], bool), f"verdadeiro-falso.json: {a['id']}: «verdadeira» não é booleano")
        for campo in ("texto", "explicacao", "erroComum"):
            t = a.get(campo, "")
            exigir(t.count("$") % 2 == 0, f"verdadeiro-falso.json: {a['id']}.{campo} com $ desequilibrados")
            exigir(not re.search(r"\d\.\d", re.sub(r"\$[^$]*\$", "", t)), f"verdadeiro-falso.json: {a['id']}.{campo}: ponto decimal em vez de vírgula")
    calc = resolver_vf()
    exigir(set(calc) == set(ids), f"verdadeiro-falso.json: ids {sorted(set(ids) ^ set(calc))} sem resolução independente")
    for a in afs:
        if a["id"] in calc:
            exigir(calc[a["id"]] == a["verdadeira"],
                   f"verdadeiro-falso.json: {a['id']}: marcada como {a['verdadeira']} mas a conta dá {calc[a['id']]}")
    # figuras: as probabilidades somam 1 e os destaques são valores de x
    for a in afs:
        f = a.get("figura")
        if not f:
            continue
        if f["tipo"] == "barras":
            exigir(len(f["x"]) == len(f["p"]) and abs(sum(f["p"]) - 1) < 1e-12, f"{a['id']}: a figura de barras não soma 1")
            for x in f.get("destaque", []):
                exigir(x in f["x"], f"{a['id']}: destaque {x} não é valor de x")
        if f["tipo"] == "normal-intervalo":
            exigir(f["k"] == 2 and f["sigma"] > 0, f"{a['id']}: figura normal-intervalo (k = {f['k']})")
    byid = {a["id"]: a for a in afs}
    # números escritos nos enunciados e nas explicações, recalculados aqui
    tf = lambda n, d_: f"\\tfrac{n}{d_}"
    virg = lambda x, c=4: f"{x:.{c}f}".replace(".", ",")
    cdf2 = cdf(2, 0, 1) - cdf(-2, 0, 1)
    cdf1 = cdf(1, 0, 1) - cdf(-1, 0, 1)
    k_t = (1 - Fr(4, 10)) / 3
    tc = {1: Fr(2, 5), 2: Fr(3, 10), 3: Fr(1, 5), 4: Fr(1, 10)}
    ge2 = sum(p_ for x_, p_ in tc.items() if x_ >= 2)
    NUMEROS = {
        "t-media-valor": ("explicacao", ["0{,}5"]),
        "t-media-zero": ("explicacao", [tf(1, 2), "= 0"]),
        "t-condicionada": ("explicacao", [tf(1, 5), tf(3, 5), tf(1, 3), "1/5", "3/5"]),
        "t-k": ("explicacao", ["3k=0{,}6", "k=" + virg(float(k_t), 1).replace(",", "{,}"), "0{,}4"]),
        "n-dois-sigma": ("explicacao", [virg(cdf2), virg(cdf1)]),
        "n-sigma": ("explicacao", ["metade da altura", "\\sigma=2", "\\sigma=1"]),
        "n-mu": ("explicacao", ["3 unidades", "\\mu=3", "\\mu=0"]),
        "n-simetria": ("explicacao", ["0,5"]),
        "n-ponto": ("explicacao", ["0,5"]),
    }
    for id_, (campo, textos) in NUMEROS.items():
        for tx in textos:
            exigir(tx in byid[id_][campo], f"verdadeiro-falso.json: {id_}.{campo} devia conter «{tx}» (número recalculado)")
    for f_ in tc.values():
        exigir(f"\\frac{{{f_.numerator}}}{{{f_.denominator}}}" in byid["t-condicionada"]["texto"], f"t-condicionada: o enunciado devia conter a fração {f_}")
    exigir("N(10,\\,3)" in byid["n-ponto"]["texto"] and "0{,}5" in byid["n-ponto"]["texto"], "n-ponto: o enunciado devia ser N(10, 3) e 0,5")
    exigir(abs(cdf(10, 10, 3) - 0.5) < 1e-12 and cdf2 > 0.9544 and ge2 == Fr(3, 5), "números de apoio das explicações")
    exigir(byid["n-sigma"]["figura"] == {"tipo": "normal", "mu": 0, "sigma": [1, 2]}, "n-sigma: a figura devia ser μ = 0 com σ = 1 e 2 (a explicação fala nesses valores)")
    exigir(byid["n-mu"]["figura"] == {"tipo": "normal", "mu": [0, 3], "sigma": 1}, "n-mu: a figura devia ser μ = 0 e 3 com σ = 1")
    exigir(byid["t-condicionada"]["figura"]["p"] == [0.4, 0.3, 0.2, 0.1], "t-condicionada: a figura devia ter as probabilidades do enunciado")
    n_verd = sum(a["verdadeira"] for a in afs)
    print(f"verdadeiro-falso.json: {len(afs)} afirmações ({n_verd} verdadeiras), cada uma resolvida de forma independente")
    return calc


# ---------------------------------------------------------------------------------------
# 2 e 3. Exercícios e matéria; 4. esperado.json
# ---------------------------------------------------------------------------------------

def arred(x, casas=12):
    return round(float(x), casas)


def construir_esperado():
    e1, e2, e3, e4 = resolver_ex1(), resolver_ex2(), resolver_ex3(), resolver_ex4()
    exigir((e1["k"], e1["mu"]) == (1, Fr(7, 12)), f"ex. 1: k = {e1['k']}, μ = {e1['mu']} (esperado 1 e 7/12)")
    exigir(sum(e1["p"]) == 1 and all(0 <= p <= 1 for p in e1["p"]), "ex. 1: tabela inválida")
    exigir((e2["a"], e2["b"]) == (Fr(7, 20), Fr(2, 5)), f"ex. 2: a = {e2['a']}, b = {e2['b']} (esperado 7/20 e 2/5)")
    exigir(e2["a"] + e2["b"] + Fr(1, 4) == 1, "ex. 2: a + b + 1/4 não dá 1")
    exigir(e2["a"] + 2 * e2["b"] + 3 * Fr(1, 4) == Fr(19, 10), "ex. 2: o valor médio não dá 1,9")
    exigir(e3["tab"] == [Fr(2, 5), Fr(3, 10), Fr(1, 5), Fr(1, 10)], f"ex. 3: tabela {e3['tab']}")
    exigir((e3["mu"], e3["var"], e3["cond"]) == (2, 1, Fr(1, 3)), "ex. 3: μ, σ² ou P(X=3|X≥2) não batem")
    exigir(abs(e4["p41"] - 0.6827) < 5e-5 and abs(e4["p42"] - 0.02275) < 5e-6, "ex. 4: valores da Normal")
    exigir((e4["p42_milesimas"], e4["esperadas_inteiro"]) == (0.023, 9), "ex. 4: 0,023 e 9 baterias")

    urna = urna_bruta(3, 4)
    mu_u, var_u = media_var(urna)
    exigir(urna == {1: Fr(3, 7), 2: Fr(2, 7), 3: Fr(6, 35), 4: Fr(3, 35), 5: Fr(1, 35)}, f"urna 3V+4A: {urna}")
    exigir((mu_u, var_u) == (2, Fr(6, 5)), f"urna 3V+4A: μ = {mu_u}, σ² = {var_u}")
    exigir(urna[2] == Fr(4, 7) * Fr(3, 6) == Fr(2, 7), "matéria: P(X=2) = 4/7 × 3/6 = 2/7")

    # jogo do saco: 5 vermelhas (+2), 2 amarelas (prémio p), 3 azuis (0): μ = 1 + p/5
    jogo = {str(p): fstr(Fr(5, 10) * 2 + Fr(2, 10) * p) for p in range(-10, 1)}
    exigir(jogo["-5"] == "0" and jogo["-3"] == "2/5" and jogo["-10"] == "-1", f"jogo: {jogo}")

    dados = {}
    for n in range(1, 13):
        d = soma_dados(n)
        mu, var = media_var(d)
        exigir(mu == Fr(7 * n, 2) and var == Fr(35 * n, 12) and sum(d.values()) == 1, f"dados n = {n}: μ, σ² ou soma não batem")
        dados[str(n)] = {"mu": arred(mu), "sigma": arred(math.sqrt(var)), "dentro1": arred(dentro_dados(n, 1), 12),
                         "dentro2": arred(dentro_dados(n, 2), 12), "maisProvavel": max(d, key=lambda s: d[s])}
    d2 = soma_dados(2)
    exigir(d2[7] == Fr(6, 36) and max(d2.values()) == d2[7], "dados: com dois dados o 7 (6 em 36) é o mais provável")
    exigir(abs(sum(p for s, p in soma_dados(6).items() if 17 <= s <= 25) - 0.7107) < 5e-5, "matéria: P(17≤S≤25) com 6 dados ≈ 0,71")
    exigir(abs(math.sqrt(17.5) - 4.18) < 5e-3, "matéria: σ = √17,5 ≈ 4,18")
    exigir(abs(phi(1) - phi(-1) - 0.6827) < 5e-5 and abs(phi(2) - phi(-2) - 0.9545) < 5e-5 and abs(phi(3) - phi(-3) - 0.9973) < 5e-5,
           "matéria: regra 68-95-99,7")
    exigir(abs((1 - 0.9545) / 2 - 0.02275) < 1e-12 and abs((1 - phi(2)) - 0.0228) < 5e-5, "matéria: P(X>120) = 0,02275 ≈ 0,0228")

    # Normal: valores que o widget deve mostrar (μ, σ, k) e (μ, σ, a, b) e caudas
    normal = {"k": [], "cauda": [], "entre": []}
    for mu in (-10, -5, 0, 0.5, 7.5, 10):
        for sg in (0.5, 1, 1.7, 2.5, 4):
            for k in (1, 2, 3):
                normal["k"].append([mu, sg, k, arred(cdf(mu + k * sg, mu, sg) - cdf(mu - k * sg, mu, sg))])
            for c in (mu - sg, mu, mu + 0.5 * sg, mu + 2 * sg):
                c = round(c, 1)
                normal["cauda"].append([mu, sg, c, arred(1 - cdf(c, mu, sg))])
            a, b = round(mu - 1.5 * sg, 1), round(mu + 0.7 * sg, 1)
            normal["entre"].append([mu, sg, a, b, arred(cdf(b, mu, sg) - cdf(a, mu, sg))])
    # Normal do exercício 4: sliders μ em [16, 24] e σ em [1, 4]; valores livres no eixo [12, 28]
    exn = {"k": [], "livre": []}
    for mu in (16, 18, 20, 22.5, 24):
        for sg in (1, 1.5, 2, 3.2, 4):
            for k in (1, 2):
                exn["k"].append([mu, sg, k, arred(cdf(mu + k * sg, mu, sg) - cdf(mu - k * sg, mu, sg))])
            a = max(12.0, round(mu - 1.2 * sg, 1))
            b = min(28.0, round(mu + 0.4 * sg + 1, 1))
            exn["livre"].append([mu, sg, a, b, arred(cdf(b, mu, sg) - cdf(a, mu, sg))])
    exn["cauda"] = {"esquerda": arred(cdf(16, 20, 2)), "centro": arred(cdf(24, 20, 2) - cdf(16, 20, 2)), "direita": arred(1 - cdf(24, 20, 2))}

    # tabelas do widget «Mexer na tabela»: probabilidades em centésimas (somam 100) com μ, σ² e σ exatos
    import random
    rnd = random.Random(2026)
    cortes = [[10, 40, 30, 20], [25, 25, 25, 25], [0, 0, 0, 100], [100, 0, 0, 0], [5, 5, 5, 85]]
    while len(cortes) < 60:
        c = sorted(rnd.randint(0, 100) for _ in range(3))
        cortes.append([c[0], c[1] - c[0], c[2] - c[1], 100 - c[2]])
    tabelas = []
    for c in cortes:
        t = {x: Fr(v, 100) for x, v in enumerate(c)}
        mu_t, var_t = media_var(t)
        tabelas.append({"c": c, "mu": arred(mu_t), "var": arred(var_t), "sigma": arred(math.sqrt(var_t))})
    exigir(tabelas[0]["mu"] == 1.6 and abs(tabelas[0]["var"] - 0.84) < 1e-12, "tabela inicial: μ = 1,6 e σ² = 0,84")
    simetria = [[mu, sg, arred(cdf(mu - 2 * sg, mu, sg)), arred(1 - cdf(mu + 2 * sg, mu, sg))] for mu in (0, 3) for sg in (1, 2.5)]
    for _, _, esq, dir_ in simetria:
        exigir(abs(esq - dir_) < 1e-12, "simetria das caudas")

    return {
        "_nota": "Gerado por tools/verificar_prob.py --gerar (contas independentes do JavaScript). Não editar à mão.",
        "ex1": {"x": e1["x"], "enunciado": ["k/4", "1/6", "k/3", "1/4"], "k": fstr(e1["k"]), "p": [fstr(p) for p in e1["p"]], "mu": fstr(e1["mu"])},
        "ex2": {"x": e2["x"], "enunciado": ["a", "b", "1/4"], "muDado": "19/10", "a": fstr(e2["a"]), "b": fstr(e2["b"])},
        "ex3": {"vermelhas": 2, "brancas": 3, "tabela": [fstr(p) for p in e3["tab"]], "pX3": fstr(e3["p3"]), "pGe2": fstr(e3["ge2"]),
                "cond": fstr(e3["cond"]), "mu": fstr(e3["mu"]), "var": fstr(e3["var"]), "sigma": arred(e3["sigma"])},
        "ex4": {"mu": e4["mu"], "sigma": e4["sigma"], "p41": arred(e4["p41"]), "p42": arred(e4["p42"]), "centro": arred(e4["centro"]),
                "n": 400, "p43": arred(e4["p43"]), "p42Milesimas": e4["p42_milesimas"], "esperadasInteiro": e4["esperadas_inteiro"]},
        "urna": {"vermelhas": 3, "azuis": 4, "tabela": [fstr(urna[k]) for k in sorted(urna)], "mu": fstr(mu_u), "var": fstr(var_u),
                 "sigma": arred(math.sqrt(var_u))},
        "jogo": jogo,
        "dados": dados,
        "dadosDois": {str(s): fstr(p) for s, p in d2.items()},
        "tabelas": tabelas,
        "exn": exn,
        "normal": normal,
        "simetria": simetria,
        "regra": {"k1": arred(phi(1) - phi(-1)), "k2": arred(phi(2) - phi(-2)), "k3": arred(phi(3) - phi(-3))},
    }


def _json(obj, nivel=0):
    """JSON com 1 espaço de indentação; as listas de números e textos ficam numa linha só."""
    pad = " " * (nivel + 1)
    if isinstance(obj, dict):
        if not obj:
            return "{}"
        itens = [f"{pad}{json.dumps(k, ensure_ascii=False)}: {_json(v, nivel + 1)}" for k, v in obj.items()]
        return "{\n" + ",\n".join(itens) + "\n" + " " * nivel + "}"
    if isinstance(obj, list) and any(isinstance(v, (dict, list)) for v in obj):
        if all(isinstance(v, list) and all(isinstance(w, (int, float, str)) for w in v) for v in obj):
            return "[\n" + ",\n".join(pad + json.dumps(v, ensure_ascii=False) for v in obj) + "\n" + " " * nivel + "]"
        return "[\n" + ",\n".join(pad + _json(v, nivel + 1) for v in obj) + "\n" + " " * nivel + "]"
    return json.dumps(obj, ensure_ascii=False)


def verificar_esperado(gerar=False):
    novo = construir_esperado()
    texto = _json(novo) + "\n"
    if gerar:
        ESPERADO.parent.mkdir(exist_ok=True)
        ESPERADO.write_text(texto, encoding="utf-8")
        print(f"escrito {ESPERADO.relative_to(RAIZ)}")
        return novo
    if not ESPERADO.is_file():
        falha("probabilidades/tests/esperado.json não existe (correr com --gerar)")
        return novo
    atual = json.loads(ESPERADO.read_text(encoding="utf-8"))
    exigir(atual == json.loads(json.dumps(novo)), "probabilidades/tests/esperado.json não é o que se recalcula (correr com --gerar e rever)")
    print("exercícios, urna, jogo, dados e Normal: recalculados de forma independente e iguais a tests/esperado.json")
    return novo


# ---------------------------------------------------------------------------------------
# 5. Texto
# ---------------------------------------------------------------------------------------

PTBR = re.compile(r"\b(tela|arquivo|celular|você|vocês|equipe|ônibus|mouse|clicar)\b", re.I)
TRACOS = ("\u2014", "\u2013")


def verificar_texto():
    n = 0
    for p in sorted(TEMA.rglob("*")):
        if not p.is_file() or p.suffix not in {".html", ".js", ".json", ".css"}:
            continue
        n += 1
        for i, linha in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            for t in TRACOS:
                if t in linha:
                    falha(f"travessão U+{ord(t):04X} em {p.relative_to(RAIZ)}:{i}")
            if p.suffix in {".html", ".json"} and TESTES not in p.parents and PTBR.search(re.sub(r"<[^>]+>", "", linha)):
                falha(f"palavra de pt-BR em {p.relative_to(RAIZ)}:{i}: {PTBR.search(linha).group(0)}")
    # sem pedidos a terceiros e com caminhos relativos (o site vive em /estudo/)
    for p in sorted(TEMA.rglob("*")):
        if not p.is_file() or p.suffix not in {".html", ".js", ".css"} or TESTES in p.parents:
            continue
        for i, linha in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
            if re.search(r"https?://(?!www\.w3\.org/2000/svg)", linha):
                falha(f"endereço externo em {p.relative_to(RAIZ)}:{i}")
            if re.search(r"(?:href|src)=\"/(?!/)", linha) or re.search(r"url\(\s*['\"]?/", linha):
                falha(f"caminho absoluto em {p.relative_to(RAIZ)}:{i}")
    print(f"texto: {n} ficheiros de probabilidades/ sem travessões, sem pt-BR, sem endereços externos nem caminhos absolutos")


# ---------------------------------------------------------------------------------------
# 6. Páginas de teste no browser
# ---------------------------------------------------------------------------------------

def correr_navegador():
    """Abre cada probabilidades/tests/*.html (menos os auxiliares) no Edge sem janela."""
    import functools
    import http.server
    import socketserver
    if not EDGE.is_file():
        falha(f"Edge não encontrado em {EDGE}")
        return
    paginas = sorted(p.name for p in TESTES.glob("*.html") if p.name != "demo.html")   # demo.html só serve para capturas de ecrã
    if not paginas:
        falha("não há páginas em probabilidades/tests/")
        return

    class Calado(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a):
            pass

    manipulador = functools.partial(Calado, directory=str(RAIZ))
    with socketserver.ThreadingTCPServer(("127.0.0.1", 0), manipulador) as srv:
        porta = srv.server_address[1]
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        with tempfile.TemporaryDirectory() as perfil:
            for nome in paginas:
                url = f"http://127.0.0.1:{porta}/probabilidades/tests/{nome}"
                try:
                    r = subprocess.run([str(EDGE), "--headless=new", "--disable-gpu", f"--user-data-dir={perfil}",
                                        "--virtual-time-budget=120000", "--dump-dom", url],
                                       capture_output=True, timeout=300, check=False)
                except subprocess.TimeoutExpired:
                    falha(f"tests/{nome}: Edge não terminou")
                    continue
                dom = r.stdout.decode("utf-8", "replace")
                m = re.search(r'data-testes="(\w+)"', dom)
                pre = re.search(r'<pre id="resultado">(.*?)</pre>', dom, re.S)
                import html as _html
                corpo = _html.unescape(pre.group(1)).strip() if pre else "(sem resultado)"
                estado = m.group(1) if m else "sem data-testes"
                ultima = corpo.splitlines()[-1] if corpo else ""
                print(f"tests/{nome}: {estado}: {ultima}")
                if estado != "ok":
                    falha(f"tests/{nome}: {estado}\n" + "\n".join("    " + l for l in corpo.splitlines()[:40]))
        srv.shutdown()


# ---------------------------------------------------------------------------------------

def correr(gerar=False):
    """Verifica os dados e o texto e devolve a lista de falhas (sem abrir o browser)."""
    falhas.clear()
    verificar_vf()
    verificar_esperado(gerar)
    verificar_texto()
    return list(falhas)


if __name__ == "__main__":
    args = sys.argv[1:]
    resultado = correr(gerar="--gerar" in args)
    if "--navegador" in args:
        correr_navegador()
        resultado = list(falhas)
    if resultado:
        print(f"\n{len(resultado)} falha(s).")
        sys.exit(1)
    print("\nTudo certo.")
