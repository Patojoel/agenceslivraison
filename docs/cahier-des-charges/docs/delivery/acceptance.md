# Contrôle qualité et scénarios transverses

## Scénarios BDD minimum

```gherkin
Fonctionnalité: Isolation entre agences
  Scénario: Une agence ne peut pas consulter une commande d'une autre agence
    Étant donné une commande appartenant à l'agence B
    Et un utilisateur authentifié membre uniquement de l'agence A
    Quand il consulte la commande de B
    Alors la réponse est 404
    Et aucune donnée de B n'est retournée

Fonctionnalité: Réservation de stock
  Scénario: Deux commandes réservent simultanément la dernière unité
    Étant donné un stock disponible de 1 unité
    Quand deux réservations concurrentes de 1 unité sont demandées
    Alors une seule réservation est confirmée
    Et le stock disponible ne devient jamais négatif

Fonctionnalité: Demande marketplace
  Scénario: Une demande ne devient pas automatiquement une commande
    Étant donné une demande soumise à une agence
    Quand l'agence n'a pas encore accepté
    Alors aucune commande confirmée n'existe

Fonctionnalité: Livraison
  Scénario: Une tentative échouée ne clôture pas la commande
    Étant donné une mission en cours
    Quand le livreur signale une tentative échouée
    Alors la mission conserve l'incident
    Et la commande n'est pas automatiquement annulée
```

## Matrice d'acceptation par module
- Domaine : invariants, transitions et erreurs intentionnelles.
- Application : ports fakes, contrôle d'accès, idempotence.
- Persistance : vrai PostgreSQL, migration, transactions, unicité, concurrence.
- HTTP : validation, auth, 403/404, pagination, contrat OpenAPI.
- Exploitation : build Docker, healthcheck, logs, migrations, backup.
- Sécurité : IDOR, élévation rôle, upload, données sensibles.
- Observabilité : correlationId, audit, erreurs sans secrets.

## Performance indicative, à mesurer
Hypothèse de charge initiale : 50 agences / 5 000 commandes mensuelles ; tester les pics réalistes et la contention de réservation, sans confondre volume mensuel et requêtes par seconde. Le budget technique de 60 000 FCFA ne prouve aucune capacité.
