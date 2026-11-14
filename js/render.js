/**
 * render.js – zeichnet den aktuellen Zustand auf den Canvas.
 * Liest nur, verändert nichts.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    function heatmapColor(stress) {
        const s = Math.min(1, Math.max(0, stress));
        if (s < 0.5) {
            return 'rgb(' + Math.round(16 + s * 2 * 229) + ',' + Math.round(185 - s * 2 * 27) + ',129)';
        }
        return 'rgb(245,' + Math.round(158 * (1 - (s - 0.5) * 2)) + ',68)';
    }

    function money(value) {
        return Math.round(value).toLocaleString('de-DE') + ' $';
    }

    function drawGround(ctx, lvl, qX, qY) {
        lvl.ground.forEach(function (poly) {
            ctx.beginPath();
            poly.forEach(function (pt, i) {
                const px = pt.x * BB.DESIGN.W + qX;
                const py = pt.y * BB.DESIGN.H + qY;
                if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.fillStyle = '#334155';
            ctx.fill();
            ctx.lineWidth = 5;
            ctx.strokeStyle = '#10b981';
            ctx.stroke();
        });
    }

    function drawBeams(ctx, state) {
        for (let i = 0; i < state.beams.length; i++) {
            const b = state.beams[i];
            if (b.broken) continue;

            const x1 = b.n1.x, y1 = b.n1.y, x2 = b.n2.x, y2 = b.n2.y;
            const midX = (x1 + x2) / 2, midY = (y1 + y2) / 2;
            const dx = x2 - x1, dy = y2 - y1;
            const len = Math.hypot(dx, dy) || 1;
            const nx = -dy / len, ny = dx / len;

            let curve = 0;
            if (b.mat.cable && b.strain < 0) {
                curve = Math.min(40, Math.abs(b.strain) * 180);
            } else if (b.strain < 0 && !b.indestructible) {
                curve = b.stress * 20;
            }

            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(midX + nx * curve, midY + ny * curve, x2, y2);

            if (state.xrayMode) {
                ctx.strokeStyle = heatmapColor(b.stress);
                ctx.lineWidth = b.mat.thickness;
                ctx.stroke();
            } else {
                ctx.strokeStyle = b.indestructible ? '#fbbf24' : b.mat.border;
                ctx.lineWidth = b.mat.thickness + 4;
                ctx.stroke();

                ctx.strokeStyle = b.indestructible
                    ? '#f59e0b'
                    : (b.stress > 0.75 ? '#ef4444' : b.mat.color);
                ctx.lineWidth = b.mat.thickness;
                ctx.stroke();
            }
        }
    }

    function drawDebris(ctx, state) {
        for (let i = 0; i < state.debris.length; i++) {
            const d = state.debris[i];
            const half = d.len / 2;
            const cos = Math.cos(d.angle);
            const sin = Math.sin(d.angle);
            ctx.strokeStyle = d.color;
            ctx.lineWidth = Math.max(2, d.thickness - 2);
            ctx.beginPath();
            ctx.moveTo(d.x - cos * half, d.y - sin * half);
            ctx.lineTo(d.x + cos * half, d.y + sin * half);
            ctx.stroke();
        }
    }

    /** Testfahrzeuge auf der Fahrbahn (nur während der Simulation). */
    function drawVehicles(ctx, state) {
        if (!state.simulating) return;
        const list = state.vehicles || [];
        for (let i = 0; i < list.length; i++) {
            const v = list[i];
            const L = v.len || 44;            // Fahrzeuglänge
            const half = L / 2;
            const bodyTop = -16, bodyH = 13;  // Karosserie-Lage (Ursprung = Fahrbahn)
            ctx.save();
            ctx.translate(v.x, v.y);
            ctx.rotate(v.angle);

            if (v.kind === 'truck') {
                // Ladefläche
                ctx.fillStyle = '#94a3b8';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                ctx.beginPath();
                rr(ctx, -half, bodyTop - 12, L * 0.62, bodyH + 12, 3);
                ctx.fill();
                ctx.stroke();
                // Führerhaus
                ctx.fillStyle = '#dc2626';
                ctx.beginPath();
                rr(ctx, half - L * 0.34, bodyTop, L * 0.34, bodyH, 3);
                ctx.fill();
                // Fenster
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                rr(ctx, half - L * 0.30, bodyTop - 9, L * 0.22, 9, 2);
                ctx.fill();
            } else if (v.kind === 'bus') {
                ctx.fillStyle = '#f59e0b';
                ctx.strokeStyle = '#92400e';
                ctx.lineWidth = 2;
                ctx.beginPath();
                rr(ctx, -half, bodyTop - 12, L, bodyH + 12, 6);
                ctx.fill();
                ctx.stroke();
                // Fensterband
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                rr(ctx, -half + 7, bodyTop - 9, L - 14, 8, 3);
                ctx.fill();
            } else {
                // Auto (Standard)
                ctx.fillStyle = '#e2e8f0';
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2;
                ctx.beginPath();
                rr(ctx, -half, bodyTop, L, bodyH, 4);
                ctx.fill();
                ctx.stroke();
                // Kabine
                ctx.fillStyle = '#94a3b8';
                ctx.beginPath();
                rr(ctx, -10, -27, 20, 11, 3);
                ctx.fill();
                // Fenster
                ctx.fillStyle = '#38bdf8';
                ctx.beginPath();
                rr(ctx, -7, -25, 14, 7, 2);
                ctx.fill();
            }

            // Räder (alle Typen)
            ctx.fillStyle = '#0f172a';
            ctx.beginPath();
            ctx.arc(-half + 9, -4, 5, 0, Math.PI * 2);
            ctx.arc(half - 9, -4, 5, 0, Math.PI * 2);
            ctx.fill();

            // Scheinwerfer
            ctx.fillStyle = '#fde047';
            ctx.beginPath();
            ctx.arc(half - 1, -11, 2.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
    }

    /** Abgerundetes Rechteck mit Fallback. */
    function rr(ctx, x, y, w, h, r) {
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
        else ctx.rect(x, y, w, h);
    }

    /** Funken an Bruchstellen. */
    function drawSparks(ctx, state) {
        const list = state.sparks;
        if (!list || !list.length) return;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            ctx.globalAlpha = Math.max(0, Math.min(1, p.life / 24));
            ctx.fillStyle = p.hue;
            ctx.beginPath();
            ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    /** Sichtbare Windböen (Streichen, die von links ziehen). */
    function drawWind(ctx, state, lvl) {
        if (!state.simulating || !state.windX) return;
        if (lvl.disaster !== 'hurricane' && lvl.disaster !== 'both') return;
        const t = (state.simTime || 0) * 60;
        ctx.strokeStyle = 'rgba(148, 197, 253, 0.22)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 7; i++) {
            const y = 120 + i * 105 + Math.sin(t / 40 + i * 1.7) * 18;
            const speed = 6 + state.windX * 260;
            const x = 1700 - ((t * speed / 6 + i * 260) % 2100);
            const len = 60 + (i % 3) * 34;
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + len, y - 3);
            ctx.stroke();
        }
    }

    function drawNodes(ctx, state) {
        for (let i = 0; i < state.nodes.length; i++) {
            const n = state.nodes[i];
            if (n.vip) {
                ctx.fillStyle = '#fbbf24';
                ctx.strokeStyle = '#92400e';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(n.x, n.y - 12, 13, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.arc(n.x, n.y, n.fixed ? 9 : 6.5, 0, Math.PI * 2);
            ctx.fillStyle = n.fixed ? '#10b981' : (n.vip ? '#f59e0b' : '#e2e8f0');
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#0f172a';
            ctx.stroke();
        }
    }

    function drawDragPreview(ctx, state) {
        if (state.simulating || !state.dragStartNode || state.currentTool === 'erase') return;

        const mat = BB.MATERIALS[state.currentTool];
        if (!mat) return;

        const start = state.dragStartNode;
        let tx = state.pointerPos.x, ty = state.pointerPos.y;
        const dist = Math.hypot(tx - start.x, ty - start.y);
        const clamped = dist > mat.maxLen;

        if (clamped) {
            const a = Math.atan2(ty - start.y, tx - start.x);
            tx = start.x + Math.cos(a) * mat.maxLen;
            ty = start.y + Math.sin(a) * mat.maxLen;
        }

        const shownLen = Math.min(dist, mat.maxLen);
        const cost = Math.round(shownLen * mat.costPerPx);
        const remaining = state.currentLevelBudget - BB.totalCost(state.beams);
        const tooExpensive = cost > remaining;

        ctx.setLineDash([6, 6]);
        ctx.strokeStyle = clamped ? '#f59e0b' : mat.color;
        ctx.lineWidth = mat.thickness;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);

        // Kostenanzeige am Zeiger
        const meters = (shownLen / BB.PX_PER_METER).toFixed(1).replace('.', ',');
        const label = cost.toLocaleString('de-DE') + ' $ · ' + meters + ' m' + (clamped ? ' (max)' : '');
        ctx.font = '700 20px system-ui, sans-serif';
        const width = ctx.measureText(label).width + 24;

        let bx = tx + 18;
        let by = ty - 44;
        if (bx + width > BB.DESIGN.W) bx = tx - width - 18;

        ctx.fillStyle = tooExpensive ? 'rgba(127, 29, 29, 0.96)' : 'rgba(15, 23, 42, 0.92)';
        ctx.strokeStyle = tooExpensive ? '#ef4444' : 'rgba(148, 163, 184, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(bx, by, width, 34, 8);
        } else {
            ctx.rect(bx, by, width, 34);
        }
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = tooExpensive ? '#fecaca' : '#e2e8f0';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, bx + 12, by + 18);
    }

    function drawBreakMarker(ctx, state) {
        const mark = state.firstBreak;
        if (!mark || state.simulating) return;

        ctx.save();
        ctx.translate(mark.x, mark.y);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(0, 0, 22, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-10, -10); ctx.lineTo(10, 10);
        ctx.moveTo(10, -10); ctx.lineTo(-10, 10);
        ctx.stroke();

        ctx.font = '700 18px system-ui, sans-serif';
        ctx.fillStyle = '#fecaca';
        ctx.textAlign = 'center';
        ctx.fillText('Bruchstelle', 0, -34);
        ctx.textAlign = 'start';
        ctx.restore();
    }

    function draw(ctx, state, lvl) {
        const view = state.view;

        ctx.fillStyle = state.xrayMode ? '#091526' : (state.simulating ? '#1a162b' : '#0f172a');
        ctx.fillRect(0, 0, state.W, state.H);

        ctx.save();
        ctx.translate(view.ox, view.oy);
        ctx.scale(view.scale, view.scale);
        ctx.beginPath();
        ctx.rect(0, 0, BB.DESIGN.W, BB.DESIGN.H);
        ctx.clip();

        const failY = lvl.failY * BB.DESIGN.H;
        ctx.setLineDash([8, 8]);
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, failY);
        ctx.lineTo(BB.DESIGN.W, failY);
        ctx.stroke();
        ctx.setLineDash([]);

        const qX = state.simulating && state.nodes[0] ? (state.nodes[0].x - state.nodes[0].baseX) : 0;
        const qY = state.simulating && state.nodes[0] ? (state.nodes[0].y - state.nodes[0].baseY) : 0;

        // Screenshake: Beben + Bruch-Spitzen lassen die Kamera wackeln.
        if (state.simulating && (state.shake || 0) > 0.001) {
            const amp = state.shake * 7;
            ctx.translate((Math.random() - 0.5) * amp, (Math.random() - 0.5) * amp);
        }

        drawGround(ctx, lvl, qX, qY);
        drawWind(ctx, state, lvl);
        drawBeams(ctx, state);
        drawVehicles(ctx, state);
        drawDebris(ctx, state);
        drawSparks(ctx, state);
        drawDragPreview(ctx, state);
        drawNodes(ctx, state);
        drawBreakMarker(ctx, state);

        ctx.restore();
    }

    BB.draw = draw;
    BB.heatmapColor = heatmapColor;
    BB.formatMoney = money;
})();
