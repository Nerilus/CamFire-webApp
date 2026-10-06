# Guide de Soutenance & Code Review : captures.py

Ce document constitue la fiche de préparation complète pour l'examen de **Code Review (20 minutes)** portant sur le module [`api/routers/captures.py`](file:///Users/herby/Herby/CamFire-webApp/api/routers/captures.py).

---

## ⏱️ Découpage Minuté de la Présentation (20 minutes)

| Timing | Phase | Objectif & Contenu clé |
|---|---|---|
| **00:00 - 03:00** | **1. Accroche & Enjeux Métier** | Positionner le module comme le garant de l'intégrité des preuves visuelles et des alertes. |
| **03:00 - 08:00** | **2. Sécurité Filesystem & Anti-Path Traversal** | Détailler la fonction `_safe_unlink_capture_file` et la canonicalisation de chemin. |
| **08:00 - 13:00** | **3. Atomicité Transactionnelle & Résilience** | Détailler `delete_capture` : commit DB prioritaire avant destruction physique. |
| **13:00 - 16:00** | **4. Typage Strict, Enum & Pagination REST** | Détailler `get_captures` : validation Pydantic, FastPath, Enum et bornes Query. |
| **16:00 - 20:00** | **5. Questions / Réponses du Jury** | Réponses fermes et argumentées sur l'architecture, la scalabilité et les codes HTTP. |

---

## 🎙️ Script de Présentation Mot-à-Mot

### 1. Introduction & Responsabilité Métier (00:00 - 03:00)
> **Ce que vous dites :**  
> *« Bonjour à tous. Aujourd'hui, je vous présente le module [`api/routers/captures.py`](file:///Users/herby/Herby/CamFire-webApp/api/routers/captures.py).  
> Dans une application de sécurité incendie comme CamFire, la détection par intelligence artificielle ne sert à rien si les preuves visuelles ne sont pas stockées, filtrées et purgées de façon infaillible.  
> Ce module est le centre de gravité de la Galerie d'incidents. À première vue, on pourrait penser qu'il s'agit d'un simple CRUD. En réalité, il résout trois défis majeurs d'ingénierie logicielle :  
> 1. **La sécurité du système de fichiers** contre les failles d'injection et de Path Traversal.  
> 2. **L'atomicité transactionnelle** : éviter toute désynchronisation entre la base de données relationnelle et le stockage physique sur disque.  
> 3. **La résilience opérationnelle** avec typage fort et journalisation structurée sans crash silencieux. »*

---

### 2. Sécurité Filesystem : `_safe_unlink_capture_file` (Lignes 35 à 65)
* **Code à projeter :**
```python
def _safe_unlink_capture_file(image_url: Optional[str]) -> bool:
    if not image_url or "/static/captures/" not in image_url:
        return False

    raw_filename = Path(image_url).name
    target_path = (CAPTURES_DIR / raw_filename).resolve()

    # Sécurité critique : confinement dans le répertoire racine des captures
    if not target_path.is_relative_to(CAPTURES_DIR):
        logger.warning(
            "Tentative potentielle de Path Traversal détectée et bloquée",
            extra={"image_url": image_url, "resolved_path": str(target_path)}
        )
        return False

    try:
        target_path.unlink(missing_ok=True)
        return True
    except OSError as err:
        logger.error("Échec de suppression physique sur disque", exc_info=True)
        return False
```
* **Ce que vous expliquez au jury :**
  - **La faille évitée (Path Traversal)** : Si un utilisateur malveillant altérait l'URL (ex: `../../../../etc/passwd` ou suppression de code source), la méthode `target_path.is_relative_to(CAPTURES_DIR)` vérifie canoniquement que le chemin résolu demeure **strictement confiné** dans le dossier dédié aux photos.
  - **L'idempotence** : L'option `missing_ok=True` garantit que si le fichier a déjà été supprimé ou archivé, la fonction ne lève pas d'exception et ne fait pas planter l'API.

---

