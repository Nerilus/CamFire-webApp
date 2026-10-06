# Guide de Soutenance & Code Review : alerts.py

Ce document constitue la fiche de préparation complète pour l'examen de **Code Review (20 minutes)** portant sur le module de gestion des incidents et reporting officiel : [`api/routers/alerts.py`](file:///Users/herby/Herby/CamFire-webApp/api/routers/alerts.py).

---

## ⏱️ Découpage Minuté de la Présentation (20 minutes)

| Timing | Phase | Objectif & Contenu clé |
|---|---|---|
| **00:00 - 03:00** | **1. Accroche & Enjeux Métier** | Présenter le rôle central de la formalisation légale des incidents et de l'alerte d'urgence. |
| **03:00 - 08:00** | **2. L'API REST & Modélisation Pydantic** | Détailler `GET /alerts/`, le typage `AlertResponse`, la session SQLAlchemy et le tri chronologique. |
| **08:00 - 13:00** | **3. Sécurité Filesystem & Génération PDF** | Détailler `_resolve_safe_snapshot_path` (anti-Path Traversal) et `FileResponse` du rapport PDF. |
| **13:00 - 16:00** | **4. Diffusion Omnicanale & Résilience Email** | Détailler `_get_emergency_recipients` : déduplication et auto-correction anti-typo (`@gnail.com`). |
| **16:00 - 20:00** | **5. Questions / Réponses du Jury** | Réponses prêtes sur l'immutabilité des preuves, la charge SMTP et la sécurité RBAC. |

---

## 🎙️ Script de Présentation Mot-à-Mot

### 1. Introduction & Responsabilité Métier (00:00 - 03:00)
> **Ce que vous dites au jury :**  
> *« Bonjour à tous. Aujourd'hui, je vous présente [`api/routers/alerts.py`](file:///Users/herby/Herby/CamFire-webApp/api/routers/alerts.py), le module responsable de la formalisation des incidents et des alertes de sécurité dans CamFire.  
> Détecter un incendie par intelligence artificielle ne suffit pas : dans un contexte d'entreprise ou de protection de site forestier, il est indispensable de **matérialiser l'incident de façon juridiquement et techniquement exploitable** pour les secours, les forces d'intervention et les compagnies d'assurance.  
> Ce module résout trois missions fondamentales :  
> 1. **La centralisation et l'historisation des alertes temps réel** via une API REST sécurisée et fortement typée avec Pydantic.  
> 2. **La génération dynamique de rapports officiels certifiés au format PDF** avec référence d'audit unique et confinement physique strict de la photo de preuve.  
> 3. **La diffusion omnicanale d'urgence** avec nettoyage défensif des adresses emails pour garantir une délivrabilité sans faille. »*

---

