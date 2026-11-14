/**
 * tutorial.js – Geführte Bau-Tipps für Level 1.
 *
 * Zeigt kontextabhängige Hinweise, solange Level 1 noch ungelöst ist.
 * Über die Einstellung settings.tutorial (= false) abschaltbar.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    let active = false;
    let beamsSeen = 0;
    let ending = false;

    function startForLevel(idx) {
        ending = false;
        beamsSeen = 0;
        active = idx === 0 &&
            BB.storage.getProgress('campaign-1').stars === 0 &&
            BB.storage.getSettings().tutorial !== false;
        update();
    }

    function update() {
        if (!BB.ui || !BB.ui.setTutorialHint) return;
        if (!active) {
            BB.ui.setTutorialHint(ending ? 'Bravo! Der Rest ist Übungssache. 🏗️' : null);
            return;
        }
        let text;
        if (beamsSeen === 0) {
            text = '💡 Ziehe mit der Maus von einem grünen Fundament zu einem goldenen Ziel, um deine erste Strebe zu bauen.';
        } else if (beamsSeen < 4) {
            text = '💡 Gut! Dreiecke sind stabil – verbinde auch Fundamente untereinander und umschließe die Ziele mit einem Fachwerk.';
        } else {
            text = '💡 Sieht stabil aus! Drücke Leertaste für den Test – die Fahrzeuge wollen sicher hinüber.';
        }
        BB.ui.setTutorialHint(text);
    }

    function onBuild() {
        if (!active) return;
        beamsSeen++;
        update();
    }

    function onTestStart() {
        if (!active) return;
        // Beim ersten Test bleiben Hinweise aus; der Test zeigt selbst, was fehlt.
        update();
    }

    function onTestEnd(won) {
        if (!active) return;
        if (won) {
            active = false;
            ending = true;
            update();
            setTimeout(function () {
                ending = false;
                if (!active) BB.ui.setTutorialHint(null);
            }, 4000);
        }
        // Bei Niederlage bleibt der Tutor aktiv und passt die Tipps an.
    }

    /** Anzeige-Einstellung geändert -> Update. */
    function refreshSetting() {
        if (BB.storage.getSettings().tutorial === false) {
            active = false;
        }
        update();
    }

    BB.tutorial = {
        startForLevel: startForLevel,
        onBuild: onBuild,
        onTestStart: onTestStart,
        onTestEnd: onTestEnd,
        refreshSetting: refreshSetting,
        isActive: function () { return active; }
    };
})();
