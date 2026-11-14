/**
 * config.js – Materialkatalog und globale Konstanten.
 *
 * WICHTIG: Physik rechnet in einem festen Design-Raum (1600 x 900).
 * Dadurch ist das Spielverhalten auf jeder Fenstergröße identisch.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    BB.VERSION = '0.4.0';

    /** Fester Design-Raum. Alles (Nodes, Streben, Physik) lebt hier drin. */
    BB.DESIGN = { W: 1600, H: 900 };

    /** Umrechnung für Anzeigen: 100 Design-Pixel = 1 Meter. */
    BB.PX_PER_METER = 100;

    /** Standarddauer eines Belastungstests in Sekunden. */
    BB.DEFAULT_DURATION = 12.0;

    /** Physik läuft mit fester Schrittweite. */
    BB.FIXED_STEP = 1 / 60;

    /** Reihenfolge im Werkzeugkasten (entspricht den Tasten 1–6). */
    BB.MATERIAL_ORDER = ['wood', 'steel', 'concrete', 'cable', 'damper', 'pendulum'];

    BB.MATERIALS = {
        wood: {
            name: 'Rundholz', costPerPx: 0.75, maxLen: 210,
            stiffness: 1.25, maxTension: 0.16, maxCompression: 0.14,
            mass: 1.0, thickness: 9, color: '#d97706', border: '#92400e'
        },
        steel: {
            name: 'Stahlträger', costPerPx: 1.8, maxLen: 260,
            stiffness: 2.40, maxTension: 0.32, maxCompression: 0.28,
            mass: 2.1, thickness: 11, color: '#dc2626', border: '#7f1d1d'
        },
        concrete: {
            name: 'Stahlbeton', costPerPx: 1.35, maxLen: 190,
            stiffness: 2.80, maxTension: 0.08, maxCompression: 0.45,
            mass: 3.3, thickness: 15, color: '#9ca3af', border: '#4b5563'
        },
        cable: {
            name: 'Stahlseil', costPerPx: 0.65, maxLen: 340,
            stiffness: 2.10, maxTension: 0.42, maxCompression: 0.0,
            mass: 0.4, thickness: 4, color: '#38bdf8', border: '#0284c7', cable: true
        },
        damper: {
            name: 'Stoßdämpfer', costPerPx: 2.1, maxLen: 185,
            stiffness: 0.65, maxTension: 0.38, maxCompression: 0.38,
            mass: 1.5, thickness: 13, color: '#facc15', border: '#854d0e', isDamper: true
        },
        pendulum: {
            name: 'Tilgerpendel', costPerPx: 2.4, maxLen: 160,
            stiffness: 1.90, maxTension: 0.45, maxCompression: 0.1,
            mass: 8.5, thickness: 6, color: '#fbbf24', border: '#78350f', isPendulum: true
        }
    };

    /** Preis pro Meter für die Werkzeugleiste. */
    BB.pricePerMeter = function (matKey) {
        const mat = BB.MATERIALS[matKey];
        return Math.round(mat.costPerPx * BB.PX_PER_METER);
    };
})();



