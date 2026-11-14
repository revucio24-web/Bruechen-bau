/**
 * storage.js – einzige Stelle, die Daten persistiert.
 *
 * Vertrag für die spätere MSIX-Version: dieselben Funktionen, aber als
 * JSON-Datei unter %LOCALAPPDATA%\BrueckenUndBeben\profile.json.
 * Dafür muss nur diese Datei ausgetauscht werden.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    const PREFIX = 'bb.';

    function read(key, fallback) {
        try {
            const raw = localStorage.getItem(PREFIX + key);
            return raw === null ? fallback : JSON.parse(raw);
        } catch (err) {
            console.warn('storage.read fehlgeschlagen:', key, err);
            return fallback;
        }
    }

    function write(key, value) {
        try {
            localStorage.setItem(PREFIX + key, JSON.stringify(value));
            return true;
        } catch (err) {
            console.warn('storage.write fehlgeschlagen:', key, err);
            return false;
        }
    }

    const storage = {
        read: read,
        write: write,

        remove: function (key) {
            try { localStorage.removeItem(PREFIX + key); } catch (err) { /* ignorieren */ }
        },

        /* ---------- Einstellungen ---------- */
        getSettings: function () {
            const s = read('settings', {});
            return {
                muted: s.muted === true,
                showHelpOnStart: s.showHelpOnStart !== false
            };
        },

        saveSettings: function (settings) {
            return write('settings', settings);
        },

        /* ---------- Fortschritt ---------- */

        /** Fortschritt eines Levels: {stars, bestCost, bestStress}. */
        getProgress: function (levelId) {
            const p = read('progress.' + levelId, null);
            if (!p || typeof p !== 'object') return { stars: 0, bestCost: null, bestStress: null };
            return {
                stars: typeof p.stars === 'number' ? p.stars : 0,
                bestCost: typeof p.bestCost === 'number' ? p.bestCost : null,
                bestStress: typeof p.bestStress === 'number' ? p.bestStress : null
            };
        },

        /**
         * Verbucht ein Ergebnis. Sterne und Bestwerte werden nur besser.
         * @returns {{stars:number, bestCost:number|null, bestStress:number|null, improved:boolean}}
         */
        recordResult: function (levelId, stars, cost, stress) {
            const prev = this.getProgress(levelId);
            const next = {
                stars: Math.max(prev.stars, stars),
                bestCost: prev.bestCost === null ? Math.round(cost) : Math.min(prev.bestCost, Math.round(cost)),
                bestStress: prev.bestStress === null ? stress : Math.min(prev.bestStress, stress)
            };
            const improved = next.stars > prev.stars ||
                (prev.bestCost === null || next.bestCost < prev.bestCost);
            write('progress.' + levelId, next);
            return {
                stars: next.stars,
                bestCost: next.bestCost,
                bestStress: next.bestStress,
                improved: improved
            };
        },

        /** Bestwert (geringste Kosten) oder null. */
        getHighscore: function (levelId) {
            return this.getProgress(levelId).bestCost;
        },

        /** Level-ID, stabil aus Index bzw. id-Feld. */
        levelId: function (level, index) {
            if (level && typeof level.id === 'string' && level.id.length) return level.id;
            return 'campaign-' + index;
        },

        /* ---------- Freischaltung ---------- */

        isUnlocked: function (index) {
            if (index <= 0) return true;
            const prev = BB.LEVELS[index - 1];
            if (!prev) return true;
            const id = this.levelId(prev, index - 1);
            return this.getProgress(id).stars > 0;
        },

        /* ---------- Eigene Level ---------- */

        getCustomLevels: function () {
            const list = read('customLevels', []);
            return Array.isArray(list) ? list : [];
        },

        saveCustomLevel: function (level) {
            const list = this.getCustomLevels().filter(function (l) { return l.id !== level.id; });
            list.unshift(level);
            // Nur die letzten 30 behalten, damit localStorage nicht überläuft.
            return write('customLevels', list.slice(0, 30));
        },

        removeCustomLevel: function (id) {
            return write('customLevels', this.getCustomLevels().filter(function (l) { return l.id !== id; }));
        }
    };

    BB.storage = storage;
})();
