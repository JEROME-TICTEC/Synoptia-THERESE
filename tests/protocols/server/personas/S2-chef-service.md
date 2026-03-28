# Protocole de test - S2 : Chef de Service

> Persona : Claire Duval, cheffe de service dans une mairie de 400 agents.
> Role : `manager` (RBAC) - visibilite elargie, pas d'admin
> Cible : THERESE Server (FastAPI + React, multi-tenant)
> Version minimale : v0.4.1
> Derniere MAJ : 27 mars 2026

---

## Informations generales

| Cle | Valeur |
|-----|--------|
| Persona | S2 - Chef de Service |
| Role RBAC | `manager` |
| URL | `http://localhost:8880` |
| Credentials | `manager@therese.local` / `manager` |
| Organisation | Mairie de Manosque (org test) |
| Navigateur | Chrome (Chrome MCP) |
| Screenshots | `/tmp/therese-server-tests/S2-*.png` |
| Duree estimee | 35-50 minutes |
| Pre-requis | Compte manager cree, au moins 1 agent dans l'org, serveur demarre |

## Contexte

Claire est cheffe du service Urbanisme depuis 4 ans. Elle manage une equipe de 8 agents. Son quotidien : repartir les taches entre ses agents, suivre les dossiers sensibles via le CRM, utiliser le Board IA pour arbitrer les reorganisations de service, et rediger des notes de service via le chat. Elle n'a PAS acces a l'administration de la plateforme (creation de comptes, audit logs, etc.) mais dispose d'une visibilite plus large qu'un agent simple : elle voit les taches et contacts de son equipe.

---

## Modules couverts

- Auth / Login
- Charte IA (bloquante)
- Chat (conversations, streaming, multi-paragraphes)
- Taches (CRUD, assignation, priorite, filtrage)
- Contacts CRM (visibilite service/org)
- Board de decision (5 conseillers, questions manageriales)
- Skills (19 competences, execution)
- RBAC (interdiction admin, visibilite manager)
- Recherche globale
- Securite (XSS, console JS)
- Persistance des donnees
- Deconnexion

## Convention selecteurs

Chaque etape fournit un selecteur `data-testid` (prioritaire) ET un fallback naturel pour les environnements ou les testid ne sont pas encore deployes.

**Syntaxe fallback** : `[aria-label="X"]`, `button:has-text("X")`, `role=X`, ou selecteur CSS standard.

---

## Preparation

```bash
# 1. Creer le dossier screenshots
mkdir -p /tmp/therese-server-tests

# 2. Verifier que le serveur repond
curl -s http://localhost:8880/api/health | jq .

# 3. Verifier que le compte manager existe (sinon le creer via admin)
curl -s -X POST http://localhost:8880/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@therese.local","password":"manager"}' | jq .status

# 4. Si 401 : creer le compte via l'admin
curl -s -X POST http://localhost:8880/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"manager@therese.local","password":"manager","name":"Claire Duval","role":"manager"}'

# 5. Verifier qu'au moins un agent existe dans l'org (pour tests d'assignation)
curl -s http://localhost:8880/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.[] | select(.role=="agent") | .email'
# Si vide : creer un agent
curl -s -X POST http://localhost:8880/api/admin/users \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"agent@therese.local","password":"agent","name":"Jean Dupont","role":"agent"}'
```

---

## Etapes de test

---

### Etape 1 : Naviguer vers /login

**Priorite** : P0

**Actions Chrome MCP** :
1. `navigate` -> `http://localhost:8880/login`
2. `wait_for` -> page chargee, formulaire visible
3. Verifier presence du formulaire de connexion

**Selecteur principal** : `[data-testid="login-form"]`
**Fallback** : `form[action*="login"]` ou `form:has(input[type="email"])`

**Resultat attendu** : La page /login s'affiche avec un formulaire contenant email, mot de passe, bouton de connexion. Aucune NavBar visible (pas encore authentifie).
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-01_login-page.png`

---

### Etape 2 : Login manager@therese.local

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` -> `[data-testid="login-email-input"]` | fallback : `input[type="email"]` -> `manager@therese.local`
2. `fill` -> `[data-testid="login-password-input"]` | fallback : `input[type="password"]` -> `manager`
3. `click` -> `[data-testid="login-submit-btn"]` | fallback : `button[type="submit"]`
4. `wait_for` -> redirection vers /chat OU affichage de la charte IA

**Resultat attendu** : Connexion reussie. Si c'est la premiere connexion, la CharterModal s'affiche par-dessus /chat. Sinon, /chat s'affiche directement. Un JWT est stocke dans localStorage.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-02_login-correct.png`

**Verification supplementaire** : DevTools > Application > Local Storage -> cle `token` ou `access_token` presente avec une valeur JWT (format `eyJ...`).

---

### Etape 3 : Charte IA - accepter si affichee

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="charter-modal"]` | fallback : `[role="dialog"]`, `.charter-modal` (timeout 3s)
2. Si la modale est presente :
   - Verifier que le texte est scrollable (contenu long)
   - Verifier que le bouton "Accepter" est present
   - Verifier que cliquer en dehors ne ferme PAS la modale (bloquante)
   - `click` -> `[data-testid="charter-accept-btn"]` | fallback : `button:has-text("Accepter")`, `button:has-text("J'accepte")`
   - `wait_for` -> modale disparait, /chat visible
3. Si la modale n'est pas presente (charte deja acceptee) : passer a l'etape 4

**Selecteur modal** : `[data-testid="charter-modal"]`
**Selecteur bouton** : `[data-testid="charter-accept-btn"]`
**Fallback modal** : `[role="dialog"]`, `.charter-modal`
**Fallback bouton** : `button:has-text("Accepter")`, `button:has-text("J'accepte")`

**Resultat attendu** : Si premiere connexion, la modale de charte IA s'affiche, le manager l'accepte, et /chat devient accessible. La NavBar apparait.
**Etats testes** : empty (premiere connexion) | filled (deja acceptee)
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-03_charte-modal.png`

