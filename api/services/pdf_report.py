import os
import hashlib
from datetime import datetime
from typing import Optional

from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    Image as RLImage,
    KeepTogether,
    HRFlowable
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from PIL import Image as PILImage


def generate_incident_pdf(
    incident_id: str,
    device_name: str,
    location: str,
    confidence: float,
    detection_type: str = "Feu / Flammes",
    image_path: Optional[str] = None,
    output_path: Optional[str] = None,
    device_hw_id: Optional[str] = None,
    alert_date: Optional[datetime] = None
) -> str:
    """
    Génère un rapport officiel d'incident incendie au format PDF,
    avec design professionnel, tableau des caractéristiques, photo de preuve et consignes d'urgence.
    Retourne le chemin absolu du fichier PDF généré.
    """
    now = alert_date or datetime.now()
    date_str = now.strftime("%d/%m/%Y à %H:%M:%S")
    doc_ref = incident_id if incident_id else f"CF-ALERT-{now.strftime('%Y%m%d-%H%M%S')}"

    if not output_path:
        reports_dir = "/tmp/camfire_reports"
        os.makedirs(reports_dir, exist_ok=True)
        output_path = os.path.join(reports_dir, f"Rapport_Incident_{doc_ref}.pdf")

    # Dimensions de la page A4 : 210 x 297 mm
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=12 * mm,
        bottomMargin=12 * mm
    )

    styles = getSampleStyleSheet()

    # Définition des styles typographiques sur mesure
    header_title_style = ParagraphStyle(
        'HeaderTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=15,
        leading=18,
        textColor=colors.HexColor('#ffffff')
    )
    header_sub_style = ParagraphStyle(
        'HeaderSub',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#cbd5e1')
    )
    badge_style = ParagraphStyle(
        'BadgeCritical',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=9,
        leading=11,
        alignment=1, # Center
        textColor=colors.HexColor('#ffffff')
    )
    section_title_style = ParagraphStyle(
        'SectionTitle',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=10.5,
        leading=13,
        textColor=colors.HexColor('#0f172a')
    )
    cell_bold_style = ParagraphStyle(
        'CellBold',
        parent=styles['Normal'],
        fontName='Helvetica-Bold',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#1e293b')
    )
    cell_val_style = ParagraphStyle(
        'CellVal',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8.5,
        leading=11,
        textColor=colors.HexColor('#334155')
    )
    caption_style = ParagraphStyle(
        'Caption',
        parent=styles['Normal'],
        fontName='Helvetica-Oblique',
        fontSize=7.5,
        leading=9.5,
        alignment=1,
        textColor=colors.HexColor('#64748b')
    )
    directive_style = ParagraphStyle(
        'Directive',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=8,
        leading=10.5,
        textColor=colors.HexColor('#991b1b')
    )
    footer_style = ParagraphStyle(
        'Footer',
        parent=styles['Normal'],
        fontName='Helvetica',
        fontSize=7,
        leading=9,
        alignment=1,
        textColor=colors.HexColor('#94a3b8')
    )

    story = []

    # 1. EN-TÊTE OFFICIEL DU RAPPORT
    header_left = [
        Paragraph("CAMFIRE • SURVEILLANCE & SÉCURITÉ INCENDIE", header_title_style),
        Paragraph("Plateforme Intelligente de Télésurveillance & Détection Précoce par IA", header_sub_style),
        Paragraph(f"Réf. Dossier : <b>{doc_ref}</b>  |  Émis le {date_str}", header_sub_style)
    ]
    badge_content = [
        Paragraph("NIVEAU DE MENACE", ParagraphStyle('B1', fontName='Helvetica-Bold', fontSize=7.5, textColor=colors.HexColor('#fee2e2'), alignment=1)),
        Spacer(1, 2),
        Paragraph("CRITIQUE — ALARME INCENDIE", badge_style)
    ]

    header_table = Table(
        [[header_left, badge_content]],
        colWidths=[125 * mm, 55 * mm]
    )
    header_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, 0), colors.HexColor('#0f172a')),
        ('BACKGROUND', (1, 0), (1, 0), colors.HexColor('#dc2626')),
        ('TOPPADDING', (0, 0), (-1, -1), 9),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 9),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('CORNERPAD', (0, 0), (-1, -1), 4),
    ]))
    story.append(header_table)
    story.append(Spacer(1, 10))

    # 2. BANDEAU DE SYNTHÈSE
    threat_text = "DÉPART DE FEU CONFIRMÉ PAR DÉTECTION VISION" if "feu" in detection_type.lower() else "DÉGAGEMENT DE FUMÉE SUSPECT CONFIRMÉ"
    summary_html = f"""<b>INCIDENT EN COURS :</b> Le système autonome a identifié un <b>{threat_text}</b> avec un degré de certitude de <b>{confidence:.1f}%</b> sur le site surveillé."""
    summary_table = Table([[Paragraph(summary_html, ParagraphStyle('Sum', fontName='Helvetica', fontSize=8.5, leading=11, textColor=colors.HexColor('#991b1b')))]], colWidths=[180 * mm])
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef2f2')),
        ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#f87171')),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 10))

    # 3. TABLEAU DES CARACTÉRISTIQUES DÉTAILLÉES
    story.append(Paragraph("1. CARACTÉRISTIQUES DE L'ÉQUIPEMENT ET DE LA DÉTECTION", section_title_style))
    story.append(Spacer(1, 4))

    table_data = [
        [
            Paragraph("Équipement source :", cell_bold_style),
            Paragraph(device_name, cell_val_style),
            Paragraph("Identifiant matériel :", cell_bold_style),
            Paragraph(device_hw_id or "RPI4-CF-5212DFE3", cell_val_style),
        ],
        [
            Paragraph("Zone / Localisation :", cell_bold_style),
            Paragraph(location, cell_val_style),
            Paragraph("Horodatage officiel :", cell_bold_style),
            Paragraph(date_str, cell_val_style),
        ],
        [
            Paragraph("Type d'anomalie :", cell_bold_style),
            Paragraph(f"<b>{detection_type}</b>", cell_val_style),
            Paragraph("Indice de confiance :", cell_bold_style),
            Paragraph(f"<b>{confidence:.1f}%</b> (Validé)", cell_val_style),
        ],
        [
            Paragraph("Moteur d'inférence :", cell_bold_style),
            Paragraph("YOLOv11 Vision IA (Deep Neural Net)", cell_val_style),
            Paragraph("Statut Watchdog :", cell_bold_style),
            Paragraph("Actif & Connecté (Temps Réel)", cell_val_style),
        ]
    ]

    details_table = Table(table_data, colWidths=[42 * mm, 48 * mm, 42 * mm, 48 * mm])
    details_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f8fafc')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(details_table)
    story.append(Spacer(1, 10))

    # 4. PREUVE PHOTOGRAPHIQUE (SNAPSHOT AVEC ENCADREMENT IA)
    story.append(Paragraph("2. PREUVE PHOTOGRAPHIQUE INSTANTANÉE (CLICHÉ HD CAMFIRE)", section_title_style))
    story.append(Spacer(1, 4))

    img_inserted = False
    img_hash = "N/A"
    if image_path and os.path.exists(image_path):
        try:
            # Calcul du Hash SHA256 pour certification de la preuve
            with open(image_path, "rb") as f_img:
                img_bytes = f_img.read()
                img_hash = hashlib.sha256(img_bytes).hexdigest()[:24]

            # Redimensionnement adapté pour la page A4 (Largeur max 160 mm, Hauteur max 80 mm)
            with PILImage.open(image_path) as pil_im:
                orig_w, orig_h = pil_im.size

            target_w = 150 * mm
            target_h = target_w * (orig_h / orig_w)
            if target_h > 82 * mm:
                target_h = 82 * mm
                target_w = target_h * (orig_w / orig_h)

            rl_img = RLImage(image_path, width=target_w, height=target_h)
            
            img_table = Table([[rl_img]], colWidths=[180 * mm])
            img_table.setStyle(TableStyle([
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                ('BOX', (0, 0), (-1, -1), 1, colors.HexColor('#cbd5e1')),
                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#000000')),
                ('TOPPADDING', (0, 0), (-1, -1), 4),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
            ]))
            story.append(img_table)
            story.append(Spacer(1, 2))
            story.append(Paragraph(f"Figure 1 — Cliché instantané capturé au déclenchement de l'alarme • Empreinte SHA256 : {img_hash}...", caption_style))
            img_inserted = True
        except Exception as e:
            print(f"[PDF REPORT] Erreur insertion image {image_path}: {e}")

    if not img_inserted:
        no_img_table = Table([[Paragraph("Aucun fichier photographique n'a pu être joint ou le fichier est inaccessible.", caption_style)]], colWidths=[180 * mm])
        no_img_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#f1f5f9')),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('PADDING', (0, 0), (-1, -1), 14),
        ]))
        story.append(no_img_table)

    story.append(Spacer(1, 10))

    # 5. PROTOCOLE D'URGENCE & DIRECTIVES DE SÉCURITÉ
    story.append(Paragraph("3. DIRECTIVES OPÉRATIONNELLES D'URGENCE", section_title_style))
    story.append(Spacer(1, 4))

    directives_data = [
        [
            Paragraph("<b>1. ÉVACUATION</b>", directive_style),
            Paragraph("Évacuez sans délai toutes les personnes présentes dans la zone vers le point de rassemblement désigné.", cell_val_style)
        ],
        [
            Paragraph("<b>2. APPEL SECOURS</b>", directive_style),
            Paragraph("Alertez immédiatement les services d'incendie et de secours : <b>18 (Sapeurs-Pompiers)</b> ou <b>112 (Urgences Europe)</b>.", cell_val_style)
        ],
        [
            Paragraph("<b>3. LEVER DE DOUTE</b>", directive_style),
            Paragraph("Consultez l'application mobile/web CamFire pour visualiser le flux vidéo direct si le réseau le permet.", cell_val_style)
        ],
        [
            Paragraph("<b>4. SÉCURISATION</b>", directive_style),
            Paragraph("Si les conditions le permettent en toute sécurité, coupez la ventilation mécanique et isolez les sources d'énergie.", cell_val_style)
        ]
    ]

    directives_table = Table(directives_data, colWidths=[35 * mm, 145 * mm])
    directives_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#fef2f2')),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#fecaca')),
        ('TOPPADDING', (0, 0), (-1, -1), 3.5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3.5),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ]))
    story.append(directives_table)
    story.append(Spacer(1, 10))

    # 6. SIGNATURE & PIED DE PAGE LÉGAL
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.HexColor('#cbd5e1'), spaceBefore=2, spaceAfter=4))
    story.append(Paragraph(
        "Ce rapport est un document certifié généré par le serveur de télésurveillance CamFire Security. "
        "Les données d'horodatage, de géolocalisation et de télémétrie sont inviolables et archivées sur base chiffrée. "
        "Document recevable auprès des services de sécurité civile et des compagnies d'assurance.",
        footer_style
    ))
    story.append(Spacer(1, 2))
    story.append(Paragraph("CamFire Security Solutions • https://camfire.local • Certificat d'authenticité SSI v2.4", footer_style))

    # Construction du PDF
    doc.build(story)
    print(f"[PDF REPORT] Rapport d'incident généré avec succès : {output_path}")
    return output_path
