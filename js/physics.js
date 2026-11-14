/**
 * physics.js – Physik und Geometrie. Kennt kein DOM.
 *
 * Alle Koordinaten liegen im Design-Raum (BB.DESIGN), nicht in Fensterpixeln.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    function createNode(x, y, fixed, vip, mass) {
        return {
            x: x, y: y, baseX: x, baseY: y, vx: 0, vy: 0,
            fixed: !!fixed, vip: !!vip,
            mass: typeof mass === 'number' ? mass : (vip ? 6.2 : 1.2)
        };
    }

    function createBeam(n1, n2, matKey, indestructible) {
        const mat = BB.MATERIALS[matKey];
        if (!mat) throw new Error('Unbekanntes Material: ' + matKey);
        const len = Math.hypot(n2.x - n1.x, n2.y - n1.y);
        return {
            n1: n1, n2: n2, mat: mat, matKey: matKey,
            restLen: len, stress: 0, strain: 0, broken: false,
            indestructible: !!indestructible,
            cost: indestructible ? 0 : Math.round(len * mat.costPerPx)
        };
    }

    function totalCost(beams) {
        return beams.reduce(function (sum, b) { return sum + b.cost; }, 0);
    }

    function distToSegment(p, v, w) {
        const l2 = Math.pow(v.x - w.x, 2) + Math.pow(v.y - w.y, 2);
        if (l2 === 0) return Math.hypot(p.x - v.x, p.y - v.y);
        let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        return Math.hypot(p.x - (v.x + t * (w.x - v.x)), p.y - (v.y + t * (w.y - v.y)));
    }

    /* ---------- Fahrzeuge ---------- */

    /** Fahrzeug-Typen: Optik und Standardwerte. */
    const VEHICLE_KINDS = {
        car: { name: 'Auto', mass: 3.0, speed: 110, len: 44, cab: true },
        truck: { name: 'LKW', mass: 6.0, speed: 85, len: 62, cab: false },
        bus: { name: 'Bus', mass: 4.5, speed: 95, len: 70, cab: false }
    };
    BB.VEHICLE_KINDS = VEHICLE_KINDS;

    /**
     * Ein Testfahrzeug. Es fährt beim Belastungstest über die Ziellinie und
     * belastet die Brücke mit seinem Gewicht. Kollabiert die Fahrbahn,
     * stürzt es ab und der Test ist verloren.
     */
    function createVehicle(x, y, mass, speed, kind) {
        const base = VEHICLE_KINDS[kind] || VEHICLE_KINDS.car;
        return {
            kind: VEHICLE_KINDS[kind] ? kind : 'car',
            x: x, y: y,
            mass: typeof mass === 'number' ? mass : base.mass,
            speed: typeof speed === 'number' ? speed : base.speed,
            len: base.len,
            phase: 'drive', // drive | fall
            vx: 0, vy: 0, angle: 0
        };
    }

    /** Typ des i-ten Spawns: aus cfg.types (zyklisch) oder Basiswerte. */
    function vehicleTypeFor(cfg, index) {
        if (Array.isArray(cfg.types) && cfg.types.length) {
            const t = cfg.types[index % cfg.types.length];
            if (t && VEHICLE_KINDS[t.kind]) return t;
        }
        return { kind: 'car', mass: cfg.mass, speed: cfg.speed };
    }

    /** Fahrbahn = alle Ziel-Knoten, sortiert nach x. */
    function deckOf(state) {
        return state.nodes.filter(function (n) { return n.vip; })
            .sort(function (a, b) { return a.x - b.x; });
    }

    /** Position auf der Fahrbahn: Höhe, Steigung und Stützpunkte. */
    function deckAt(deck, x) {
        if (deck.length < 2) return null;
        const last = deck.length - 1;
        if (x <= deck[0].x) {
            return { y: deck[0].y, angle: Math.atan2(deck[1].y - deck[0].y, deck[1].x - deck[0].x), n1: deck[0], n2: deck[1], t: 0 };
        }
        if (x >= deck[last].x) return null;
        for (let i = 0; i < last; i++) {
            const a = deck[i], b = deck[i + 1];
            if (x >= a.x && x <= b.x) {
                const span = (b.x - a.x) || 1;
                const t = (x - a.x) / span;
                return {
                    y: a.y + (b.y - a.y) * t,
                    angle: Math.atan2(b.y - a.y, b.x - a.x),
                    n1: a, n2: b, t: t
                };
            }
        }
        return null;
    }

    /**
     * Fahrzeuge bewegen, belasten und Stürze erkennen.
     * @returns {null|{won: boolean, msg: string}} ended wie stepPhysics
     */
    function updateVehicles(state, lvl, timeScale) {
        const cfg = lvl.vehicles;
        if (!cfg) return null;
        if (typeof timeScale !== 'number' || !isFinite(timeScale)) timeScale = 1;

        const failLine = lvl.failY * BB.DESIGN.H;
        if (!Array.isArray(state.vehicles)) state.vehicles = [];
        if (typeof state.vehiclesSpawned !== 'number') state.vehiclesSpawned = 0;
        if (typeof state.vehiclesArrived !== 'number') state.vehiclesArrived = 0;
        if (typeof state.vehiclesCrashed !== 'number') state.vehiclesCrashed = 0;
        if (!Array.isArray(state.vehiclesArrivedKinds)) state.vehiclesArrivedKinds = [];

        const deck = deckOf(state);
        if (deck.length < 2) return null;

        // Nachschub spawnen
        const count = cfg.count || 0;
        const first = typeof cfg.first === 'number' ? cfg.first : 1.5;
        const interval = typeof cfg.interval === 'number' ? cfg.interval : 3.5;
        while (state.vehiclesSpawned < count &&
               state.simTime >= first + state.vehiclesSpawned * interval) {
            const t = vehicleTypeFor(cfg, state.vehiclesSpawned);
            state.vehicles.push(createVehicle(deck[0].x, deck[0].y, t.mass, t.speed, t.kind));
            state.vehiclesSpawned++;
        }

        let ended = null;
        const survivors = [];

        for (let i = 0; i < state.vehicles.length; i++) {
            const v = state.vehicles[i];

            if (v.phase === 'drive') {
                // Erst das Ziel prüfen: hinter dem letzten Ziel gilt "angekommen".
                if (v.x >= deck[deck.length - 1].x) {
                    state.vehiclesArrived = (state.vehiclesArrived || 0) + 1;
                    if (Array.isArray(state.vehiclesArrivedKinds)) state.vehiclesArrivedKinds.push(v.kind);
                    BB.playSound('ding');
                    continue; // angekommen, nicht mehr zeichnen
                }

                const pos = deckAt(deck, v.x);
                if (!pos || pos.n1.y > failLine || pos.n2.y > failLine) {
                    // Fahrbahn weg -> Sturz
                    v.phase = 'fall';
                    v.vx = v.speed * BB.FIXED_STEP;
                    v.vy = 0;
                    state.vehiclesCrashed = (state.vehiclesCrashed || 0) + 1;
                } else {
                    v.x += v.speed * BB.FIXED_STEP * timeScale;
                    v.y = pos.y;
                    v.angle = pos.angle;

                    // Gewicht auf die beiden Stützpunkte verteilen
                    const s1 = 1 - pos.t, s2 = pos.t;
                    if (!pos.n1.fixed) {
                        pos.n1.vy += 0.28 * timeScale * (v.mass * s1 / pos.n1.mass);
                    }
                    if (!pos.n2.fixed) {
                        pos.n2.vy += 0.28 * timeScale * (v.mass * s2 / pos.n2.mass);
                    }
                }
            }

            if (v.phase === 'fall') {
                v.vy += 0.28 * timeScale;
                v.x += v.vx * timeScale;
                v.y += v.vy * timeScale;
                v.angle += 0.06 * timeScale;
                if (v.y > failLine) {
                    ended = { won: false, msg: 'FAHRZEUG ABGESTÜRZT! Die Brücke ist nicht stabil.' };
                }
            }

            if (v.phase !== 'arrived') survivors.push(v);
        }

        state.vehicles = survivors;
        return ended;
    }

    function updateDebris(state) {
        const list = state.debris;
        for (let i = 0; i < list.length; i++) {
            const d = list[i];
            d.vy += 0.9;
            d.vx *= 0.995;
            d.x += d.vx;
            d.y += d.vy;
            d.angle += d.vAngle;
            d.life--;
        }
        state.debris = list.filter(function (d) {
            return d.life > 0 && d.y < BB.DESIGN.H + 200;
        });
        if (state.debris.length > 160) state.debris.splice(0, state.debris.length - 160);
    }

    /** Kleine Funken-Partikel an Bruchstellen. */
    function spawnSparks(state, x, y, count) {
        if (!Array.isArray(state.sparks)) state.sparks = [];
        for (let i = 0; i < count; i++) {
            const a = Math.random() * Math.PI * 2;
            const sp = 2 + Math.random() * 4;
            state.sparks.push({
                x: x, y: y,
                vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2,
                life: 20 + Math.floor(Math.random() * 18),
                hue: Math.random() < 0.7 ? '#fbbf24' : '#f87171'
            });
        }
        if (state.sparks.length > 240) state.sparks.splice(0, state.sparks.length - 240);
    }

    function updateSparks(state) {
        if (!Array.isArray(state.sparks)) return;
        const list = state.sparks;
        for (let i = 0; i < list.length; i++) {
            const p = list[i];
            p.vy += 0.22;
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
        }
        state.sparks = list.filter(function (p) { return p.life > 0; });
    }

    /** Screenshake: Intensität verfällt pro Schritt. */
    function addShake(state, amount) {
        state.shake = Math.min(1, (state.shake || 0) + amount);
    }

    function updateShake(state) {
        if (state.shake > 0) state.shake = Math.max(0, state.shake - 0.04);
    }

    /**
     * Führt einen Simulationsschritt aus.
     * @returns {{remaining: number, ended: null|{won: boolean, msg: string}}}
     */
    function stepPhysics(state, lvl) {
        const duration = lvl.duration || BB.DEFAULT_DURATION;
        const timeScale = state.slowMoTimer > 0 ? 0.25 : 1.0;
        if (state.slowMoTimer > 0) state.slowMoTimer--;
        state.simTime += BB.FIXED_STEP * timeScale;

        const remaining = Math.max(0, duration - state.simTime);

        const vehicleEnd = updateVehicles(state, lvl, timeScale);

        let quakeX = 0, quakeY = 0, windX = 0;
        if (lvl.disaster === 'earthquake' || lvl.disaster === 'both') {
            const ramp = Math.min(1, state.simTime / 3.0);
            quakeX = Math.sin(state.simTime * 9) * 11 * ramp;
            quakeY = Math.cos(state.simTime * 14) * 5 * ramp;
        }
        if (lvl.disaster === 'hurricane' || lvl.disaster === 'both') {
            windX = 0.22 * (0.6 + 0.4 * Math.sin(state.simTime * 4.5));
        }
        // Fürs Rendering (Screenshake folgt dem Beben, Windböen sichtbar).
        state.quakeOffset = { x: quakeX, y: quakeY };
        state.windX = windX;

        const subSteps = 8;
        const dt = (BB.FIXED_STEP * timeScale) / subSteps;

        for (let s = 0; s < subSteps; s++) {
            for (let i = 0; i < state.nodes.length; i++) {
                const n = state.nodes[i];
                if (n.fixed) {
                    const px = n.x, py = n.y;
                    n.x = n.baseX + quakeX;
                    n.y = n.baseY + quakeY;
                    n.vx = n.x - px;
                    n.vy = n.y - py;
                } else {
                    n.vy += 0.28 * dt;
                    n.vx += (windX / n.mass) * dt;
                    n.vx *= Math.pow(0.992, dt);
                    n.vy *= Math.pow(0.992, dt);
                    n.x += n.vx * dt;
                    n.y += n.vy * dt;
                }
            }

            for (let i = 0; i < state.beams.length; i++) {
                const b = state.beams[i];
                if (b.broken) continue;

                const dx = b.n2.x - b.n1.x;
                const dy = b.n2.y - b.n1.y;
                const dist = Math.hypot(dx, dy) || 0.0001;
                const diff = dist - b.restLen;
                const strain = diff / b.restLen;
                b.strain = strain;

                // Seile können nur Zug aufnehmen.
                if (b.mat.cable && strain < 0) {
                    b.stress = 0;
                    continue;
                }

                b.stress = strain >= 0
                    ? (strain / b.mat.maxTension)
                    : (Math.abs(strain) / b.mat.maxCompression);

                if (!b.indestructible && b.stress > state.maxPeakStress) {
                    state.maxPeakStress = b.stress;
                }

                if (!b.indestructible && b.stress >= 1.0) {
                    b.broken = true;
                    BB.playSound('snap');

                    const mx = (b.n1.x + b.n2.x) / 2;
                    const my = (b.n1.y + b.n2.y) / 2;

                    // Nur der erste Bruch wird als Ursache markiert.
                    if (!state.firstBreak) {
                        state.firstBreak = { x: mx, y: my, matKey: b.matKey, stress: b.stress };
                    }

                    if (state.slowMoTimer === 0) state.slowMoTimer = 40;

                    spawnSparks(state, mx, my, 8);
                    addShake(state, 0.35);

                    state.debris.push({
                        x: mx, y: my,
                        vx: (Math.random() - 0.5) * 5, vy: -2,
                        angle: Math.atan2(dy, dx), vAngle: 0.12,
                        len: b.restLen * 0.45,
                        color: b.mat.color, thickness: b.mat.thickness,
                        life: 240
                    });
                    continue;
                }

                const nx = dx / dist;
                const ny = dy / dist;
                const rvx = b.n2.vx - b.n1.vx;
                const rvy = b.n2.vy - b.n1.vy;
                const damp = (rvx * nx + rvy * ny) * (b.mat.isDamper ? 3.2 : 0.8);
                const force = (diff * b.mat.stiffness) + damp;

                if (!b.n1.fixed) {
                    b.n1.vx += (nx * force / b.n1.mass) * dt;
                    b.n1.vy += (ny * force / b.n1.mass) * dt;
                }
                if (!b.n2.fixed) {
                    b.n2.vx -= (nx * force / b.n2.mass) * dt;
                    b.n2.vy -= (ny * force / b.n2.mass) * dt;
                }
            }
        }

        updateDebris(state);
        updateSparks(state);
        updateShake(state);

        if (vehicleEnd) {
            addShake(state, 0.9);
            return { remaining: remaining, ended: vehicleEnd };
        }

        const failLine = lvl.failY * BB.DESIGN.H;
        for (let i = 0; i < state.nodes.length; i++) {
            const n = state.nodes[i];
            if (n.vip && n.y > failLine) {
                return {
                    remaining: remaining,
                    ended: { won: false, msg: 'EINGESTÜRZT! Die Plattform ist in die Tiefe gestürzt.' }
                };
            }
        }

        if (remaining <= 0) {
            return {
                remaining: 0,
                ended: { won: true, msg: 'Meisterleistung! Das Gebäude hat die Katastrophe überstanden.' }
            };
        }

        return { remaining: remaining, ended: null };
    }

    BB.createNode = createNode;
    BB.createBeam = createBeam;
    BB.createVehicle = createVehicle;
    BB.updateVehicles = updateVehicles;
    BB.totalCost = totalCost;
    BB.distToSegment = distToSegment;
    BB.stepPhysics = stepPhysics;
})();
