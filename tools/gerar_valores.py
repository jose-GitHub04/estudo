"""Gera trigonometria/dados/valores.json: sin, cos e tan exatos dos ângulos notáveis.

Parte da tabela do 1.º quadrante (0, 30, 45, 60, 90) e aplica o sinal de cada
quadrante. A verificação independente (contra math.sin/cos/tan) está em
verificar.py: correr sempre depois de mexer aqui.

Uso: python -I tools/gerar_valores.py
"""
import json
from pathlib import Path

# ângulo -> (expr, tex) no 1.º quadrante; None onde não existe
SIN = {0: ("0", "0"), 30: ("1/2", r"\frac{1}{2}"), 45: ("sqrt(2)/2", r"\frac{\sqrt{2}}{2}"),
       60: ("sqrt(3)/2", r"\frac{\sqrt{3}}{2}"), 90: ("1", "1")}
COS = {0: SIN[90], 30: SIN[60], 45: SIN[45], 60: SIN[30], 90: SIN[0]}
TAN = {0: ("0", "0"), 30: ("sqrt(3)/3", r"\frac{\sqrt{3}}{3}"), 45: ("1", "1"),
       60: ("sqrt(3)", r"\sqrt{3}"), 90: None}

ANGULOS = [0, 30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330, 360]


def com_sinal(valor, negativo):
    if valor is None:
        return None
    expr, tex = valor
    if expr == "0" or not negativo:
        return {"expr": expr, "tex": tex}
    return {"expr": "-" + expr, "tex": "-" + tex}


def linha(g):
    if g <= 90:
        ref, s_sin, s_cos, s_tan = g, False, False, False
    elif g <= 180:
        ref, s_sin, s_cos, s_tan = 180 - g, False, True, True
    elif g <= 270:
        ref, s_sin, s_cos, s_tan = g - 180, True, True, False
    else:
        ref, s_sin, s_cos, s_tan = 360 - g, True, False, True
    return {
        "graus": g,
        "sin": com_sinal(SIN[ref], s_sin),
        "cos": com_sinal(COS[ref], s_cos),
        "tan": com_sinal(TAN[ref], s_tan),
    }


if __name__ == "__main__":
    saida = Path(__file__).resolve().parent.parent / "trigonometria" / "dados" / "valores.json"
    dados = {
        "_nota": "tan é null onde não está definida (90° e 270°). Gerado por tools/gerar_valores.py.",
        "angulos": [linha(g) for g in ANGULOS],
    }
    saida.write_text(json.dumps(dados, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"escrito {saida} ({len(ANGULOS)} ângulos)")
