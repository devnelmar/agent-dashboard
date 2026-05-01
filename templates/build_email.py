#!/usr/bin/env python3
"""
Regenera email-jobhunting.html con datos nuevos del JSON.
Uso:
  python3 build_email.py                           # usa el JSON del template
  python3 build_email.py /tmp/jobs.json            # usa JSON externo
  python3 build_email.py /tmp/jobs.json output.html # archivo salida personalizado
"""
import json, sys, os

TEMPLATE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMPLATE = os.path.join(TEMPLATE_DIR, "email-jobhunting.html")

# ── Colors ──────────────────────────────────────────────────────────────
BG          = "#fbfaf8"
WHITE       = "#ffffff"
BG_SUNK     = "#f5f3f0"
BORDER      = "#e6e4e1"
TEXT        = "#1d1a16"
TEXT_MUTED  = "#66635e"
TEXT_FAINT  = "#918f8b"
ACCENT      = "#3f9c53"
ACCENT_SOFT = "#ddf6e0"
ACCENT_TEXT = "#035e23"
SCORE_HIGH  = "#3f9c53"
SCORE_MID   = "#d79628"
SCORE_LOW   = "#e06255"

FONT_DISPLAY = "'Inter Tight','Inter',system-ui,sans-serif"
FONT_BODY    = "'Inter',system-ui,sans-serif"

LANGS = {
    "ES": "linear-gradient(to bottom,#c60b1e 0 33%,#ffc400 33% 66%,#c60b1e 66%)",
    "EN": "linear-gradient(to bottom,#012169 0 33%,#ffffff 33% 66%,#c8102e 66%)",
    "IT": "linear-gradient(to right,#009246 0 33%,#ffffff 33% 66%,#ce2b37 66%)",
}

# ── Helpers ─────────────────────────────────────────────────────────────

def tier_for(score):
    if score >= 85: return "high"
    if score >= 60: return "mid"
    return "low"

def tier_label(score):
    if score >= 95: return "🔥 Excelente"
    if score >= 85: return "⭐ Top match"
    if score >= 60: return "• Viable"
    return "· Bajo"

def score_color(score):
    if score >= 85: return SCORE_HIGH
    if score >= 60: return SCORE_MID
    return SCORE_LOW

def lang_flag(lang_code):
    return LANGS.get((lang_code or "").upper(), TEXT_FAINT)

def esc(s):
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

# ── Templates ───────────────────────────────────────────────────────────

def render_stat_card(label, value, meta, accent=False):
    bg_c = ACCENT_SOFT if accent else WHITE
    border_c = "transparent" if accent else BORDER
    text_c = ACCENT_TEXT if accent else TEXT
    return f"""<td width="25%" style="padding:18px 16px;background:{bg_c};border:1px solid {border_c};border-radius:10px;">
  <div style="font-size:12px;font-weight:500;color:{TEXT_MUTED};text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px;">{esc(label)}</div>
  <div style="font-family:{FONT_DISPLAY};font-size:32px;font-weight:600;color:{text_c};line-height:1;">{value}</div>
  <div style="font-size:12px;color:{TEXT_FAINT};margin-top:6px;">{esc(meta)}</div>
</td>"""

def render_stats(data, stats):
    t = stats.get("total", len(data.get("jobs", [])))
    v = stats.get("viables", 0)
    top = stats.get("top", 0)
    n = stats.get("nuevas", 0)
    return f"""<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;">
<tr>
{render_stat_card("Total", t, "ofertas")}
<td width="4"></td>
{render_stat_card("Viables", v, "score ≥ 60")}
<td width="4"></td>
{render_stat_card("Top", top, "score ≥ 85", accent=True)}
<td width="4"></td>
{render_stat_card("Nuevas", n, "hoy")}
</tr>
</table>"""

