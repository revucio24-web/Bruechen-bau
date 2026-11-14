/**
 * ui.js – gesamter DOM-Zugriff an einer Stelle.
 * Andere Module rufen nur diese Funktionen auf.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    const el = {};
    let toastTimer = null;

    const PREVIEW_STYLE = {
        wood: 'background:#d97706',
        steel: 'background:#dc2626',
        concrete: 'background:#9ca3af;height:10px',
        cable: 'background:#38bdf8;height:4px',
        damper: 'background:repeating-linear-gradient(90deg,#facc15 0 5px,#111 5px 10px)',
        pendulum: 'background:radial-gradient(circle,#fbbf24 40%,#78350f 100%);width:12px;height:12px;border-radius:50%'
    };

    function cache() {
        el.levelSelect = document.getElementById('levelSelect');
        el.briefingTitle = document.getElementById('briefingTitle');
        el.briefingText = document.getElementById('briefingText');
        el.highscore = document.getElementById('highscoreDisplay');
        el.budget = document.getElementById('budgetDisplay');
        el.stress = document.getElementById('stressDisplay');
        el.timer = document.getElementById('timerDisplay');
        el.testBtn = document.getElementById('testBtn');
        el.toolBar = document.getElementById('toolBar');
        el.xrayBtn = document.getElementById('xrayBtn');
        el.editorBtn = document.getElementById('editorBtn');
        el.muteBtn = document.getElementById('muteBtn');
        el.helpBtn = document.getElementById('helpBtn');
        el.modal = document.getElementById('result-modal');
        el.modalTitle = document.getElementById('modalTitle');
        el.modalSub = document.getElementById('modalSub');
        el.modalStars = document.getElementById('modalStars');
        el.modalStats = document.getElementById('modalStats');
        el.editorPanel = document.getElementById('editorPanel');
        el.helpOverlay = document.getElementById('helpOverlay');
        el.helpLegend = document.getElementById('helpLegend');
        el.toast = document.getElementById('toast');
        el.edTitle = document.getElementById('edTitle');
        el.edBudget = document.getElementById('edBudget');
        el.edDuration = document.getElementById('edDuration');
        el.edDisaster = document.getElementById('edDisaster');
        el.edFileInput = document.getElementById('edFileInput');
        el.editorHint = document.getElementById('editorHint');
        el.achBtn = document.getElementById('achBtn');
        el.achOverlay = document.getElementById('achOverlay');
        el.achList = document.getElementById('achList');
        el.achStats = document.getElementById('achStats');
        el.tutorialHint = document.getElementById('tutorialHint');
        el.tutorialToggle = document.getElementById('tutorialToggle');
    }

    function starsText(stars) {
        let out = '';
        for (let i = 0; i < 3; i++) out += (i < stars ? '★' : '☆');
        return out;
    }

    function buildToolbar() {
        el.toolBar.innerHTML = '';

        BB.MATERIAL_ORDER.forEach(function (key, index) {
            const mat = BB.MATERIALS[key];
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'tool-btn';
            btn.id = 'tool-' + key;
            btn.setAttribute('data-tool', key);
            btn.innerHTML =
                '<span class="tool-key">' + (index + 1) + '</span>' +
                '<div class="mat-preview" style="' + PREVIEW_STYLE[key] + '"></div>' +
                '<span class="tool-name">' + mat.name + '</span>' +
                '<span class="tool-cost">' + BB.pricePerMeter(key) + ' $/m</span>';
            btn.addEventListener('click', function () { BB.game.selectTool(key); });
            el.toolBar.appendChild(btn);
        });

        const eraser = document.createElement('button');
        eraser.type = 'button';
        eraser.className = 'tool-btn eraser';
        eraser.id = 'tool-erase';
        eraser.setAttribute('data-tool', 'erase');
        eraser.innerHTML =
            '<div style="font-size:14px;">✂️</div>' +
            '<span class="tool-name">Abriss</span><span class="tool-cost">Löschen</span>';
        eraser.addEventListener('click', function () { BB.game.selectTool('erase'); });
        el.toolBar.appendChild(eraser);

        const test = document.createElement('button');
        test.type = 'button';
        test.className = 'action-btn btn-test';
        test.id = 'testBtn';
        test.textContent = '🚨 TESTEN';
        test.addEventListener('click', function () { BB.game.toggleSimulation(); });
        el.toolBar.appendChild(test);

        el.testBtn = test;
    }

    function buildLevelList() {
        el.levelSelect.innerHTML = '';
        BB.LEVELS.forEach(function (lvl, index) {
            const unlocked = BB.storage.isUnlocked(index);
            const progress = BB.storage.getProgress(BB.storage.levelId(lvl, index));

            const option = document.createElement('option');
            option.value = String(index);
            option.textContent = (index + 1) + '. ' + lvl.title +
                (lvl.subtitle ? ' · ' + lvl.subtitle : '') +
                '  ' + starsText(progress.stars) +
                (unlocked ? '' : ' 🔒');
            option.disabled = !unlocked;
            el.levelSelect.appendChild(option);
        });
    }

    function buildLegend() {
        el.helpLegend.innerHTML = '';
        BB.MATERIAL_ORDER.forEach(function (key) {
            const mat = BB.MATERIALS[key];
            const li = document.createElement('li');
            li.innerHTML = '<span class="swatch" style="background:' + mat.color + '"></span>' +
                mat.name + ' — ' + BB.pricePerMeter(key) + ' $/m';
            el.helpLegend.appendChild(li);
        });
    }

    const ui = {
        init: function () {
            cache();
            buildToolbar();
            buildLevelList();
            buildLegend();
            ui.bind();
            ui.setMute(BB.storage.getSettings().muted);
        },

        setBriefing: function (title, text) {
            el.briefingTitle.innerText = title;
            el.briefingText.innerText = text;
        },

        setHighscoreText: function (text) {
            el.highscore.innerText = text;
        },

        setTimer: function (seconds) {
            el.timer.innerText = seconds.toFixed(1) + 's';
        },

        setStats: function (state, lvl, cost) {
            el.budget.innerText = BB.formatMoney(cost) + ' / ' + BB.formatMoney(lvl.budget);
            el.budget.className = 'stat-value ' +
                (cost > lvl.budget ? 'over' : (cost > lvl.budget * 0.85 ? 'warn' : 'ok'));

            const pct = Math.min(100, Math.round(state.maxPeakStress * 100));
            el.stress.innerText = pct + ' %';
            el.stress.style.color = pct > 80 ? '#ef4444' : (pct > 50 ? '#f59e0b' : '#10b981');
        },

        setTestButton: function (simulating) {
            if (!el.testBtn) return;
            el.testBtn.innerText = simulating ? '⏹️ STOPP' : '🚨 TESTEN';
            el.testBtn.style.background = simulating
                ? '#475569'
                : 'linear-gradient(135deg, #ef4444, #dc2626)';
        },

        setXrayActive: function (active) {
            el.xrayBtn.classList.toggle('active', active);
        },

        setEditorActive: function (active) {
            el.editorBtn.classList.toggle('active', active);
            if (el.editorPanel) el.editorPanel.hidden = !active;
        },

        setMute: function (muted) {
            el.muteBtn.innerText = muted ? '🔇' : '🔊';
            el.muteBtn.classList.toggle('active', muted);
        },

        setToolActive: function (toolKey) {
            if (!el.toolBar) return;
            Array.prototype.forEach.call(el.toolBar.querySelectorAll('.tool-btn'), function (btn) {
                btn.classList.toggle('active', btn.getAttribute('data-tool') === toolKey);
            });
        },

        setEditorTool: function (toolKey) {
            Array.prototype.forEach.call(document.querySelectorAll('[data-edit-tool]'), function (btn) {
                btn.classList.toggle('active', btn.getAttribute('data-edit-tool') === toolKey);
            });
        },

        syncLevelSelect: function (index) {
            el.levelSelect.value = String(index);
        },

        syncEditor: function (level) {
            if (!el.edTitle) return;
            el.edTitle.value = level.title || '';
            el.edBudget.value = level.budget;
            el.edDuration.value = level.duration;
            el.edDisaster.value = level.disaster || 'none';
        },

        readEditor: function () {
            return {
                title: el.edTitle.value.trim() || 'Eigenes Level',
                budget: parseInt(el.edBudget.value, 10) || 3500,
                duration: parseInt(el.edDuration.value, 10) || 12,
                disaster: el.edDisaster.value
            };
        },

        showResult: function (won, msg, info) {
            el.modalTitle.innerText = won ? '🏆 BESTANDEN!' : '💥 EINGESTÜRZT!';
            el.modalTitle.style.color = won ? '#10b981' : '#ef4444';
            el.modalSub.innerText = msg;

            el.modalStars.innerHTML = won
                ? starsText(info.stars).slice(0, info.stars) +
                  '<span class="dim">' + starsText(info.stars).slice(info.stars) + '</span>'
                : '';

            const parts = [];
            parts.push('Kosten: <b>' + BB.formatMoney(info.cost) + '</b>' +
                (info.budget ? ' von ' + BB.formatMoney(info.budget) : ''));
            parts.push('Spitzenlast: <b>' + Math.round(info.peakStress * 100) + ' %</b>');
            if (info.par) {
                parts.push('Ziel: <b>' + BB.formatMoney(info.par.cost) + '</b> · ' +
                    Math.round(info.par.peakStress * 100) + ' %');
            }
            if (info.vehicles && info.vehicles.total > 0) {
                parts.push('Fahrzeuge: <b>' + info.vehicles.arrived + ' / ' + info.vehicles.total + '</b>');
            }
            if (won && info.record) parts.push('<span class="record">Neuer Bestwert!</span>');
            el.modalStats.innerHTML = parts.join('<br>');

            el.modal.classList.add('show');
        },

        hideResult: function () {
            el.modal.classList.remove('show');
        },

        toast: function (message, isError) {
            el.toast.innerText = message;
            el.toast.classList.toggle('error', !!isError);
            el.toast.hidden = false;
            if (toastTimer && typeof clearTimeout === 'function') clearTimeout(toastTimer);
            if (typeof setTimeout === 'function') {
                toastTimer = setTimeout(function () { el.toast.hidden = true; }, 3200);
            }
        },

        openHelp: function () {
            el.helpOverlay.hidden = false;
        },

        closeHelp: function () {
            el.helpOverlay.hidden = true;
        },

        isHelpOpen: function () {
            return el.helpOverlay.hidden === false;
        },

        /* ---------- Erfolge ---------- */

        openAch: function () {
            ui.renderAch();
            el.achOverlay.hidden = false;
        },

        closeAch: function () {
            el.achOverlay.hidden = true;
        },

        isAchOpen: function () {
            return el.achOverlay.hidden === false;
        },

        renderAch: function () {
            if (!el.achList || !BB.achievements) return;
            const stats = BB.achievements.stats();
            if (el.achStats) {
                el.achStats.innerText = stats.unlockedCount + ' von ' + stats.total +
                    ' freigeschaltet · ' + stats.counters.testsWon + ' Tests bestanden · ' +
                    stats.counters.beamsBuilt + ' Streben gebaut';
            }
            el.achList.innerHTML = '';
            BB.achievements.list().forEach(function (a) {
                const li = document.createElement('li');
                li.className = 'ach-item' + (a.unlocked ? '' : ' locked');
                li.innerHTML =
                    '<span class="ach-icon">' + (a.unlocked ? a.icon : '🔒') + '</span>' +
                    '<span class="ach-body"><b>' + a.name + '</b>' +
                    '<small>' + (a.unlocked ? a.desc + (a.when ? ' · ' + a.when : '') : a.desc) + '</small></span>';
                el.achList.appendChild(li);
            });
        },

        /* ---------- Tutorial ---------- */

        setTutorialHint: function (text) {
            if (!el.tutorialHint) return;
            if (text) {
                el.tutorialHint.innerText = text;
                el.tutorialHint.hidden = false;
            } else {
                el.tutorialHint.hidden = true;
            }
        },

        refreshAfterProgress: function () {
            buildLevelList();
        },

        bind: function () {
            el.levelSelect.addEventListener('change', function () {
                BB.game.loadLevel(parseInt(this.value, 10));
            });

            el.xrayBtn.addEventListener('click', function () { BB.game.toggleXray(); });
            el.editorBtn.addEventListener('click', function () { BB.editor.toggle(); });
            el.helpBtn.addEventListener('click', function () { ui.openHelp(); });
            if (el.achBtn) el.achBtn.addEventListener('click', function () { ui.openAch(); });

            el.muteBtn.addEventListener('click', function () {
                const settings = BB.storage.getSettings();
                settings.muted = !settings.muted;
                BB.storage.saveSettings(settings);
                ui.setMute(settings.muted);
            });

            document.getElementById('undoBtn').addEventListener('click', function () { BB.editor.undo(); });
            document.getElementById('resetBtn').addEventListener('click', function () { BB.editor.reset(); });

            document.getElementById('modalRebuildBtn').addEventListener('click', function () {
                BB.game.stopSimulation();
            });
            document.getElementById('modalNextBtn').addEventListener('click', function () {
                BB.game.nextLevel();
            });

            document.getElementById('helpCloseBtn').addEventListener('click', function () { ui.closeHelp(); });

            if (el.tutorialToggle) {
                el.tutorialToggle.checked = BB.storage.getSettings().tutorial !== false;
                el.tutorialToggle.addEventListener('change', function () {
                    const settings = BB.storage.getSettings();
                    settings.tutorial = el.tutorialToggle.checked;
                    BB.storage.saveSettings(settings);
                    if (BB.tutorial) BB.tutorial.refreshSetting();
                });
            }

            Array.prototype.forEach.call(document.querySelectorAll('[data-edit-tool]'), function (btn) {
                btn.addEventListener('click', function () {
                    BB.editor.setTool(this.getAttribute('data-edit-tool'));
                });
            });

            ['edTitle', 'edBudget', 'edDuration', 'edDisaster'].forEach(function (id) {
                const input = document.getElementById(id);
                if (input) input.addEventListener('input', function () { BB.editor.applyMeta(); });
                if (input) input.addEventListener('change', function () { BB.editor.applyMeta(); });
            });

            document.getElementById('edExportBtn').addEventListener('click', function () { BB.editor.exportLevel(); });
            document.getElementById('edImportBtn').addEventListener('click', function () { el.edFileInput.click(); });
            el.edFileInput.addEventListener('change', function () {
                if (this.files && this.files[0]) BB.editor.importFile(this.files[0]);
                this.value = '';
            });
        }
    };

    BB.ui = ui;
})();
