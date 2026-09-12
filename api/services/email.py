import logging
import smtplib
import threading
from datetime import datetime
from email.message import EmailMessage
from html import escape

from core.config import (
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USE_TLS,
    SMTP_USERNAME,
)

logger = logging.getLogger("camfire.email")


def _send_email_sync(subject: str, recipient: str, text_body: str, html_body: str) -> None:
    if not SMTP_HOST:
        print(f"[EMAIL] SMTP non configuré (SMTP_HOST vide). Envoi simulé pour : {recipient}")
        return

    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = SMTP_FROM or "CamFire Security <no-reply@camfire.local>"
    message["To"] = recipient
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=12) as smtp:
            if SMTP_USE_TLS:
                smtp.starttls()
            if SMTP_USERNAME and SMTP_PASSWORD:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
        print(f"[EMAIL] E-mail envoyé avec succès à {recipient}")
    except Exception as error:
        print(f"[EMAIL ERROR] Échec de l'envoi de l'e-mail à {recipient}: {error}")


def send_email_async(subject: str, recipient: str, text_body: str, html_body: str) -> None:
    """Envoie un e-mail dans un thread d'arrière-plan sans bloquer la requête HTTP."""
    thread = threading.Thread(
        target=_send_email_sync,
        args=(subject, recipient, text_body, html_body),
        daemon=True,
    )
    thread.start()


def _email_base_template(eyebrow: str, title: str, intro: str, content: str) -> str:
    """Template e-mail HTML moderne en mode sombre assorti à la charte CamFire."""
    return f"""<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background-color:#0d0d12;color:#e4e4e7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <div style="padding:32px 16px;">
        <div style="max-width:540px;margin:0 auto;background-color:#16161e;border:1px solid #272736;border-radius:16px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.6);">
            <!-- En-tête -->
            <div style="padding:24px 30px;background:#11131a;border-bottom:1px solid #232332;">
                <div style="font-size:20px;font-weight:700;color:#ffffff;display:flex;align-items:center;">
                    <span style="display:inline-block;width:28px;height:28px;line-height:28px;text-align:center;border-radius:50%;background:rgba(255,69,0,0.15);border:1px solid #ff4500;margin-right:10px;font-size:16px;">🔥</span>
                    CamFire
                </div>
                <div style="margin-top:10px;color:#ff5722;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">
                    {eyebrow}
                </div>
            </div>
            <!-- Corps -->
            <div style="padding:32px 30px;">
                <h1 style="margin:0 0 12px 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">{title}</h1>
                <p style="margin:0 0 20px 0;color:#94a3b8;font-size:15px;line-height:1.6;">{intro}</p>
                {content}
                <div style="height:1px;margin:28px 0 20px 0;background:#232332;"></div>
                <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
                    Ceci est une notification automatique de sécurité CamFire. Merci de ne pas répondre à ce message.
                </p>
                <p style="margin:12px 0 0 0;color:#94a3b8;font-size:13px;">
                    L'équipe Sécurité <strong style="color:#ffffff;">CamFire</strong>
                </p>
            </div>
        </div>
        <p style="max-width:540px;margin:16px auto 0;text-align:center;color:#475569;font-size:11px;">
            Système Intelligent de Télésurveillance Incendie & Surveillance d'Équipements
        </p>
    </div>
</body>
</html>"""


def _detail_card(rows: list[tuple[str, str]]) -> str:
    items = "".join(
        f'<tr><td style="padding:12px 16px;color:#71717a;border-bottom:1px solid #1c1c28;font-size:13px;">{escape(label)}</td>'
        f'<td style="padding:12px 16px;text-align:right;color:#ffffff;font-size:13px;font-weight:600;border-bottom:1px solid #1c1c28;">{escape(value)}</td></tr>'
        for label, value in rows
    )
    return f'<div style="margin:20px 0;background:#0d0d12;border:1px solid #232332;border-radius:10px;overflow:hidden;"><table role="presentation" width="100%" style="border-collapse:collapse;">{items}</table></div>'


