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
      "Accord est un moteur de synchronisation offline-first open source et auto-hébergé, en développement : écriture locale d'abord, opérations plutôt que écrasements, règles de fusion déclarées, et des conflits que votre appli tranche. TypeScript et PostgreSQL.",
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
      "Accord est un moteur de sync open source et auto-hébergé, en développement pour les applis de terrain : les données vivent en SQLite ou IndexedDB, la vérité en PostgreSQL côté serveur, et les répliques fusionnent selon des règles déclarées — pas à la chance.",
    ctaHow: "Fonctionnement",
    ctaGithub: "GitHub",
    statusLine: "En développement : pas encore publié. Suivez le projet sur GitHub.",
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
    intro:
      "Le design de la v1, écrit à l'intention. Ces étapes suivent une écriture, d'un appareil vers tous les autres.",
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
    note: "Les listes ordonnées (un CRDT de séquence) sont prévues après la v1 — la plupart des listes d'applis de terrain sont des ensembles. Ce tableau sera généré depuis docs/merge-rules.md quand elle existera.",
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
      "Seules des garanties prouvées ont leur place ici — un test qui passe dans le dépôt. Rien n'y est encore arrivé : chaque point est à venir, et reliera son test le jour où il deviendra vrai.",
    planned: { label: "À venir", title: "À venir — en attente d'un test qui passe dans le dépôt" },
    whyLabel: "Pourquoi :",
    sourceLink: { label: "crossben/accordsync — le plan (section 6)" },
    items: {
      convergence: {
        title: "Chaque réplique converge",
        body: "Après la sync, toutes les répliques sont conçues pour porter un état identique — à prouver par des tests propriétés sous pannes aléatoires.",
        why: "Les jours hors ligne sont normaux ; la divergence, silencieuse.",
      },
      counters: {
        title: "Les compteurs ne perdent jamais d'incrément",
        body: "Un compteur est conçu pour égaler la somme de tous les incréments jamais faits, quel que soit l'ordre d'arrivée.",
        why: "Les quantités collectées et les stocks doivent tomber juste.",
      },
      conflicts: {
        title: "conflict() n'est jamais résolu automatiquement",
        body: "Les champs marqués conflict() sont conçus pour afficher les deux valeurs et rester marqués jusqu'à ce que l'appli tranche.",
        why: "Accord ne devine jamais sur l'argent ou le statut légal.",
      },
      idempotent: {
        title: "Rejouer une opération ne change rien",
        body: "Les opérations sont conçues pour être idempotentes : appliquer deux fois ne change rien, donc renvoyer un lot après une coupure est sans danger.",
        why: "Les réseaux mobiles coupent en plein lot, tout le temps.",
      },
      resumable: {
        title: "La sync reprend, des jours plus tard",
        body: "Un appareil hors ligne des jours est conçu pour synchroniser par pages reprises : s'il meurt à la page 7, il reprend à la page 7.",
        why: "Les longues coupures sont la raison d'être de l'offline-first.",
      },
      scopes: {
        title: "Les périmètres sont appliqués côté serveur",
        body: "Le serveur est conçu pour filtrer chaque pull et rejeter chaque opération hors périmètre, en signalant les refus au client.",
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
  },

  quickstart: {
    heading: "Lancez-le vous-même",
    intro:
      "Le squelette tourne : un serveur, PostgreSQL, un contrôle de santé. Le quick start du dépôt — un aperçu développeur, pas une version publiée.",
    steps: [
      {
        title: "Cloner le dépôt",
        body: "Il est privé pour l'instant.",
        commands: ["git clone https://github.com/crossben/accordsync", "cd accordsync"],
      },
      {
        title: "Démarrer PostgreSQL et le serveur",
        body: "Docker Compose construit l'image et lance les deux.",
        commands: ["docker compose up --build"],
      },
      {
        title: "Vérifier la santé",
        body: "Le serveur répond avec la version du protocole qu'il parle.",
        commands: ["curl localhost:8080/health"],
      },
    ],
    note: "Node 22.12+ et pnpm 11 pour développer sur Accord ; les tests du serveur démarrent PostgreSQL 16 avec Testcontainers.",
    terminalLabel: "Terminal",
    terminalNote: "Commandes réelles et vraie réponse de santé — tirées du test du endpoint.",
  },

  proof: {
    heading: "Preuves",
    intro:
      "La correction est une suite de tests, pas une promesse. Ces preuves sont en construction, d'après le plan (section 6) ; les vrais chiffres arriveront avec la CI.",
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
        body: "Pas d'édition riche partagée dans la v1. Les champs sont des scalaires, des ensembles, des compteurs et des listes de références.",
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
      body: "Les dépôts restent privés pendant les premiers jalons. À l'ouverture, issues et pull requests seront bienvenues ; CONTRIBUTING.md sera relié ici.",
    },
    security: {
      title: "Sécurité",
      body: "Les signalements auront un canal privé — SECURITY.md dans le dépôt expliquera comment.",
    },
    roadmap: {
      title: "Feuille de route",
      body: "Après la v1 : un client Dart/Flutter, des listes ordonnées avec leurs preuves, des pièces jointes reprises au téléversement. Une petite v1 prouvablement correcte vaut mieux qu'une grande qui fonctionne à peu près.",
    },
  },

  footer: {
    tagline: "Conçu pour les réseaux qui mentent.",
    statusLine: "En développement : pas encore publié. Suivez le projet sur GitHub.",
    copyright: "© 2026 Ben Hattab",
    linkLabels: { github: "GitHub", docs: "Docs", changelog: "Changelog", license: "Licence" },
  },
};
