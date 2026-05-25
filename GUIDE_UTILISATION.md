# Guide d'utilisation - Application de gestion scolaire

Ce document explique comment utiliser l'application au quotidien selon chaque profil : administrateur, direction, personnel, enseignant, educateur, parent, eleve et visiteur public.

Il complete les guides specialises deja presents dans le projet :

- `GUIDE_CONNEXION.md` pour la connexion et les comptes.
- `GUIDE_PAIEMENT.md` pour les paiements.
- `GUIDE_ATTRIBUER_FRAIS.md` pour l'attribution des frais.
- `INSTALLATION.md` pour l'installation technique.

## 1. Acceder a l'application

### En developpement local

1. Demarrer le backend :

```powershell
cd server
npm run dev
```

2. Demarrer le frontend :

```powershell
cd web
npm run dev
```

3. Ouvrir l'application dans le navigateur :

```text
http://localhost:3000
```

L'API backend est generalement disponible sur :

```text
http://localhost:5000
```

### En production

Utiliser l'adresse publique configuree pour l'etablissement. Les utilisateurs accedent ensuite a leur espace depuis le bouton `Connexion` ou `Espace securise`.

## 2. Page d'accueil publique

La page d'accueil sert de vitrine pour l'etablissement.

Elle permet de :

- presenter le college, son projet educatif et ses valeurs ;
- consulter les actualites et informations pratiques ;
- acceder au formulaire de pre-inscription ;
- contacter l'etablissement ;
- acceder aux espaces securises.

Les informations affichees peuvent etre adaptees depuis les parametres d'administration :

- nom de l'etablissement ;
- slogan ou accroche ;
- logo ;
- images de la page d'accueil ;
- annee scolaire active ;
- contacts et informations publiques.

## 3. Connexion et redirection par role

Chaque utilisateur doit se connecter avec son email et son mot de passe.

Apres connexion, l'application redirige automatiquement vers l'espace correspondant au role :

| Role | Espace |
| --- | --- |
| Administrateur | `/admin` |
| Direction | `/directeur` |
| Personnel / metiers | `/staff` |
| Enseignant | `/teacher` |
| Educateur | `/educator` |
| Eleve | `/student` |
| Parent | `/parent` |
| Super administrateur | `/super-admin` |

En cas d'erreur de connexion :

- verifier l'email ;
- verifier le mot de passe ;
- verifier que le compte est actif ;
- verifier que le backend fonctionne ;
- demander une reinitialisation du mot de passe si necessaire.

## 4. Espace administrateur

L'administrateur pilote l'ensemble de l'etablissement.

### Actions principales

Depuis l'espace administrateur, il est possible de gerer :

- les eleves ;
- les parents ;
- les enseignants ;
- le personnel administratif ;
- les classes et niveaux ;
- les matieres et emplois du temps ;
- les notes, absences et bulletins ;
- les admissions et pre-inscriptions ;
- les frais de scolarite ;
- les paiements et recus ;
- les parametres de branding ;
- l'annee scolaire active ;
- les roles, modules et autorisations ;
- les exports et rapports.

### Bonnes pratiques

- Creer les classes et niveaux avant d'inscrire les eleves.
- Configurer l'annee scolaire active avant les operations de scolarite.
- Verifier les informations d'un eleve avant de lier un parent.
- Utiliser les modules de paiement avec prudence : un paiement valide modifie les soldes.
- Eviter de supprimer une donnee deja utilisee dans des bulletins, paiements ou historiques.

## 5. Parametres de l'etablissement

Les parametres permettent de personnaliser l'application pour l'ecole active.

### Branding et identite

L'administrateur peut configurer :

- le nom public de l'etablissement ;
- le titre court affiche dans la navigation ;
- le slogan ;
- le logo de navigation ;
- le logo de connexion ;
- le favicon ;
- les images de la page d'accueil ;
- les contacts publics.

Les changements se repercutent sur les pages publiques et les espaces de l'application.

### Annee scolaire active

L'administrateur peut definir l'annee scolaire active au format :

```text
2026-2027
```

Cette valeur est utilisee par les modules qui doivent travailler sur l'annee courante.

## 6. Gestion des admissions

### Parcours public

Un parent ou visiteur peut soumettre une pre-inscription depuis la page publique.

Le formulaire permet de renseigner :

