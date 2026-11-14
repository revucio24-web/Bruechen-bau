/**
 * levels.js – Leveldaten der Kampagne.
 *
 * Koordinaten sind auf 0..1 normalisiert; die Laufzeit rechnet sie in den
 * Design-Raum (1600 x 900) um. Struktur entspricht 1:1 dem `.bridge`-Format,
 * damit Kampagnen-Level und eigene Level denselben Code nutzen.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    BB.LEVELS = [
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-1',
            author: 'campaign',
            title: 'Die Schlucht-Villa',
            subtitle: 'Erdbeben',
            desc: 'Bürgermeister Gierig will seine goldene Badewanne über dem Abgrund! Vierecke klappen zusammen – ziehe Dreiecke zu den grünen Fundamenten.',
            budget: 2800,
            duration: 12,
            disaster: 'earthquake',
            failY: 0.78,
            ground: [
                [{ x: 0, y: 0.56 }, { x: 0.36, y: 0.56 }, { x: 0.42, y: 1.0 }, { x: 0, y: 1.0 }],
                [{ x: 0.64, y: 0.56 }, { x: 1.0, y: 0.56 }, { x: 1.0, y: 1.0 }, { x: 0.58, y: 1.0 }]
            ],
            anchors: [
                { x: 0.28, y: 0.56 }, { x: 0.35, y: 0.56 }, { x: 0.39, y: 0.70 },
                { x: 0.65, y: 0.56 }, { x: 0.72, y: 0.56 }, { x: 0.61, y: 0.70 }
            ],
            targets: [
                { type: 'platform', x: 0.46, y: 0.45, mass: 6.2 },
                { type: 'platform', x: 0.54, y: 0.45, mass: 6.2 }
            ],
            par: { cost: 1900, peakStress: 0.45 },
            vehicles: { mass: 3.0, speed: 110, count: 2, first: 1.5, interval: 3.5 }
        },
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-2',
            author: 'campaign',
            title: 'Der Sky-High-Turm',
            subtitle: 'Orkan',
            desc: 'Ein schmaler Turm im Orkan von links! Spanne links blaue Stahlseile und stütze mit Beton oder hänge ein Pendel ein.',
            budget: 3400,
            duration: 12,
            disaster: 'hurricane',
            failY: 0.70,
            ground: [
                [{ x: 0.32, y: 0.78 }, { x: 0.68, y: 0.78 }, { x: 0.75, y: 1.0 }, { x: 0.25, y: 1.0 }]
            ],
            anchors: [
                { x: 0.44, y: 0.78 }, { x: 0.50, y: 0.78 }, { x: 0.53, y: 0.78 }, { x: 0.56, y: 0.78 }
            ],
            targets: [
                { type: 'platform', x: 0.47, y: 0.50, mass: 6.2 },
                { type: 'platform', x: 0.53, y: 0.50, mass: 6.2 }
            ],
            par: { cost: 2100, peakStress: 0.40 },
            vehicles: {
                count: 2, first: 1.5, interval: 3.5,
                types: [
                    { kind: 'car', mass: 3.0, speed: 110 },
                    { kind: 'truck', mass: 6.0, speed: 85 }
                ]
            }
        },
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-3',
            author: 'campaign',
            title: 'Das Mega-Beben',
            subtitle: 'Beben + Wind',
            desc: 'Schlucht mit Erdbeben UND Seitenwind! Nutze Stoßdämpfer an den Fundamenten oder baue eine Hängebrücke.',
            budget: 4800,
            duration: 12,
            disaster: 'both',
            failY: 0.76,
            ground: [
                [{ x: 0, y: 0.62 }, { x: 0.26, y: 0.62 }, { x: 0.31, y: 1.0 }, { x: 0, y: 1.0 }],
                [{ x: 0.46, y: 0.62 }, { x: 0.54, y: 0.62 }, { x: 0.56, y: 1.0 }, { x: 0.44, y: 1.0 }],
                [{ x: 0.74, y: 0.62 }, { x: 1.0, y: 0.62 }, { x: 1.0, y: 1.0 }, { x: 0.69, y: 1.0 }]
            ],
            anchors: [
                { x: 0.17, y: 0.62 }, { x: 0.25, y: 0.62 },
                { x: 0.47, y: 0.62 }, { x: 0.53, y: 0.62 },
                { x: 0.75, y: 0.62 }, { x: 0.83, y: 0.62 }
            ],
            targets: [
                { type: 'platform', x: 0.43, y: 0.52, mass: 6.2 },
                { type: 'platform', x: 0.50, y: 0.52, mass: 6.2 },
                { type: 'platform', x: 0.57, y: 0.52, mass: 6.2 }
            ],
            par: { cost: 1700, peakStress: 0.45 },
            vehicles: { mass: 3.0, speed: 110, count: 2, first: 1.5, interval: 3.5 }
        },
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-4',
            author: 'campaign',
            title: 'Die Hafenkräne',
            subtitle: 'Orkan, enges Budget',
            desc: 'Zwei Kräne sollen den Hafen überspannen. Der Wind kommt von rechts, und diesmal ist das Budget knapp.',
            budget: 3200,
            duration: 14,
            disaster: 'hurricane',
            failY: 0.68,
            ground: [
                [{ x: 0.30, y: 0.78 }, { x: 0.47, y: 0.78 }, { x: 0.50, y: 1.0 }, { x: 0.24, y: 1.0 }],
                [{ x: 0.53, y: 0.78 }, { x: 0.70, y: 0.78 }, { x: 0.76, y: 1.0 }, { x: 0.50, y: 1.0 }]
            ],
            anchors: [
                { x: 0.40, y: 0.78 }, { x: 0.46, y: 0.78 },
                { x: 0.52, y: 0.78 }, { x: 0.60, y: 0.78 }
            ],
            targets: [
                { type: 'platform', x: 0.46, y: 0.52, mass: 6.2 },
                { type: 'platform', x: 0.54, y: 0.52, mass: 6.2 }
            ],
            par: { cost: 2000, peakStress: 0.40 },
            vehicles: {
                count: 2, first: 1.5, interval: 3.5,
                types: [
                    { kind: 'truck', mass: 6.0, speed: 85 },
                    { kind: 'car', mass: 3.0, speed: 110 }
                ]
            }
        },
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-5',
            author: 'campaign',
            title: 'Die Doppelspann-Brücke',
            subtitle: 'Beben + Wind',
            desc: 'Drei Plattformen, ein Pfeiler in der Mitte und zwei Katastrophen gleichzeitig. Das ist die Meisterprüfung.',
            budget: 5200,
            duration: 15,
            disaster: 'both',
            failY: 0.76,
            ground: [
                [{ x: 0, y: 0.62 }, { x: 0.22, y: 0.62 }, { x: 0.26, y: 1.0 }, { x: 0, y: 1.0 }],
                [{ x: 0.44, y: 0.62 }, { x: 0.56, y: 0.62 }, { x: 0.58, y: 1.0 }, { x: 0.42, y: 1.0 }],
                [{ x: 0.78, y: 0.62 }, { x: 1.0, y: 0.62 }, { x: 1.0, y: 1.0 }, { x: 0.74, y: 1.0 }]
            ],
            anchors: [
                { x: 0.14, y: 0.62 }, { x: 0.20, y: 0.62 },
                { x: 0.44, y: 0.62 }, { x: 0.46, y: 0.62 },
                { x: 0.54, y: 0.62 }, { x: 0.56, y: 0.62 },
                { x: 0.80, y: 0.62 }, { x: 0.86, y: 0.62 }
            ],
            targets: [
                { type: 'platform', x: 0.36, y: 0.52, mass: 5.5 },
                { type: 'platform', x: 0.50, y: 0.44, mass: 6.2 },
                { type: 'platform', x: 0.64, y: 0.52, mass: 5.5 }
            ],
            par: { cost: 2200, peakStress: 0.45 },
            vehicles: {
                count: 2, first: 1.5, interval: 4.0,
                types: [
                    { kind: 'bus', mass: 4.5, speed: 95 },
                    { kind: 'truck', mass: 6.0, speed: 85 }
                ]
            }
        },
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-6',
            author: 'campaign',
            title: 'Die Pilgerbrücke',
            subtitle: 'Erdbeben, weite Spannweite',
            desc: 'Die große Schlucht will überwunden werden! Spann Seile oder baue ein hohes Fachwerk – die Spannweite ist fast zu groß.',
            budget: 4000,
            duration: 12,
            disaster: 'earthquake',
            failY: 0.76,
            ground: [
                [{ x: 0, y: 0.56 }, { x: 0.33, y: 0.56 }, { x: 0.39, y: 1.0 }, { x: 0, y: 1.0 }],
                [{ x: 0.67, y: 0.56 }, { x: 1.0, y: 0.56 }, { x: 1.0, y: 1.0 }, { x: 0.61, y: 1.0 }]
            ],
            anchors: [
                { x: 0.22, y: 0.56 }, { x: 0.29, y: 0.56 }, { x: 0.33, y: 0.62 },
                { x: 0.64, y: 0.56 }, { x: 0.71, y: 0.56 }, { x: 0.67, y: 0.62 }
            ],
            targets: [
                { type: 'platform', x: 0.45, y: 0.42, mass: 6.2 },
                { type: 'platform', x: 0.55, y: 0.42, mass: 6.2 }
            ],
            par: { cost: 2400, peakStress: 0.45 },
            vehicles: {
                count: 2, first: 1.5, interval: 3.5,
                types: [
                    { kind: 'car', mass: 3.0, speed: 110 },
                    { kind: 'bus', mass: 4.5, speed: 95 }
                ]
            }
        },
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-7',
            author: 'campaign',
            title: 'Der Sturmhafen',
            subtitle: 'Orkan, Konvoi',
            desc: 'Ein ganzer Konvoi will über den Hafen! Der Orkan ist stark – stütze die lange Fahrbahn gut ab.',
            budget: 4400,
            duration: 14,
            disaster: 'hurricane',
            failY: 0.72,
            ground: [
                [{ x: 0, y: 0.62 }, { x: 0.28, y: 0.62 }, { x: 0.34, y: 1.0 }, { x: 0, y: 1.0 }],
                [{ x: 0.44, y: 0.62 }, { x: 0.56, y: 0.62 }, { x: 0.59, y: 1.0 }, { x: 0.41, y: 1.0 }],
                [{ x: 0.72, y: 0.62 }, { x: 1.0, y: 0.62 }, { x: 1.0, y: 1.0 }, { x: 0.66, y: 1.0 }]
            ],
            anchors: [
                { x: 0.20, y: 0.62 }, { x: 0.27, y: 0.62 },
                { x: 0.47, y: 0.62 }, { x: 0.53, y: 0.62 },
                { x: 0.73, y: 0.62 }, { x: 0.80, y: 0.62 }
            ],
            targets: [
                { type: 'platform', x: 0.38, y: 0.50, mass: 5.5 },
                { type: 'platform', x: 0.50, y: 0.50, mass: 6.2 },
                { type: 'platform', x: 0.62, y: 0.50, mass: 5.5 }
            ],
            par: { cost: 2600, peakStress: 0.45 },
            vehicles: {
                count: 3, first: 1.5, interval: 3.0,
                types: [
                    { kind: 'car', mass: 3.0, speed: 110 },
                    { kind: 'truck', mass: 6.0, speed: 85 },
                    { kind: 'bus', mass: 4.5, speed: 95 }
                ]
            }
        },
        {
            format: 'bridge-level',
            version: 1,
            id: 'campaign-8',
            author: 'campaign',
            title: 'Die Meisterprüfung',
            subtitle: 'Beben + Orkan, schwerer Konvoi',
            desc: 'Alles gleichzeitig: Beben, Orkan und ein schwerer Konvoi. Die letzte Prüfung für wahre Brückenmeister!',
            budget: 6000,
            duration: 15,
            disaster: 'both',
            failY: 0.74,
            ground: [
                [{ x: 0, y: 0.60 }, { x: 0.24, y: 0.60 }, { x: 0.28, y: 1.0 }, { x: 0, y: 1.0 }],
                [{ x: 0.45, y: 0.60 }, { x: 0.55, y: 0.60 }, { x: 0.58, y: 1.0 }, { x: 0.42, y: 1.0 }],
                [{ x: 0.76, y: 0.60 }, { x: 1.0, y: 0.60 }, { x: 1.0, y: 1.0 }, { x: 0.72, y: 1.0 }]
            ],
            anchors: [
                { x: 0.16, y: 0.60 }, { x: 0.23, y: 0.60 },
                { x: 0.47, y: 0.60 }, { x: 0.53, y: 0.60 },
                { x: 0.77, y: 0.60 }, { x: 0.84, y: 0.60 }
            ],
            targets: [
                { type: 'platform', x: 0.37, y: 0.50, mass: 5.5 },
                { type: 'platform', x: 0.50, y: 0.42, mass: 6.2 },
                { type: 'platform', x: 0.63, y: 0.50, mass: 5.5 }
            ],
            par: { cost: 3100, peakStress: 0.45 },
            vehicles: {
                count: 3, first: 1.5, interval: 3.5,
                types: [
                    { kind: 'truck', mass: 6.0, speed: 85 },
                    { kind: 'bus', mass: 4.5, speed: 95 },
                    { kind: 'truck', mass: 6.0, speed: 85 }
                ]
            }
        }
    ];

    /** Startzustand des Editors. */
    BB.createDefaultCustomLevel = function () {
        return {
            format: 'bridge-level',
            version: 1,
            id: 'custom-' + Date.now().toString(36),
            author: 'local',
            title: 'Eigenes Level',
            subtitle: 'Werkstatt',
            desc: 'Im Editor gebaut.',
            budget: 3500,
            duration: 12,
            disaster: 'both',
            failY: 0.78,
            ground: [
                [{ x: 0, y: 0.6 }, { x: 0.43, y: 0.6 }, { x: 0.47, y: 1.0 }, { x: 0, y: 1.0 }],
                [{ x: 0.57, y: 0.6 }, { x: 1.0, y: 0.6 }, { x: 1.0, y: 1.0 }, { x: 0.53, y: 1.0 }]
            ],
            anchors: [{ x: 0.40, y: 0.6 }, { x: 0.60, y: 0.6 }],
            targets: [{ type: 'platform', x: 0.5, y: 0.5, mass: 6.2 }],
            par: { cost: 1500, peakStress: 0.50 }
        };
    };
})();