def send_otp_email(recipient: str, code: str, expire_minutes: int = 10, purpose: str = "login") -> None:
    """
    Envoie le code de vérification à l'utilisateur par e-mail
    et l'affiche systématiquement dans les logs de l'API pour faciliter les tests locaux.
    """
    is_disable = purpose == "disable_2fa"
    log_tag = "2FA DESACTIVATION" if is_disable else "2FA AUTH"

    # Affiche TOUJOURS dans les logs console pour le développement et la visibilité
    print("=" * 60)
    print(f"[{log_tag}] >>> CODE OTP POUR {recipient} : [{code}] (Expire dans {expire_minutes} min) <<<")
    print("=" * 60)

    if is_disable:
        subject = f"CamFire — Code pour désactiver la double authentification : {code}"
        text_body = f"""Bonjour,

Une demande de désactivation de la double authentification a été initiée sur votre compte CamFire ({recipient}).

Votre code de confirmation :
{code}

Ce code est valable pendant {expire_minutes} minutes.
Si vous n'êtes pas à l'origine de cette demande, ne partagez JAMAIS ce code et changez immédiatement votre mot de passe.

L'équipe Sécurité CamFire
"""
        intro = f"Une demande de désactivation de la double authentification (2FA) a été initiée pour votre compte <strong>{escape(recipient)}</strong>. Saisissez ce code pour confirmer :"
        eyebrow = "Sécurité du Compte"
        title = "Désactivation du 2FA"
    else:
        subject = f"CamFire — Votre code de connexion : {code}"
        text_body = f"""Bonjour,

Voici votre code de vérification pour vous connecter à votre espace CamFire :

{code}

Ce code est valable pendant {expire_minutes} minutes.
Si vous n'êtes pas à l'origine de cette demande de connexion, nous vous recommandons de modifier immédiatement votre mot de passe.

L'équipe Sécurité CamFire
"""
        intro = f"Une tentative de connexion a été initiée pour votre compte <strong>{escape(recipient)}</strong>. Saisissez le code suivant pour valider votre identité :"
        eyebrow = "Double Authentification (2FA)"
        title = "Connexion sécurisée à votre compte"

    content = f"""
    <div style="margin:24px 0;padding:22px;background:#0d0d12;border:1px dashed #ff4500;border-radius:12px;text-align:center;">
        <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#ff5722;display:inline-block;padding-left:10px;">
            {code}
        </span>
        <div style="margin-top:10px;color:#64748b;font-size:12px;">
            ⏱️ Ce code expire dans <strong>{expire_minutes} minutes</strong>
        </div>
    </div>
    <div style="padding:14px 16px;background:rgba(255,87,34,0.08);border-left:3px solid #ff5722;border-radius:6px;color:#cbd5e1;font-size:13px;line-height:1.5;">
        🔒 <strong>Important :</strong> Ne partagez jamais ce code avec qui que ce soit. Nos équipes ne vous le demanderont jamais.
    </div>
    """

    html_body = _email_base_template(
        eyebrow=eyebrow,
        title=title,
        intro=intro,
        content=content,
    )

    send_email_async(subject, recipient, text_body, html_body)


def send_login_notification_email(recipient: str, ip_address: str, user_agent: str) -> None:
    """
    Envoie un e-mail d'alerte de sécurité après une connexion réussie
    indiquant l'adresse IP, la date/heure et le navigateur utilisé.
    """
    now_str = datetime.now().strftime("%d/%m/%Y à %H:%M:%S")

    # Log pour le développement et la visibilité
    print(f"[LOGIN NOTIF] Nouvelle connexion pour {recipient} | IP: {ip_address} | Navigateur: {user_agent}")

    subject = "CamFire — Nouvelle connexion détectée sur votre compte"

    text_body = f"""Bonjour,

Une nouvelle connexion a été effectuée avec succès sur votre compte CamFire ({recipient}).

Détails de la connexion :
- Date et heure : {now_str}
- Adresse IP : {ip_address}
- Navigateur / Système : {user_agent}

Si vous êtes bien à l'origine de cette connexion, vous pouvez ignorer cet e-mail.
Si vous ne reconnaissez pas cette activité, nous vous conseillons de changer immédiatement votre mot de passe depuis votre espace CamFire.

L'équipe Sécurité CamFire
"""

    content = f"""
    <div style="margin:20px 0;background:#0d0d12;border:1px solid #232332;border-radius:10px;overflow:hidden;">
        <table role="presentation" width="100%" style="border-collapse:collapse;font-size:13px;">
            <tr>
                <td style="padding:12px 16px;color:#71717a;border-bottom:1px solid #1c1c28;">Date et heure</td>
                <td style="padding:12px 16px;color:#ffffff;font-weight:600;text-align:right;border-bottom:1px solid #1c1c28;">{now_str}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;color:#71717a;border-bottom:1px solid #1c1c28;">Adresse IP</td>
                <td style="padding:12px 16px;color:#00d2ff;font-weight:700;font-family:monospace;text-align:right;border-bottom:1px solid #1c1c28;">{escape(ip_address)}</td>
            </tr>
            <tr>
                <td style="padding:12px 16px;color:#71717a;">Appareil / Navigateur</td>
                <td style="padding:12px 16px;color:#cbd5e1;font-size:12px;text-align:right;max-width:240px;word-break:break-all;">{escape(user_agent)}</td>
            </tr>
        </table>
    </div>
    <div style="padding:14px 16px;background:rgba(239,68,68,0.08);border-left:3px solid #ef4444;border-radius:6px;color:#cbd5e1;font-size:13px;line-height:1.5;">
        ⚠️ <strong>Ce n'est pas vous ?</strong> Si vous ne reconnaissez pas cette connexion, modifiez immédiatement votre mot de passe et contactez votre administrateur.
    </div>
    """

    html_body = _email_base_template(
        eyebrow="Alerte Sécurité",
        title="Nouvelle connexion détectée",
        intro=f"Une connexion réussie vient d'être enregistrée sur votre compte <strong>{escape(recipient)}</strong> :",
        content=content,
    )

    send_email_async(subject, recipient, text_body, html_body)


