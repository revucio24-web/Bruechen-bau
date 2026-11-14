/**
 * game.js – Zustand, Levelwechsel, Simulation und Eingaben.
 * Wird als letztes Modul geladen und startet das Spiel.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    const state = {
        W: 0, H: 0,
        view: { scale: 1, ox: 0, oy: 0 },

        currentLevelIdx: 0,
        currentLevelBudget: 0,
        currentTool: 'wood',
        editorTool: 'anchor',
        xrayMode: false,
        simulating: false,
        editorMode: false,
        simTime: 0,
        maxPeakStress: 0,
        slowMoTimer: 0,
        firstBreak: null,

        nodes: [],
        beams: [],
        historyStack: [],
        savedNodes: [],
        savedBeams: [],
        particles: [],
        debris: [],

        dragStartNode: null,
        pointerPos: { x: 0, y: 0 },
        hoveredNode: null,

        customLevel: null
    };

    BB.state = state;

    let canvas = null;
    let ctx = null;

    function getCurrentLevelData() {
        return state.editorMode ? state.customLevel : BB.LEVELS[state.currentLevelIdx];
    }

    function levelId(lvl) {
        return BB.storage.levelId(lvl, state.currentLevelIdx);
    }

    /* ---------- Ansicht ---------- */

    function updateView() {
        const scale = Math.min(state.W / BB.DESIGN.W, state.H / BB.DESIGN.H);
        state.view.scale = scale;
        state.view.ox = (state.W - BB.DESIGN.W * scale) / 2;
        state.view.oy = (state.H - BB.DESIGN.H * scale) / 2;
    }

    function toDesignPos(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - state.view.ox) / state.view.scale,
            y: (e.clientY - rect.top - state.view.oy) / state.view.scale
        };
    }

    /* ---------- HUD ---------- */

    function updateHighscoreBadge() {
        if (state.editorMode) {
            BB.ui.setHighscoreText('🛠️ Werkstatt · freies Bauen');
            return;
        }
        const lvl = getCurrentLevelData();
        const progress = BB.storage.getProgress(levelId(lvl));
        if (progress.bestCost === null) {
            BB.ui.setHighscoreText('🏆 Bestwert: Noch ungelöst');
        } else {
            BB.ui.setHighscoreText('🏆 Bestwert: ' + BB.formatMoney(progress.bestCost) +
                '  ' + starsText(progress.stars));
        }
    }

    function starsText(stars) {
        let out = '';
        for (let i = 0; i < 3; i++) out += (i < stars ? '★' : '☆');
        return out;
    }

    function refreshStats() {
        BB.ui.setStats(state, getCurrentLevelData(), BB.totalCost(state.beams));
    }

    /* ---------- Level ---------- */

    function setupLevelState(lvl) {
        BB.ui.setBriefing(
            lvl.title + (lvl.subtitle ? ' · ' + lvl.subtitle : ''),
            lvl.desc || ''
        );
        BB.ui.hideResult();
        state.simulating = false;
        BB.ui.setTestButton(false);

        state.nodes = [];
        state.beams = [];
        state.historyStack = [];
        state.particles = [];
        state.debris = [];
        state.simTime = 0;
        state.maxPeakStress = 0;
        state.slowMoTimer = 0;
        state.firstBreak = null;
        state.dragStartNode = null;
        state.hoveredNode = null;
        state.vehicles = [];
        state.vehiclesSpawned = 0;
        state.vehiclesArrived = 0;
        state.vehiclesCrashed = 0;
        state.vehiclesArrivedKinds = [];
        state.currentLevelBudget = lvl.budget;

        lvl.anchors.forEach(function (a) {
            state.nodes.push(BB.createNode(a.x * BB.DESIGN.W, a.y * BB.DESIGN.H, true, false));
        });

        const targets = [];
        lvl.targets.forEach(function (t) {
            const node = BB.createNode(
                t.x * BB.DESIGN.W,
                t.y * BB.DESIGN.H,
                false,
                true,
                typeof t.mass === 'number' ? t.mass : 6.2
            );
            state.nodes.push(node);
            targets.push(node);
        });

        for (let i = 0; i < targets.length - 1; i++) {
            state.beams.push(BB.createBeam(targets[i], targets[i + 1], 'steel', true));
        }

        updateHighscoreBadge();
        refreshStats();
        BB.ui.setTimer(lvl.duration || BB.DEFAULT_DURATION);
        layoutHud();
    }

    function loadLevel(idx) {
        const lvl = BB.LEVELS[idx];
        if (!lvl) return;

        if (!BB.storage.isUnlocked(idx)) {
            BB.ui.toast('Level ist noch gesperrt – schließe zuerst Level ' + idx + ' ab.', true);
            BB.ui.syncLevelSelect(state.currentLevelIdx);
            return;
        }

        state.currentLevelIdx = idx;
        if (state.editorMode) {
            state.editorMode = false;
            BB.ui.setEditorActive(false);
        }
        BB.ui.syncLevelSelect(idx);
        setupLevelState(lvl);
        if (BB.tutorial) BB.tutorial.startForLevel(idx);
    }

    function nextLevel() {
        const next = state.currentLevelIdx + 1;
        if (next >= BB.LEVELS.length) {
            BB.ui.toast('Alle Level geschafft. Baue eigene in der Werkstatt!');
            BB.ui.hideResult();
            return;
        }
        if (!BB.storage.isUnlocked(next)) {
            BB.ui.toast('Nächstes Level ist noch gesperrt.', true);
            return;
        }
        loadLevel(next);
    }

    /* ---------- Simulation ---------- */

    function startSimulation() {
        const cost = BB.totalCost(state.beams);
        const lvl = getCurrentLevelData();

        if (cost > lvl.budget) {
            BB.ui.toast('Über Budget: ' + BB.formatMoney(cost) + ' von ' + BB.formatMoney(lvl.budget), true);
        }

        state.savedNodes = state.nodes.map(function (n) { return Object.assign({}, n); });
        state.savedBeams = state.beams.map(function (b) {
            return {
                n1Idx: state.nodes.indexOf(b.n1),
                n2Idx: state.nodes.indexOf(b.n2),
                matKey: b.matKey,
                indestructible: b.indestructible
            };
        });
        state.simulating = true;
        state.simTime = 0;
        state.maxPeakStress = 0;
        state.slowMoTimer = 0;
        state.firstBreak = null;
        state.debris = [];
        state.dragStartNode = null;
        state.vehicles = [];
        state.vehiclesSpawned = 0;
        state.vehiclesArrived = 0;
        state.vehiclesCrashed = 0;
        state.vehiclesArrivedKinds = [];
        resetClock();
        BB.ui.hideResult();
        BB.ui.setTestButton(true);
        if (BB.tutorial) BB.tutorial.onTestStart();
    }

    function stopSimulation() {
        restoreAfterTest();
        BB.ui.hideResult();
    }

    /** Baut die Brücke nach einem Test wieder auf (vor dem Testzustand). */
    function restoreAfterTest() {
        state.simulating = false;
        state.slowMoTimer = 0;
        state.firstBreak = null;
        resetClock();

        state.nodes = state.savedNodes.map(function (n) {
            return BB.createNode(n.baseX, n.baseY, n.fixed, n.vip, n.mass);
        });
        state.beams = state.savedBeams.map(function (sb) {
            return BB.createBeam(state.nodes[sb.n1Idx], state.nodes[sb.n2Idx], sb.matKey, sb.indestructible);
        });
        state.particles = [];
        state.debris = [];
        state.vehicles = [];
        state.vehiclesSpawned = 0;
        state.vehiclesArrived = 0;
        state.vehiclesCrashed = 0;
        state.vehiclesArrivedKinds = [];
        state.maxPeakStress = 0;
        state.dragStartNode = null;

        BB.ui.setTimer(getCurrentLevelData().duration || BB.DEFAULT_DURATION);
        BB.ui.setTestButton(false);
        refreshStats();
    }

    function toggleSimulation() {
        if (state.simulating) stopSimulation();
        else startSimulation();
    }

    function endSimulation(won, msg) {
        const lvl = getCurrentLevelData();
        const cost = BB.totalCost(state.beams);
        const peak = state.maxPeakStress;
        const stars = BB.levelFormat.rate(lvl, cost, peak);
        // Fahrzeugbilanz sichern, bevor der Testzustand zurückgesetzt wird.
        const vehiclesInfo = {
            arrived: state.vehiclesArrived || 0,
            total: (lvl.vehicles && lvl.vehicles.count) || 0,
            kinds: (state.vehiclesArrivedKinds || []).slice(),
            crashed: state.vehiclesCrashed || 0
        };

        // Wichtig: Brücke sofort wieder aufbauen, sonst würde ein sofort
        // gestarteter zweiter Test (Leertaste) auf dem Wrack laufen.
        restoreAfterTest();

        const info = {
            stars: stars,
            cost: cost,
            peakStress: peak,
            budget: lvl.budget,
            par: lvl.par || BB.defaultPar(lvl),
            vehicles: vehiclesInfo,
            record: false
        };

        if (won) {
            BB.playSound('win');
            if (!state.editorMode) {
                const result = BB.storage.recordResult(levelId(lvl), stars, cost, peak);
                info.stars = result.stars;
                info.record = result.improved;
                BB.ui.refreshAfterProgress();
                BB.ui.syncLevelSelect(state.currentLevelIdx);
                updateHighscoreBadge();
            }
        }
        if (BB.achievements && !state.editorMode) {
            BB.achievements.onTestEnd({
                won: won,
                stars: stars,
                vehicles: vehiclesInfo,
                levelId: levelId(lvl)
            });
        }

        BB.ui.showResult(won, msg, info);
        if (BB.tutorial && !state.editorMode) BB.tutorial.onTestEnd(won);
    }

    /* ---------- Eingaben ---------- */

    function selectTool(toolKey) {
        if (toolKey !== 'erase' && !BB.MATERIALS[toolKey]) return;
        state.currentTool = toolKey;
        BB.ui.setToolActive(toolKey);
    }

    function toggleXray() {
        state.xrayMode = !state.xrayMode;
        BB.ui.setXrayActive(state.xrayMode);
    }

    function findNearestNode(x, y, radius) {
        let best = null;
        let minDist = radius;
        for (let i = 0; i < state.nodes.length; i++) {
            const n = state.nodes[i];
            const d = Math.hypot(n.x - x, n.y - y);
            if (d < minDist) { minDist = d; best = n; }
        }
        return best;
    }

    function onPointerMove(e) {
        const p = toDesignPos(e);
        state.pointerPos.x = p.x;
        state.pointerPos.y = p.y;
        state.hoveredNode = findNearestNode(p.x, p.y, 28);
    }

    function onPointerDown(e) {
        if (state.simulating) return;
        const p = toDesignPos(e);
        state.pointerPos.x = p.x;
        state.pointerPos.y = p.y;
        state.hoveredNode = findNearestNode(p.x, p.y, 28);

        const wantsErase = e.button === 2 ||
            state.currentTool === 'erase' ||
            (state.editorMode && state.editorTool === 'erase');

        if (wantsErase) {
            if (state.editorMode) BB.editor.eraseAt(p.x, p.y);
            else BB.editor.deleteBeamAt(p.x, p.y);
            return;
        }

        // Werkstatt: Klick auf freie Fläche setzt Fundament oder Ziel.
        if (state.editorMode && !state.hoveredNode &&
            (state.editorTool === 'anchor' || state.editorTool === 'target')) {
            BB.editor.place(p.x, p.y);
            return;
        }

        if (state.hoveredNode) state.dragStartNode = state.hoveredNode;
    }

    function onPointerUp(e) {
        if (state.simulating || !state.dragStartNode) {
            state.dragStartNode = null;
            return;
        }

        const p = toDesignPos(e);
        state.pointerPos.x = p.x;
        state.pointerPos.y = p.y;

        const mat = BB.MATERIALS[state.currentTool];
        const start = state.dragStartNode;

        if (mat) {
            const dx = p.x - start.x;
            const dy = p.y - start.y;
            const dist = Math.hypot(dx, dy);

            if (dist > 24) {
                let tx = p.x, ty = p.y;
                if (dist > mat.maxLen) {
                    const a = Math.atan2(dy, dx);
                    tx = start.x + Math.cos(a) * mat.maxLen;
                    ty = start.y + Math.sin(a) * mat.maxLen;
                }

                let endNode = findNearestNode(tx, ty, 28);
                const createdNode = !endNode;
                if (createdNode) {
                    endNode = BB.createNode(tx, ty, false, false, mat.isPendulum ? 8.5 : undefined);
                    state.nodes.push(endNode);
                }

                if (endNode !== start) {
                    const exists = state.beams.some(function (b) {
                        return (b.n1 === start && b.n2 === endNode) || (b.n1 === endNode && b.n2 === start);
                    });
                    if (!exists) {
                        // Erst jetzt in den Verlauf schreiben – nur wenn wirklich gebaut wird.
                        BB.editor.saveHistory();
                        state.beams.push(BB.createBeam(start, endNode, state.currentTool));
                        BB.playSound('build');
                        refreshStats();
                        if (BB.achievements) BB.achievements.onBeamBuilt();
                        if (BB.tutorial) BB.tutorial.onBuild();
                    } else if (createdNode) {
                        // Knoten ohne Strebe wieder entfernen.
                        state.nodes.pop();
                    }
                } else if (createdNode) {
                    state.nodes.pop();
                }
            }
        }

        state.dragStartNode = null;
    }

    function onPointerCancel() {
        state.dragStartNode = null;
    }

    function onKeyDown(e) {
        const tag = (e.target && e.target.tagName) || '';
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;

        if (e.key === 'Escape') {
            if (BB.ui.isHelpOpen()) BB.ui.closeHelp();
            else if (BB.ui.isAchOpen && BB.ui.isAchOpen()) BB.ui.closeAch();
            else BB.ui.hideResult();
            return;
        }

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            BB.editor.undo();
            return;
        }

        if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;

        if (e.key === ' ' || e.key === 'Spacebar') {
            e.preventDefault();
            toggleSimulation();
            return;
        }

        const key = e.key.toLowerCase();

        if (key >= '1' && key <= '6') {
            const matKey = BB.MATERIAL_ORDER[parseInt(key, 10) - 1];
            if (matKey) selectTool(matKey);
            return;
        }

        if (key === 'x') { toggleXray(); return; }
        if (key === 'e') { BB.editor.toggle(); return; }
        if (key === 'r') { BB.editor.reset(); return; }
        if (key === 'h' || key === '?') { BB.ui.openHelp(); return; }
    }

    function onDrop(e) {
        e.preventDefault();
        const files = e.dataTransfer && e.dataTransfer.files;
        if (files && files.length) BB.editor.importFile(files[0]);
    }

    /* Hält Briefing und Werkstatt unterhalb der oberen HUD-Leiste. Die Leiste
       bricht bei schmalen Fenstern um, deshalb wird ihre echte Höhe gemessen. */
    function layoutHud() {
        try {
            const bar = document.querySelector && document.querySelector('.top-bar');
            if (!bar || !bar.getBoundingClientRect) return;
            const rect = bar.getBoundingClientRect();
            if (!rect || !rect.bottom) return;
            document.documentElement.style.setProperty(
                '--hud-bottom', Math.round(rect.bottom + 10) + 'px');
        } catch (err) {
            /* DOM-Stubs ohne Layout dürfen das Spiel nicht stoppen. */
        }
    }

    function resize() {
        state.W = window.innerWidth;
        state.H = window.innerHeight;
        canvas.width = state.W;
        canvas.height = state.H;
        updateView();
        layoutHud();
    }

    /* Echte Frame-Zeit: Physik läuft mit fester Schrittweite, unabhängig
       von der Bildwiederholrate des Monitors. */
    let lastFrameTime = 0;
    let accumulator = 0;

    function resetClock() {
        lastFrameTime = 0;
        accumulator = 0;
    }

    function loop(timestamp) {
        const hasTime = typeof timestamp === 'number' && isFinite(timestamp);

        if (hasTime) {
            if (lastFrameTime === 0) lastFrameTime = timestamp;
            let dt = (timestamp - lastFrameTime) / 1000;
            lastFrameTime = timestamp;
            if (dt < 0) dt = 0;
            if (dt > 0.1) dt = 0.1; // Tab-Wechsel oder Hänger nicht aufholen
            accumulator += dt;
        } else {
            // Tests (und Browser ohne Zeitstempel): ein Schritt pro Frame.
            accumulator = BB.FIXED_STEP;
        }

        if (state.simulating) {
            let result = null;
            let steps = 0;

            while (accumulator >= BB.FIXED_STEP && steps < 8) {
                accumulator -= BB.FIXED_STEP;
                result = BB.stepPhysics(state, getCurrentLevelData());
                steps++;
                if (result.ended) {
                    accumulator = 0;
                    break;
                }
            }

            if (result) {
                BB.ui.setTimer(result.remaining);
                refreshStats();
                if (result.ended) {
                    endSimulation(result.ended.won, result.ended.msg);
                }
            }
        }

        BB.draw(ctx, state, getCurrentLevelData());
        requestAnimationFrame(loop);
    }

    function init() {
        canvas = document.getElementById('gameCanvas');
        ctx = canvas.getContext('2d');

        state.customLevel = BB.createDefaultCustomLevel();
        resize();
        window.addEventListener('resize', resize);

        BB.ui.init();
        BB.ui.syncEditor(state.customLevel);
        BB.ui.setToolActive(state.currentTool);
        BB.ui.setEditorTool(state.editorTool);
        layoutHud();
        window.addEventListener('load', layoutHud);

        canvas.addEventListener('pointermove', onPointerMove);
        canvas.addEventListener('pointerdown', onPointerDown);
        canvas.addEventListener('pointerup', onPointerUp);
        canvas.addEventListener('pointercancel', onPointerCancel);
        canvas.addEventListener('pointerleave', onPointerCancel);
        canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('dragover', function (e) { e.preventDefault(); });
        window.addEventListener('drop', onDrop);

        const loadedFromHash = BB.editor.loadFromHash();
        if (!loadedFromHash) loadLevel(0);

        loop();
    }

    BB.game = {
        init: init,
        loadLevel: loadLevel,
        nextLevel: nextLevel,
        setupLevelState: setupLevelState,
        getCurrentLevelData: getCurrentLevelData,
        selectTool: selectTool,
        toggleXray: toggleXray,
        toggleSimulation: toggleSimulation,
        startSimulation: startSimulation,
        stopSimulation: stopSimulation,
        endSimulation: endSimulation,
        refreshStats: refreshStats,
        updateHighscoreBadge: updateHighscoreBadge
    };

    document.addEventListener('DOMContentLoaded', init);
})();