**Verification API** :
```bash
curl -s http://localhost:8880/api/users/me \
  -H "Authorization: Bearer $TOKEN" | jq .charter_accepted_at
# Doit retourner une date ISO, pas null
```

---

### Etape 4 : Verifier NavBar (RBAC manager)

**Priorite** : P0

**Actions Chrome MCP** :
1. Verifier presence : `[data-testid="nav-link-chat"]` | fallback : `a[href="/chat"]`, `nav a:has-text("Chat")`
2. Verifier presence : `[data-testid="nav-link-tasks"]` | fallback : `a[href="/tasks"]`
3. Verifier presence : `[data-testid="nav-link-skills"]` | fallback : `a[href="/skills"]`
4. Verifier presence : `[data-testid="nav-link-crm"]` | fallback : `a[href="/crm"]`, `nav a:has-text("Contacts")`
5. Verifier presence : `[data-testid="nav-link-board"]` | fallback : `a[href="/board"]`
6. Verifier ABSENCE : `[data-testid="nav-link-admin"]` | fallback : `a[href="/admin"]`

**Resultat attendu** : Les 5 liens de navigation (Chat, Taches, Skills, Contacts, Board) sont visibles. Le lien "Admin" ou "Administration" est ABSENT. C'est le test RBAC fondamental cote frontend pour le role manager.
**Etats testes** : rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-04_navbar-rbac.png`

**CRITIQUE** : Si le lien Admin est visible pour un manager, c'est un defaut RBAC. Le manager n'est PAS admin. Stopper le protocole et remonter le bug immediatement.

---

### Etape 5 : Chat - nouvelle conversation

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="new-conversation-btn"]` | fallback : `button:has-text("Nouvelle")`, `button[aria-label="Nouvelle conversation"]`
2. `wait_for` -> conversation creee, input chat actif

**Resultat attendu** : Une nouvelle conversation apparait dans la sidebar (si visible) ou la zone de chat se reinitialise. Le champ de saisie est actif (focus).
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-05_nouvelle-conv.png`

---

### Etape 6 : Envoyer "Redige une note de service sur les horaires d'ete"

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` -> `[data-testid="chat-message-input"]` | fallback : `textarea` -> `Redige une note de service sur les horaires d'ete pour mon equipe du service Urbanisme. Les horaires passent de 8h30-17h a 8h-16h du 1er juillet au 31 aout.`
2. `click` -> `[data-testid="chat-send-btn"]` | fallback : `button[aria-label="Envoyer"]`, `button:has(svg)`
3. `wait_for` -> message utilisateur affiche dans la liste

**Resultat attendu** : Le message utilisateur apparait dans la conversation. Le champ de saisie se vide apres envoi.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-06_message-envoye.png`

---

### Etape 7 : Verifier reponse LLM streaming

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` -> reponse IA en streaming (texte qui apparait progressivement)
2. Attendre fin du streaming (bouton send redevient actif)
3. Verifier que la reponse contient du texte pertinent (horaires, note de service)
4. Verifier presence de 2 messages dans la liste (user + assistant)

**Resultat attendu** : Une reponse IA s'affiche en streaming. Le contenu est pertinent (mentionne les horaires d'ete, le service Urbanisme). Pas de message d'erreur. Le streaming se termine proprement.
**Etats testes** : filled | loading
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-07_streaming.png`

**Verification reseau** : DevTools > Network -> requete SSE vers `/api/chat/stream` ou `/api/chat/deliberate` avec Content-Type `text/event-stream`.

---

### Etape 8 : Envoyer un message complexe multi-paragraphes

**Priorite** : P1

**Actions Chrome MCP** :
1. `fill` -> `[data-testid="chat-message-input"]` | fallback : `textarea` -> texte multi-lignes :
   ```
   Je dois reorganiser le planning de mon equipe pour la rentree. Voici les contraintes :

   1. Marie est en conge parental le lundi et mardi
   2. Paul ne peut pas travailler apres 16h (contrainte medicale)
   3. Le guichet doit etre ouvert de 9h a 12h et de 14h a 17h du lundi au vendredi
   4. Il faut au minimum 2 personnes au guichet en permanence

   Propose-moi un planning hebdomadaire qui respecte toutes ces contraintes.
   ```
2. `click` -> `[data-testid="chat-send-btn"]`
3. `wait_for` -> reponse IA en streaming

**Resultat attendu** : Le message multi-paragraphes est envoye correctement (pas de troncature). La reponse IA prend en compte les 4 contraintes. Le formatage multi-lignes est preserve dans l'affichage.
**Etats testes** : filled | loading
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-08_message-complexe.png`

**Note** : Le champ textarea doit supporter les retours a la ligne (Shift+Enter ou saisie directe). Si `fill` ne gere pas le multi-lignes, utiliser `evaluate_script` pour injecter la valeur.

---

### Etape 9 : Voir les conversations dans la sidebar

