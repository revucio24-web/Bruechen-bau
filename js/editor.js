/**
 * editor.js – Werkstatt: bauen, löschen, Metadaten, Export/Import.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    const HINTS = {
        anchor: 'Klick auf die Fläche setzt ein Fundament (grün).',
        target: 'Klick auf die Fläche setzt ein Ziel (gold). Ziele dürfen nicht unter die rote Linie fallen.',
        erase: 'Klick auf einen Knoten oder eine Strebe entfernt ihn.'
    };

    function saveHistory() {
        const s = BB.state;
        s.historyStack.push({
            nodes: s.nodes.map(function (n) {
                return { x: n.baseX, y: n.baseY, fixed: n.fixed, vip: n.vip, mass: n.mass };
            }),
            beams: s.beams.map(function (b) {
                return {
                    n1: s.nodes.indexOf(b.n1),
                    n2: s.nodes.indexOf(b.n2),
                    matKey: b.matKey,
                    ind: b.indestructible
                };
            })
        });
        if (s.historyStack.length > 30) s.historyStack.shift();
    }

    /** Schreibt die aktuelle Geometrie aus dem Laufzeit-Zustand ins Level-Objekt. */
    function syncGeometry() {
        const s = BB.state;
        const lvl = s.customLevel;

        lvl.anchors = s.nodes.filter(function (n) { return n.fixed; })
            .map(function (n) { return { x: n.baseX / BB.DESIGN.W, y: n.baseY / BB.DESIGN.H }; });

        lvl.targets = s.nodes.filter(function (n) { return n.vip; })
            .map(function (n) {
                return {
                    type: 'platform',
                    x: n.baseX / BB.DESIGN.W,
                    y: n.baseY / BB.DESIGN.H,
                    mass: n.mass
                };
            });
    }

    function persist() {
        syncGeometry();
        BB.storage.saveCustomLevel(BB.state.customLevel);
    }

    function undo() {
        const s = BB.state;
        if (s.simulating || s.historyStack.length === 0) return;
        const snapshot = s.historyStack.pop();
        s.dragStartNode = null;
        s.nodes = snapshot.nodes.map(function (n) {
            return BB.createNode(n.x, n.y, n.fixed, n.vip, n.mass);
        });
        s.beams = snapshot.beams.map(function (b) {
            return BB.createBeam(s.nodes[b.n1], s.nodes[b.n2], b.matKey, b.ind);
        });
        s.firstBreak = null;
        BB.playSound('delete');
        BB.game.refreshStats();
        if (s.editorMode) persist();
    }

    function reset() {
        const s = BB.state;
        if (s.simulating) BB.game.stopSimulation();
        s.dragStartNode = null;
        BB.game.setupLevelState(BB.game.getCurrentLevelData());
        BB.playSound('delete');
    }

    function toggle() {
        const s = BB.state;
        s.editorMode = !s.editorMode;
        BB.ui.setEditorActive(s.editorMode);

        if (s.editorMode) {
            if (!s.customLevel) s.customLevel = BB.createDefaultCustomLevel();
            s.editorTool = s.editorTool || 'anchor';
            BB.game.setupLevelState(s.customLevel);
            BB.ui.syncEditor(s.customLevel);
            BB.ui.setEditorTool(s.editorTool);
            BB.ui.setBriefing('🛠️ Werkstatt', 'Baue dein eigenes Level. Alles bleibt lokal – Export als .bridge-Datei.');
        } else {
            // Zurück zum zuletzt gespielten Kampagnen-Level, nicht immer zu Level 1.
            BB.game.loadLevel(s.currentLevelIdx);
        }
    }

    function setTool(toolKey) {
        BB.state.editorTool = toolKey;
        BB.ui.setEditorTool(toolKey);
        BB.ui.setBriefing('🛠️ Werkstatt', HINTS[toolKey] || '');
    }

    function applyMeta() {
        const s = BB.state;
        if (!s.editorMode || !s.customLevel) return;

        const meta = BB.ui.readEditor();
        const lvl = s.customLevel;

        lvl.title = meta.title.trim().slice(0, 120) || 'Eigenes Level';
        lvl.budget = Math.max(100, Math.min(100000, meta.budget));
        lvl.duration = Math.max(3, Math.min(60, meta.duration));
        lvl.disaster = meta.disaster;
        lvl.par = BB.defaultPar(lvl);
        s.currentLevelBudget = lvl.budget;

        BB.ui.setBriefing(lvl.title, 'Eigenes Level · ' + disasterLabel(lvl.disaster));
        BB.game.refreshStats();
        persist();
    }

    function disasterLabel(disaster) {
        return { none: 'Keine Katastrophe', earthquake: 'Erdbeben', hurricane: 'Orkan', both: 'Beben + Orkan' }[disaster] || disaster;
    }

    function place(x, y) {
        const s = BB.state;
        if (!s.editorMode) return;

        if (s.editorTool === 'anchor') {
            saveHistory();
            s.nodes.push(BB.createNode(x, y, true, false));
        } else if (s.editorTool === 'target') {
            saveHistory();
            s.nodes.push(BB.createNode(x, y, false, true, 6.2));
        } else {
            eraseAt(x, y);
            return;
        }

        BB.playSound('build');
        BB.game.refreshStats();
        persist();
    }

    function eraseAt(x, y) {
        const s = BB.state;

        // 1. Knoten?
        let nearest = null;
        let minDist = 26;
        for (let i = 0; i < s.nodes.length; i++) {
            const n = s.nodes[i];
            const d = Math.hypot(n.x - x, n.y - y);
            if (d < minDist) { minDist = d; nearest = n; }
        }

        if (nearest) {
            saveHistory();
            s.nodes = s.nodes.filter(function (n) { return n !== nearest; });
            s.beams = s.beams.filter(function (b) {
                return b.n1 !== nearest && b.n2 !== nearest;
            });
            s.dragStartNode = null;
            BB.playSound('delete');
            BB.game.refreshStats();
            persist();
            return;
        }

        // 2. Strebe?
        for (let i = s.beams.length - 1; i >= 0; i--) {
            const b = s.beams[i];
            if (BB.distToSegment({ x: x, y: y }, b.n1, b.n2) < 14) {
                saveHistory();
                s.beams.splice(i, 1);
                s.nodes = s.nodes.filter(function (n) {
                    return n.fixed || n.vip || s.beams.some(function (bm) {
                        return bm.n1 === n || bm.n2 === n;
                    });
                });
                BB.playSound('delete');
                BB.game.refreshStats();
                if (s.editorMode) persist();
                return;
            }
        }
    }

    /** Löscht nur Streben (Kampagnen-Modus). Anker und Ziele bleiben. */
    function deleteBeamAt(x, y) {
        const s = BB.state;
        for (let i = s.beams.length - 1; i >= 0; i--) {
            const b = s.beams[i];
            if (b.indestructible && !s.editorMode) continue;
            if (BB.distToSegment({ x: x, y: y }, b.n1, b.n2) < 16) {
                saveHistory();
                s.beams.splice(i, 1);
                s.nodes = s.nodes.filter(function (n) {
                    return n.fixed || n.vip || s.beams.some(function (bm) {
                        return bm.n1 === n || bm.n2 === n;
                    });
                });
                BB.playSound('delete');
                BB.game.refreshStats();
                return;
            }
        }
    }

    /* ---------- Dateien ---------- */

    function exportLevel() {
        const s = BB.state;
        if (!s.editorMode) {
            BB.ui.toast('Export gibt es nur in der Werkstatt.', true);
            return;
        }

        syncGeometry();
        const check = BB.levelFormat.validate(s.customLevel);
        if (!check.ok) {
            BB.ui.toast('Level ist ungültig: ' + check.errors[0].message, true);
            return;
        }

        const text = BB.levelFormat.toJSON(check.level);
        const name = BB.levelFormat.fileName(check.level);
        s.customLevel = check.level;

        const fallbackDownload = function () {
            if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
                BB.ui.toast('Datei-Export wird von diesem Browser nicht unterstützt.', true);
                return;
            }
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
            BB.ui.toast('Level exportiert: ' + name);
            if (BB.achievements) BB.achievements.onExport();
        };

        if (window.showSaveFilePicker) {
            window.showSaveFilePicker({
                suggestedName: name,
                types: [{ description: 'Brücken-Level', accept: { 'application/json': ['.bridge'] } }]
            }).then(function (handle) {
                return handle.createWritable().then(function (writable) {
                    return writable.write(text).then(function () { return writable.close(); });
                });
            }).then(function () {
                BB.ui.toast('Level gespeichert: ' + name);
                if (BB.achievements) BB.achievements.onExport();
            }).catch(function (err) {
                if (err && err.name === 'AbortError') return;
                fallbackDownload();
            });
        } else {
            fallbackDownload();
        }
    }

    function importText(text, sourceName) {
        const result = BB.levelFormat.fromJSON(text);
        if (!result.ok) {
            BB.ui.toast('Import fehlgeschlagen: ' + result.errors[0].message, true);
            return false;
        }

        // Eigene ID vergeben, damit importierte Level nicht kollidieren.
        const level = result.level;
        level.id = 'custom-' + Date.now().toString(36);
        level.author = 'local';

        const s = BB.state;
        s.customLevel = level;
        s.editorMode = true;
        BB.ui.setEditorActive(true);
        BB.game.setupLevelState(level);
        BB.ui.syncEditor(level);
        BB.ui.setEditorTool(s.editorTool || 'anchor');
        BB.ui.setBriefing(level.title, 'Importiert' + (sourceName ? ' aus ' + sourceName : '') + '.');
        BB.storage.saveCustomLevel(level);
        BB.ui.refreshAfterProgress();
        BB.ui.toast('Level importiert: ' + level.title);
        return true;
    }

    function importFile(file) {
        if (!file) return;
        if (file.size > BB.levelFormat.LIMITS.bytes) {
            BB.ui.toast('Datei ist zu groß (max. 512 KB).', true);
            return;
        }
        file.text().then(function (text) {
            importText(text, file.name);
        }).catch(function () {
            BB.ui.toast('Datei konnte nicht gelesen werden.', true);
        });
    }

    /** Lädt ein Level-Objekt in die Werkstatt. */
    function loadCustom(level) {
        const s = BB.state;
        s.customLevel = level;
        s.editorMode = true;
        BB.ui.setEditorActive(true);
        BB.game.setupLevelState(level);
        BB.ui.syncEditor(level);
    }

    /** Alte Share-Links (#level=...) weiterhin annehmen. */
    function loadFromHash() {
        if (!window.location.hash || window.location.hash.indexOf('level=') === -1) return false;
        try {
            const encoded = window.location.hash.split('level=')[1];
            const text = decodeURIComponent(atob(encoded));
            const result = BB.levelFormat.fromJSON(text);
            if (!result.ok) {
                console.warn('Level aus URL ungültig:', result.errors);
                return false;
            }
            loadCustom(result.level);
            BB.ui.toast('Level aus Link geladen.');
            return true;
        } catch (err) {
            console.error('Level aus URL konnte nicht geladen werden:', err);
            return false;
        }
    }

    BB.editor = {
        saveHistory: saveHistory,
        undo: undo,
        reset: reset,
        toggle: toggle,
        setTool: setTool,
        applyMeta: applyMeta,
        place: place,
        eraseAt: eraseAt,
        deleteBeamAt: deleteBeamAt,
        syncGeometry: syncGeometry,
        persist: persist,
        exportLevel: exportLevel,
        importText: importText,
        importFile: importFile,
        loadCustom: loadCustom,
        loadFromHash: loadFromHash
    };
})();