- l'identite de l'enfant ;
- le niveau souhaite ;
- les informations du parent ;
- les contacts ;
- les documents ou informations scolaires demandes.

Apres soumission, une reference de suivi peut etre utilisee pour retrouver le dossier.

### Parcours administrateur

L'administrateur peut :

- consulter les demandes ;
- verifier les informations ;
- proposer une classe ;
- accepter ou refuser une demande ;
- convertir une admission acceptee en eleve inscrit.

Dans un contexte multi-etablissement, les admissions sont rattachees a l'etablissement actif.

## 7. Gestion des eleves

L'administrateur, les agents autorises ou les educateurs peuvent gerer les informations liees aux eleves selon leurs droits.

### Informations principales

Une fiche eleve peut contenir :

- identite ;
- classe ;
- niveau ;
- matricule ;
- contacts ;
- informations parentales ;
- donnees scolaires ;
- situation financiere ;
- documents.

### Utilisation quotidienne

- Rechercher un eleve par nom, matricule, classe ou statut.
- Consulter son historique scolaire.
- Verifier les absences, notes et paiements.
- Mettre a jour les informations si elles changent.

## 8. Gestion des enseignants

L'espace enseignant permet de suivre l'activite pedagogique.

Selon les autorisations, un enseignant peut :

- consulter ses classes ;
- consulter ses matieres ;
- saisir ou consulter des notes ;
- gerer des devoirs ;
- suivre les absences ;
- consulter son emploi du temps ;
- communiquer autour des activites pedagogiques.

L'enseignant ne doit acceder qu'aux classes, cours ou eleves qui lui sont rattaches.

## 9. Espace educateur

L'educateur intervient surtout sur le suivi quotidien des eleves.

Il peut notamment :

- consulter les listes d'eleves ;
- suivre la discipline ;
- suivre les absences ;
- consulter certaines informations de classe ;
- accompagner la vie scolaire.

Les droits exacts dependent de la configuration faite par l'administration.

## 10. Espace personnel / staff

Le personnel administratif dispose d'un espace module selon son metier.

Exemples de metiers ou modules :

- econome ;
- secretariat ;
- admissions ;
- gestion des eleves ;
- tresorerie ;
- bibliotheque ;
- ressources humaines ;
- sante ;
- rapports.

Chaque membre du personnel ne voit que les modules autorises pour son metier.

### Cas de l'econome

L'econome peut traiter les operations financieres selon ses droits :

- consulter les paiements en attente ;
- valider les paiements en especes apres depot ;
- rejeter une declaration incorrecte ;
- suivre certaines donnees de tresorerie.

## 11. Frais de scolarite

Les frais de scolarite sont geres par l'administration.

### Creation ou attribution

Avant d'attribuer les frais, verifier :

- l'annee scolaire ;
- le niveau ou la classe ;
- la periode ;
- le montant brut ;
- les remises eventuelles ;
- le montant net a payer ;
- la date d'echeance.

### Suivi

Pour chaque eleve, l'application peut afficher :

- montant total attendu ;
- montant deja paye ;
- montant restant ;
- statut du paiement ;
- historique des versements ;
- recus disponibles.

## 12. Paiements

Les paiements peuvent etre inities depuis les espaces parent ou eleve, ou saisis au guichet selon les droits.

### Statuts principaux

| Statut | Signification |
| --- | --- |
| `PENDING` | Paiement initie, en attente de validation |
| `COMPLETED` | Paiement valide |
| `FAILED` | Paiement echoue ou refuse |
| `CANCELLED` | Paiement annule |

### Paiement en especes

1. Le parent ou l'eleve declare le paiement.
2. Le montant reste en attente.
3. L'econome ou l'administration valide apres reception physique du montant.
4. Le solde de scolarite est mis a jour.

### Paiement en ligne

Les paiements en ligne ne doivent pas etre confirmes directement par le parent ou l'eleve.

Le paiement doit rester en attente jusqu'a validation securisee :

- soit par l'administration ;
- soit par un webhook signe d'un prestataire de paiement, si l'integration est active.

Cette regle evite qu'un utilisateur confirme lui-meme un paiement sans preuve de transaction.

## 13. Espace parent

Le parent utilise son espace pour suivre ses enfants.

Il peut :