**Priorite** : P1

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="conversation-list"]` | fallback : `.conversation-list`, `aside ul`, `.sidebar-conversations`
2. Verifier presence d'au moins 1 `[data-testid="conversation-item"]` | fallback : `.conversation-item`, `aside li`
3. Verifier que la conversation courante est mise en surbrillance (active)

**Resultat attendu** : La sidebar affiche la liste des conversations. Au moins une conversation est visible (celle qu'on vient de creer). La conversation active est visuellement distinguee (fond colore, bordure, ou texte en gras).
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-09_sidebar-conversations.png`

---

### Etape 10 : Naviguer vers /tasks

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="nav-link-tasks"]` | fallback : `a[href="/tasks"]`, `nav a:has-text("Taches")`
2. `wait_for` -> `[data-testid="tasks-page"]` | fallback : page /tasks chargee

**Resultat attendu** : La page Taches s'affiche. La liste des taches est visible (vide ou avec des taches existantes). Un bouton "Creer" ou "+" est present.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-10_tasks-page.png`

---

### Etape 11 : Voir les taches (manager + assignees)

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="tasks-list"]` | fallback : `.tasks-list`, `[role="list"]`
2. Verifier que la liste s'affiche (vide ou avec du contenu)
3. Si des taches existent, verifier que le manager voit :
   - ses propres taches
   - les taches qu'il a assignees a des agents

**Resultat attendu** : Le manager voit ses taches personnelles ET les taches qu'il a assignees. La visibilite est plus large qu'un agent simple (qui ne voit que les siennes). Si la liste est vide, c'est normal (on va creer des taches ensuite).
**Etats testes** : empty | filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-11_tasks-visibilite.png`

**Note** : La visibilite manager est un test RBAC cle. Si disponible, comparer avec la vue d'un agent simple pour confirmer que le manager voit plus de taches.

---

### Etape 12 : Creer tache "Planifier reunion equipe"

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="tasks-create-btn"]` | fallback : `button:has-text("Creer")`, `button:has-text("Nouvelle tache")`, `button[aria-label="Ajouter"]`
2. `wait_for` -> formulaire de creation visible
3. `fill` -> champ titre -> `Planifier reunion equipe`
4. `fill` -> champ description (si present) -> `Reunion de service hebdomadaire - ordre du jour : horaires d'ete, repartition dossiers, point RH`
5. `fill` -> champ deadline/echeance (si present) -> date J+7 (format YYYY-MM-DD ou via date picker)

**Resultat attendu** : Le formulaire de creation de tache s'ouvre. Les champs titre, description et echeance sont editables. Le formulaire accepte les donnees saisies.
**Etats testes** : empty | filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-12_task-create.png`

---

### Etape 13 : Assigner la tache a un agent

**Priorite** : P1

**Actions Chrome MCP** :
1. Chercher un champ d'assignation : `select`, `combobox`, `[data-testid="task-assignee-select"]` | fallback : `select[name="assignee"]`, `[aria-label="Assigner a"]`, `.assignee-select`
2. Si le champ existe :
   - Selectionner un agent dans la liste (ex: "Jean Dupont" ou `agent@therese.local`)
   - `wait_for` -> selection confirmee visuellement
3. Si le champ n'existe pas : noter "fonctionnalite non disponible" et continuer

**Resultat attendu** : Si la fonctionnalite est disponible, le manager peut assigner la tache a un membre de son equipe via un selecteur. L'agent assigne apparait dans les details de la tache.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-13_task-assignation.png`

**Note** : L'assignation est une fonctionnalite cle du role manager. Si elle n'est pas implementee, c'est un P1 dans le backlog.

---

### Etape 14 : Modifier la priorite de la tache

**Priorite** : P1

**Actions Chrome MCP** :
1. Chercher un selecteur de priorite : `[data-testid="task-priority-select"]` | fallback : `select[name="priority"]`, `.priority-select`, `button:has-text("Priorite")`
2. Si le selecteur existe :
   - Changer la priorite (ex: "Normale" -> "Haute" ou "Urgente")
   - `wait_for` -> changement visuel (badge couleur, icone)
3. Sauvegarder la tache : `click` -> bouton "Sauvegarder" | fallback : `button[type="submit"]`, `button:has-text("Sauvegarder")`
4. `wait_for` -> tache visible dans la liste avec la nouvelle priorite

**Resultat attendu** : La priorite est modifiable. Apres sauvegarde, la tache apparait dans la liste avec un indicateur visuel de priorite (badge colore, icone, ou texte). La tache "Planifier reunion equipe" est bien creee.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-14_task-priorite.png`

**Verification API** :
```bash
curl -s http://localhost:8880/api/tasks \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.title=="Planifier reunion equipe") | {title, priority, assignee}'
```

---

### Etape 15 : Filtrer les taches par statut

**Priorite** : P1

**Actions Chrome MCP** :
1. Chercher un filtre de statut : `[data-testid="tasks-filter-status"]` | fallback : `select[name="status"]`, `.status-filter`, `button:has-text("Filtre")`
2. Si le filtre existe :
   - Selectionner "A faire" ou "En cours"
   - `wait_for` -> liste filtree (debounce ~300ms)
   - Verifier que seules les taches du statut selectionne sont affichees
3. Reinitialiser le filtre (selectionner "Tous" ou vider le filtre)
4. Verifier que toutes les taches reapparaissent

**Resultat attendu** : Le filtrage par statut fonctionne. La liste se met a jour dynamiquement. Reinitialiser le filtre restaure la liste complete.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-15_tasks-filtre.png`

**Note** : Si le filtre n'est pas disponible, noter "fonctionnalite non disponible" et continuer.