### 2. Consultation & Modélisation Pydantic (Lignes 118 à 143)
* **Code à projeter :**
```python
@router.get(
    "/",
    response_model=List[AlertResponse],
    summary="Lister l'historique des alertes"
)
def get_all_alerts(db: Session = Depends(get_db)) -> List[AlertResponse]:
    alerts = db.query(Alert).order_by(Alert.date.desc()).all()
    return [
        AlertResponse(
            id=str(alert.id),
            status=alert.status,
            location=alert.location,
            date=alert.date.isoformat() if alert.date else "",
            confidence=alert.confidence,
            coords=alert.coords,
            image_url=alert.image_url,
            detection_type=alert.detection_type or "fire"
        )
        for alert in alerts
    ]
```
* **Ce que vous expliquez au jury :**
  - **Typage strict Pydantic** : Remplacement des dictionnaires bruts par le schéma `AlertResponse` dans [`schemas/alert_schema.py`](file:///Users/herby/Herby/CamFire-webApp/api/schemas/alert_schema.py), garantissant la validation des types et la génération automatique de la documentation OpenAPI / Swagger.
  - **Injection de dépendance** : `db: Session = Depends(get_db)` qui ouvre et ferme proprement la session SQLAlchemy.
  - **Tri chronologique prioritaire** : `order_by(Alert.date.desc())` restitue immédiatement les événements les plus récents en tête de liste pour l'interface de surveillance.

---

### 3. Sécurité Filesystem & Génération PDF à la Volée (Lignes 48 à 72 et 145 à 192)
* **Code à projeter :**
```python
def _resolve_safe_snapshot_path(image_url: Optional[str]) -> Optional[str]:
    if not image_url or "/static/captures/" not in image_url:
        return None

    filename = Path(image_url).name
    candidate_path = (CAPTURES_DIR / filename).resolve()

    # Sécurité critique : confinement dans le répertoire racine des captures
    if not candidate_path.is_relative_to(CAPTURES_DIR):
        logger.warning("Tentative potentielle de Path Traversal bloquée...", ...)
        return None

    if candidate_path.is_file():
        return str(candidate_path)
    return None
```
* **Ce que vous expliquez au jury (Points forts d'ingénierie) :**
  - **Protection contre le Path Traversal** : Utilisation de `Path.resolve()` et validation avec `candidate_path.is_relative_to(CAPTURES_DIR)`. Tout chemin relatif corrompu ou malveillant est bloqué.
  - **Génération à la demande (On-demand)** : Évite de pré-générer et stocker des milliers de fichiers PDF qui gaspilleraient de l'espace disque. Le document est produit en quelques millisecondes et transmis en flux binaire via `FileResponse(media_type="application/pdf")`.
  - **Tolérance aux pannes sur l'image** : Si la photo a été purgée, la fonction retourne `None` et le générateur PDF ne plante pas : il produit un document officiel certifié sans la photo.
  - **Identifiant normalisé d'audit** : Format normalisé `CF-ALERT-{alert.id:04d}` (ex: `CF-ALERT-0013`) pour le suivi judiciaire ou administratif.

---

### 4. Diffusion d'Urgence & Nettoyage Défensif (Lignes 74 à 115)
* **Code à projeter :**
```python
def _get_emergency_recipients(db: Session) -> List[str]:
    all_users = db.query(User).all()
    target_emails: List[str] = []

    for user in all_users:
        if not getattr(user, "emergency_alerts_enabled", True):
            continue
        ...
        for candidate in email_candidates:
            clean = candidate.strip()
            if not clean or "@" not in clean:
                continue

            # Auto-correction défensive des fautes de frappe utilisateur courantes
            if clean.endswith("@gnail.com"):
                clean = clean.replace("@gnail.com", "@gmail.com")

            if clean not in target_emails:
                target_emails.append(clean)
    return target_emails
```
* **Ce que vous expliquez au jury :**
  - **Isolation et réutilisabilité (DRY)** : La collecte des destinataires est encapsulée dans une fonction pure et testable.
  - **Normalisation défensive des adresses** : Détection et remplacement automatique des fautes de frappe de nom de domaine (comme `@gnail.com` vers `@gmail.com`). Dans un contexte d'urgence incendie, une simple faute de frappe humaine sur smartphone ne doit pas empêcher l'alerte d'arriver à destination.

---

## ❓ Les 5 Questions Pièges du Jury & Vos Réponses

#### 1. « Pourquoi générer le PDF à la volée plutôt que de le persister dès la détection ? »
> **Votre réponse :**  
> *« Pour deux raisons majeures d'architecture :  
> 1. **Optimisation du stockage** : générer un PDF pour chaque alerte saturerait rapidement le disque dur avec des données redondantes.  
> 2. **Immutabilité et fraîcheur** : le rapport PDF est une vue projetée des données de la base. S'il n'est téléchargé qu'en cas d'audit ou de sinistre, le générer à la demande avec `FileResponse` est la solution la plus économique et scalable. »*

#### 2. « Que se passe-t-il si le serveur SMTP est lent ou indisponible lors de la requête POST ? »
> **Votre réponse :**  
> *« Dans la version actuelle, l'envoi SMTP s'exécute dans le thread de la requête HTTP. Si le serveur SMTP subit de la latence, la réponse client attend.  
> **L'évolution cible en production** est de confier cet appel aux `BackgroundTasks` de FastAPI ou à une file de tâches asynchrones distribuée (**Celery / Redis**), renvoyant immédiatement un code HTTP 202 Accepted avec reprise automatique (retries) en tâche de fond. »*

#### 3. « Comment sécuriseriez-vous l'accès aux rapports PDF d'incident ? »
> **Votre réponse :**  
> *« En injectant la dépendance d'authentification `current_user: User = Depends(get_current_user)` et en appliquant un contrôle d'accès basé sur les rôles (RBAC) pour s'assurer que l'utilisateur a les droits sur le site ou la caméra liée à l'alerte, neutralisant ainsi toute vulnérabilité de type IDOR (Insecure Direct Object Reference). »*

#### 4. « Pourquoi utiliser `FileResponse` plutôt qu'un encodage Base64 dans un JSON ? »
> **Votre réponse :**  
> *« `FileResponse` effectue un transfert binaire en flux continu (*streaming* de chunks) avec les en-têtes HTTP adéquats (`Content-Disposition: attachment`), ce qui permet au navigateur de déclencher nativement la boîte de dialogue de téléchargement sans surcharger la mémoire JavaScript du frontend avec une conversion Base64 (+33% de surcoût réseau). »*

#### 5. « Que fait le code si l'identifiant d'alerte demandé n'existe pas en base ? »
> **Votre réponse :**  
> *« Le code possède une stratégie de repli via `_resolve_alert` : il tente de charger l'ID demandé. S'il n'est pas trouvé, il bascule sur le dernier incident actif pour permettre la consultation du cas le plus récent. Si la base est totalement vide, il lève proprement une exception `HTTPException(status_code=404, detail="Aucune alerte enregistrée")`. »*
