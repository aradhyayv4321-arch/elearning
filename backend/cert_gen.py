"""
LearnVault — Certificate PDF Generator
Uses reportlab to create professional course completion certificates.
"""

import os
import pathlib
from datetime import datetime

from reportlab.lib.pagesizes import landscape, A4
from reportlab.lib.units import cm, mm
from reportlab.lib.colors import HexColor
from reportlab.pdfgen import canvas

CERT_DIR = pathlib.Path(__file__).resolve().parent / "certificates"
CERT_DIR.mkdir(exist_ok=True)


def generate_certificate(
    student_name: str,
    course_name: str,
    score_pct: float,
    start_date: str,
    completion_date: str,
    cert_id: int,
) -> str:
    """
    Generate a professional PDF certificate and return the file path.
    """
    filename = f"cert_{cert_id}_{student_name.replace(' ', '_').lower()}.pdf"
    filepath = CERT_DIR / filename
    width, height = landscape(A4)

    c = canvas.Canvas(str(filepath), pagesize=landscape(A4))

    # ── Background ──
    c.setFillColor(HexColor("#0f172a"))
    c.rect(0, 0, width, height, fill=True, stroke=False)

    # ── Border ──
    c.setStrokeColor(HexColor("#6d5acd"))
    c.setLineWidth(3)
    c.roundRect(20, 20, width - 40, height - 40, 10)

    # ── Inner border ──
    c.setStrokeColor(HexColor("#3b3166"))
    c.setLineWidth(1)
    c.roundRect(30, 30, width - 60, height - 60, 8)

    # ── Decorative corners ──
    c.setFillColor(HexColor("#6d5acd"))
    for x, y in [(35, 35), (35, height - 45), (width - 45, 35), (width - 45, height - 45)]:
        c.circle(x, y, 4, fill=True, stroke=False)

    # ── Header ──
    c.setFillColor(HexColor("#8b7acf"))
    c.setFont("Helvetica", 14)
    c.drawCentredString(width / 2, height - 80, "LEARNVAULT")

    c.setFillColor(HexColor("#e2e8f0"))
    c.setFont("Helvetica", 12)
    c.drawCentredString(width / 2, height - 100, "CERTIFICATE OF COMPLETION")

    # ── Decorative line ──
    c.setStrokeColor(HexColor("#6d5acd"))
    c.setLineWidth(2)
    c.line(width / 2 - 120, height - 115, width / 2 + 120, height - 115)

    # ── "This certifies that" ──
    c.setFillColor(HexColor("#94a3b8"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2, height - 150, "This is to certify that")

    # ── Student Name ──
    c.setFillColor(HexColor("#ffffff"))
    c.setFont("Helvetica-Bold", 28)
    c.drawCentredString(width / 2, height - 185, student_name)

    # ── Underline ──
    c.setStrokeColor(HexColor("#6d5acd"))
    c.setLineWidth(1)
    name_width = c.stringWidth(student_name, "Helvetica-Bold", 28)
    c.line(width / 2 - name_width / 2 - 20, height - 192, width / 2 + name_width / 2 + 20, height - 192)

    # ── "has successfully completed" ──
    c.setFillColor(HexColor("#94a3b8"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(width / 2, height - 220, "has successfully completed the course")

    # ── Course Name ──
    c.setFillColor(HexColor("#a78bfa"))
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2, height - 250, course_name)

    # ── Score ──
    c.setFillColor(HexColor("#22c55e"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2, height - 285, f"Score: {score_pct:.1f}%")

    # ── Dates ──
    c.setFillColor(HexColor("#64748b"))
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2 - 120, height - 320, f"Started: {start_date}")
    c.drawCentredString(width / 2 + 120, height - 320, f"Completed: {completion_date}")

    # ── Certificate ID ──
    c.setFillColor(HexColor("#475569"))
    c.setFont("Helvetica", 8)
    c.drawCentredString(width / 2, 50, f"Certificate ID: LV-{cert_id:06d}")

    # ── Footer ──
    c.setFillColor(HexColor("#64748b"))
    c.setFont("Helvetica", 9)
    c.drawCentredString(width / 2, 65, "LearnVault — Secure E-Learning Platform")

    c.save()
    return f"/certificates/{filename}"


if __name__ == "__main__":
    # Quick test
    path = generate_certificate(
        student_name="Ravi Kumar",
        course_name="Python Basics",
        score_pct=85.0,
        start_date="2026-03-01",
        completion_date="2026-03-15",
        cert_id=1,
    )
    print(f"Certificate generated: {path}")
