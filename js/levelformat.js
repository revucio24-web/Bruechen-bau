/**
 * levelformat.js – Lesen, Prüfen und Schreiben von `.bridge`-Dateien.
 *
 * Grundsatz: Fremde Dateien sind nicht vertrauenswürdig. Jede Datei wird
 * vollständig validiert, bevor sie den Spielzustand berührt.
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    const FORMAT = 'bridge-level';
    const VERSION = 1;

    const LIMITS = {
        bytes: 512 * 1024,
        anchors: 60,
        targets: 20,
        nodes: 80,
        polygons: 8,
        pointsPerPolygon: 64,
        title: 120,
        subtitle: 40,
        desc: 400,
        budgetMin: 100,
        budgetMax: 100000,
        durationMin: 3,
        durationMax: 60,
        massMin: 0.5,
        massMax: 50,
        vehicleTypes: 12
    };

    const DISASTERS = ['none', 'earthquake', 'hurricane', 'both'];

    function err(code, message) {
        return { code: code, message: message };
    }

    function isNumber(v) {
        return typeof v === 'number' && isFinite(v);
    }

    function isPoint(p) {
        return p && typeof p === 'object' && isNumber(p.x) && isNumber(p.y) &&
            p.x >= 0 && p.x <= 1 && p.y >= 0 && p.y <= 1;
    }

    function checkPoints(list, label, errors) {
        if (!Array.isArray(list)) {
            errors.push(err('E004', label + ': Liste fehlt.'));
            return false;
        }
        for (let i = 0; i < list.length; i++) {
            if (!isPoint(list[i])) {
                errors.push(err('E005', label + ': Punkt ' + (i + 1) + ' liegt nicht in 0..1.'));
                return false;
            }
        }
        return true;
    }

    /** Prüft ein geparstes Objekt gegen das Level-Schema. */
    function validate(raw) {
        const errors = [];

        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            return { ok: false, errors: [err('E001', 'Datei enthält kein Level-Objekt.')] };
        }
        if (raw.format !== FORMAT) {
            return { ok: false, errors: [err('E002', 'Kein Brücken-Level (format = "' + FORMAT + '").')] };
        }
        if (!isNumber(raw.version) || raw.version < 1) {
            return { ok: false, errors: [err('E004', 'Versionsnummer fehlt.')] };
        }
        if (raw.version > VERSION) {
            return {
                ok: false,
                errors: [err('E003', 'Level wurde mit Version ' + raw.version + ' erstellt, unterstützt wird ' + VERSION + '.')]
            };
        }

        if (typeof raw.title !== 'string' || !raw.title.trim()) {
            errors.push(err('E004', 'Titel fehlt.'));
        } else if (raw.title.length > LIMITS.title) {
            errors.push(err('E011', 'Titel ist länger als ' + LIMITS.title + ' Zeichen.'));
        }

        if (!isNumber(raw.budget) || raw.budget < LIMITS.budgetMin || raw.budget > LIMITS.budgetMax) {
            errors.push(err('E007', 'Budget muss zwischen ' + LIMITS.budgetMin + ' und ' + LIMITS.budgetMax + ' liegen.'));
        }

        if (!isNumber(raw.duration) || raw.duration < LIMITS.durationMin || raw.duration > LIMITS.durationMax) {
            errors.push(err('E007', 'Dauer muss zwischen ' + LIMITS.durationMin + ' und ' + LIMITS.durationMax + ' s liegen.'));
        }

        if (DISASTERS.indexOf(raw.disaster) === -1) {
            errors.push(err('E010', 'Unbekannte Katastrophe: ' + String(raw.disaster)));
        }

        if (!isNumber(raw.failY) || raw.failY < 0.05 || raw.failY > 0.99) {
            errors.push(err('E005', 'failY muss zwischen 0.05 und 0.99 liegen.'));
        }

        // Boden
        if (!Array.isArray(raw.ground) || raw.ground.length === 0) {
            errors.push(err('E004', 'Boden fehlt.'));
        } else if (raw.ground.length > LIMITS.polygons) {
            errors.push(err('E009', 'Zu viele Bodenflächen (max. ' + LIMITS.polygons + ').'));
        } else {
            for (let i = 0; i < raw.ground.length; i++) {
                const poly = raw.ground[i];
                if (!Array.isArray(poly) || poly.length < 3) {
                    errors.push(err('E004', 'Bodenfläche ' + (i + 1) + ' braucht mindestens 3 Punkte.'));
                    break;
                }
                if (poly.length > LIMITS.pointsPerPolygon) {
                    errors.push(err('E009', 'Bodenfläche ' + (i + 1) + ' hat zu viele Punkte.'));
                    break;
                }
                if (!checkPoints(poly, 'Bodenfläche ' + (i + 1), errors)) break;
            }
        }

        // Anker
        if (!Array.isArray(raw.anchors) || raw.anchors.length === 0) {
            errors.push(err('E008', 'Mindestens ein Fundament ist nötig.'));
        } else if (raw.anchors.length > LIMITS.anchors) {
            errors.push(err('E009', 'Zu viele Fundamente (max. ' + LIMITS.anchors + ').'));
        }

        // Ziele
        if (!Array.isArray(raw.targets) || raw.targets.length === 0) {
            errors.push(err('E008', 'Mindestens ein Ziel ist nötig.'));
        } else if (raw.targets.length > LIMITS.targets) {
            errors.push(err('E009', 'Zu viele Ziele (max. ' + LIMITS.targets + ').'));
        }

        if (errors.length === 0) {
            checkPoints(raw.anchors, 'Fundamente', errors);

            for (let i = 0; i < raw.targets.length; i++) {
                const t = raw.targets[i];
                if (!isPoint(t)) {
                    errors.push(err('E005', 'Ziel ' + (i + 1) + ' liegt nicht in 0..1.'));
                    break;
                }
                if (!isNumber(t.mass) || t.mass < LIMITS.massMin || t.mass > LIMITS.massMax) {
                    errors.push(err('E007', 'Ziel ' + (i + 1) + ': Masse muss zwischen ' +
                        LIMITS.massMin + ' und ' + LIMITS.massMax + ' liegen.'));
                    break;
                }
            }

            const nodeCount = raw.anchors.length + raw.targets.length;
            if (nodeCount > LIMITS.nodes) {
                errors.push(err('E009', 'Zu viele Knoten (' + nodeCount + ', max. ' + LIMITS.nodes + ').'));
            }
        }

        if (raw.par !== undefined) {
            if (!raw.par || typeof raw.par !== 'object' ||
                !isNumber(raw.par.cost) || raw.par.cost <= 0 ||
                !isNumber(raw.par.peakStress) || raw.par.peakStress <= 0 || raw.par.peakStress > 1) {
                errors.push(err('E007', 'par.cost/par.peakStress sind ungültig.'));
            }
        }

        // Fahrzeuge (optional)
        if (raw.vehicles !== undefined) {
            const v = raw.vehicles;
            if (!v || typeof v !== 'object' || Array.isArray(v)) {
                errors.push(err('E004', 'vehicles muss ein Objekt sein.'));
            } else {
                if (v.mass !== undefined && (!isNumber(v.mass) || v.mass < LIMITS.massMin || v.mass > LIMITS.massMax)) {
                    errors.push(err('E007', 'vehicles.mass muss zwischen ' +
                        LIMITS.massMin + ' und ' + LIMITS.massMax + ' liegen.'));
                }
                if (v.speed !== undefined && (!isNumber(v.speed) || v.speed < 20 || v.speed > 400)) {
                    errors.push(err('E007', 'vehicles.speed muss zwischen 20 und 400 liegen.'));
                }
                if (!isNumber(v.count) || v.count < 0 || v.count > 12 || v.count % 1 !== 0) {
                    errors.push(err('E007', 'vehicles.count muss eine ganze Zahl zwischen 0 und 12 sein.'));
                }
                if (v.first !== undefined && (!isNumber(v.first) || v.first < 0 || v.first > LIMITS.durationMax)) {
                    errors.push(err('E007', 'vehicles.first muss zwischen 0 und ' + LIMITS.durationMax + ' liegen.'));
                }
                if (v.interval !== undefined && (!isNumber(v.interval) || v.interval < 0.5 || v.interval > LIMITS.durationMax)) {
                    errors.push(err('E007', 'vehicles.interval muss zwischen 0.5 und ' + LIMITS.durationMax + ' liegen.'));
                }
                // Fahrzeug-Typen (optional)
                if (v.types !== undefined) {
                    if (!Array.isArray(v.types)) {
                        errors.push(err('E004', 'vehicles.types muss eine Liste sein.'));
                    } else {
                        if (v.types.length > LIMITS.vehicleTypes) {
                            errors.push(err('E009', 'Zu viele Fahrzeug-Typen (max. ' + LIMITS.vehicleTypes + ').'));
                        }
                        const kinds = Object.keys((BB.VEHICLE_KINDS) || { car: 1, truck: 1, bus: 1 });
                        for (let i = 0; i < v.types.length && i < LIMITS.vehicleTypes; i++) {
                            const t = v.types[i];
                            if (!t || typeof t !== 'object' || Array.isArray(t)) {
                                errors.push(err('E004', 'Fahrzeug-Typ ' + (i + 1) + ' muss ein Objekt sein.'));
                                break;
                            }
                            if (kinds.indexOf(t.kind) === -1) {
                                errors.push(err('E007', 'Unbekannter Fahrzeug-Typ: ' + String(t.kind)));
                                break;
                            }
                            if (!isNumber(t.mass) || t.mass < LIMITS.massMin || t.mass > LIMITS.massMax) {
                                errors.push(err('E007', 'Fahrzeug-Typ ' + (i + 1) + ': Masse zwischen ' +
                                    LIMITS.massMin + ' und ' + LIMITS.massMax + '.'));
                                break;
                            }
                            if (!isNumber(t.speed) || t.speed < 20 || t.speed > 400) {
                                errors.push(err('E007', 'Fahrzeug-Typ ' + (i + 1) + ': Tempo zwischen 20 und 400.'));
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (errors.length) return { ok: false, errors: errors };
        return { ok: true, errors: [], level: sanitize(raw) };
    }

    /** Baut aus gültigen Rohdaten ein sauberes Level-Objekt. */
    function sanitize(raw) {
        return {
            format: FORMAT,
            version: VERSION,
            id: typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim().slice(0, 64) : 'custom-' + Date.now().toString(36),
            author: typeof raw.author === 'string' ? raw.author.slice(0, 40) : 'local',
            title: raw.title.trim().slice(0, LIMITS.title),
            subtitle: typeof raw.subtitle === 'string' ? raw.subtitle.slice(0, LIMITS.subtitle) : '',
            desc: typeof raw.desc === 'string' ? raw.desc.slice(0, LIMITS.desc) : '',
            budget: Math.round(raw.budget),
            duration: Math.round(raw.duration),
            disaster: raw.disaster,
            failY: raw.failY,
            ground: raw.ground.map(function (poly) {
                return poly.map(function (p) { return { x: p.x, y: p.y }; });
            }),
            anchors: raw.anchors.map(function (p) { return { x: p.x, y: p.y }; }),
            targets: raw.targets.map(function (t) {
                return {
                    type: typeof t.type === 'string' ? t.type.slice(0, 16) : 'platform',
                    x: t.x, y: t.y,
                    mass: t.mass
                };
            }),
            par: raw.par ? {
                cost: Math.round(raw.par.cost),
                peakStress: raw.par.peakStress
            } : BB.defaultPar(raw),
            vehicles: raw.vehicles ? {
                mass: raw.vehicles.mass,
                speed: raw.vehicles.speed,
                count: raw.vehicles.count,
                first: raw.vehicles.first !== undefined ? raw.vehicles.first : 1.5,
                interval: raw.vehicles.interval !== undefined ? raw.vehicles.interval : 3.5,
                types: Array.isArray(raw.vehicles.types) ? raw.vehicles.types.map(function (t) {
                    return { kind: t.kind, mass: t.mass, speed: t.speed };
                }) : undefined
            } : undefined
        };
    }

    /** Standardvorgabe für Sterne, wenn ein Level keine par-Werte hat. */
    BB.defaultPar = function (level) {
        return {
            cost: Math.round(level.budget * 0.75),
            peakStress: 0.60
        };
    };

    function fromJSON(text) {
        if (typeof text !== 'string' || text.length === 0) {
            return { ok: false, errors: [err('E001', 'Datei ist leer.')] };
        }
        if (text.length > LIMITS.bytes) {
            return { ok: false, errors: [err('E009', 'Datei ist zu groß (max. 512 KB).')] };
        }
        let raw;
        try {
            raw = JSON.parse(text);
        } catch (parseError) {
            return { ok: false, errors: [err('E001', 'Datei ist kein gültiges JSON.')] };
        }
        return validate(raw);
    }

    function toJSON(level) {
        return JSON.stringify({
            format: FORMAT,
            version: VERSION,
            id: level.id,
            author: level.author || 'local',
            title: level.title,
            subtitle: level.subtitle || '',
            desc: level.desc || '',
            budget: level.budget,
            duration: level.duration,
            disaster: level.disaster,
            failY: level.failY,
            par: level.par || BB.defaultPar(level),
            vehicles: level.vehicles,
            ground: level.ground,
            anchors: level.anchors,
            targets: level.targets
        }, null, 2);
    }

    /** Dateiname aus dem Titel bauen. */
    function fileName(level) {
        const base = String(level.title || 'level')
            .toLowerCase()
            .replace(/[äöüß]/g, function (c) { return { 'ä': 'ae', 'ö': 'oe', 'ü': 'ue', 'ß': 'ss' }[c]; })
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 48) || 'level';
        return base + '.bridge';
    }

    /** Sterne aus Kosten und Spitzenlast. */
    function rate(level, cost, peakStress) {
        const par = level.par || BB.defaultPar(level);
        let stars = 1;
        if (cost <= par.cost) stars++;
        if (peakStress <= par.peakStress) stars++;
        return stars;
    }

    BB.levelFormat = {
        FORMAT: FORMAT,
        VERSION: VERSION,
        LIMITS: LIMITS,
        DISASTERS: DISASTERS,
        validate: validate,
        sanitize: sanitize,
        fromJSON: fromJSON,
        toJSON: toJSON,
        fileName: fileName,
        rate: rate
    };
})();