def send_welcome_email(recipient: str) -> None:
    """Envoie un e-mail de bienvenue lors de la création d'un compte."""
    text = (
        "Bonjour,\n\n"
        "Votre inscription à CamFire est confirmée. Votre compte est maintenant actif.\n\n"
        "Vous pourrez associer votre appareil CamFire depuis votre espace personnel.\n\n"
        "L'équipe CamFire"
    )
    content = (
        '<div style="margin-top:20px;padding:18px 20px;background:rgba(255,87,34,0.08);border-left:4px solid #ff5722;border-radius:8px;color:#cbd5e1;font-size:14px;line-height:1.6;">'
        'CamFire vous accompagne dans la surveillance intelligente de vos sites et de vos équipements.<br><br>'
        'Vous pourrez associer votre appareil Raspberry Pi depuis votre espace personnel.'
        '</div>'
    )
    html = _email_base_template(
        eyebrow="Inscription Confirmée",
        title="Bienvenue chez CamFire",
        intro="Votre inscription a bien été prise en compte. Votre compte est maintenant actif et votre espace personnel est prêt à être utilisé.",
        content=content,
    )
    send_email_async("Bienvenue chez CamFire", recipient, text, html)


def send_device_paired_email(recipient: str, device_name: str, device_id: str) -> None:
    """Envoie un e-mail confirmant l'association d'un appareil."""
    text = (
        f"Bonjour,\n\n"
        f"L'appareil {device_name} ({device_id}) est désormais associé à votre compte CamFire.\n\n"
        "L'équipe CamFire"
    )
    content = (
        _detail_card([("Nom de l'appareil", device_name), ("Identifiant matériel", device_id)])
        + '<p style="margin:20px 0 0;color:#94a3b8;font-size:14px;line-height:1.6;">Vous pouvez désormais retrouver son flux vidéo en direct, ses alertes et son état depuis votre espace CamFire.</p>'
    )
    html = _email_base_template(
        eyebrow="Équipement Connecté",
        title="Votre appareil est prêt",
        intro="L'association de votre équipement a bien été confirmée :",
        content=content,
    )
    send_email_async("Confirmation d'association de votre appareil CamFire", recipient, text, html)


def send_device_unpaired_email(recipient: str, device_name: str, device_id: str) -> None:
    """Envoie un e-mail informant de la dissociation d'un appareil."""
    text = (
        f"Bonjour,\n\n"
        f"L'appareil {device_name} ({device_id}) a été dissocié de votre compte CamFire.\n\n"
        "L'équipe CamFire"
    )
    content = (
        _detail_card([("Nom de l'appareil", device_name), ("Identifiant matériel", device_id)])
        + '<div style="margin-top:20px;padding:14px 16px;background:rgba(239,68,68,0.08);border-left:3px solid #ef4444;border-radius:6px;color:#cbd5e1;font-size:13px;line-height:1.5;">Si vous n’êtes pas à l’origine de cette action, connectez-vous immédiatement à votre espace CamFire et contactez votre administrateur.</div>'
    )
    html = _email_base_template(
        eyebrow="Modification du Compte",
        title="Appareil dissocié",
        intro="Nous vous confirmons que cet équipement n'est désormais plus rattaché à votre espace CamFire :",
        content=content,
    )
    send_email_async("Confirmation de dissociation de votre appareil CamFire", recipient, text, html)


def send_reset_password_email(recipient: str, code: str, expire_minutes: int = 30) -> None:
    """Envoie un code de réinitialisation du mot de passe par e-mail."""
    print("=" * 60)
    print(f"[RESET PASSWORD] >>> CODE POUR {recipient} : [{code}] (Expire dans {expire_minutes} min) <<<")
    print("=" * 60)

    subject = f"CamFire — Code de réinitialisation de mot de passe : {code}"
    text_body = f"""Bonjour,

Vous avez demandé la réinitialisation de votre mot de passe CamFire.

Votre code de réinitialisation :
{code}

Ce code est valable pendant {expire_minutes} minutes.
Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.

L'équipe Sécurité CamFire
"""
    content = f"""
    <div style="margin:24px 0;padding:22px;background:#0d0d12;border:1px dashed #ff4500;border-radius:12px;text-align:center;">
        <span style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#ff5722;display:inline-block;padding-left:10px;">
            {code}
        </span>
        <div style="margin-top:10px;color:#64748b;font-size:12px;">
            ⏱️ Ce code expire dans <strong>{expire_minutes} minutes</strong>
        </div>
    </div>
    <div style="padding:14px 16px;background:rgba(255,87,34,0.08);border-left:3px solid #ff5722;border-radius:6px;color:#cbd5e1;font-size:13px;line-height:1.5;">
        🔒 <strong>Important :</strong> Si vous n'avez pas demandé cette réinitialisation, ignorez cet e-mail. Votre mot de passe ne sera pas modifié.
    </div>
    """
    html_body = _email_base_template(
        eyebrow="Réinitialisation du Mot de Passe",
        title="Code de réinitialisation",
        intro=f"Une demande de réinitialisation de mot de passe a été effectuée pour <strong>{escape(recipient)}</strong>. Saisissez ce code pour continuer :",
        content=content,
    )
    send_email_async(subject, recipient, text_body, html_body)