---

### Etape 16 : Naviguer vers /crm

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="nav-link-crm"]` | fallback : `a[href="/crm"]`, `nav a:has-text("Contacts")`
2. `wait_for` -> `[data-testid="crm-page"]` | fallback : page /crm chargee

**Resultat attendu** : La page Contacts/CRM s'affiche. La liste des contacts est visible (vide ou avec des contacts existants). Un bouton "Creer" ou "Ajouter" est present.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-16_crm-page.png`

---

### Etape 17 : Voir les contacts du service/organisation

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="crm-contact-list"]` | fallback : `.contact-list`, `[role="list"]`
2. Verifier que la liste s'affiche (vide ou avec du contenu)
3. Si des contacts existent, noter leur nombre pour comparaison avec la vue agent

**Resultat attendu** : Le manager voit les contacts de son service/organisation. La visibilite est au minimum egale a celle d'un agent, potentiellement plus large (contacts partages, contacts de l'equipe). Si la liste est vide, c'est normal (on va creer un contact ensuite).
**Etats testes** : empty | filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-17_crm-visibilite.png`

---

### Etape 18 : Creer contact "Prefecture - M. Lambert"

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="crm-create-contact-btn"]` | fallback : `button:has-text("Ajouter")`, `button:has-text("Nouveau contact")`
2. `wait_for` -> formulaire de creation visible
3. `fill` -> champ nom -> `M. Lambert`
4. `fill` -> champ organisation/entreprise (si present) -> `Prefecture des Alpes-de-Haute-Provence`
5. `fill` -> champ fonction/titre (si present) -> `Secretaire general`
6. `fill` -> champ email (si present) -> `p.lambert@prefecture04.gouv.fr`
7. `fill` -> champ telephone (si present) -> `04 92 30 55 00`

**Resultat attendu** : Le formulaire de creation de contact s'ouvre. Tous les champs disponibles sont editables.
**Etats testes** : empty | filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-18_contact-create.png`

---

### Etape 19 : Ajouter des notes sur le contact

**Priorite** : P1

**Actions Chrome MCP** :
1. Sauvegarder d'abord le contact : `click` -> bouton "Sauvegarder" | fallback : `button[type="submit"]`
2. `wait_for` -> contact cree, detail visible
3. Chercher une zone de notes : `[data-testid="crm-contact-notes"]` | fallback : `textarea[name="notes"]`, `.contact-notes`, `[aria-label="Notes"]`
4. Si la zone existe :
   - `fill` -> zone de notes -> `Referent pour les autorisations d'urbanisme. A contacter avant toute demande de permis modificatif. Disponible le mardi et jeudi matin.`
   - Sauvegarder les notes (si bouton dedie) | ou verifier auto-save
5. Verifier que les notes sont persistees (rafraichir et verifier)

**Resultat attendu** : Le contact "M. Lambert" est cree et apparait dans la liste. Les notes sont ajoutees et persistees. Si les notes ne sont pas disponibles en tant que champ dedie, verifier si elles font partie du formulaire de creation.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-19_contact-notes.png`

**Verification API** :
```bash
curl -s http://localhost:8880/api/crm/contacts \
  -H "Authorization: Bearer $TOKEN" | jq '.[] | select(.name | contains("Lambert"))'
```

---

### Etape 20 : Rechercher un contact existant

**Priorite** : P1

**Actions Chrome MCP** :
1. Chercher un champ de recherche sur la page CRM
2. `fill` -> champ recherche | fallback : `input[placeholder*="Rechercher"]`, `input[type="search"]` -> `Lambert`
3. `wait_for` -> filtrage de la liste (debounce ~300ms)
4. Verifier que "M. Lambert" apparait dans les resultats
5. Vider le champ de recherche
6. Verifier que tous les contacts reapparaissent

**Resultat attendu** : La recherche filtre en temps reel. Le contact "M. Lambert" apparait. Vider la recherche restaure la liste complete.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-20_contact-recherche.png`

---

### Etape 21 : Naviguer vers /board

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="nav-link-board"]` | fallback : `a[href="/board"]`, `nav a:has-text("Board")`
2. `wait_for` -> `[data-testid="board-page"]` | fallback : page /board chargee
3. Verifier que le panneau Board est visible avec un champ de saisie

**Resultat attendu** : La page Board s'affiche. Un champ de saisie pour poser une question est visible. Les 5 conseillers (ou leur representation) sont affiches.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-21_board-page.png`

---

### Etape 22 : Poser question strategique au Board

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` -> champ de saisie Board `[data-testid="board-panel"] textarea` | fallback : `textarea`, `input[placeholder*="question"]` -> `Comment reorganiser l'accueil du public apres les travaux ? Le hall principal sera ferme 3 mois, nous devons maintenir l'accueil avec 2 guichets temporaires au lieu de 4.`
2. `click` -> `[data-testid="board-submit-btn"]` | fallback : `button:has-text("Deliberer")`, `button:has-text("Soumettre")`
3. `wait_for` -> debut du streaming de la deliberation

**Resultat attendu** : La question est envoyee. Le Board lance la deliberation avec les 5 conseillers. Le streaming commence.
**Etats testes** : filled | loading
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-22_board-question.png`

---

### Etape 23 : Attendre la deliberation - resultat visible

