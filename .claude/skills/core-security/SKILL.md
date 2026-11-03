---
name: "core-security"
description: Invariants de sécurité pour toutes les applications multi-tenant (SaaS, plateformes métier) quelles que soient la stack et l'authentification (session + CSRF, JWT, OAuth). Charge ce skill avant d'écrire ou de relire du code qui touche l'autorisation, l'isolation entre tenants, une route publique, un webhook entrant, un paiement, le stockage d'un jeton ou d'un secret, des données personnelles, un upload, du contenu riche, un consommateur de file de messages ou du SQL. Complète core-ddd et core-hexagonal côté robustesse.
---

# Sécurité — invariants

Règle d'or : **ne jamais faire confiance à une entrée client.** La « Fiche projet » de `CLAUDE.md` indique la clé de tenant, le modèle d'authentification et la sensibilité des données (mineurs, santé, paiements) ; adapte la sévérité en conséquence.

## Isolation multi-tenant (risque n°1)

- Toute ressource appartient à un tenant. Avant toute lecture ou écriture, vérifie que la ressource ciblée appartient **au tenant du requérant**, pas seulement qu'elle existe.
- **IDOR** : un identifiant reçu dans l'URL ou le corps ne prouve rien. Charge la ressource **filtrée par tenant** (repository ou `WHERE tenant_id = :tenantId`).
- Les queries filtrent par tenant dès la CTE d'entrée.
- Contexte « système » (webhooks, jobs, pages publiques) : explicite, minimal, et le tenant est fixé à partir d'une donnée de confiance (compte marchand, hôte résolu), jamais d'un paramètre client.

## Autorisation

- Identité et tenant **résolus côté serveur** (session ou jeton vérifié), jamais un `userId` ou `tenantId` venant du client.
- Contrôle de droit dans le handler (ou un service d'autorisation dédié) avant toute action sensible. Un garde côté front (route protégée, bouton masqué) est du confort UX, pas une protection.
- **401** = non authentifié (le front déconnecte) ; **403** = droit insuffisant (le front masque). Pour une ressource d'un autre tenant, réponds comme si elle n'existait pas (404) sauf convention contraire du projet.

## Authentification et transport

- **Session cookie** : `HttpOnly`, `Secure`, `SameSite` cohérent ; CSRF actif sur toutes les écritures.
- **Jetons** (JWT, OAuth) : jamais dans `localStorage` ni `sessionStorage`. Cookie `HttpOnly`, ou mémoire de l'application pour un jeton d'accès court. Durée courte, refresh avec rotation, révocation possible.
- OAuth : Authorization Code + PKCE ; scopes minimaux ; écran de consentement pour les clients tiers (agents IA, intégrations).
- **CORS** en liste blanche d'origines ; jamais `*` avec des cookies.

## Endpoints publics et webhooks

- Endpoint public listé précisément dans la configuration de sécurité, jamais un motif large ; rate-limité ; captcha sur les formulaires anonymes (opt-in, inscription).
- **Webhook entrant** : signature vérifiée sur le **corps brut** avec comparaison en temps constant ; déduplication par identifiant d'événement (contrainte d'unicité) ; réponse rapide puis traitement asynchrone ; rejet si la signature est absente. Le webhook ne fait jamais confiance au montant ou au statut sans les rapprocher de la transaction connue.
- Réponses identiques que le compte existe ou non (mot de passe oublié, lien magique) : pas d'énumération.

## Paiements et argent

- Statut payé uniquement sur confirmation serveur (webhook ou interrogation du fournisseur), jamais sur une redirection navigateur.
- Montants en entiers dans l'unité mineure, devise explicite, prix relu côté serveur (jamais celui envoyé par le client).
- Idempotence des créations de commande et des initiations de paiement (clé d'idempotence).
- Un paiement confirmé tardivement ou en double n'est jamais ignoré : il est tracé et traité (revue, remboursement).

## Données personnelles

- Projection minimale dans les réponses : jamais de hash, jeton, secret, ni donnée d'un autre tenant.
- Erreurs : message générique au client, détail technique dans les logs. Pas de stack trace en réponse.
- Pas de donnée personnelle ni de jeton dans une URL ou un log (masquage des numéros de téléphone et emails dans les logs).
- Durée de conservation définie pour les données techniques (IP, user agent).
- Mots de passe hachés (Argon2 ou bcrypt), jamais loggés. Jetons à usage unique (vérification, réinitialisation, lien magique) : hachés en base, expirables, usage unique.

## Secrets et configuration

- Aucun secret dans le dépôt ni dans un fichier `*.example`. Variables d'environnement ou gestionnaire de secrets.
- Secrets de tiers stockés en base (clés d'API d'un client) : chiffrés (AES-GCM), clé maîtresse hors base, jamais réaffichés.
- Front : toute variable `VITE_*` est **publique** (figée dans le bundle) → jamais de secret.

## Injection et entrées

- SQL paramétré uniquement (voir `core-sql-query`).
- Valider chaque requête entrante (DTO validés + value objects auto-validés) ; côté front, schémas Zod.
- Contenu riche : format structuré (JSON) plutôt que HTML ; sinon assainissement serveur. Jamais de `dangerouslySetInnerHTML` sans assainissement.
- Upload : type, taille et quota vérifiés **côté serveur** ; nom de stockage généré, jamais le nom fourni ; fichiers privés servis par URL signée courte.
- URL externes fournies par l'utilisateur : `https` uniquement, pas de requête serveur vers une URL fournie sans liste blanche (SSRF).

## Messagerie et concurrence

- Livraison au moins une fois → consommateurs et subscribers d'événements d'intégration **idempotents**.
- Opérations concurrentes sensibles (paiement, inscription, stock, affectation) : contrainte d'unicité en base et/ou verrou optimiste, pas seulement un contrôle applicatif.

## Checklist avant de valider

- [ ] Ressource chargée filtrée par le tenant du requérant (pas d'IDOR) ?
- [ ] Identité et tenant résolus côté serveur ; contrôle de droit présent ?
- [ ] Jetons hors `localStorage` ; CSRF actif si session cookie ; CORS en liste blanche ?
- [ ] Endpoint public justifié, listé précisément, rate-limité ?
- [ ] Webhook : signature sur corps brut, déduplication, idempotence ?
- [ ] Aucune donnée sensible exposée dans la réponse, l'erreur ou les logs ?
- [ ] SQL paramétré ; consommateurs idempotents ; contraintes d'unicité ?
