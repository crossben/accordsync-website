// French copy (website.md section 3). Written to read naturally, not as a translation:
// the jokes are adapted ("trouver un accord", "d'accord"), the technical terms
// stay in English (conflict(), lww, HLC, op log). The owner reviews this file
// before launch (website.md section 11). Same sections and limits as content/en.ts.
import type { Content } from "@/content/types";

export const fr: Content = {
  lang: "fr",
  otherLang: { label: "English", href: "/" },

  meta: {
    title: "Accord — la synchronisation offline-first qui reste correcte quand le réseau ment",
    description:
      "Accord est un moteur de synchronisation offline-first open source et auto-hébergé : écriture locale d'abord, opérations plutôt qu'écrasements, règles de fusion déclarées, et des conflits que votre appli tranche. TypeScript et PostgreSQL.",
  },

  header: {
    skipToContent: "Aller au contenu",
    homeAria: "Accord — retour en haut",
    nav: {
      problem: "Le problème",
      how: "Fonctionnement",
      merges: "Règles de fusion",
      guarantees: "Garanties",
      code: "Votre code",
      playground: "Essayer",
      proof: "Preuves",
      run: "Lancer",
      openSource: "Open source",
    },
    themeToggle: { toDark: "Passer en thème sombre", toLight: "Passer en thème clair" },
  },

  hero: {
    kicker: "Chaque appareil, d'accord.",
    headline: "La synchronisation offline-first qui reste correcte quand le réseau ment.",
    subline:
      "Accord est un moteur de sync open source et auto-hébergé pour les applis de terrain : les données vivent en SQLite ou IndexedDB, la vérité en PostgreSQL côté serveur, et les répliques fusionnent selon des règles déclarées — pas à la chance.",
    ctaHow: "Fonctionnement",
    ctaGithub: "GitHub",
    statusLine: "v{version}, publiée le {date}. Avant la 1.0 : l'API peut encore changer.",
    scene: {
      labels: {
        devices: ["Appareil A", "Appareil B", "Appareil C"],
        server: "Serveur",
        offline: "hors ligne",
      },
      description:
        "Illustration du design de la sync : trois appareils écrivent hors ligne pendant que les opérations s'accumulent, se reconnectent, échangent des opérations et terminent avec un état identique. Deux appareils modifient le même champ conflict() ; ensuite chaque appareil affiche les deux valeurs, marquées conflictuelles — jamais l'une qui écrase l'autre en silence. Une illustration, pas une vue en direct.",
      pause: "Mettre l'animation en pause",
      play: "Reprendre l'animation",
      caption: "Illustration. Pas une vue en direct.",
    },
  },

  problem: {
    heading: "Le réseau tombe. Le travail, non.",
    cards: [
      {
        title: "« Reconnectez-vous » n'est pas une réponse",
        body: "Les applis de terrain vivent là où le réseau tombe des minutes ou des jours : agents d'enrôlement, collecteurs de déchets, boutiquiers. Une appli bloquée sur une boîte de dialogue bloque le travail.",
      },
      {
        title: "Last write wins, c'est un pile ou face",
        body: "La solution habituelle — garder la dernière écriture, jeter le reste — perd en silence le travail d'un agent. Last write wins, ce n'est pas un accord : c'est un pile ou face.",
      },
      {
        title: "Certains champs méritent une réunion",
        body: "Deux agents modifient le même dossier hors ligne. Un moteur qui choisit un gagnant a choisi à votre place. Sur l'argent et le statut légal, les deux valeurs s'affichent, et l'appli tranche.",
      },
    ],
  },

  how: {
    heading: "Fonctionnement",
    intro: "Ces étapes suivent une écriture, d'un appareil vers tous les autres.",
    planned: { label: "À venir", title: "À venir — décrit comme conçu, pas encore construit" },
    steps: [
      {
        title: "Écrire en local, toujours",
        body: "Chaque action atterrit d'abord en SQLite ou IndexedDB local. Le réseau n'est jamais sur le chemin critique d'une action.",
      },
      {
        title: "Enregistrer des opérations, pas des écrasements",
        body: "Une écriture devient une opération dans un journal en ajout seul — op id, champ, valeur, horloge hybride. Rejouée deux fois, une opération ne change rien.",
      },
      {
        title: "Passer hors ligne",
        body: "Rien de spécial. L'appareil continue de fonctionner et collecte les opérations pendant la coupure.",
      },
      {
        title: "Se reconnecter et synchroniser dans les deux sens",
        body: "Les opérations partent par lots idempotents et arrivent par pages reprises — un appareil hors ligne trois jours reprend où il s'est arrêté.",
      },
      {
        title: "Fusionner selon des règles déclarées",
        body: "Chaque champ déclare sa stratégie. Le serveur applique les sync scopes et signale les refus au client — jamais jetés en silence.",
      },
      {
        title: "Converger",
        body: "Chaque réplique fusionne vers le même état, et un champ conflict() affiche les deux valeurs jusqu'à ce que l'appli tranche.",
      },
    ],
    timeline: {
      deviceA: "Appareil A",
      deviceB: "Appareil B",
      server: "Serveur",
      networkDown: "réseau coupé",
      opCounterA: "visites +3",
      opCounterB: "visites +2",
      opStatusA: "status = « approuvé »",
      opStatusB: "status = « rejeté »",
      hlcCounterA: "hlc …:0004:A",
      hlcCounterB: "hlc …:0003:B",
      hlcStatusA: "hlc …:0007:A",
      hlcStatusB: "hlc …:0006:B",
      counterRow: "visites — counter()",
      conflictRow: "status — conflict()",
      finalCounter: "3 + 2 = 5",
      finalConflictA: "approuvé",
      finalConflictB: "rejeté",
      keptBoth: "les deux valeurs gardées",
      converged: "d'accord — état identique sur chaque réplique",
    },
  },

  merges: {
    heading: "Règles de fusion",
    intro:
      "Chaque champ déclare sa stratégie dans le schéma, et la stratégie décide qui gagne. conflict() : certains désaccords méritent une réunion.",
    planned: {
      label: "À venir",
      title: "À venir — les stratégies sont conçues, pas encore construites",
    },
    note: "Chaque règle est fixée par des vecteurs de test de référence que toute implémentation doit passer. Les listes ordonnées (un CRDT de séquence) sont prévues après la v1 — la plupart des listes d'applis de terrain sont des ensembles.",
    table: {
      columns: { strategy: "Stratégie", useFor: "Pour quoi", rule: "Règle", example: "Exemple" },
      rows: {
        lww: {
          useFor: "Noms, notes, scalaires simples",
          rule: "L'horloge hybride la plus élevée gagne.",
          before: "client_name: « Awa »",
          after: "« Awa Ndiaye » — écrite plus tard",
        },
        counter: {
          useFor: "Quantités collectées, ajustements de stock",
          rule: "Somme des incréments — aucun perdu, quel que soit l'ordre.",
          before: "A : +3 · B : +2",
          after: "5, partout",
        },
        set: {
          useFor: "Étiquettes, agents assignés",
          rule: "Ensemble add-wins : un ajout bat un retrait.",
          before: "A : + zone-nord · B : − zone-sud",
          after: "les deux appliqués",
        },
        conflict: {
          useFor: "Champs critiques : statut, approbation, montant",
          rule: "Jamais résolu automatiquement : les deux valeurs gardées, l'enregistrement marqué, l'appli décide.",
          before: "A : « approuvé » · B : « rejeté »",
          after: "« approuvé » | « rejeté » — marqué",
        },
      },
    },
  },

  guarantees: {
    heading: "Ce qu'Accord garantit",
    intro:
      "Seules des garanties prouvées ont leur place ici : chacune renvoie au test du dépôt qui la prouve.",
    planned: { label: "À venir", title: "À venir — en attente d'un test qui passe dans le dépôt" },
    whyLabel: "Pourquoi :",
    testLink: "Le test",
    sourceLink: { label: "Décisions de conception (ADR)" },
    items: {
      convergence: {
        title: "Chaque réplique converge",
        body: "Après la sync, chaque réplique porte un état identique — vérifié par des milliers d'exécutions générées, messages perdus, retardés, dupliqués et réordonnés.",
        why: "Les jours hors ligne sont normaux ; la divergence, silencieuse.",
      },
      counters: {
        title: "Les compteurs ne perdent jamais d'incrément",
        body: "Un compteur égale la somme de tous les incréments acceptés par le serveur, quel que soit l'ordre d'arrivée.",
        why: "Les quantités collectées et les stocks doivent tomber juste.",
      },
      conflicts: {
        title: "conflict() n'est jamais résolu automatiquement",
        body: "Les champs marqués conflict() affichent toutes les valeurs concurrentes et restent marqués jusqu'à ce que l'appli tranche.",
        why: "Accord ne devine jamais sur l'argent ou le statut légal.",
      },
      idempotent: {
        title: "Rejouer une opération ne change rien",
        body: "Les opérations sont idempotentes : appliquer deux fois ne change rien, donc renvoyer un lot après une coupure est sans danger.",
        why: "Les réseaux mobiles coupent en plein lot, tout le temps.",
      },
      resumable: {
        title: "La sync reprend, des jours plus tard",
        body: "Un appareil hors ligne des jours synchronise par pages reprises : s'il meurt à la page 7, il reprend à la page 7.",
        why: "Les longues coupures sont la raison d'être de l'offline-first.",
      },
      scopes: {
        title: "Les périmètres sont appliqués côté serveur",
        body: "Le serveur filtre chaque pull et refuse chaque opération hors périmètre ; l'appareil annule le changement refusé et prévient l'appli.",
        why: "Un client qui diverge en silence est un bug de données qui attend.",
      },
    },
  },

  code: {
    heading: "Votre code",
    intro:
      "Trois moments d'une journée d'appli de terrain avec la vraie API du client : définir un schéma, écrire hors ligne, trancher les conflits qu'Accord refuse de deviner. Les extraits sont vérifiés par le compilateur contre les paquets du dépôt à chaque build.",
    previewLabel: "Aperçu de l'API : peut changer avant la v0.1",
    tabLabels: {
      schema: "Définir un schéma",
      offline: "Écrire hors ligne",
      conflict: "Trancher un conflit",
    },
    copy: "Copier",
    copied: "Copié",
    screenshot: {
      alt: "L'exemple d'appli de terrain d'Accord : un dossier où deux agents ont choisi des statuts différents hors ligne. Les visites affichent 3, et un encadré dit « Agents disagree. Accord kept every value. Which one is right? » avec un bouton par valeur.",
      caption:
        "L'exemple d'appli de terrain du dépôt, après que deux agents ont modifié le même dossier hors ligne : chaque visite compte, et le statut sur lequel ils divergent attend un humain.",
      link: "examples/field-app",
    },
  },

  quickstart: {
    heading: "Lancez-le vous-même",
    intro:
      "Une commande crée un projet qui fonctionne, à partir des paquets publiés : un schéma, une configuration serveur, PostgreSQL dans Docker Compose et un client.",
    steps: [
      {
        title: "Créer un projet",
        body: "Node 22.18 ou plus récent, et Docker.",
        commands: ["npm create accord my-app", "cd my-app", "npm install"],
      },
      {
        title: "Démarrer PostgreSQL et le serveur",
        body: "Le fichier Compose du projet lance PostgreSQL ; le serveur tourne depuis npm.",
        commands: ["docker compose up -d", "cp .env.example .env", "npm run server"],
      },
      {
        title: "Lancer un appareil",
        body: "Dans un autre terminal : le client d'exemple écrit quatre changements hors ligne, puis synchronise.",
        commands: ["npm run client"],
      },
    ],
    note: "Pour travailler sur Accord lui-même (pnpm, les suites de tests), voir le README du dépôt.",
    terminalLabel: "Terminal",
    terminalNote:
      "Commandes réelles ; la dernière ligne est ce qu'affiche le client d'exemple après la sync.",
  },

  playground: {
    heading: "Essayer",
    intro:
      "Deux agents de terrain, un dossier client, pas de réseau. Ces téléphones font tourner le vrai @accordsync/core dans votre navigateur : coupez le réseau, mettez les deux agents en désaccord, et regardez ce que fait Accord.",
    noscript:
      "La démo a besoin de JavaScript. L'exemple d'appli de terrain du dépôt montre la même chose avec un vrai serveur.",
    loading: "Chargement de la démo…",
    agents: ["Awa", "Moussa"],
    airplane: "Mode avion",
    app: {
      name: "Terrain",
      dossier: "Dossier client n° 91",
      client: "Aminata Fall",
      visits: "Visites",
      addVisit: "+ Visite",
      documents: "Documents",
      addDoc: "+ Pièce d'identité",
      status: "Décision",
      statuses: { draft: "Brouillon", approved: "Approuvé", rejected: "Rejeté" },
      approve: "Approuver",
      reject: "Rejeter",
      offline: "Pas de réseau : enregistré sur le téléphone",
      pending: "{n} en attente de sync",
      synced: "Synchronisé",
      conflictTitle: "Les agents ne sont pas d'accord",
      conflictBody: "Accord a gardé les deux décisions. Laquelle est la bonne ?",
      keep: "Garder « {value} »",
    },
    server: { title: "Serveur", stored: "{n} modifications" },
    steps: {
      title: "À essayer",
      items: [
        "Passez le téléphone de Moussa en mode avion",
        "Approuvez sur celui d'Awa, rejetez sur celui de Moussa, ajoutez une visite sur les deux",
        "Coupez le mode avion : les deux visites comptent, les deux décisions sont gardées",
        "Choisissez la bonne décision : tous les téléphones sont d'accord",
      ],
      allDone: "C'est ça, Accord : rien de perdu, rien de deviné.",
    },
    faults: {
      title: "Test de résistance",
      run: "Simuler un mauvais réseau",
      rerun: "Rejouer la graine {seed}",
      reset: "Recommencer",
      result:
        "Graine {seed} : {ops} modifications sur 3 téléphones, {dropped} messages perdus, {duplicated} dupliqués, {partitions} coupures réseau. Une fois le réseau revenu : {verdict}",
      identical: "tous les téléphones identiques.",
      diverged: "les téléphones diffèrent. Cela ne devrait jamais arriver : signalez la graine.",
    },
    announce: {
      online: "Le téléphone de {agent} est en ligne.",
      offline: "Le téléphone de {agent} est en mode avion.",
    },
  },

  proof: {
    heading: "Preuves",
    intro:
      "La correction est une suite de tests, pas une promesse. Ces suites tournent à chaque changement.",
    planned: { label: "À venir", title: "À venir — les suites de tests sont en construction" },
    items: {
      convergenceTest: {
        title: "Tests propriétés de convergence",
        body: "Des exécutions générées d'appareils qui passent hors ligne, écrivent et se reconnectent, avec des pannes aléatoires. Chaque réplique doit finir identique ; les échecs sont réduits à un exemple minimal.",
      },
      strategyLaws: {
        title: "Lois des stratégies",
        body: "Chaque stratégie est testée pour commutativité, associativité et idempotence : les implémentations ne peuvent jamais diverger, ports futurs compris.",
      },
      simulator: {
        title: "Simulateur à graine",
        body: "Un simulateur réseau déterministe — coupure, délai, duplication, réordonnancement, partition. Un échec en CI se rejoue avec la même graine.",
      },
    },
    testLink: "Les tests",
    ciLine:
      "Chaque passage de la CI génère {simulations} réseaux simulés et {propertyCases} cas par loi de stratégie ; un échec affiche la graine qui le rejoue.",
    load: {
      heading: "Sous charge",
      intro:
        "Des appareils k6 qui envoient des lots de 10 opérations et tirent des pages, sans pause, 60 secondes par mesure. Depuis la v0.2, les envois s'exécutent en parallèle et plusieurs processus serveur (workers) se partagent la charge : environ 3 000 opérations/s avec 4 workers, pulls à p95 ≤ 56 ms.",
      columns: {
        devices: "Appareils",
        workers: "Workers",
        ops: "Opérations/s acceptées",
        push: "Push p95",
        pull: "Pull p95",
      },
      hardwareLabel: "Mesuré sur :",
      caveat:
        "Aucune requête en échec. Une seule machine et une charge synthétique : mesurez sur votre propre installation avant de vous y fier.",
      link: "Méthode et résultats bruts",
    },
  },

  not: {
    heading: "Ce qu'Accord n'est pas",
    intro: "Sans détour, parce qu'une limite honnête fait partie du discours.",
    items: {
      database: {
        title: "Pas une base de données",
        body: "Accord synchronise les enregistrements définis par le schéma de votre appli. Ce n'est pas un moteur de requêtes et ne remplace ni PostgreSQL ni SQLite — il déplace les changements entre eux.",
      },
      collab: {
        title: "Pas de collaboration temps réel sur le texte",
        body: "Pas d'édition riche partagée dans la v1. Les champs sont des scalaires, des ensembles et des compteurs.",
      },
      business: {
        title: "Pas de magie pour les conflits métier",
        body: "Deux agents qui approuvent le même dossier différemment, c'est une décision métier. Accord l'expose à trancher par votre appli, au lieu de deviner.",
      },
    },
  },

  openSource: {
    heading: "Open source",
    licence: {
      title: "Licence",
      body: "Le code d'Accord est Apache-2.0 — courte, permissive, sans surprise pour les services juridiques. Celui de ce site est Apache-2.0 aussi.",
    },
    contribute: {
      title: "Contribuer",
      body: "Issues et pull requests sont bienvenues. Une graine qui fait échouer la suite de convergence est le meilleur rapport de bug qui soit.",
    },
    security: {
      title: "Sécurité",
      body: "Signalez les vulnérabilités en privé via GitHub. Une liste de contrôle dans la documentation dit ce que le serveur applique et ce que vous configurez.",
    },
    roadmap: {
      title: "Feuille de route",
      body: "Après la v1 : un client Dart/Flutter, des listes ordonnées avec leurs preuves, des pièces jointes reprises au téléversement. Une petite v1 prouvablement correcte vaut mieux qu'une grande qui fonctionne à peu près.",
    },
  },

  docs: {
    navLabel: "Documentation",
    headerLink: "Docs",
    index: {
      title: "Documentation",
      description:
        "Documentation d'Accord : démarrage rapide, schéma et règles de fusion, le client, React et React Native, le serveur, les périmètres, le protocole de sync et la sécurité.",
      intro:
        "Tout pour construire une appli offline-first sur Accord : le client écrit en local et synchronise, le serveur auto-hébergé fusionne selon vos règles. Chaque exemple de code de ces pages est lu dans le dépôt au moment du build : il correspond aux paquets publiés.",
      install: "Créez un projet en une commande :",
      note: "Les exemples de code et leurs commentaires viennent du dépôt, en anglais.",
    },
    sourceLabel: "Source",
    fromLabel: "depuis",
    pages: {
      quickstart: {
        title: "Démarrage rapide",
        description:
          "Créer un projet Accord, lancer le serveur et un appareil qui écrit hors ligne puis synchronise.",
        intro:
          "Une commande crée un projet qui fonctionne : un schéma, une configuration serveur, PostgreSQL dans Docker Compose, un script de jetons de développement et un client.",
        sections: {
          create: {
            title: "Créer un projet",
            body: ["Il faut Node 22.18 ou plus récent, et Docker."],
          },
          run: {
            title: "Le lancer",
            body: [
              "Démarrez PostgreSQL et le serveur, puis l'appareil d'exemple : il écrit quatre changements sans réseau, synchronise, et n'a plus aucun changement en attente.",
            ],
          },
          files: {
            title: "Ce que vous obtenez",
            body: [],
            items: [
              "`schema.ts` : vos enregistrements et la fusion de chaque champ, partagés par le serveur et tous les clients.",
              "`accord.config.ts` : le serveur, avec vos règles de périmètre et la vérification des jetons.",
              "`client.ts` : un appareil qui écrit hors ligne, puis synchronise.",
              "`dev-token.mjs` : des jetons de développement. En production, c'est votre serveur d'authentification qui les émet.",
            ],
          },
        },
      },
      schema: {
        title: "Schéma et règles de fusion",
        description: "Déclarer comment chaque champ fusionne : lww, counter, set et conflict().",
        intro:
          "Chaque champ déclare comment fusionnent les modifications concurrentes. Quel que soit l'ordre d'arrivée, et le nombre d'arrivées, chaque appareil lit la même valeur.",
        sections: {
          strategies: { title: "Les quatre stratégies", body: [] },
          define: {
            title: "Déclarer un schéma",
            body: [
              "Le même fichier de schéma sert au serveur et à chaque client : importez-le des deux côtés.",
            ],
          },
          conflicts: {
            title: "Trancher un conflict()",
            body: [
              "Un champ `conflict()` garde chaque valeur écrite en concurrence et reste marqué. Trancher, c'est écrire en voyant toutes les valeurs en conflit : l'écriture remplace exactement celles-là. Une valeur écrite ailleurs, que l'appareil n'avait pas encore vue, n'est jamais effacée : le champ reste en conflit jusqu'à ce qu'elle soit tranchée à son tour.",
            ],
          },
        },
      },
      client: {
        title: "Client",
        description:
          "Ouvrir le client Accord, écrire hors ligne, trancher les conflits et réagir aux événements.",
        intro:
          "`@accordsync/client` garde sur l'appareil une copie de travail complète des enregistrements de l'utilisateur. Les écritures s'appliquent tout de suite, sans réseau ; la sync tourne en arrière-plan.",
        sections: {
          open: {
            title: "Ouvrir et écrire",
            body: [
              "Chaque écriture se termine une fois enregistrée sur l'appareil, et `read` la voit tout de suite. `start()` synchronise après les écritures, toutes les 30 secondes, et espace les essais hors ligne.",
            ],
          },
          conflicts: {
            title: "Trancher les conflits",
            body: [
              "Affichez chaque champ en conflit avec toutes ses valeurs, et laissez quelqu'un décider.",
            ],
          },
          events: {
            title: "Événements",
            body: [
              "`change` quand l'état local a changé, `refused` quand le serveur a refusé une écriture (déjà annulée), `synced` après un tour de sync, `resync` quand les données ont été rechargées, `error` quand un tour a échoué et sera réessayé.",
            ],
          },
          storage: {
            title: "Stockage",
            body: [],
            items: [
              "`IndexedDbStorage` : navigateurs.",
              "`SqliteStorage` : tout SQLite via un pilote à deux méthodes : wa-sqlite sur le web, op-sqlite sur React Native, `node:sqlite` ou better-sqlite3 dans Node.",
              "`MemoryStorage` : tests ; les écritures non synchronisées sont perdues au redémarrage.",
            ],
          },
        },
      },
      react: {
        title: "React",
        description:
          "Hooks React pour Accord : useRecord, useRecords, useConflicts, useSyncStatus.",
        intro:
          "`@accordsync/react` donne aux composants les enregistrements, les conflits et l'état de sync de l'appareil, et les ré-affiche quand l'état local change, qu'il s'agisse d'une écriture locale ou de la sync.",
        sections: {
          hooks: { title: "Provider et hooks", body: [] },
          rendering: {
            title: "Ré-affichage",
            body: [
              "Un composant n'est ré-affiché que si ce qu'il lit a changé : un enregistrement inchangé garde la même valeur, et React l'ignore.",
            ],
          },
        },
      },
      "react-native": {
        title: "React Native",
        description:
          "Accord sur React Native : stockage op-sqlite, identifiants d'appareil, et sync selon le cycle de vie de l'appli.",
        intro:
          "Les applis de terrain tournent surtout sur téléphone. Voici le client avec SQLite sur l'appareil, une sync qui suit le cycle de vie de l'appli, et les hooks React.",
        sections: {
          install: {
            title: "Installer",
            body: [
              "op-sqlite est un module natif : avec Expo, utilisez un development build. Importez le polyfill en premier : le client a besoin d'une source aléatoire sûre pour l'identifiant d'appareil, et s'arrête avec une explication sans elle.",
            ],
          },
          open: {
            title: "Ouvrir le client",
            body: [
              "Ne fixez pas `deviceId` : le client en crée un et le garde. Les tables d'Accord sont préfixées `accord_`, elles peuvent donc partager la base de votre appli.",
            ],
          },
          lifecycle: {
            title: "Synchroniser selon le cycle de vie",
            body: [
              "Synchronisez au premier plan, mettez en pause en arrière-plan, et synchronisez dès que le réseau revient. Les écritures n'attendent jamais rien de tout cela.",
            ],
          },
        },
      },
      server: {
        title: "Serveur",
        description:
          "Configurer et lancer le serveur de sync Accord : périmètres, authentification, environnement, workers et compaction.",
        intro:
          "`@accordsync/server` est un serveur de sync auto-hébergé sur PostgreSQL. Vous décrivez vos enregistrements et qui peut les voir dans un fichier TypeScript, puis lancez `accord serve`.",
        sections: {
          configure: {
            title: "Configurer",
            body: [
              "Lancez-le avec `accord serve --config accord.config.ts`, ou avec l'image Docker. En production, utilisez `jwksUrl` avec un `issuer` et une `audience`.",
            ],
          },
          env: {
            title: "Environnement",
            body: [],
            items: [
              "`ACCORD_DATABASE_URL` : la chaîne de connexion PostgreSQL (obligatoire).",
              "`ACCORD_PORT` : le port HTTP (8080 par défaut).",
              "`ACCORD_DB_POOL` : connexions PostgreSQL par processus (20 par défaut).",
              "`ACCORD_WORKERS` : processus serveur sur le même port, un nombre ou `auto` (1 par défaut).",
            ],
          },
          scaling: {
            title: "Workers et compaction",
            body: [
              "Les envois s'exécutent en parallèle : plusieurs workers ajoutent du débit. Toutes les heures, le serveur replie en instantanés l'historique que tous les appareils ont déjà ; `accord compact` le fait une fois.",
            ],
          },
        },
      },
      scopes: {
        title: "Règles de périmètre",
        description:
          "Qui peut lire et écrire quoi : le fonctionnement des périmètres d'Accord, cinq modèles testés, et les règles qui les gardent justes.",
        intro:
          "Les périmètres sont votre politique d'accès : un enregistrement appartient à des clés calculées depuis ses champs, et chaque utilisateur peut lire et écrire certaines clés. Un utilisateur voit un enregistrement quand ils partagent une clé.",
        sections: {
          how: {
            title: "Fonctionnement",
            body: [
              "Un enregistrement existant accepte une écriture si ses clés actuelles croisent les clés d'écriture de l'utilisateur ; un nouvel enregistrement, si les clés qu'il aurait après l'écriture les croisent. Quand une écriture déplace un enregistrement, les appareils qui ne peuvent plus le voir le suppriment ; ceux qui le peuvent désormais reçoivent tout son historique.",
            ],
          },
          patterns: {
            title: "Modèles",
            body: [
              "Le dépôt propose cinq modèles testés : personnel, équipe de terrain, superviseur, multi-organisation et listes partagées. En voici trois :",
            ],
          },
          rules: {
            title: "Règles pour des périmètres justes",
            body: [],
            items: [
              "Fermé par défaut : un enregistrement sans clé n'est visible par personne.",
              "Des fonctions de périmètre pures : ni horloge, ni hasard, ni réseau, ni base de données.",
              "Le champ de périmètre dès la première écriture de l'enregistrement.",
              "Les claims sont relus à chaque requête : des jetons de courte durée pour retirer un accès vite.",
              "Testez les périmètres comme du code : un utilisateur qui doit voir un enregistrement, un qui ne doit pas.",
            ],
          },
        },
      },
      protocol: {
        title: "Protocole de sync",
        description:
          "Le protocole de sync HTTP d'Accord, version 1 : push, pull, resync et erreurs.",
        intro:
          "Les clients et le serveur échangent en HTTPS et JSON. Chaque requête porte le jeton de l'utilisateur et l'identifiant de l'appareil ; les JSON Schemas de chaque message sont dans le dépôt.",
        sections: {
          push: {
            title: "Push",
            body: [
              "Envoyez la file d'attente dans l'ordre d'écriture. Les opérations acceptées quittent la file ; les refusées, chacune avec sa raison, sont annulées sur l'appareil. Renvoyer un lot est toujours sans danger.",
            ],
          },
          pull: {
            title: "Pull",
            body: [
              "Partez du curseur 0, appliquez chaque élément, gardez le curseur, et recommencez tant que `has_more` est vrai. `device_seq` indique à l'appareil où en sont ses propres numéros d'opération : un identifiant n'est jamais réutilisé.",
            ],
          },
          resync: {
            title: "Resync",
            body: [
              "Quand les périmètres d'un utilisateur changent, la page suivante apporte les enregistrements entrés et retire ceux qui sont sortis. Seul un très gros changement, ou un appareil de retour après une longue absence, reçoit cette réponse à la place.",
            ],
          },
          errors: {
            title: "Erreurs",
            body: [],
            items: [
              "`400` : requête mal formée.",
              "`401` : jeton absent ou invalide.",
              "`403` : l'identifiant d'appareil appartient à un autre utilisateur.",
              "`429` : limite de débit ; attendez `Retry-After`.",
              "`500` : erreur serveur ; réessayez avec un délai croissant (les envois sont idempotents).",
            ],
          },
        },
      },
      security: {
        title: "Sécurité",
        description:
          "Ce que le serveur Accord applique, et ce qu'il faut configurer au déploiement.",
        intro:
          "Le serveur applique l'autorisation à chaque push et chaque pull. Quelques réglages restent à votre charge au déploiement.",
        sections: {
          enforced: {
            title: "Appliqué par le serveur",
            body: [],
            items: [
              "Chaque requête de sync exige un JWT vérifié ; les périmètres filtrent chaque pull et contrôlent chaque opération envoyée.",
              "Un identifiant d'appareil est lié à son premier utilisateur ; un appareil n'envoie que ses propres opérations.",
              "Une opération renvoyée n'est jamais appliquée deux fois ; un identifiant réutilisé est refusé, jamais accepté en silence.",
              "Les horloges très en avance sont refusées ; l'historique est en ajout seul, imposé par PostgreSQL.",
              "La taille et le débit des requêtes sont limités (413 et 429).",
            ],
          },
          deploy: {
            title: "Votre part au déploiement",
            body: [],
            items: [
              "Utilisez `jwksUrl` avec `issuer` et `audience`, jamais le secret de développement.",
              "Terminez TLS devant Accord.",
              "Limitez CORS aux origines de votre appli.",
              "Sauvegardez PostgreSQL et restreignez son accès réseau.",
              "Chiffrez les données sensibles sur les appareils : Accord ne chiffre pas le stockage local.",
            ],
          },
        },
      },
    },
    homeLinks: { code: "Lire la doc du client", run: "Lire le démarrage rapide" },
  },

  footer: {
    tagline: "Conçu pour les réseaux qui mentent.",
    statusLine: "v{version}, publiée le {date}. Avant la 1.0.",
    copyright: "© 2026 Ben Hattab",
    linkLabels: { github: "GitHub", docs: "Docs", changelog: "Changelog", license: "Licence" },
  },
};