**Priorite** : P0

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="board-result"]` | fallback : `.board-result`, `.deliberation-result` (timeout 90s)
2. Attendre fin du streaming (tous les conseillers ont repondu)
3. Verifier que le resultat contient des contributions de plusieurs conseillers
4. Verifier la presence d'une synthese ou recommandation finale

**Resultat attendu** : Le resultat de la deliberation est affiche. Chaque conseiller a apporte sa contribution (identifiable par nom, emoji ou couleur). Une synthese ou recommandation finale est visible. Pas de message d'erreur.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-23_board-resultat.png`

**Timeout** : La deliberation peut prendre 30-60 secondes (5 appels LLM). Configurer un timeout de 90s.

---

### Etape 24 : Voir les 5 avis des conseillers

**Priorite** : P1

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="board-advisor-card"]` | fallback : `.advisor-card`, `.board-advisor`, `.conseiller-card`
2. Compter le nombre de cartes de conseillers visibles
3. Verifier que chaque carte contient : un nom/role, un avis textuel
4. Verifier que les 5 conseillers sont distincts (pas de doublons)

**Resultat attendu** : Exactement 5 cartes de conseillers sont affichees. Chaque carte contient un avis argumente et identifiable. Les 5 avis sont differents et complementaires.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-24_board-5-avis.png`

**Verification** : Les 5 conseillers attendus sont generalement : Stratege, Financier, Juridique, Operationnel, Innovation (ou equivalent). Verifier que les noms/roles correspondent a la configuration du Board.

---

### Etape 25 : Naviguer vers /skills

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="nav-link-skills"]` | fallback : `a[href="/skills"]`, `nav a:has-text("Skills")`
2. `wait_for` -> `[data-testid="skills-page"]` | fallback : page /skills chargee

**Resultat attendu** : La page Skills s'affiche avec la liste des competences disponibles.
**Etats testes** : empty
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-25_skills-page.png`

---

### Etape 26 : Parcourir les categories de skills

**Priorite** : P1

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="skills-list"]` | fallback : `.skills-list`, `.skills-grid`
2. Compter le nombre de `[data-testid="skill-item"]` | fallback : `.skill-item`, `.skill-card`
3. Verifier qu'il y a au moins 15 skills affiches (19 attendus)
4. Verifier que les categories sont visibles (ex: Generation, Texte, Analyse, Planification, Office)
5. Chercher un skill pertinent pour un manager : "Document Word Professionnel" ou equivalent

**Resultat attendu** : La liste affiche 19 skills organises par categories. Les categories regroupent logiquement les skills. Le skill "Document Word Professionnel" (ou equivalent Office) est identifiable.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-26_skills-categories.png`

---

### Etape 27 : Executer un skill "Document Word Professionnel"

**Priorite** : P1

**Actions Chrome MCP** :
1. `click` -> le skill "Document Word" ou "Note de service" | fallback : `.skill-item:has-text("Word")`, `.skill-item:has-text("Document")`
2. `wait_for` -> detail du skill visible (description, parametres)
3. Remplir les parametres requis (si formulaire) :
   - Sujet/titre : `Note de service - Horaires d'ete 2026`
   - Contenu/instructions : `Informer l'equipe du service Urbanisme du changement d'horaires du 1er juillet au 31 aout`
4. `click` -> `[data-testid="skill-execute-btn"]` | fallback : `button:has-text("Executer")`, `button:has-text("Lancer")`
5. `wait_for` -> resultat du skill (generation en cours puis resultat)

**Resultat attendu** : Le skill s'execute. Un document Word est genere (telechargement ou apercu). Pas d'erreur 500. Le temps d'execution est raisonnable (<30s).
**Etats testes** : filled | loading
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-27_skill-word.png`

**Note** : Certains skills generent un fichier (DOCX, XLSX, PPTX). Verifier que le telechargement se declenche ou qu'un apercu est affiche.

---

### Etape 28 : Verifier le resultat du skill

**Priorite** : P1

**Actions Chrome MCP** :
1. `wait_for` -> `[data-testid="skill-result"]` | fallback : `.skill-result`, `.generation-result`
2. Verifier que le resultat contient :
   - Un message de succes OU un apercu du document
   - Un bouton de telechargement (si fichier genere)
3. Si un apercu est affiche, verifier que le contenu est pertinent (horaires, service Urbanisme)

**Resultat attendu** : Le skill a produit un resultat exploitable. Le manager peut telecharger le fichier ou copier le contenu. Pas de message d'erreur.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-28_skill-resultat.png`

---

### Etape 29 : Retour au chat - conversation preservee

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> `[data-testid="nav-link-chat"]` | fallback : `a[href="/chat"]`, `nav a:has-text("Chat")`
2. `wait_for` -> `[data-testid="message-list"]` | fallback : `.message-list`, `[role="log"]`
3. Verifier que les messages precedents sont visibles (note de service, planning)
4. Verifier que la conversation est intacte (pas de perte de messages)

**Resultat attendu** : En revenant sur /chat, la conversation precedente est intacte. Les messages utilisateur et les reponses IA sont tous presents. La navigation entre modules ne cause pas de perte de donnees.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-29_chat-preserve.png`

---

### Etape 30 : Tenter /admin - DOIT etre redirige

**Priorite** : P0

**Actions Chrome MCP** :
1. `navigate` -> `http://localhost:8880/admin`
2. `wait_for` -> redirection vers /chat OU page 403 OU message "Acces interdit"