def render_job_card(job, idx):
    score = job.get("score", 0)
    tier = tier_for(score)
    sc = score_color(score)
    pct = min(100, max(0, score))

    # Insights
    insights = ""
    parts = []
    if job.get("matchReason"):
        parts.append(f'  🎯 <strong style="color:{TEXT};font-weight:500;">Match:</strong> {esc(job["matchReason"])}')
    if job.get("highlight"):
        parts.append(f'  💡 <strong style="color:{TEXT};font-weight:500;">Dato:</strong> {esc(job["highlight"])}')
    if parts:
        insights = f"""<div style="padding:14px 16px;background:{BG_SUNK};border-radius:10px;margin-top:16px;font-size:13px;line-height:1.55;color:{TEXT_MUTED};">
{chr(10).join(parts)}
</div>"""

    # Email section
    email = job.get("email", {})
    lang = email.get("lang", "EN")
    body_paras = (email.get("body", "") or "").split("\n\n")
    body_html = "".join(
        f'<p style="font-size:13px;color:{TEXT};line-height:1.55;">{esc(p)}</p>'
        for p in body_paras if p.strip()
    )

    apply_html = ""
    if job.get("applyUrl"):
        via = job.get("applyVia", "enlace")
        apply_html = f"""<div style="padding:10px 16px;border-top:1px solid {BORDER};">
    <a href="{esc(job['applyUrl'])}" style="display:inline-flex;align-items:center;gap:6px;color:{ACCENT};text-decoration:none;font-size:13px;font-weight:500;">↗ Aplicar via {esc(via)}</a>
  </div>"""

    return f"""<!-- JOB {idx+1}: {esc(job.get("company",""))} -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:{WHITE};border:1px solid {BORDER};border-radius:14px;margin-bottom:16px;">
<tr><td style="padding:22px 24px 20px;">

<table width="100%"><tr>
<td style="vertical-align:top;">
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:12px;color:{TEXT_MUTED};">
    <span style="display:inline-flex;align-items:center;gap:5px;padding:2px 8px;background:{BG_SUNK};border-radius:5px;font-weight:500;font-size:11px;color:{TEXT_MUTED};">{tier_label(score)}</span>
    <span>{esc(job.get("location",""))}</span>
    <span>·</span>
    <span>🕐 {esc(job.get("posted",""))}</span>
  </div>
  <h2 style="font-family:{FONT_DISPLAY};font-size:18px;font-weight:600;margin:0 0 6px;line-height:1.3;color:{TEXT};">{esc(job.get("title",""))}</h2>
  <p style="font-size:13px;color:{TEXT_MUTED};margin:0;"><strong style="color:{TEXT};font-weight:500;">{esc(job.get("company",""))}</strong>{f" — {esc(job['companyInfo'])}" if job.get("companyInfo") else ""}</p>
</td>
<td width="88" style="text-align:right;vertical-align:top;">
  <div style="font-family:{FONT_DISPLAY};font-size:28px;font-weight:600;line-height:1;color:{TEXT};">{score}<span style="font-size:13px;color:{TEXT_FAINT};font-weight:500;">/100</span></div>
  <div style="margin-top:8px;height:4px;background:{BG_SUNK};border-radius:99px;overflow:hidden;"><div style="height:100%;width:{pct}%;background:{sc};border-radius:99px;"></div></div>
  <div style="font-size:11px;color:{TEXT_FAINT};text-transform:uppercase;letter-spacing:0.06em;margin-top:6px;font-weight:500;">Match</div>
</td>
</tr></table>

{insights}

<div style="border:1px solid {BORDER};border-radius:10px;background:{BG};margin-top:16px;overflow:hidden;">
  <div style="padding:14px 16px;border-bottom:1px solid {BORDER};">
    <span style="display:inline-block;padding:2px 8px;background:{WHITE};border:1px solid {BORDER};border-radius:5px;font-size:12px;font-weight:500;margin-right:10px;"><span style="display:inline-block;width:14px;height:10px;border-radius:2px;background:{lang_flag(lang)};vertical-align:middle;margin-right:4px;"></span> {esc(lang)}</span>
    Para <strong style="font-weight:500;">{esc(email.get("to","Hiring Manager"))}</strong>
  </div>
  <div style="padding:14px 16px;">
    <div style="margin-bottom:10px;font-size:13px;"><span style="color:{TEXT_FAINT};">Asunto</span> {esc(email.get("subject",""))}</div>
    {body_html}
  </div>
  {apply_html}
</div>

</td></tr></table>"""

# ── Main ────────────────────────────────────────────────────────────────

