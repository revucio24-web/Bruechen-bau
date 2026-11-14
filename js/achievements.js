/**
 * achievements.js – Erfolge und Spielstatistiken. Rein lokal.
 *
 * Ereignisse landen über onTestEnd/onBeamBuilt/onExport hier; freigeschaltete
 * Erfolge werden über BB.storage persistiert und mit Toast gemeldet.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    const DEFS = [
        { id: 'first-win', name: 'Erster Erfolg', desc: 'Bestehe deinen ersten Test.', icon: '🏆' },
        { id: 'star-3', name: 'Sterne-Sammler', desc: 'Hole 3 Sterne in einem Level.', icon: '⭐' },
        { id: 'stars-12', name: 'Am Aufstieg', desc: 'Sammle insgesamt 12 Sterne.', icon: '🌟' },
        { id: 'stars-24', name: 'Brückenlegende', desc: 'Sammle alle Sterne der Kampagne.', icon: '🌠' },
        { id: 'truck-saved', name: 'Spediteur', desc: 'Bringe einen LKW sicher hinüber.', icon: '🚚' },
        { id: 'convoy-3', name: 'Konvoi-Kapitän', desc: 'Bringe 3 Fahrzeuge in einem Test hinüber.', icon: '🚛' },
        { id: 'tests-10', name: 'Proband', desc: 'Bestehe insgesamt 10 Tests.', icon: '✅' },
        { id: 'builder-100', name: 'Konstrukteur', desc: 'Baue 100 Streben.', icon: '🔧' },
        { id: 'exporter', name: 'Level-Autor', desc: 'Exportiere ein eigenes Level.', icon: '💾' },
        { id: 'crash', name: 'Lehrgeld', desc: 'Lass ein Fahrzeug abstürzen. Automechanik macht Spaß.', icon: '💥' }
    ];

    function loadUnlocked() {
        const u = BB.storage.read('ach.unlocked', {});
        return (u && typeof u === 'object') ? u : {};
    }

    function loadCounters() {
        const c = BB.storage.read('ach.counters', {});
        const base = { testsWon: 0, beamsBuilt: 0, vehiclesSaved: 0, vehiclesLost: 0 };
        if (!c || typeof c !== 'object') return base;
        for (const k in base) {
            if (typeof c[k] === 'number' && c[k] >= 0) base[k] = c[k];
        }
        return base;
    }

    let unlocked = loadUnlocked();
    let counters = loadCounters();

    function unlock(id) {
        if (unlocked[id]) return false;
        const def = DEFS.find(function (d) { return d.id === id; });
        if (!def) return false;
        unlocked[id] = Date.now();
        BB.storage.write('ach.unlocked', unlocked);
        if (BB.ui && BB.ui.toast) {
            BB.ui.toast(def.icon + ' Erfolg freigeschaltet: ' + def.name);
        }
        return true;
    }

    /** Gesamtsterne der Kampagne. */
    function totalStars() {
        let sum = 0;
        for (let i = 0; i < BB.LEVELS.length; i++) {
            const lvl = BB.LEVELS[i];
            sum += BB.storage.getProgress(BB.storage.levelId(lvl, i)).stars;
        }
        return sum;
    }

    /**
     * Ende eines Tests auswerten.
     * @param {object} info {won, stars, levelId, vehicles:{arrived,total,kinds,crashed}, parReached}
     */
    function onTestEnd(info) {
        if (!info) return;
        if (info.won) {
            counters.testsWon++;
            unlock('first-win');
            if (counters.testsWon >= 10) unlock('tests-10');
        }
        if (info.vehicles) {
            counters.vehiclesSaved += info.vehicles.arrived || 0;
            counters.vehiclesLost += info.vehicles.crashed || 0;
            if (info.vehicles.crashed > 0) unlock('crash');
            const kinds = info.vehicles.kinds || [];
            if (kinds.indexOf('truck') !== -1 && info.won) unlock('truck-saved');
            if (info.won && (info.vehicles.arrived || 0) >= 3) unlock('convoy-3');
        }
        if (info.won && info.stars >= 3) unlock('star-3');
        const total = totalStars();
        if (total >= 12) unlock('stars-12');
        if (total >= BB.LEVELS.length * 3) unlock('stars-24');
        save();
    }

    function onBeamBuilt() {
        counters.beamsBuilt++;
        if (counters.beamsBuilt >= 100) unlock('builder-100');
        save();
    }

    function onExport() {
        unlock('exporter');
        save();
    }

    function save() {
        BB.storage.write('ach.counters', counters);
    }

    /** Liste fürs Panel: Definitionen + Freischaltstatus. */
    function list() {
        return DEFS.map(function (d) {
            return {
                id: d.id, name: d.name, desc: d.desc, icon: d.icon,
                unlocked: !!unlocked[d.id],
                when: unlocked[d.id] ? new Date(unlocked[d.id]).toLocaleDateString('de-DE') : null
            };
        });
    }

    function stats() {
        return {
            unlockedCount: Object.keys(unlocked).length,
            total: DEFS.length,
            counters: Object.assign({}, counters)
        };
    }

    BB.achievements = {
        list: list,
        stats: stats,
        isUnlocked: function (id) { return !!unlocked[id]; },
        unlock: unlock,
        onTestEnd: onTestEnd,
        onBeamBuilt: onBeamBuilt,
        onExport: onExport,
        /** Nur für Tests: Zustand zurücksetzen. */
        _reset: function () {
            unlocked = {};
            counters = { testsWon: 0, beamsBuilt: 0, vehiclesSaved: 0, vehiclesLost: 0 };
            BB.storage.write('ach.unlocked', unlocked);
            BB.storage.write('ach.counters', counters);
        }
    };
})();