**Resultat attendu** : Le manager est redirige vers /chat (ou une page d'erreur). Il ne voit PAS le dashboard admin. Pas de donnees admin visibles (liste users, logs, KPIs admin).
**Etats testes** : rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-30_admin-interdit.png`

**CRITIQUE** : Si le manager accede au dashboard admin, c'est une faille RBAC majeure. Le role `manager` n'est PAS `admin`. Stopper le protocole et remonter immediatement.

---

### Etape 31 : Tenter API /api/admin/users - 403

**Priorite** : P0

**Actions Chrome MCP** :
1. `evaluate_script` -> `fetch('/api/admin/users', {headers: {'Authorization': 'Bearer ' + localStorage.getItem('token')}}).then(r => r.status)`
2. `wait_for` -> resultat de l'evaluation

**Fallback CLI** :
```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8880/api/admin/users \
  -H "Authorization: Bearer $MANAGER_TOKEN"
# Doit retourner 403
```

**Resultat attendu** : L'API retourne un code HTTP 403 Forbidden. Aucune donnee utilisateur n'est retournee dans le corps de la reponse.
**Etats testes** : rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-31_api-admin-403.png`

**Verification etendue** : Tester aussi les autres endpoints admin :
```bash
# Tous doivent retourner 403 pour un manager
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/admin/audit-log -H "Authorization: Bearer $MANAGER_TOKEN"
curl -s -o /dev/null -w "%{http_code}" http://localhost:8880/api/admin/org/settings -H "Authorization: Bearer $MANAGER_TOKEN"
curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:8880/api/admin/users -H "Authorization: Bearer $MANAGER_TOKEN" -d '{}'
curl -s -o /dev/null -w "%{http_code}" -X DELETE http://localhost:8880/api/admin/users/1 -H "Authorization: Bearer $MANAGER_TOKEN"
```

**CRITIQUE** : Tout code different de 403 est une faille de securite. Le manager ne doit JAMAIS pouvoir creer, modifier ou supprimer des utilisateurs.

---

### Etape 32 : Recherche globale (Ctrl+K)

**Priorite** : P2

**Actions Chrome MCP** :
1. `press_key` -> `Control+k` (ou `Meta+k` sur Mac)
2. `wait_for` -> modale de recherche globale visible | fallback : `[role="dialog"]`, `.search-modal`, `.command-palette`
3. `fill` -> champ de recherche -> `reunion`
4. `wait_for` -> resultats de recherche (taches, contacts, conversations)

**Resultat attendu** : La palette de commandes / recherche globale s'ouvre. La recherche "reunion" retourne la tache "Planifier reunion equipe" creee a l'etape 12. Les resultats sont cliquables et menent vers l'element correspondant.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-32_recherche-globale.png`

**Note** : Si Ctrl+K ne fonctionne pas, chercher un bouton de recherche dans la NavBar (`button[aria-label="Rechercher"]`, icone loupe).

---

### Etape 33 : Deconnexion

**Priorite** : P0

**Actions Chrome MCP** :
1. Chercher le bouton de deconnexion : menu profil, icone, ou lien
2. `click` -> bouton deconnexion | fallback : `button:has-text("Deconnexion")`, `button:has-text("Se deconnecter")`, `a[href="/logout"]`
3. `wait_for` -> redirection vers /login

**Resultat attendu** : Le manager est deconnecte. Le JWT est supprime de localStorage. La page /login s'affiche. La NavBar n'est plus visible.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-33_deconnexion.png`

**Verification supplementaire** : DevTools > Application > Local Storage -> cle `token` ou `access_token` absente.

---

### Etape 34 : Reconnexion - persistance des donnees

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` -> `[data-testid="login-email-input"]` -> `manager@therese.local`
2. `fill` -> `[data-testid="login-password-input"]` -> `manager`
3. `click` -> `[data-testid="login-submit-btn"]`
4. `wait_for` -> /chat visible (charte deja acceptee, pas de re-affichage)
5. Naviguer vers /tasks -> verifier que la tache "Planifier reunion equipe" est toujours la
6. Naviguer vers /crm -> verifier que le contact "M. Lambert" est toujours la

**Resultat attendu** : Apres reconnexion, toutes les donnees creees en session precedente sont presentes : taches, contacts, conversations. La charte n'est PAS re-affichee (deja acceptee). Les donnees sont persistees cote serveur (pas seulement localStorage).
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-34_persistance.png`

**CRITIQUE** : Si les donnees ont disparu apres deconnexion/reconnexion, c'est un bug de persistance majeur. Verifier que les donnees sont bien en base (pas seulement en memoire/state frontend).

---

### Etape 35 : Test XSS dans le chat

**Priorite** : P0

**Actions Chrome MCP** :
1. `fill` -> `[data-testid="chat-message-input"]` | fallback : `textarea` -> `<script>alert(1)</script>`
2. `click` -> `[data-testid="chat-send-btn"]`
3. `wait_for` -> message affiche dans la conversation
4. Verifier qu'AUCUNE alerte JavaScript ne s'est declenchee
5. Verifier que le texte `<script>alert(1)</script>` est affiche en tant que texte brut (pas interprete)

**Resultat attendu** : Le message est affiche en texte brut. Le tag `<script>` est echappe ou neutralise. Aucune alerte JS ne s'affiche. La protection XSS fonctionne correctement.
**Etats testes** : security
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-35_xss-test.png`

**Verification etendue** : Tester aussi d'autres vecteurs XSS :
```
<img src=x onerror="alert(1)">
<svg onload="alert(1)">
javascript:alert(1)
```

**CRITIQUE** : Si une alerte JS apparait, c'est une faille XSS. Stopper et remonter immediatement.

---

### Etape 36 : Verifier 0 erreurs console JS

**Priorite** : P1

**Actions Chrome MCP** :
1. Ouvrir DevTools > Console
2. Naviguer successivement : /chat -> /tasks -> /crm -> /board -> /skills -> /chat
3. A chaque navigation, verifier la console pour des erreurs (messages rouges)
4. `evaluate_script` -> `window.__consoleErrors` ou relever les erreurs manuellement

**Resultat attendu** : Apres navigation complete sur tous les modules, la console Chrome ne contient AUCUNE erreur JS rouge. Les warnings (jaunes) sont tolerables mais a documenter. Les erreurs de reseau (favicon, polices) sont tolerables.
**Etats testes** : quality
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-36_console-errors.png`

**Note** : Les erreurs de CORS, les 404 sur des assets statiques, et les deprecation warnings ne sont PAS bloquants. Seules les erreurs JS applicatives sont critiques.

---

### Etape 37 : Verifier /legal (mentions legales)

**Priorite** : P2

**Actions Chrome MCP** :
1. `navigate` -> `http://localhost:8880/legal`
2. `wait_for` -> page chargee avec du contenu textuel

**Resultat attendu** : La page des mentions legales s'affiche. Elle contient au minimum : l'editeur, l'hebergeur, les conditions d'utilisation de l'IA, la politique de donnees. La page est accessible avec authentification manager.
**Etats testes** : filled
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-37_mentions-legales.png`

**Note** : Si /legal n'existe pas encore, verifier /about, /terms, ou un lien en bas de page (footer).

---

### Etape 38 : Deconnexion finale

**Priorite** : P0

**Actions Chrome MCP** :
1. `click` -> bouton deconnexion | fallback : `button:has-text("Deconnexion")`, `button:has-text("Se deconnecter")`
2. `wait_for` -> redirection vers /login
3. Verifier que la page /login s'affiche proprement
4. Tenter `navigate` -> `http://localhost:8880/chat` -> doit rediriger vers /login (protection route)

**Resultat attendu** : Le manager est deconnecte. Le JWT est supprime. Toute tentative d'acces a une page protegee redirige vers /login. La session est proprement terminee.
**Etats testes** : filled | rbac
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-38_deconnexion-finale.png`

---

## Tests supplementaires RBAC manager

Ces tests verifient la separation de privileges entre manager et admin. A executer apres les 38 etapes principales.

---

### Etape RBAC-1 : Manager ne peut pas creer de comptes utilisateurs

**Priorite** : P0

**Actions** :
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  http://localhost:8880/api/admin/users \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"email":"pirate@test.fr","password":"pirate","name":"Pirate","role":"agent"}'
# Doit retourner 403
```

**Resultat attendu** : L'API retourne 403. Aucun compte n'est cree. Le manager ne peut pas s'auto-promouvoir admin ni creer des comptes.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-RBAC1_create-user-403.png`

**CRITIQUE** : Un retour 200 ou 201 est une faille d'escalade de privileges.

---

### Etape RBAC-2 : Manager ne peut pas modifier les roles

**Priorite** : P0

**Actions** :
```bash
# Tenter de changer le role d'un utilisateur via l'API admin
curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  http://localhost:8880/api/admin/users/1 \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
# Doit retourner 403
```

**Resultat attendu** : L'API retourne 403. Le manager ne peut pas promouvoir un agent en admin ni modifier les roles des utilisateurs.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-RBAC2_change-role-403.png`

---

### Etape RBAC-3 : Manager ne peut pas acceder aux logs d'audit

**Priorite** : P0

**Actions** :
```bash
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:8880/api/admin/audit-log \
  -H "Authorization: Bearer $MANAGER_TOKEN"
# Doit retourner 403
```

**Resultat attendu** : L'API retourne 403. Les logs d'audit sont reserves a l'admin.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-RBAC3_audit-403.png`

---

### Etape RBAC-4 : Manager ne peut pas s'auto-promouvoir admin

**Priorite** : P0

**Actions** :
```bash
# Tenter de modifier son propre role via l'API profil
curl -s -o /dev/null -w "%{http_code}" -X PATCH \
  http://localhost:8880/api/users/me \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"admin"}'
# Doit retourner 403 ou ignorer le champ "role"
```

**Resultat attendu** : L'API retourne 403 ou accepte la requete mais ignore le champ `role` (le manager reste manager). En aucun cas le role ne doit changer vers admin.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-RBAC4_self-promote-403.png`

**Verification** :
```bash
curl -s http://localhost:8880/api/users/me \
  -H "Authorization: Bearer $MANAGER_TOKEN" | jq .role
# Doit toujours retourner "manager"
```

**CRITIQUE** : Si le role change vers "admin", c'est une faille d'escalade de privileges critique.

---

## Tests supplementaires visibilite manager

Ces tests verifient que le manager a bien une visibilite elargie par rapport a un agent simple.

---

### Etape VIS-1 : Visibilite taches equipe (si implementee)

**Priorite** : P1

**Actions** :
1. Creer une tache avec le compte agent (`agent@therese.local`) : `Preparer dossier urbanisme`
2. Se reconnecter avec le compte manager (`manager@therese.local`)
3. Naviguer vers /tasks
4. Verifier si la tache de l'agent est visible (si le manager a la visibilite equipe)

**Resultat attendu** : Deux scenarios possibles :
- **Scenario A** (visibilite equipe implementee) : le manager voit ses taches + celles des agents de son service
- **Scenario B** (pas encore implemente) : le manager ne voit que ses propres taches (comme un agent)

Dans les deux cas, documenter le comportement observe.
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-VIS1_taches-equipe.png`

---

### Etape VIS-2 : Visibilite contacts partages (si implementee)

**Priorite** : P1

**Actions** :
1. Creer un contact avec le compte agent : `Test Contact Agent`
2. Se reconnecter avec le compte manager
3. Naviguer vers /crm
4. Verifier si le contact de l'agent est visible

**Resultat attendu** : Meme logique que VIS-1. Documenter le comportement observe (visibilite elargie ou isolee).
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-VIS2_contacts-partages.png`

---

## Tests supplementaires persistance

---

### Etape PER-1 : Conversations persistantes apres refresh

**Priorite** : P0

**Actions** :
1. (Connecte en tant que manager)
2. Naviguer vers /chat
3. Verifier qu'une conversation existe
4. Rafraichir la page (F5)
5. Verifier que les conversations sont toujours presentes
6. Cliquer sur une conversation -> verifier que les messages sont charges

**Resultat attendu** : Apres rafraichissement, les conversations persistent. Les messages sont charges depuis le serveur (pas seulement le state frontend).
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-PER1_conversations-refresh.png`

---

### Etape PER-2 : Taches persistantes apres refresh

**Priorite** : P0

**Actions** :
1. Naviguer vers /tasks
2. Verifier que la tache "Planifier reunion equipe" est presente
3. Rafraichir la page (F5)
4. Verifier que la tache est toujours la (titre, description, priorite, assignee)

**Resultat attendu** : Les taches persistent apres rafraichissement. Tous les champs sont intacts (pas de perte de donnees sur la description, la priorite ou l'assignation).
**Si FAIL** : Screenshot `/tmp/therese-server-tests/S2-PER2_taches-refresh.png`

---

## Recapitulatif par priorite

| Priorite | Etapes | Total | Description |
|----------|--------|-------|-------------|
| P0 | 1, 2, 3, 4, 5, 6, 7, 10, 11, 16, 17, 18, 21, 22, 23, 25, 29, 30, 31, 33, 34, 35, 38, RBAC-1, RBAC-2, RBAC-3, RBAC-4, PER-1, PER-2 | 29 | Bloquants - doivent passer avant toute release |
| P1 | 8, 9, 12, 13, 14, 15, 19, 20, 24, 26, 27, 28, 36, VIS-1, VIS-2 | 15 | Importants - doivent passer avant la demo client |
| P2 | 32, 37 | 2 | Souhaitables - a corriger quand possible |

## Recapitulatif par module

| Module | Etapes | Couverture |
|--------|--------|------------|
| Auth / Login | 1-3, 33-34, 38 | Formulaire, JWT, charte, reconnexion, redirect |
| Charte IA | 3 | Modale, acceptation, non-reaffichage |
| Chat | 5-9, 29, 35 | Conversations, streaming, multi-paragraphes, XSS, preservation |
| Taches | 10-15 | CRUD, assignation, priorite, filtrage, visibilite manager |
| Contacts CRM | 16-20 | CRUD, notes, recherche, visibilite service |
| Board | 21-24 | Question strategique, deliberation, 5 conseillers |
| Skills | 25-28 | Categories, execution Word, resultat |
| RBAC | 4, 30-31, RBAC-1 a RBAC-4 | NavBar, redirect, API 403, escalade privileges |
| Securite | 35 | XSS, injection |
| Qualite | 36 | Console JS zero erreurs |
| Persistance | 34, PER-1, PER-2 | Reconnexion, refresh, donnees intactes |
| Visibilite manager | 11, 17, VIS-1, VIS-2 | Taches equipe, contacts partages |
| UX | 32, 37 | Recherche globale, mentions legales |

## Criteres de reussite globaux

- **100% des P0 passent** : obligatoire pour toute release
- **90% des P1 passent** : obligatoire avant demo client
- **Zero faille RBAC** : aucun acces admin, aucune escalade de privileges, aucun endpoint admin accessible
- **Streaming fonctionnel** : chat et board repondent sans erreur 500
- **Charte bloquante** : impossible d'utiliser l'app sans acceptation
- **Persistance** : les donnees survivent a la deconnexion et au rafraichissement
- **XSS protege** : aucun script ne s'execute dans le chat

## Notes d'execution

1. **Ordre** : Executer les etapes dans l'ordre (1 a 38 puis RBAC puis VIS puis PER). Les etapes sont sequentielles (chaque etape depend des precedentes).
2. **Reinitialisation** : Entre deux passages complets, reinitialiser le compte manager (supprimer taches, contacts, conversations) ou utiliser un nouveau compte.
3. **Screenshots** : Capturer systematiquement en cas de FAIL. Le nom du fichier inclut le numero d'etape et un slug descriptif.
4. **Timeout** : Les etapes de streaming (7, 8, 22-23, 27) necessitent des timeouts plus longs (60-90s).
5. **DevTools** : Garder la console Chrome ouverte pendant toute l'execution. Toute erreur JS rouge est a documenter.
6. **Reseau** : Surveiller l'onglet Network pour les erreurs 4xx/5xx inattendues.
7. **Comparaison agent** : Pour les tests de visibilite (VIS-1, VIS-2), il est recommande d'avoir le resultat du protocole S1 (Agent Municipal) comme reference pour comparer les visibilites.
8. **Compte agent pre-existant** : Les etapes d'assignation (13) et de visibilite (VIS-1, VIS-2) necessitent qu'un compte agent existe dans l'organisation. Verifier en preparation.
