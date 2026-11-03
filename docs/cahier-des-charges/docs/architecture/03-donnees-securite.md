# Données, sécurité et isolation

## Identités
`users`, `agencies`, `agency_memberships`, `merchant_profiles`, `courier_profiles`, `agency_locations`, `agency_capabilities`. Une personne peut être commerçant et membre d'agence ; rôles contextuels, pas enum globale unique.

## Modèle relationnel conceptuel
- agency → locations, services, price_rules, memberships, customers, couriers, orders, warehouses.
- order → parcels, status_events, delivery_tasks ; demande marketplace liée par `request_id` facultatif.
- warehouse → bins ; merchant → stock ownership ; inventory_item/stock_lot → movements/reservations.
- transfer → source agency, destination agency, handover proof, acceptance proof.
- immutable audit log → actor, tenant, action, resource, time, safe metadata.

## Sécurité obligatoire
- Tous les accès privés filtrés par tenant *et* autorisation de ressource ; 404 sur ID externe.
- Cross-agency : accès seulement via objet de transfert ou relation contractuelle explicite ; jamais désactiver le filtre global.
- Auth : hash Argon2id, rate limit, session refresh rotation et révocation, audit des connexions sensibles.
- JWT access court, refresh token haché et rotation ; sur mobile stockage sécurisé natif, jamais stockage non chiffré.
- Invitations à durée limitée ; pas d'auto-attribution de rôle admin.
- Upload : MIME réel, taille, extension, chemin, contrôle d'accès, antivirus si nécessaire ; URL signées à durée limitée.
- Concurrence : version optimiste, transactions et contraintes SQL ; `unique(agency_id, external_reference)` si pertinent.
- Logs : aucune donnée de carte, token, document personnel en clair ; rétention et export/suppression à définir.
- RLS PostgreSQL en défense supplémentaire **uniquement** avec gestion sûre du contexte transactionnel et tests anti-fuite ; le filtrage applicatif reste requis.

## Indices d'index à vérifier par EXPLAIN
`orders(agency_id, created_at, id)`, `orders(agency_id,status,created_at)`, `stock(agency_id,warehouse_id,sku)`, `tasks(agency_id,courier_id,status)`, `tracking_events(agency_id,parcel_id,occurred_at)` ; index réels ajustés après mesures, pas ajout automatique aveugle.