def main():
    # Load data
    if len(sys.argv) > 1:
        with open(sys.argv[1]) as f:
            data = json.load(f)
    else:
        with open(TEMPLATE) as f:
            raw = f.read()
        start = raw.find('<script type="application/json" id="job-data">')
        end = raw.find('</script>', start)
        data = json.loads(raw[start + len('<script type="application/json" id="job-data">'):end])

    date = data.get("date", "")
    stats = data.get("stats", {})
    jobs = data.get("jobs", [])
    jobs_sorted = sorted(jobs, key=lambda j: j.get("score", 0), reverse=True)

    # Stats
    if not stats:
        stats = {
            "total": len(jobs),
            "viables": sum(1 for j in jobs if j.get("score", 0) >= 60),
            "top": sum(1 for j in jobs if j.get("score", 0) >= 85),
            "nuevas": sum(1 for j in jobs if any(w in (j.get("posted","")).lower() for w in ("hour","hours","today","hoy","minuto","minutos"))),
        }
    stats_html = render_stats(data, stats)

    # Job cards
    cards = "\n\n".join(render_job_card(j, i) for i, j in enumerate(jobs_sorted))

    # Counts for toolbar
    top_n = sum(1 for j in jobs if j.get("score", 0) >= 85)
    viable_n = sum(1 for j in jobs if j.get("score", 0) >= 60)

    # Serialize data back for embedding
    data_json = json.dumps(data, ensure_ascii=False, indent=2)

    html = f"""<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Informe Diario — Megan Jobhunting</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

<script type="application/json" id="job-data">
{data_json}
</script>
</head>
<body style="margin:0;padding:0;background:{BG};color:{TEXT};font-family:{FONT_BODY};font-size:15px;line-height:1.55;-webkit-font-smoothing:antialiased;">

<table width="100%" cellpadding="0" cellspacing="0" style="background:{BG};">
<tr><td align="center" style="padding:32px 28px 96px;">

<table width="100%" style="max-width:640px;">

<!-- Top bar -->
<tr><td style="padding-bottom:28px;border-bottom:1px solid {BORDER};">
<table width="100%"><tr>
<td style="font-family:{FONT_DISPLAY};font-weight:600;font-size:15px;letter-spacing:-0.01em;color:{TEXT};">
  ■&nbsp;Jobhunting <span style="color:{TEXT_MUTED};font-size:13px;margin-left:4px;">— reporte diario</span>
</td>
</tr></table>
</td></tr>

<!-- Header -->
<tr><td style="padding-top:32px;padding-bottom:36px;">
<div style="display:inline-flex;align-items:center;gap:8px;color:{TEXT_MUTED};font-size:12px;font-weight:500;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:12px;">
  <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:{ACCENT};box-shadow:0 0 0 4px {ACCENT_SOFT};"></span>
  Reporte diario · Megan
</div>
<h1 style="font-family:{FONT_DISPLAY};font-size:32px;font-weight:600;letter-spacing:-0.025em;line-height:1.1;margin:0 0 10px;">Tus matches de hoy</h1>
<p style="color:{TEXT_MUTED};font-size:15px;margin:0;">{esc(date)}</p>

{stats_html}
</td></tr>

<!-- Toolbar -->
<tr><td style="padding-top:32px;padding-bottom:24px;">
<div style="display:inline-flex;background:{WHITE};border:1px solid {BORDER};border-radius:10px;padding:3px;">
  <span style="padding:6px 14px;border-radius:7px;background:{BG_SUNK};color:{TEXT};font-size:13px;font-weight:500;display:inline-block;">🔥 Top {top_n}</span>
  <span style="padding:6px 14px;border-radius:7px;color:{TEXT_MUTED};font-size:13px;font-weight:500;display:inline-block;">⭐ Viables {viable_n}</span>
  <span style="padding:6px 14px;border-radius:7px;color:{TEXT_MUTED};font-size:13px;font-weight:500;display:inline-block;">Todos {len(jobs)}</span>
</div>
</td></tr>

<!-- Job cards -->
<tr><td>
{cards}
</td></tr>

<!-- Footer -->
<tr><td style="padding-top:24px;text-align:center;font-size:13px;color:{TEXT_FAINT};">
  Generado por agente · {len(jobs)} jobs en este reporte
</td></tr>

</table>

</td></tr>
</table>

</body>
</html>"""

    out_path = sys.argv[2] if len(sys.argv) > 2 else "/tmp/megan_daily_report.html"
    with open(out_path, "w") as f:
        f.write(html)
    print(f"✅ {out_path} — {len(jobs)} jobs, {stats.get('top',0)} top matches")


if __name__ == "__main__":
    main()
