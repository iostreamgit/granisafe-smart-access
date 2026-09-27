# Granisafe Smart Access — Rapport de Stage de Deuxième Année

**Projet :** Plateforme intelligente de contrôle d'accès et de présence assistée par IA pour la conformité EPI  
**Organisation :** Granisafe Solution  
**Version :** 0.1.0 (Phase 9 terminée — pré-v1.0.0)  
**Type de document :** Analyse technique du projet pour la soumission du stage

---

## Table des matières

1. [Résumé exécutif](#1-résumé-exécutif)
2. [Contexte métier et énoncé du problème](#2-contexte-métier-et-énoncé-du-problème)
3. [Stack technologique](#3-stack-technologique)
4. [Architecture système](#4-architecture-système)
5. [Structure du projet (monorepo)](#5-structure-du-projet-monorepo)
6. [Conception de la base de données](#6-conception-de-la-base-de-données)
7. [Sécurité et RBAC](#7-sécurité-et-rbac)
8. [Conception du module IA](#8-conception-du-module-ia)
9. [Phases de développement et livrables](#9-phases-de-développement-et-livrables)
10. [Stratégie de tests](#10-stratégie-de-tests)
11. [Fonctionnalités clés implémentées](#11-fonctionnalités-clés-implémentées)
12. [Compétences et savoir-faire démontrés](#12-compétences-et-savoir-faire-démontrés)
13. [Hors périmètre (V1)](#13-hors-périmètre-v1)
14. [Améliorations futures](#14-améliorations-futures)
15. [Structure suggérée du rapport formel](#15-structure-suggérée-du-rapport-formel)
16. [Référence rapide](#16-référence-rapide)

---

## 1. Résumé exécutif

**Granisafe Smart Access** est une plateforme intelligente de contrôle d'accès et de gestion de présence, assistée par intelligence artificielle, développée pour **Granisafe Solution**. Le système impose le respect des Équipements de Protection Individuelle (EPI) aux points d'entrée du site grâce à la détection par caméra, à la vérification d'identité par QR/RFID et à des workflows basés sur les rôles pour les agents de sécurité, les RH, les superviseurs et les administrateurs.

Le projet est implémenté sous forme de **monorepo pnpm** contenant trois applications et des packages partagés, livré en **10 phases de développement planifiées**. **Les phases 1 à 9 sont terminées** ; la phase 10 (packaging de déploiement, scénario de démonstration, release v1.0.0) constitue le jalon restant.

| Attribut | Valeur |
|----------|--------|
| **Nom du projet** | Granisafe Smart Access |
| **Version** | 0.1.0 |
| **Type** | Plateforme web full-stack entreprise + microservice IA |
| **Architecture** | Monolithe modulaire (NestJS) + sidecar IA (FastAPI) |
| **Jalon actuel** | Phase 9 terminée — Tests et durcissement |

---

## 2. Contexte métier et énoncé du problème

### 2.1 Problème métier

Les sites industriels et de construction exigent que les travailleurs portent des EPI obligatoires (casque, gilet de sécurité, uniforme) avant l'entrée. Les contrôles manuels aux portiques sont lents, incohérents et difficiles à auditer. Granisafe Smart Access automatise :

- **La vérification d'identité** via code QR ou badge RFID
- **L'inspection des EPI** par vision par ordinateur et IA
- **Les décisions d'accès** (autoriser/refuser) avec une logique de sécurité fail-closed
- **L'enregistrement de présence** en cas d'entrée réussie
- **Les rapports de conformité** et les pistes d'audit complètes

### 2.2 Utilisateurs cibles (acteurs)

| Rôle | Responsabilités principales |
|------|---------------------------|
| **Administrateur** | Gestion des utilisateurs, rôles, paramètres système, politiques EPI, revue d'audit |
| **Agent de sécurité** | Borne de contrôle d'accès en direct, caméra, scan QR |
| **Superviseur** | Suivi de conformité d'équipe, tableau de bord live, génération de rapports |
| **RH** | Gestion des employés et départements, historique de présence, exports de données |
| **Employé** | Consultation du profil, des présences et des notifications |

### 2.3 Flux métier principal

```
L'employé arrive au portique
    → Présente le code QR / badge RFID
    → Le système valide l'identité (employé actif ?)
        → NON → Accès REFUSÉ (identité invalide)
        → OUI → Chargement de la politique EPI requise pour le contexte employé
            → Activation caméra / capture d'image
            → Inspection EPI par IA
            → Tous les EPI requis détectés avec confiance suffisante ?
                → NON → Accès REFUSÉ (liste des EPI manquants) + notification superviseur
                → OUI → Accès AUTORISÉ
                    → Simulation ouverture portique
                    → Enregistrement présence ENTRÉE
                    → Écriture événement d'accès + journal d'audit
                    → Mise à jour temps réel du tableau de bord
```

### 2.4 Processus de sortie

1. L'employé présente son identité au point de sortie (ou même borne en mode SORTIE).
2. Le système valide l'identité et la session de présence ouverte.
3. Le système enregistre la SORTIE avec horodatage.
4. L'inspection EPI à la sortie est optionnelle (configurable ; désactivée par défaut en V1).
5. Simulation d'ouverture du portique ; l'événement est journalisé.

---

## 3. Stack technologique

### 3.1 Vue d'ensemble de la stack

```
┌─────────────────────────────────────────────────────────┐
│                    COUCHE CLIENT                         │
│         React 19 + Vite 6 + TypeScript 5.8              │
│         Zustand · React Router 7 · Socket.IO Client       │
└────────────────────────┬────────────────────────────────┘
                         │ HTTP / WebSocket
┌────────────────────────▼────────────────────────────────┐
│                    COUCHE API                            │
│         NestJS 11 + Prisma 6 + TypeScript 5.8           │
│         JWT Auth · BullMQ · Socket.IO Gateway             │
└──────┬──────────────┬──────────────┬────────────────────┘
       │              │              │
┌──────▼──────┐ ┌─────▼─────┐ ┌─────▼─────────────────────┐
│ PostgreSQL  │ │  Redis 7  │ │  MinIO (compatible S3)    │
│    16       │ │           │ │  Preuves + Rapports       │
└─────────────┘ └───────────┘ └───────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   SERVICE IA        │
              │   FastAPI + YOLO    │
              │   Python 3.11/3.12  │
              └─────────────────────┘
```

### 3.2 Frontend (`apps/web`)

| Technologie | Version | Rôle |
|-------------|---------|------|
| React | 19.x | Framework de composants UI |
| TypeScript | 5.8 | Typage statique |
| Vite | 6.x | Serveur de dev et build de production |
| React Router | 7.x | Routage SPA avec gardes basées sur les rôles |
| Zustand | 5.x | Gestion d'état client/auth légère |
| Socket.IO Client | 4.8 | Flux d'événements temps réel du tableau de bord |
| html5-qrcode | 2.3 | Scan QR par caméra sur la borne |
| TensorFlow.js + COCO-SSD | 4.x | Détection d'objets côté client (optionnelle) |
| CSS Modules | — | Styles scoped par composant |

### 3.3 API Backend (`apps/api`)

| Technologie | Version | Rôle |
|-------------|---------|------|
| NestJS | 11.x | Framework API REST + WebSocket modulaire |
| TypeScript | 5.8 | Langage partagé avec le frontend |
| Prisma | 6.5 | ORM schema-first, migrations, seeding |
| Passport + JWT | — | Authentification et autorisation |
| Argon2 | 0.41 | Hachage des mots de passe (recommandation OWASP) |
| BullMQ | 5.x | File de jobs asynchrones (rapports) |
| Socket.IO | 4.8 | Passerelle WebSocket temps réel |
| ExcelJS | 4.4 | Génération de rapports XLSX |
| PDFKit | 0.19 | Génération de rapports PDF |
| Multer | 2.x | Upload multipart (images de preuve) |
| class-validator | — | Validation des DTO de requête |

### 3.4 Service IA (`apps/ai-service`)

| Technologie | Version | Rôle |
|-------------|---------|------|
| Python | 3.11–3.12 | Environnement d'exécution ML |
| FastAPI | 0.115+ | API HTTP d'inférence haute performance |
| Uvicorn | 0.34+ | Serveur d'application ASGI |
| YOLO (Ultralytics) | optionnel | Détection d'objets EPI lorsque les poids sont présents |
| Pillow / OpenCV | optionnel | Décodage d'image et contrôles qualité |
| Pydantic | 2.11+ | Validation requête/réponse |

**Pattern adaptateur :** L'API centrale utilise soit `FakeAiAdapter` (développement/tests), soit `HttpAiAdapter` (production) pour appeler le service IA. Le modèle YOLO se charge lorsque des poids existent à `MODEL_PATH` ; sinon des stubs par scénario sont utilisés.

### 3.5 Infrastructure

| Service | Image/Version | Rôle |
|---------|---------------|------|
| PostgreSQL | 16-alpine | Base de données relationnelle principale |
| Redis | 7-alpine | Files BullMQ, cache |
| MinIO | latest | Stockage objet compatible S3 pour preuves et rapports |
| Docker Compose | — | Orchestration environnement local et staging |
| GitHub Actions | — | Pipeline d'intégration continue |

### 3.6 Outils de développement

| Outil | Rôle |
|-------|------|
| pnpm workspaces (v9.15) | Gestion des packages monorepo |
| Prettier | Formatage du code |
| tsx | Exécuteur de tests unitaires (API native Node) |
| Testcontainers | Tests d'intégration avec PostgreSQL réel |
| Playwright | Tests end-to-end automatisés navigateur |
| k6 | Tests de performance/charge légers (smoke) |

---

## 4. Architecture système

### 4.1 Style architectural : Monolithe modulaire + Sidecar IA

| Approche | Verdict | Justification |
|----------|---------|---------------|
| Microservices complets | Rejeté | Charge opérationnelle trop élevée pour le périmètre du stage |
| Processus unique incluant l'IA | Rejeté | Couple le cycle de vie ML Python à NestJS ; scaling GPU difficile |
| **Monolithe modulaire + service IA** | **Retenu** | Frontières propres, base unique, déploiement simple, voie d'extraction commerciale |
| Serverless uniquement | Rejeté | Contraintes de latence caméra/IA et démo locale |

### 4.2 Principes de conception

1. **Clean Architecture** — Logique métier indépendante des frameworks et de l'UI
2. **Contextes délimités** — Auth, Organisation, Contrôle d'accès, Présence, Rapports, Notifications, Audit
3. **Sécurité fail-closed** — Échec IA, timeout ou incertitude → refus d'accès systématique
4. **Pattern adaptateur** — Détecteur IA et matériel portique interchangeables via ports/interfaces
5. **Hooks multi-tenant** — `company_id` sur toutes les entités pour un futur SaaS
6. **Traçabilité événementielle** — Chaque tentative d'accès produit des enregistrements d'audit et événements temps réel

### 4.3 Diagramme des couches

```
┌─────────────────────────────────────────┐
│  Interfaces : Contrôleurs HTTP / WS / Jobs │
├─────────────────────────────────────────┤
│  Application : Cas d'usage / DTO / Ports   │
├─────────────────────────────────────────┤
│  Domaine : Entités / Politiques / Décisions│
├─────────────────────────────────────────┤
│  Infrastructure : Prisma / Redis / S3 / IA│
└─────────────────────────────────────────┘
```

### 4.4 Séquence de contrôle d'accès

```
Agent (UI Borne)
    │
    ├─ POST /api/v1/access/identify  (payload QR)
    │       API → DB : résolution employé + politique EPI
    │       API → UI : infos employé + classes EPI requises
    │
    ├─ UI capture image caméra (getUserMedia)
    │
    ├─ POST /api/v1/access/inspect  (multipart : image + attemptId)
    │       API → MinIO : stockage JPEG preuve
    │       API → Service IA : POST /v1/detect
    │       IA  → API : détections + scores de confiance
    │       API → DecisionService : évaluation vs politique EPI
    │
    ├─ SI AUTORISÉ :
    │       API → DB : access_attempt + decision + detections
    │       API → DB : attendance_record (ENTRY)
    │       API → AuditLog
    │       API → Socket.IO : access.event.created
    │       API → UI : AUTORISÉ + simulation portique (ouvert N ms)
    │
    └─ SI REFUSÉ :
            API → DB : access_attempt + decision + detections
            API → AuditLog
            API → Notification (ACCESS_DENIED)
            API → Socket.IO : access.event.created
            API → UI : REFUSÉ + liste EPI manquants/échoués
```

### 4.5 Composants majeurs

| Composant | Responsabilité |
|-----------|----------------|
| **SPA Frontend** | UX admin + borne agent (codebase unique, navigation par rôle) |
| **API centrale** | Workflows métier, RBAC, persistance (source de vérité) |
| **Service IA** | Chargement modèle + inférence uniquement (runtime indépendant) |
| **PostgreSQL** | Système relationnel de référence |
| **Redis** | Files de jobs (BullMQ), pub/sub |
| **Stockage objet (MinIO)** | Images de preuve, fichiers de rapports générés |
| **Module Auth** | Émission/validation JWT, hachage mots de passe (frontière de confiance) |

---

## 5. Structure du projet (monorepo)

```
Granisafe Smart Access/
├── apps/
│   ├── web/                    # SPA React (panneaux admin + borne agent)
│   │   ├── src/
│   │   │   ├── app/            # Shell app, routage, navigation
│   │   │   ├── components/     # Composants UI partagés
│   │   │   ├── features/       # Auth, accès, employés, tableau de bord
│   │   │   ├── pages/          # Composants page par route
│   │   │   └── lib/            # Client API, utilitaires
│   │   └── e2e/                # Tests end-to-end Playwright
│   │
│   ├── api/                    # API NestJS REST + WebSocket
│   │   ├── prisma/             # Schéma, migrations, seed
│   │   └── src/
│   │       ├── modules/        # Modules fonctionnels (voir ci-dessous)
│   │       ├── shared/         # Prisma, audit, sécurité, upload
│   │       └── test/           # Tests d'intégration
│   │
│   └── ai-service/             # Service de détection EPI FastAPI
│       ├── app/
│       │   ├── api/            # Handlers de routes (detect, health)
│       │   ├── core/           # Configuration
│       │   └── services/       # Chargement modèle, détecteur, adaptateur labels
│       └── tests/              # Tests unitaires pytest
│
├── packages/
│   ├── shared/                 # Enums, permissions, constantes partagés
│   └── tsconfig/               # Configurations TypeScript partagées
│
├── deploy/
│   └── compose/                # Fichiers Docker Compose (dev, prod)
│
├── docs/
│   └── architecture/           # Pack de planification 16 docs + notes de phase
│
├── perf/                       # Tests smoke performance k6
├── scripts/                    # Scripts d'aide infra dev
├── .github/workflows/          # Pipeline CI (ci.yml)
├── package.json                # Scripts racine workspace
└── pnpm-workspace.yaml
```

### 5.1 Modules API (`apps/api/src/modules/`)

| Module | Responsabilité | Endpoints clés |
|--------|----------------|----------------|
| `auth` | Login, refresh, logout, JWT, changement mot de passe | `POST /auth/login`, `POST /auth/refresh`, `GET /auth/me` |
| `users` | CRUD utilisateurs, attribution de rôles | `GET /users`, `POST /users/:id/roles` |
| `organization` | Gestion des départements | `GET /departments`, `POST /departments` |
| `employees` | CRUD employés, génération QR | `GET /employees`, `POST /employees/:id/qr/regenerate` |
| `attendance` | Pointages, calcul retard | `GET /attendance`, `GET /attendance/current-on-site` |
| `access-control` | Identify, inspect, moteur de décision | `POST /access/identify`, `POST /access/inspect` |
| `dashboard` | Métriques, heartbeat caméra, WebSocket | `GET /dashboard/summary`, Socket.IO `/ws` |
| `reports` | Jobs rapports XLSX/PDF async | `POST /reports/attendance`, `GET /reports/:jobId/download` |
| `notifications` | Alertes in-app | `GET /notifications`, `POST /notifications/:id/read` |
| `settings` | Configuration système | `GET /settings`, `PUT /settings` |
| `audit` | Requêtes journal d'audit | `GET /audit` |
| `health` | Sondes health/readiness | `GET /health`, `GET /ready` |

### 5.2 Package partagé (`packages/shared`)

Source unique de vérité pour les contrats inter-applications :

- Codes de rôles : `ADMIN`, `GUARD`, `SUPERVISOR`, `HR`, `EMPLOYEE`
- Matrice de permissions : `ROLE_PERMISSIONS` (19 codes de permission)
- Enums métier : classes EPI, décisions d'accès, types de pointage, types d'identifiants
- Constantes : `APP_NAME`, `API_PREFIX` (`/api/v1`)

### 5.3 Pages frontend

| Page | Route | Permission requise |
|------|-------|-------------------|
| Connexion | `/login` | Public |
| Tableau de bord | `/app/dashboard` | `dashboard.view` |
| Borne d'accès | `/app/access` | `access.operate` |
| Employés | `/app/employees` | `employees.view` |
| Présence | `/app/attendance` | `attendance.view_*` |
| Rapports | `/app/reports` | `reports.view` |
| Notifications | `/app/notifications` | `notifications.view` |
| Utilisateurs et rôles | `/app/users` | `users.manage` |
| Journaux d'audit | `/app/audit` | `audit.view` |
| Paramètres | `/app/settings` | `settings.manage` |
| Profil | `/app/profile` | `profile.view_self` |

La navigation est filtrée dynamiquement par rôle — chaque utilisateur ne voit que les entrées de menu autorisées.

---

## 6. Conception de la base de données

**ORM :** Prisma 6 · **Base de données :** PostgreSQL 16 · **Nombre total de modèles :** 20

### 6.1 Vue d'ensemble des entités

| Modèle | Rôle |
|--------|------|
| `Company` | Entité racine multi-tenant |
| `User` | Comptes utilisateurs plateforme |
| `Role` / `Permission` / `UserRole` / `RolePermission` | Système RBAC |
| `RefreshToken` | Stockage des refresh tokens hachés |
| `Employee` | Fiches employés |
| `EmployeeIdentifier` | Tokens QR/RFID (hachés + hint d'affichage) |
| `Department` | Structure organisationnelle |
| `PpePolicy` / `PpePolicyItem` | Classes EPI requises + seuils de confiance |
| `AccessAttempt` | Enregistrement complet du cycle d'accès |
| `AccessDecisionRecord` | Décision autoriser/refuser avec raisons JSON |
| `AccessDetectionItem` | Résultats de détection IA par classe avec bounding boxes |
| `AttendanceRecord` | Pointages entrée/sortie avec flag retard |
| `CameraStatus` | Heartbeat borne par point d'accès |
| `Notification` | Alertes utilisateur in-app |
| `ReportJob` | État des jobs d'export asynchrones |
| `AuditLog` | Piste d'actions immuable |
| `SystemSetting` | Configuration plateforme clé-valeur |

### 6.2 Relations clés

- `Company` → possède plusieurs `User`, `Employee`, `Department`, `AccessAttempt`, etc.
- `Employee` → possède plusieurs `EmployeeIdentifier`, `AttendanceRecord`, `AccessAttempt`
- `AccessAttempt` → un `AccessDecisionRecord`, plusieurs `AccessDetectionItem`, optionnellement un `AttendanceRecord`
- `PpePolicy` → plusieurs `PpePolicyItem` (une par classe EPI avec confiance minimale)
- `User` ↔ `Role` via table de jonction `UserRole`
- `Role` ↔ `Permission` via table de jonction `RolePermission`

### 6.3 Décisions de conception notables

- **Suppressions logiques** sur `Employee`, `Department`, `User` via `deletedAt`
- **Clés d'idempotence** sur `AccessAttempt` pour éviter les autorisations en double
- **Stockage des preuves** : clés objet MinIO, pas de binaire en base
- **Journaux d'audit** : append-only avec acteur, entité et métadonnées JSON
- **Hachage des identifiants** — valeurs QR stockées hachées ; valeur en clair conservée uniquement pour réaffichage démo

---

## 7. Sécurité et RBAC

### 7.1 Flux d'authentification

1. L'utilisateur envoie email + mot de passe à `POST /api/v1/auth/login`
2. L'API valide les identifiants (comparaison hash Argon2)
3. L'API retourne un **JWT access token** courte durée (15 min) + **refresh token** (7 jours, haché en base)
4. Le frontend stocke l'access token ; envoie `Authorization: Bearer <token>` sur toutes les requêtes API
5. À expiration, le frontend appelle silencieusement `POST /api/v1/auth/refresh`
6. La déconnexion révoque le refresh token en base de données

### 7.2 Autorisation

- Décorateur NestJS `@Permissions()` + `PermissionsGuard` sur chaque endpoint protégé
- Codes de permission vérifiés contre les rôles de l'utilisateur
- Le frontend reflète les permissions via le wrapper de route `RequirePermission` et la navigation filtrée
- Les appels API non autorisés retournent **HTTP 403 Forbidden**

### 7.3 Matrice rôles-permissions

| Permission | Admin | Agent | Superviseur | RH | Employé |
|------------|:-----:|:-----:|:-----------:|:--:|:-------:|
| Vue tableau de bord | ✓ | ✓ | ✓ | ✓ | — |
| Tableau de bord live (WebSocket) | ✓ | ✓ | ✓ | — | — |
| Opération accès (borne) | ✓ | ✓ | — | — | — |
| Vue événements d'accès | ✓ | ✓ | ✓ | ✓ | — |
| Vue employés | ✓ | ✓ | ✓ | ✓ | — |
| Gestion employés | ✓ | — | — | ✓ | — |
| Gestion départements | ✓ | — | — | ✓ | — |
| Vue présence (tous/équipe/soi) | ✓ | soi | tous+équipe | tous+équipe | soi |
| Vue + export rapports | ✓ | — | ✓ | ✓ | — |
| Vue notifications | ✓ | ✓ | ✓ | ✓ | ✓ |
| Gestion utilisateurs | ✓ | — | — | — | — |
| Vue audit | ✓ | — | — | — | — |
| Gestion paramètres | ✓ | — | — | — | — |
| Profil (soi) | ✓ | ✓ | ✓ | ✓ | ✓ |

### 7.4 Durcissement sécurité (Phase 9)

- Limite d'upload : **3 Mio** avec liste blanche MIME (JPEG, PNG, WebP)
- En-têtes HTTP de sécurité : `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- IA fail-closed : timeout, service injoignable ou kill switch → refus `AI_UNAVAILABLE`
- Piste d'audit immuable complète sur toutes les actions sensibles
- Complexité minimale du mot de passe imposée à l'inscription/modification

---

## 8. Conception du module IA

### 8.1 Classes EPI détectées

| Code classe | Description |
|-------------|-------------|
| `helmet` | Casque / casque de sécurité |
| `safety_vest` | Gilet haute visibilité |
| `uniform` | Uniforme de travail / entreprise |

### 8.2 Endpoints du service IA

| Endpoint | Méthode | Auth | Rôle |
|----------|---------|------|------|
| `/v1/detect` | POST | `X-API-Key` | Exécuter la détection EPI sur une image uploadée |
| `/health` | GET | — | Vivacité du service |
| `/ready` | GET | — | Modèle chargé et prêt |
| `/v1/health` | GET | — | Santé détaillée avec infos modèle |

### 8.3 Architecture adaptateur

```
AccessControlService
    └── AiDetectorPort (interface)
            ├── FakeAiAdapter      ← dev/test (in-process, scénarios basculables)
            └── HttpAiAdapter      ← production (appelle AI_BASE_URL/v1/detect)
                    └── Service IA FastAPI
                            ├── Modèle YOLO (si poids MODEL_PATH présents)
                            └── Stub par scénario (défaut, sans poids requis)
```

**Configuration (`.env`) :**
- `AI_ADAPTER=fake|http` — sélection de l'adaptateur
- `AI_BASE_URL=http://localhost:8000` — URL du service IA
- `AI_KILL_SWITCH=true` — forcer toutes les inspections en AI_UNAVAILABLE
- `MODEL_PATH=./models/ppe-yolo.pt` — poids YOLO optionnels

### 8.4 Logique de décision fail-closed

Le `AccessDecisionService` évalue les résultats IA par rapport à la politique EPI de l'employé :

1. Pour chaque classe EPI requise dans la politique → vérifier le résultat de détection
2. La détection doit être `detected: true` ET `confidence >= minConfidence` (défaut 0,70)
3. Si le service IA est injoignable, timeout ou kill switch actif → **REFUSER** avec raison `AI_UNAVAILABLE`
4. Si une classe requise échoue → **REFUSER** avec liste des classes manquantes
5. Uniquement si toutes les classes requises passent → **AUTORISER**

---

## 9. Phases de développement et livrables

| Phase | Nom | Statut | Livrables clés |
|-------|-----|--------|----------------|
| **1** | Mise en place projet | ✅ Terminée | Scaffold monorepo, Docker Compose (Postgres/Redis/MinIO), squelette CI, README |
| **2** | Auth et RBAC | ✅ Terminée | Login/refresh JWT, 5 rôles seedés, gardes de routes frontend, audit à la connexion |
| **3** | Employés et org | ✅ Terminée | CRUD départements, CRUD employés, générer/régénérer/afficher QR |
| **4** | Présence | ✅ Terminée | Pointages, utilitaire retard, UI historique présence, calcul sur site |
| **5** | Orchestration accès | ✅ Terminée | Flux identify/inspect, FakeAiAdapter, simulation portique, upload preuves |
| **6** | Service IA EPI | ✅ Terminée | Endpoint detect FastAPI, HttpAiAdapter, mapping fail-closed, UI statut IA |
| **7** | Tableau de bord live | ✅ Terminée | Flux temps réel Socket.IO, heartbeat caméra, UI métriques tableau de bord |
| **8** | Rapports et notifications | ✅ Terminée | Exports async BullMQ (XLSX/PDF), notifications in-app, UI paramètres, filtres audit |
| **9** | Tests et durcissement | ✅ Terminée | Tests unit/intégration/E2E/perf, limites upload, en-têtes sécurité, checklist UAT |
| **10** | Déploiement et démo | 🔜 En attente | Packaging Docker tous services, scénario démo, tag release v1.0.0 |

---

## 10. Stratégie de tests

### 10.1 Pyramide de tests

| Couche | Outil | Éléments testés |
|--------|-------|-----------------|
| **Unitaire** | tsx (test natif Node) | Moteur de décision accès, matrice permissions RBAC, calcul retard, parsing payload QR, limites upload, mapping HttpAiAdapter |
| **Intégration** | Testcontainers + PostgreSQL | Opérations base de données sur instance Postgres réelle |
| **End-to-End** | Playwright | Smoke login, navigation UI RBAC, flux borne d'accès |
| **Contrat IA** | pytest | Mapping adaptateur labels, scénarios endpoint detect |
| **Performance** | k6 | Test smoke charge léger sur health et identify |

### 10.2 Pipeline CI (GitHub Actions — `.github/workflows/ci.yml`)

Exécuté à chaque push/PR sur `main` et `develop` :

| Job | Étapes |
|-----|--------|
| **quality** | Vérification format Prettier → typecheck TypeScript → tests unitaires → build production |
| **integration** | Prisma generate → tests intégration Testcontainers Postgres |
| **e2e** | Build → migrate + seed → démarrage API + web → tests smoke Playwright + RBAC |
| **ai-syntax** | Python 3.12 → pip install → import app FastAPI (vérification syntaxe) |

### 10.3 Commandes de test

```bash
pnpm test                  # Tests unitaires (API + web)
pnpm test:integration      # Intégration Postgres (Docker requis)
pnpm test:e2e              # E2E Playwright (API + DB en cours d'exécution)
pnpm test:perf             # Smoke k6 (optionnel ; ignoré si k6 absent)
```

---

## 11. Fonctionnalités clés implémentées

### 11.1 Borne de contrôle d'accès
- Scan QR caméra live via webcam (`html5-qrcode`)
- Flux complet identify → inspect avec retour visuel
- Affichage décision autoriser/refuser avec raisons EPI manquants précises
- Durée de simulation d'ouverture portique configurable
- Image de preuve uploadée et stockée dans MinIO
- Heartbeat caméra envoyé toutes les 20 secondes

### 11.2 Tableau de bord live
- Métriques temps réel : employés sur site, entrées du jour, refus du jour
- Indicateur statut adaptateur IA (fake vs HTTP live)
- Santé caméra par point d'accès
- Flux d'événements live Socket.IO — nouveaux accès sans rafraîchir la page
- Indicateur « Live connected » lorsque le WebSocket est actif

### 11.3 Gestion des employés
- CRUD complet avec suppression logique et gestion de statut
- Affectation département
- Génération, régénération et affichage à l'écran du code QR
- Heure de début de shift et minutes de grâce retard par employé
- Liste paginée avec recherche/filtre

### 11.4 Présence
- Pointage ENTRÉE automatique enregistré à l'autorisation d'accès
- Flag retard calculé depuis début de shift + période de grâce
- Historique de présence filtrable (employé, plage de dates, retards uniquement)
- Compteur employés actuellement sur site
- Traçabilité source de pointage manuel

### 11.5 Rapports (async via BullMQ)
- **Rapport de présence** — tous les pointages sur une plage de dates (XLSX ou PDF)
- **Rapport de refus** — toutes les tentatives d'accès refusées
- **Rapport conformité EPI** — taux réussite/échec détection par classe
- Jobs en file Redis ; URL de téléchargement fournie à la fin

### 11.6 Notifications
- Déclenchées sur : ACCESS_DENIED, AI_UNAVAILABLE, CAMERA_OFFLINE
- Centre de notifications in-app avec état lu/non lu
- Marquer une notification ou toutes comme lues

### 11.7 Paramètres système (Admin)
- Durée ouverture portique (ms)
- Délai minimum entre tentatives d'accès
- Minutes de grâce retard par défaut
- Seuils de confiance EPI
- Bascule fail-closed
- Jours de rétention des preuves

### 11.8 Piste d'audit
- Chaque action sensible journalisée avec acteur, entité, horodatage, IP
- Filtrable par acteur, type d'action, type d'entité, plage de dates
- Conception append-only immuable

---

## 12. Compétences et savoir-faire démontrés

| Catégorie | Technologies et concepts |
|-----------|-------------------------|
| **Développement frontend** | React 19, TypeScript, architecture SPA, routage client, gestion d'état (Zustand), client WebSocket, APIs caméra/QR navigateur, CSS Modules |
| **Développement backend** | Architecture modulaire NestJS, conception API REST, passerelle WebSocket, authentification JWT, autorisation RBAC, traitement de jobs en arrière-plan |
| **Ingénierie base de données** | Conception schéma PostgreSQL, ORM Prisma, migrations, seeding, stratégie d'indexation, suppressions logiques, colonnes JSON |
| **Intégration IA/ML** | Microservice FastAPI, détection d'objets (YOLO), pattern port/adaptateur, conception sécurité fail-closed, contrôles qualité image |
| **DevOps et infrastructure** | Docker Compose, orchestration multi-services, configuration environnement, CI/CD avec GitHub Actions |
| **Architecture logicielle** | Clean Architecture, monolithe modulaire, contextes délimités, pattern port/adaptateur, temps réel événementiel |
| **Tests** | Tests unitaires, tests d'intégration (Testcontainers), tests E2E (Playwright), tests de performance (k6) |
| **Sécurité** | Tokens JWT, hachage Argon2, RBAC, validation upload, en-têtes de sécurité, journalisation d'audit |
| **Gestion de projet** | Méthodologie livraison par phases, documentation d'architecture, checklists UAT, préparation démo |

---

## 13. Hors périmètre (V1)

Les éléments suivants ont été explicitement exclus de la Version 1 selon le pack de planification architecture :

- Reconnaissance faciale / identification biométrique
- Reconnaissance de plaques d'immatriculation (LPR)
- Intégration matérielle portique / tourniquet physique
- Biométrie empreinte digitale
- Détection incendie/fumée
- Intégration paie, ERP, inventaire ou comptabilité
- Entraînement de modèle ML personnalisé (poids pré-entraînés ou stubs par scénario)
- Déploiement SaaS multi-entreprises (hooks présents, non entièrement implémenté)
- Canaux notification email/SMS (in-app uniquement en V1)
- SSO entreprise OAuth2/OIDC

---

## 14. Améliorations futures

| Domaine | Amélioration prévue |
|---------|---------------------|
| **Matériel** | Adaptateur contrôleur portique réel, intégration lecteur RFID |
| **Notifications** | Canaux email et SMS |
| **Auth** | SSO entreprise OAuth2/OIDC (Keycloak) |
| **IA** | Inférence accélérée GPU, pipeline de fine-tuning modèle |
| **Déploiement** | Stack prod Docker Compose complète, Kubernetes, VM cloud |
| **Observabilité** | Traçage OpenTelemetry, logs JSON structurés (Pino), APM |
| **Multi-tenant** | Isolation SaaS multi-entreprises complète |
| **UI** | Tailwind CSS + bibliothèque composants shadcn/ui (prévu en architecture) |
| **Streaming** | WebRTC / MJPEG pour mur de caméras multi-vues |

---

## 15. Structure suggérée du rapport formel

Utiliser ce plan pour la rédaction de la soumission académique finale :

### Pages liminaires
- Page de garde (titre, nom étudiant, établissement, entreprise, dates de stage)
- Remerciements
- Résumé / abstract (150–200 mots)
- Table des matières
- Liste des figures et tableaux

### Chapitre 1 : Introduction
- Présentation de l'entreprise (Granisafe Solution)
- Énoncé du problème (conformité EPI sur sites industriels/construction)
- Objectifs et périmètre du projet
- Plan du rapport

### Chapitre 2 : Contexte et état de l'art
- Systèmes de contrôle d'accès industriels
- Réglementation EPI et sécurité au travail
- IA / vision par ordinateur en santé-sécurité au travail
- Travaux connexes et solutions existantes

### Chapitre 3 : Analyse et conception du système
- Exigences fonctionnelles (cas d'usage, user stories)
- Exigences non fonctionnelles (performance, sécurité, disponibilité)
- Diagrammes d'architecture système
- Conception base de données (diagramme ER, description des tables)
- Choix et justification de la stack technologique
- Vue d'ensemble de la conception API

### Chapitre 4 : Implémentation
- Méthodologie de développement (livraison en 10 phases)
- Détails d'implémentation module par module
- Algorithmes clés (moteur de décision accès, calcul retard)
- Approche d'intégration du service IA
- Captures d'écran de l'interface par rôle
- Extraits de code sur les chemins critiques

### Chapitre 5 : Tests et assurance qualité
- Stratégie de tests (unitaire, intégration, E2E, performance)
- Description du pipeline CI/CD
- Synthèse des résultats de tests
- Checklist UAT et résultats

### Chapitre 6 : Résultats et discussion
- Scénarios de démonstration et résultats
- Observations de performance
- Difficultés rencontrées et solutions appliquées
- Enseignements tirés

### Chapitre 7 : Conclusion et perspectives
- Synthèse des réalisations
- Limites de la version actuelle
- Prochaines étapes recommandées

### Pages finales
- Bibliographie (format IEEE ou APA)
- Annexes :
  - A : Liste complète des endpoints API
  - B : Schéma base de données (Prisma)
  - C : Identifiants utilisateurs démo
  - D : Checklist UAT
  - E : Référence configuration environnement

---

## 16. Référence rapide

### Identifiants utilisateurs démo

Mot de passe pour tous les comptes : `Password123!`

| Email | Rôle | Accès principal |
|-------|------|-----------------|
| admin@granisafe.local | ADMIN | Accès système complet |
| guard@granisafe.local | GUARD | Borne d'accès, tableau de bord, employés |
| supervisor@granisafe.local | SUPERVISOR | Tableau de bord, présence, rapports |
| hr@granisafe.local | HR | Employés, départements, présence, rapports |
| employee@granisafe.local | EMPLOYEE | Profil, présence personnelle, notifications |

### URLs de développement local

| Service | URL |
|---------|-----|
| SPA Web | http://localhost:5173 |
| Health check API | http://localhost:3000/health |
| Ready check API | http://localhost:3000/ready |
| Service IA | http://localhost:8000 |
| Documentation service IA | http://localhost:8000/docs |
| Console MinIO | http://localhost:9001 |

### Commandes de mise en place

```bash
# 1. Installer les dépendances
pnpm install
cp .env.example .env

# 2. Démarrer l'infrastructure (Postgres, Redis, MinIO)
pnpm infra:up
# ou sous Windows :
.\scripts\dev-infra.ps1

# 3. Exécuter migrations et seed des données démo
pnpm db:setup

# 4. Démarrer web + API en mode développement
pnpm dev

# 5. (Optionnel) Démarrer le service IA séparément
pnpm dev:ai
```

### Commandes de test

```bash
pnpm typecheck           # Validation TypeScript sur tous les packages
pnpm build               # Build production (shared + api + web)
pnpm test                # Tests unitaires
pnpm test:integration    # Tests intégration Postgres (Docker requis)
pnpm test:e2e            # Tests navigateur Playwright
pnpm test:perf           # Test smoke performance k6
pnpm format:check        # Vérification formatage Prettier
```

### Variables d'environnement clés

| Variable | Défaut | Rôle |
|----------|--------|------|
| `DATABASE_URL` | `postgresql://granisafe:granisafe@localhost:5433/...` | Connexion PostgreSQL |
| `REDIS_URL` | `redis://localhost:6379` | Connexion Redis |
| `JWT_ACCESS_SECRET` | (à modifier) | Secret de signature JWT |
| `AI_ADAPTER` | `http` | Adaptateur IA `fake` ou `http` |
| `AI_BASE_URL` | `http://localhost:8000` | URL du service IA |
| `AI_KILL_SWITCH` | `false` | Forcer IA indisponible |
| `S3_ENDPOINT` | `http://localhost:9000` | Endpoint MinIO |
| `GATE_OPEN_MS` | `3000` | Durée simulation ouverture portique |

---

*Document généré à partir de l'analyse du codebase projet. Source : monorepo Granisafe Smart Access, phases 1 à 9 terminées.*
