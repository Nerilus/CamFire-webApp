import smtplib
import threading
from email.message import EmailMessage
from html import escape

from core.config import SMTP_FROM, SMTP_HOST, SMTP_PASSWORD, SMTP_PORT, SMTP_USE_TLS, SMTP_USERNAME


def _send_email(subject: str, recipient: str, text_body: str, html_body: str) -> None:
    if not SMTP_HOST or not SMTP_FROM:
        print("[EMAIL] SMTP non configure, e-mail ignore")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM
    message["To"] = recipient
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        print(f"[EMAIL] E-mail envoye a {recipient}")
    except Exception as error:
        print(f"[EMAIL] Echec de l'envoi a {recipient}: {error}")


def send_email_async(subject: str, recipient: str, text_body: str, html_body: str) -> None:
        threading.Thread(target=_send_email, args=(subject, recipient, text_body, html_body), daemon=True).start()


def _email_template(eyebrow: str, title: str, intro: str, content: str) -> str:
        return f"""<!doctype html>
<html lang="fr">
<body style="margin:0;background:#f3f5f7;color:#18212b;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:36px 16px;">
        <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e7eb;border-radius:18px;overflow:hidden;box-shadow:0 8px 30px rgba(19,32,43,.08);">
            <div style="padding:28px 32px;background:#11131a;">
                <div style="font-size:20px;font-weight:700;letter-spacing:.3px;color:#ffffff;">
                    <span style="display:inline-block;width:30px;height:30px;margin-right:9px;border:1px solid #ff4500;border-radius:50%;vertical-align:middle;text-align:center;line-height:30px;color:#ffffff;font-size:20px;">&#128293;</span>
                    CamFire
                </div>
                <div style="margin-top:18px;color:#ff8a3d;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">{eyebrow}</div>
            </div>
            <div style="padding:38px 32px 32px;">
                <h1 style="margin:0;color:#16202a;font-size:28px;line-height:1.2;letter-spacing:-.3px;">{title}</h1>
                <p style="margin:18px 0 0;color:#53606b;font-size:16px;line-height:1.7;">{intro}</p>
                {content}
                <div style="height:1px;margin:30px 0 22px;background:#e9edef;"></div>
                <p style="margin:0;color:#7a858e;font-size:12px;line-height:1.6;">Message automatique de CamFire. Merci de ne pas répondre à cet e-mail.</p>
                <p style="margin:16px 0 0;color:#53606b;font-size:14px;line-height:1.5;">Cordialement,<br><strong style="color:#18212b;">L'équipe CamFire</strong></p>
            </div>
        </div>
        <p style="max-width:600px;margin:18px auto 0;text-align:center;color:#8b969e;font-size:11px;">Surveillance intelligente, pensée pour protéger vos sites.</p>
    </div>
</body>
</html>"""


def _detail_card(rows: list[tuple[str, str]]) -> str:
        items = "".join(
                f'<tr><td style="padding:13px 0;color:#7a858e;font-size:13px;border-bottom:1px solid #edf0f2;">{escape(label)}</td>'
                f'<td style="padding:13px 0;text-align:right;color:#18212b;font-size:13px;font-weight:700;border-bottom:1px solid #edf0f2;">{escape(value)}</td></tr>'
                for label, value in rows
        )
        return f'<table role="presentation" width="100%" style="margin-top:26px;border-collapse:collapse;">{items}</table>'


def send_welcome_email(recipient: str) -> None:
    text = "Bonjour,\n\nVotre inscription à CamFire est confirmée. Votre compte est maintenant actif.\n\nVous pourrez associer votre appareil CamFire depuis votre espace personnel.\n\nL'équipe CamFire"
    html = _email_template("Inscription confirmée", "Bienvenue chez CamFire", "Votre inscription a bien été prise en compte. Votre compte est maintenant actif et votre espace personnel est prêt à être utilisé.", '<div style="margin-top:26px;padding:18px 20px;background:#fff6ef;border-left:4px solid #ff6b19;border-radius:8px;color:#6b4b38;font-size:14px;line-height:1.6;">CamFire vous accompagne dans la surveillance intelligente de vos sites et de vos équipements.<br><br>Vous pourrez associer votre appareil depuis votre espace personnel.</div>')
    send_email_async("Bienvenue chez CamFire", recipient, text, html)


def send_device_paired_email(recipient: str, device_name: str, device_id: str) -> None:
    text = f"Bonjour,\n\nL'appareil {device_name} ({device_id}) est associé à votre compte CamFire.\n\nL'équipe CamFire"
    html = _email_template("Équipement connecté", "Votre appareil est prêt", "L'association de votre équipement a bien été confirmée.", _detail_card([("Nom de l'appareil", device_name), ("Identifiant matériel", device_id)]) + '<p style="margin:24px 0 0;color:#53606b;font-size:14px;line-height:1.6;">Vous pouvez désormais retrouver son état et ses fonctionnalités depuis votre espace CamFire.</p>')
    send_email_async("Confirmation d'association de votre appareil CamFire", recipient, text, html)


def send_device_unpaired_email(recipient: str, device_name: str, device_id: str) -> None:
    text = f"Bonjour,\n\nL'appareil {device_name} ({device_id}) a été dissocié de votre compte CamFire.\n\nL'équipe CamFire"
    html = _email_template("Modification du compte", "Appareil dissocié", "Nous vous confirmons que cet équipement n'est désormais plus rattaché à votre espace CamFire.", _detail_card([("Nom de l'appareil", device_name), ("Identifiant matériel", device_id)]) + '<div style="margin-top:24px;padding:16px 18px;background:#f6f8f9;border-radius:8px;color:#53606b;font-size:13px;line-height:1.6;">Si vous n’êtes pas à l’origine de cette action, connectez-vous à votre espace CamFire et contactez votre administrateur.</div>')
    send_email_async("Confirmation de dissociation de votre appareil CamFire", recipient, text, html)