### 3. Atomicité & Résilience : `delete_capture` (Lignes 114 à 168)
* **Code à projeter :**
```python
@router.delete("/{capture_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_capture(
    capture_id: int = FastPath(..., ge=1, description="Identifiant unique de la capture"),
    db: Session = Depends(get_db)
) -> None:
    capture = db.query(Capture).filter(Capture.id == capture_id).first()
    if not capture:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Capture #{capture_id} introuvable."
        )

    image_url_to_cleanup = capture.image_url

    try:
        db.delete(capture)
        db.commit()
    except SQLAlchemyError as db_err:
        db.rollback()
        logger.error("Échec transaction SQL", exc_info=True)
        raise HTTPException(status_code=500, detail="Erreur interne SQL.") from db_err

    # Nettoyage physique du stockage uniquement après confirmation du commit SQL
    _safe_unlink_capture_file(image_url_to_cleanup)
    return None
```
* **Ce que vous expliquez au jury (Le point clé d'architecture) :**
  - **L'ordre des opérations** : On valide d'abord la transaction SQL (`db.commit()`) **AVANT** de détruire le fichier physique sur le disque.
  - *Pourquoi ?* Si la base de données subit un verrou ou une coupure réseau, on exécute `db.rollback()`. Le fichier image sur disque est **préservé**. Si on avait fait l'inverse, l'image aurait été détruite du disque sans que la BDD ne le sache, créant une capture orpheline corrompue et une erreur 404 permanente pour l'utilisateur.

---

### 4. Typage Strict & Pagination : `get_captures` (Lignes 70 à 112)
* **Ce que vous expliquez au jury :**
  - **L'Enum `DetectionTypeFilter`** : Au lieu d'accepter des chaînes de caractères libres susceptibles d'erreurs, on type avec un Enum strict (`PERSON`, `FIRE`, `SMOKE`, `MANUAL`).
  - **Protection contre les dénis de service (DDoS par volume)** : Le paramètre `limit` est borné avec `Query(default=60, ge=1, le=200)`. Aucun client ne peut saturer la mémoire du serveur en demandant 100 000 lignes d'un coup.
  - **Pagination réelle** : Ajout du paramètre `offset` pour permettre le défilement infini ou la pagination côté frontend.

---

## ❓ Les 6 Questions Pièges du Jury & Vos Réponses Clé en Main

#### 1. « Pourquoi avoir encapsulé la suppression du fichier dans une sous-fonction `_safe_unlink_capture_file` ? »
> **Votre réponse :**  
> *« C'est l'application directe du principe de responsabilité unique (SRP - SOLID). Le contrôleur HTTP ne doit pas contenir la logique bas niveau d'accès au système de fichiers. Isoler cette fonction permet de la tester unitairement, de réutiliser cette logique ailleurs, et de la remplacer demain par un driver Cloud (S3/MinIO) sans toucher au contrôleur. »*

#### 2. « Que se passe-t-il si la suppression du fichier physique échoue après le `db.commit()` ? »
> **Votre réponse :**  
> *« En génie logiciel, on privilégie toujours l'intégrité de la base de données. Si le fichier physique reste sur le disque suite à un problème de permission OS, ce n'est qu'un fichier temporaire orphelin (tracé dans nos logs par `logger.error`). Cela n'impacte pas l'utilisateur car la ligne SQL est supprimée. Un cron de nettoyage nocturne (Garbage Collector) peut purger ces fichiers résiduels. »*

#### 3. « Pourquoi renvoyer un code HTTP 204 sur la suppression plutôt qu'un code 200 avec `{"success": true}` ? »
> **Votre réponse :**  
> *« C'est le standard strict de l'architecture REST : **HTTP 204 No Content** signifie que l'action demandée a été exécutée avec succès par le serveur et qu'aucun corps de réponse n'a besoin d'être transféré sur le réseau. Cela économise de la bande passante et respecte la RFC HTTP. »*

#### 4. « Comment feriez-vous évoluer ce code si l'application tournait sur 5 serveurs avec un Load Balancer ? »
> **Votre réponse :**  
> *« Actuellement, les photos sont stockées sur le système de fichiers local (`CAPTURES_DIR`). En environnement distribué (multi-instances), les disques locaux ne sont pas partagés.  
> La solution d'évolution en production est d'utiliser un stockage objet type **AWS S3** ou **MinIO** avec la librairie `boto3`. Il suffirait de modifier le corps de `_safe_unlink_capture_file` pour appeler `s3_client.delete_object(Bucket=..., Key=...)`, sans rien modifier à la logique de nos routes. »*

#### 5. « Pourquoi avoir utilisé `Path as FastPath` pour le paramètre `capture_id` ? »
> **Votre réponse :**  
> *« C'est un alias pour éviter un conflit de nom entre `pathlib.Path` (gestion des chemins sur le système de fichiers) et `fastapi.Path` (validation des paramètres d'URL). Cela nous permet d'appliquer la validation `ge=1` dès l'entrée de la requête HTTP, rejetant les IDs négatifs avec une 422 avant même de solliciter la base de données. »*

#### 6. « Pourquoi la route est synchrone (`def`) plutôt qu'asynchrone (`async def`) ? »
> **Votre réponse :**  
> *« La session SQLAlchemy utilisée ici est synchrone, tout comme les opérations I/O de suppression de fichier sur disque (`Path.unlink`). En déclarant la fonction en `def`, FastAPI la délègue automatiquement à son threadpool sous-jacent (AnyIO workers), ce qui empêche de bloquer la boucle d'événements principale (`event loop`). »*

---

## 🎯 3 Conseils Clés pour Demain
1. **Rythme** : Ne parlez pas trop vite. Posez vos explications.
2. **Posture** : Vous avez le code sous les yeux, vous en connaissez chaque ligne et chaque raison d'être.
3. **Question imprévue** : Utilisez la méthode C-A-P (*Constat, Action actuelle, Piste d'amélioration*). Vous réagissez ainsi comme un véritable ingénieur confirmé.