- consulter les informations de ses enfants ;
- consulter les frais de scolarite ;
- initier un paiement ;
- suivre l'historique des paiements ;
- consulter les notes et bulletins disponibles ;
- consulter les absences ;
- suivre certaines communications de l'etablissement ;
- prendre rendez-vous si le module est actif.

Bonnes pratiques :

- verifier l'enfant selectionne avant toute action ;
- conserver les references de paiement ;
- contacter l'administration en cas d'erreur sur un solde ou une classe.

## 14. Espace eleve

L'eleve peut utiliser son espace pour suivre sa scolarite.

Il peut :

- consulter son tableau de bord ;
- voir ses notes ;
- consulter ses absences ;
- consulter ses devoirs ;
- suivre ses frais de scolarite ;
- initier une declaration de paiement selon les options activees ;
- telecharger certains documents ou recus disponibles.

## 15. Rapports, exports et documents

Selon les modules actifs, l'application peut generer ou exporter :

- listes d'eleves ;
- donnees administratives ;
- bulletins ;
- recus de paiement ;
- rapports financiers ;
- documents de suivi ;
- cartes ou fiches eleves.

Avant export, verifier :

- la classe ;
- l'annee scolaire ;
- la periode ;
- le filtre applique ;
- le role de l'utilisateur qui exporte.

## 16. Notifications et communication

L'application peut afficher des notifications importantes pour :

- paiements en attente ;
- actions administratives ;
- admissions ;
- evenements scolaires ;
- communications avec les familles.

Les utilisateurs doivent consulter regulierement leur tableau de bord pour ne pas manquer les informations importantes.

## 17. Bonnes pratiques de securite

### Pour tous les utilisateurs

- Ne jamais partager son mot de passe.
- Se deconnecter apres utilisation sur un ordinateur public.
- Verifier l'adresse du site avant de saisir ses identifiants.
- Signaler tout acces suspect a l'administration.

### Pour l'administration

- Creer des comptes nominatifs, pas de comptes partages.
- Attribuer uniquement les modules necessaires.
- Desactiver les comptes des personnes qui quittent l'etablissement.
- Verifier regulierement les roles et autorisations.
- Sauvegarder les donnees importantes.

## 18. Depannage courant

### La page ne charge pas

- Verifier la connexion internet.
- Actualiser la page.
- Verifier que le frontend est demarre.
- Verifier que le backend est demarre.

### Connexion impossible

- Verifier l'email et le mot de passe.
- Verifier que le compte est actif.
- Demander une reinitialisation du mot de passe.
- Consulter les logs du backend si le probleme persiste.

### Donnees absentes ou incoherentes

- Verifier l'annee scolaire active.
- Verifier l'etablissement actif.
- Verifier les filtres appliques.
- Actualiser les donnees.
- Controler les droits de l'utilisateur.

### Paiement toujours en attente

- Pour un paiement en especes : attendre la validation de l'econome.
- Pour un virement : attendre la verification administrative.
- Pour un paiement en ligne : verifier l'integration prestataire ou le webhook.
- Contacter l'administration si le paiement a deja ete effectue.

### Une image ou un logo ne s'affiche pas

- Verifier le fichier envoye dans les parametres.
- Verifier que le backend expose correctement le dossier `uploads`.
- Verifier `NEXT_PUBLIC_UPLOADS_ORIGIN` si le frontend et le backend sont sur des domaines differents.

## 19. Checklist de demarrage pour un nouvel etablissement

1. Verifier la connexion a la base de donnees.
2. Creer ou verifier le compte administrateur.
3. Configurer le nom de l'etablissement.
4. Ajouter les logos et images publiques.
5. Definir l'annee scolaire active.
6. Creer les niveaux et classes.
7. Ajouter les enseignants.
8. Ajouter les eleves et parents.
9. Configurer les frais de scolarite.
10. Attribuer les modules au personnel.
11. Tester une connexion par role.
12. Tester une pre-inscription publique.
13. Tester un paiement en attente et sa validation.
14. Verifier les exports ou documents importants.

## 20. Support

En cas de probleme :

- noter le role concerne ;
- noter l'action effectuee ;
- copier le message d'erreur exact ;
- preciser l'eleve, la classe ou le paiement concerne si necessaire ;
- contacter l'administrateur ou l'equipe technique.

Pour les problemes techniques, fournir aussi :

- l'URL de la page ;
- l'heure approximative de l'erreur ;
- une capture d'ecran ;
- les logs backend si disponibles.

