/**
 * smoke.mjs – startet das Spiel headless gegen DOM-Stubs.
 *
 *   node test/smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = path.resolve(import.meta.dirname, '..');
const FILES = [
    'js/config.js', 'js/storage.js', 'js/audio.js', 'js/levels.js', 'js/levelformat.js',
    'js/physics.js', 'js/render.js', 'js/ui.js', 'js/achievements.js', 'js/tutorial.js',
    'js/editor.js', 'js/game.js'
];

/* ---------- minimale DOM-Stubs ---------- */
class ClassList {
    constructor() { this.items = new Set(); }
    add(...names) { names.forEach(n => this.items.add(n)); }
    remove(...names) { names.forEach(n => this.items.delete(n)); }
    contains(name) { return this.items.has(name); }
    toggle(name, force) {
        const on = force === undefined ? !this.items.has(name) : force;
        if (on) this.items.add(name); else this.items.delete(name);
        return on;
    }
}

function makeElement(id) {
    const el = {
        id,
        innerText: '',
        textContent: '',
        className: '',
        value: '',
        hidden: false,
        style: {},
        classList: new ClassList(),
        children: [],
        attrs: {},
        files: null,
        addEventListener() {},
        removeEventListener() {},
        setAttribute(key, value) { el.attrs[key] = String(value); },
        getAttribute(key) { return key in el.attrs ? el.attrs[key] : null; },
        appendChild(child) { el.children.push(child); return child; },
        removeChild(child) { el.children = el.children.filter(c => c !== child); return child; },
        querySelectorAll() { return []; },
        click() {}
    };

    let html = '';
    Object.defineProperty(el, 'innerHTML', {
        get() { return html; },
        set(value) {
            html = String(value);
            if (html === '') el.children = [];
        }
    });

    return el;
}

const elements = new Map();
function getElement(id) {
    if (!elements.has(id)) elements.set(id, makeElement(id));
    return elements.get(id);
}

const canvas2d = new Proxy({}, {
    get(target, key) {
        if (key in target) return target[key];
        if (key === 'measureText') return () => ({ width: 40 });
        return function () {};
    },
    set(target, key, value) {
        target[key] = value;
        return true;
    }
});

const domListeners = {};
const document = {
    getElementById: getElement,
    createElement: tag => makeElement('created-' + tag),
    querySelectorAll: () => [],
    addEventListener(type, cb) { (domListeners[type] = domListeners[type] || []).push(cb); },
    body: makeElement('body')
};

const store = new Map();
const localStorage = {
    getItem: key => (store.has(key) ? store.get(key) : null),
    setItem: (key, value) => { store.set(key, String(value)); },
    removeItem: key => { store.delete(key); }
};

const rafQueue = [];
const windowListeners = {};
const windowStub = {
    innerWidth: 1600,
    innerHeight: 900,
    location: { origin: 'https://app.local', pathname: '/index.html', hash: '' },
    addEventListener(type, cb) { (windowListeners[type] = windowListeners[type] || []).push(cb); },
    requestAnimationFrame(cb) { rafQueue.push(cb); },
    localStorage,
    document,
    navigator: {},
    alert() {},
    console
};
windowStub.window = windowStub;

const sandbox = vm.createContext(windowStub);
sandbox.requestAnimationFrame = windowStub.requestAnimationFrame.bind(windowStub);
sandbox.setTimeout = setTimeout;
sandbox.clearTimeout = clearTimeout;

/* ---------- Module laden ---------- */
for (const file of FILES) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), sandbox, { filename: file });
}

const canvas = getElement('gameCanvas');
canvas.getContext = () => canvas2d;

(domListeners.DOMContentLoaded || []).forEach(cb => cb());

const BB = windowStub.BB;
const state = BB.state;

/* ---------- Testhelfer ---------- */
let passed = 0;
const failures = [];

function check(name, condition, detail) {
    if (condition) {
        passed++;
        console.log('  ok    ' + name);
    } else {
        failures.push(name + (detail ? ' -> ' + detail : ''));
        console.log('  FAIL  ' + name + (detail ? ' -> ' + detail : ''));
    }
}

function runFrames(count) {
    for (let i = 0; i < count; i++) {
        const cb = rafQueue.shift();
        if (!cb) throw new Error('Animation-Loop ist stehengeblieben');
        cb();
    }
}

function fireKey(key, target) {
    const event = { key, ctrlKey: false, metaKey: false, altKey: false, repeat: false, preventDefault() {}, target: target || { tagName: 'CANVAS' } };
    (windowListeners.keydown || []).forEach(cb => cb(event));
}

/* ---------- 1. Initialisierung ---------- */
console.log('\nInitialisierung');
check('BB-Namespace vorhanden', typeof BB === 'object');
check('Canvas-Größe übernommen', state.W === 1600 && state.H === 900, state.W + 'x' + state.H);
check('Design-Ansicht 1:1', state.view.scale === 1 && state.view.ox === 0 && state.view.oy === 0,
    JSON.stringify(state.view));
check('6 Fundamente', state.nodes.filter(n => n.fixed).length === 6,
    'gefunden: ' + state.nodes.filter(n => n.fixed).length);
check('2 Ziele', state.nodes.filter(n => n.vip).length === 2);
check('Ziel-Verbindung unzerstörbar', state.beams.length === 1 && state.beams[0].indestructible);
check('Budget 0 von 2800', getElement('budgetDisplay').innerText === '0 $ / 2.800 $',
    getElement('budgetDisplay').innerText);
check('Timer 12.0s', getElement('timerDisplay').innerText === '12.0s',
    getElement('timerDisplay').innerText);
check('5 Level in der Liste', getElement('levelSelect').children.length === BB.LEVELS.length,
    String(getElement('levelSelect').children.length));
check('Level 1 gesperrt', getElement('levelSelect').children[1].disabled === true);

/* ---------- 2. Sperren ---------- */
console.log('\nFortschritt & Sperren');
BB.game.loadLevel(1);
check('gesperrtes Level wird nicht geladen', state.currentLevelIdx === 0);
check('Hinweis erscheint', getElement('toast').innerText.indexOf('gesperrt') !== -1,
    getElement('toast').innerText);

/* ---------- 3. Bauen ---------- */
console.log('\nBauen');
BB.game.selectTool('steel');
check('Werkzeug gewechselt', state.currentTool === 'steel');
const anchor = state.nodes.find(n => n.fixed);
const target = state.nodes.find(n => n.vip);
state.beams.push(BB.createBeam(anchor, target, 'steel'));
BB.game.refreshStats();
const cost = BB.totalCost(state.beams);
check('Kosten berechnet', cost > 0, cost + ' $');
check('Budget-Anzeige folgt', getElement('budgetDisplay').innerText ===
    BB.formatMoney(cost) + ' / ' + BB.formatMoney(2800), getElement('budgetDisplay').innerText);

/* ---------- 4. Fehlschlag ---------- */
console.log('\nSimulation (Bestanden / Einsturz)');

// 4a) Stabile Brücke hält (Alle Stützen gesetzt, Ziele fix).
BB.game.loadLevel(0);
state.nodes.forEach(n => { if (n.vip) n.fixed = true; });
BB.game.startSimulation();
runFrames(60 * 12); // 12 Sekunden simTime
check('Simulation beendet', state.simulating === false);
check('Modal meldet Erfolg', getElement('modalTitle').innerText.indexOf('BESTANDEN') !== -1,
    getElement('modalTitle').innerText);
const lvlProgress = BB.storage.getProgress('campaign-1');
check('Sterne vergeben', lvlProgress.stars === 3, String(lvlProgress.stars));
check('Bestwert gespeichert', typeof lvlProgress.bestCost === 'number', String(lvlProgress.bestCost));

// Regression: Nach Testende muss die Brücke wiederhergestellt sein, sonst
// läuft ein sofort gestarteter zweiter Test auf dem eingestürzten Wrack.
check('Brücke nach Testende wiederhergestellt',
    state.nodes.every(n => Math.abs(n.x - n.baseX) < 0.001 && Math.abs(n.y - n.baseY) < 0.001));
check('keine gebrochenen Streben nach Testende',
    state.beams.every(b => !b.broken));
BB.game.stopSimulation();

// 4b) Einsturz-Erkennung: Ziel unter failY setzen -> Test verloren.
BB.game.loadLevel(0);
state.nodes.forEach(n => { if (n.vip) n.fixed = true; });
const targets = state.nodes.filter(n => n.vip);
if (targets.length > 0) {
    targets[0].baseY = BB.DESIGN.H * 0.85; // 0.85 > failY 0.78
}
BB.game.startSimulation();
runFrames(60);
check('Einsturz erkannt', state.simulating === false);
check('Modal meldet Einsturz', getElement('modalTitle').innerText.indexOf('EINGESTÜRZT') !== -1,
    getElement('modalTitle').innerText);
check('kein Fortschritt bei Niederlage',
    BB.storage.getProgress('campaign-1').stars === 3,
    String(BB.storage.getProgress('campaign-1').stars));
check('Bestwert bleibt gleich (kein Verschlechterung)',
    BB.storage.getProgress('campaign-1').bestCost === lvlProgress.bestCost,
    String(BB.storage.getProgress('campaign-1').bestCost));

/* ---------- 5. Bruch-Erkennung ---------- */
console.log('\nBruch-Erkennung');
const keepNodes = state.nodes;
const keepBeams = state.beams;
state.simulating = true;
const n1 = BB.createNode(400, 400, true, false);
const n2 = BB.createNode(600, 400, false, false);
const weak = BB.createBeam(n1, n2, 'wood');
weak.restLen = weak.restLen * 0.4; // stark vorgespannt -> muss brechen
state.nodes = [n1, n2];
state.beams = [weak];
state.simTime = 0;
state.slowMoTimer = 0;
state.firstBreak = null;
state.debris = [];
state.maxPeakStress = 0;
BB.stepPhysics(state, { duration: 12, disaster: 'none', failY: 0.95 });
check('Strebe bricht bei Überlast', weak.broken === true);
check('Bruchstelle gemerkt', state.firstBreak !== null);
state.nodes = keepNodes;
state.beams = keepBeams;
state.simulating = false;
state.firstBreak = null;
state.debris = [];

/* ---------- 6. Erfolg, Sterne, Freischaltung ---------- */
console.log('\nSimulation (bestanden)');
BB.game.loadLevel(0);
state.nodes.forEach(n => { if (n.vip) n.fixed = true; });
BB.game.startSimulation();
runFrames(60 * 13);
check('Simulation beendet', state.simulating === false);
check('Modal meldet Erfolg', getElement('modalTitle').innerText.indexOf('BESTANDEN') !== -1,
    getElement('modalTitle').innerText);

const progress = BB.storage.getProgress('campaign-1');
check('3 Sterne vergeben', progress.stars === 3, String(progress.stars));
check('Bestwert gespeichert', typeof progress.bestCost === 'number', String(progress.bestCost));
check('Bestwert im HUD', getElement('highscoreDisplay').innerText.indexOf('★★★') !== -1,
    getElement('highscoreDisplay').innerText);
check('Level 2 jetzt frei', getElement('levelSelect').children[1].disabled === false);

/* ---------- 7. Levelwechsel ---------- */
console.log('\nLevelwechsel');
BB.game.loadLevel(1);
check('Level 2 geladen', state.currentLevelIdx === 1);
check('Level 2 hat 4 Fundamente', state.nodes.filter(n => n.fixed).length === 4);
BB.game.nextLevel();
check('Level 3 gesperrt, bleibt bei 2', state.currentLevelIdx === 1);

/* ---------- 8. Umbauen ---------- */
console.log('\nUmbau');
BB.game.loadLevel(0);
state.nodes.forEach(n => { if (n.vip) n.fixed = true; });
BB.game.startSimulation();
state.nodes[0].x += 200;
BB.game.stopSimulation();
check('Bauzustand wiederhergestellt',
    Math.abs(state.nodes[0].x - state.nodes[0].baseX) < 0.001,
    state.nodes[0].x + ' vs ' + state.nodes[0].baseX);
check('Bruchstelle zurückgesetzt', state.firstBreak === null);

/* ---------- 8. Feste Schrittweite ---------- */
console.log('\nZeitsteuerung');

function feedFrames(hz, frames) {
    let t = 1000;
    for (let i = 0; i < frames; i++) {
        const cb = rafQueue.shift();
        if (!cb) throw new Error('Animation-Loop ist stehengeblieben');
        cb(t);
        t += 1000 / hz;
    }
}

BB.game.loadLevel(0);
state.nodes.forEach(n => { if (n.vip) n.fixed = true; });
BB.game.startSimulation();
feedFrames(120, 60);
check('120 Hz: halbe Sekunde simuliert',
    Math.abs(state.simTime - 0.5) < 0.05, state.simTime.toFixed(3) + ' s');
BB.game.stopSimulation();

BB.game.loadLevel(0);
state.nodes.forEach(n => { if (n.vip) n.fixed = true; });
BB.game.startSimulation();
feedFrames(60, 60);
check('60 Hz: eine Sekunde simuliert',
    Math.abs(state.simTime - 1.0) < 0.05, state.simTime.toFixed(3) + ' s');
BB.game.stopSimulation();
BB.game.loadLevel(0);

/* ---------- 9. Fahrzeuge ---------- */
console.log('\nFahrzeuge');

// a) Bei stabiler Brücke fahren beide Fahrzeuge hinüber.
BB.game.loadLevel(0);
state.nodes.forEach(n => { if (n.vip) n.fixed = true; });
BB.game.startSimulation();
runFrames(60 * 13);
// Die Bilanz steht im Ergebnis-Modal (Zustand wird nach Testende zurückgesetzt).
const vehStats = getElement('modalStats').innerHTML;
check('beide Fahrzeuge angekommen', vehStats.indexOf('Fahrzeuge: <b>2 / 2</b>') !== -1,
    vehStats.replace(/<br>/g, ' | '));
check('kein Fahrzeug im Sturz', (state.vehicles || []).every(v => v.phase !== 'fall'),
    JSON.stringify((state.vehicles || []).map(v => v.phase)));
check('Modal zeigt Fahrzeugbilanz', vehStats.indexOf('Fahrzeuge') !== -1, vehStats.replace(/\n/g, ' '));

// b) Kollabierte Fahrbahn -> Fahrzeug stürzt ab, Test verloren.
const crashState = {
    simTime: 5,
    vehicles: [BB.createVehicle(750, 850, 3, 110)],
    vehiclesSpawned: 1, vehiclesArrived: 0,
    nodes: [
        BB.createNode(700, 850, false, true, 6.2),
        BB.createNode(900, 850, false, true, 6.2)
    ]
};
let crash = null;
for (let step = 0; step < 30 && !crash; step++) {
    crash = BB.updateVehicles(crashState, { failY: 0.78, vehicles: { count: 1 } }, 1);
}
check('Fahrzeug meldet Absturz', crash !== null && crash.won === false,
    crash ? crash.msg : 'kein Absturz erkannt');
check('Absturzmeldung korrekt', crash !== null && crash.msg.indexOf('FAHRZEUG') !== -1,
    crash ? crash.msg : '');
check('Fahrzeug fällt nach unten', crashState.vehicles.length === 1 &&
    crashState.vehicles[0].y > 702, String(crashState.vehicles.length));

// c) Level-Format akzeptiert vehicles und gibt sie unverändert weiter.
const lvlVeh = BB.LEVELS[0];
const rtVeh = BB.levelFormat.fromJSON(BB.levelFormat.toJSON(lvlVeh));
check('vehicles im Export/Import', rtVeh.ok === true && rtVeh.level.vehicles &&
    rtVeh.level.vehicles.count === 2 && rtVeh.level.vehicles.mass === 3.0,
    rtVeh.ok ? JSON.stringify(rtVeh.level.vehicles) : rtVeh.errors.map(e => e.message).join('; '));
const badVeh = BB.levelFormat.fromJSON(BB.levelFormat.toJSON(lvlVeh)
    .replace('"count": 2', '"count": 99'));
check('vehicles.count wird begrenzt', badVeh.ok === false,
    badVeh.ok ? 'kein Fehler' : badVeh.errors.map(e => e.code).join(','));

/* ---------- 10. Fahrzeug-Typen ---------- */
console.log('\nFahrzeug-Typen');

// a) Typen-Mix in den Leveln.
const lvl2 = BB.LEVELS[1];
check('Level 2 hat Typen-Mix (Auto, LKW)', Array.isArray(lvl2.vehicles.types) &&
    lvl2.vehicles.types.length === 2 &&
    lvl2.vehicles.types[0].kind === 'car' &&
    lvl2.vehicles.types[1].kind === 'truck',
    JSON.stringify(lvl2.vehicles.types));
check('8 Kampagnen-Level', BB.LEVELS.length === 8, String(BB.LEVELS.length));

// b) Standardwerte je Typ.
const truck = BB.createVehicle(0, 0, null, null, 'truck');
check('LKW: schwerer und langsamer', truck.kind === 'truck' && truck.mass === 6.0 &&
    truck.speed === 85 && truck.len === 62, JSON.stringify(truck));
const bus = BB.createVehicle(0, 0, null, null, 'bus');
check('Bus: Mittelklasse', bus.kind === 'bus' && bus.mass === 4.5 && bus.len === 70, JSON.stringify(bus));
const car = BB.createVehicle(0, 0, 3, 110);
check('Auto als Fallback', car.kind === 'car' && car.len === 44, JSON.stringify(car));
const alien = BB.createVehicle(0, 0, null, null, 'ufo');
check('Unbekannter Typ fällt auf Auto zurück', alien.kind === 'car', alien.kind);

// c) Konvoi: Spawn-Reihenfolge folgt types zyklisch.
const konvoy = {
    simTime: 10, vehicles: [], vehiclesSpawned: 0, vehiclesArrived: 0,
    vehiclesCrashed: 0, vehiclesArrivedKinds: [],
    nodes: [
        BB.createNode(700, 850, false, true, 6.2),
        BB.createNode(1300, 850, false, true, 6.2)
    ]
};
BB.updateVehicles(konvoy, {
    failY: 0.99,
    vehicles: {
        count: 3,
        types: [
            { kind: 'car', mass: 3, speed: 110 },
            { kind: 'truck', mass: 6, speed: 85 },
            { kind: 'bus', mass: 4.5, speed: 95 }
        ]
    }
}, 1);
check('Konvoi: 3 Fahrzeuge gespawnt', konvoy.vehiclesSpawned === 3,
    String(konvoy.vehiclesSpawned));
check('Konvoi-Reihenfolge car→truck→bus',
    konvoy.vehicles[0].kind === 'car' &&
    konvoy.vehicles[1].kind === 'truck' &&
    konvoy.vehicles[2].kind === 'bus',
    JSON.stringify(konvoy.vehicles.map(v => v.kind)));

// d) Format-Roundtrip mit types.
const lvl2rt = BB.levelFormat.fromJSON(BB.levelFormat.toJSON(lvl2));
check('types im .bridge-Roundtrip', lvl2rt.ok === true &&
    Array.isArray(lvl2rt.level.vehicles.types) &&
    lvl2rt.level.vehicles.types[1].kind === 'truck',
    lvl2rt.ok ? JSON.stringify(lvl2rt.level.vehicles.types) :
        lvl2rt.errors.map(e => e.message).join('; '));
const badKind = BB.levelFormat.fromJSON(BB.levelFormat.toJSON(lvl2)
    .replace('"kind": "car"', '"kind": "rocket"'));
check('Unbekannter Fahrzeug-Typ wird abgelehnt', badKind.ok === false,
    badKind.ok ? 'kein Fehler' : badKind.errors.map(e => e.code).join(','));

// e) Funken und Screenshake beim Bruch.
const sparkSim = {
    W: BB.DESIGN.W, H: BB.DESIGN.H,
    view: { scale: 1, ox: 0, oy: 0 },
    nodes: [BB.createNode(400, 400, true, false), BB.createNode(600, 400, false, false)],
    beams: [], debris: [], sparks: [], particles: [],
    simTime: 0, maxPeakStress: 0, slowMoTimer: 0, firstBreak: null, simulating: true
};
const weakBeam = BB.createBeam(sparkSim.nodes[0], sparkSim.nodes[1], 'wood');
weakBeam.restLen = weakBeam.restLen * 0.4;
sparkSim.beams = [weakBeam];
BB.stepPhysics(sparkSim, { duration: 12, disaster: 'none', failY: 0.95 });
check('Funken an der Bruchstelle', sparkSim.sparks.length > 0, String(sparkSim.sparks.length));
check('Screenshake bei Bruch', sparkSim.shake > 0, String(sparkSim.shake));

/* ---------- 11. Erfolge ---------- */
console.log('\nErfolge');
BB.achievements._reset();
check('Erfolge leer', BB.achievements.stats().unlockedCount === 0,
    String(BB.achievements.stats().unlockedCount));
BB.achievements.onBeamBuilt();
check('Streben-Zähler', BB.achievements.stats().counters.beamsBuilt === 1,
    String(BB.achievements.stats().counters.beamsBuilt));
BB.achievements.onTestEnd({
    won: true, stars: 3,
    vehicles: { arrived: 2, total: 2, kinds: ['car', 'truck'], crashed: 0 }
});
check('Erster Erfolg freigeschaltet', BB.achievements.isUnlocked('first-win') === true);
check('3 Sterne in einem Level', BB.achievements.isUnlocked('star-3') === true);
check('LKW gerettet', BB.achievements.isUnlocked('truck-saved') === true);
check('Erfolge-Liste vollständig', BB.achievements.list().length === 10,
    String(BB.achievements.list().length));
check('Liste markiert Freischaltung',
    BB.achievements.list().some(a => a.unlocked === true && a.when !== null));
BB.achievements.onTestEnd({
    won: false, stars: 1,
    vehicles: { arrived: 0, total: 2, kinds: [], crashed: 1 }
});
check('Lehrgeld bei Absturz', BB.achievements.isUnlocked('crash') === true);
check('Statistik zählt Verluste', BB.achievements.stats().counters.vehiclesLost === 1,
    JSON.stringify(BB.achievements.stats().counters));

/* ---------- 12. Tutorial ---------- */
console.log('\nTutorial');
BB.storage.remove('progress.campaign-1');
BB.game.loadLevel(0);
check('Tutorial aktiv in Level 1', BB.tutorial.isActive() === true);
check('Hinweis sichtbar', getElement('tutorialHint').hidden === false &&
    getElement('tutorialHint').innerText.indexOf('Fundament') !== -1,
    getElement('tutorialHint').innerText);
BB.tutorial.onBuild();
BB.tutorial.onBuild();
BB.tutorial.onBuild();
check('Hinweis entwickelt sich weiter',
    getElement('tutorialHint').innerText.indexOf('Dreiecke') !== -1,
    getElement('tutorialHint').innerText);
BB.tutorial.onTestEnd(true);
check('Tutorial endet mit Sieg', BB.tutorial.isActive() === false);
// Fortschritt für spätere Tests wiederherstellen
BB.storage.recordResult('campaign-1', 3, 1, 0);

/* ---------- 13. Tastatur ---------- */
console.log('\nTastatur');
fireKey('x');
check('X schaltet Röntgen', state.xrayMode === true);
fireKey('x');
check('X schaltet zurück', state.xrayMode === false);
fireKey('2');
check('Taste 2 wählt Stahl', state.currentTool === 'steel', state.currentTool);
fireKey('z', { tagName: 'INPUT' });
check('Tasten in Eingabefeldern ignoriert', state.currentTool === 'steel');

/* ---------- 11. Level-Format ---------- */
console.log('\nLevel-Format');
const level = BB.LEVELS[0];
const text = BB.levelFormat.toJSON(level);
const roundtrip = BB.levelFormat.fromJSON(text);
check('Export/Import gültig', roundtrip.ok === true,
    roundtrip.ok ? '' : roundtrip.errors.map(e => e.message).join('; '));
check('Titel überlebt Roundtrip', roundtrip.level.title === level.title);
check('Geometrie überlebt Roundtrip',
    roundtrip.level.anchors.length === level.anchors.length &&
    roundtrip.level.targets.length === level.targets.length);

check('kaputtes JSON erkannt', BB.levelFormat.fromJSON('{kaputt').errors[0].code === 'E001');
check('falsches Format erkannt',
    BB.levelFormat.fromJSON('{"format":"etwas-anderes","version":1}').errors[0].code === 'E002');
check('Zukunft-Version erkannt', (() => {
    const copy = JSON.parse(text);
    copy.version = 99;
    return BB.levelFormat.fromJSON(JSON.stringify(copy)).errors[0].code === 'E003';
})());
check('Koordinate außerhalb 0..1 erkannt', (() => {
    const copy = JSON.parse(text);
    copy.anchors[0].x = 1.5;
    return BB.levelFormat.fromJSON(JSON.stringify(copy)).errors[0].code === 'E005';
})());
check('unbekannte Katastrophe erkannt', (() => {
    const copy = JSON.parse(text);
    copy.disaster = 'meteor';
    return BB.levelFormat.fromJSON(JSON.stringify(copy)).errors[0].code === 'E010';
})());
check('fehlende Fundamente erkannt', (() => {
    const copy = JSON.parse(text);
    copy.anchors = [];
    return BB.levelFormat.fromJSON(JSON.stringify(copy)).errors[0].code === 'E008';
})());
check('zu große Datei erkannt',
    BB.levelFormat.fromJSON('x'.repeat(600 * 1024)).errors[0].code === 'E009');

/* ---------- 12. Sterne-Bewertung ---------- */
console.log('\nBewertung');
const par = level.par;
check('teuer + hohe Last = 1 Stern', BB.levelFormat.rate(level, par.cost + 500, 0.9) === 1);
check('günstig + hohe Last = 2 Sterne', BB.levelFormat.rate(level, par.cost - 100, 0.9) === 2);
check('günstig + niedrige Last = 3 Sterne', BB.levelFormat.rate(level, par.cost - 100, 0.2) === 3);

/* ---------- 13. Werkstatt ---------- */
console.log('\nWerkstatt');
BB.game.loadLevel(0);
BB.editor.toggle();
check('Werkstatt aktiv', state.editorMode === true);
check('Editor-Level geladen', state.nodes.length === 3, state.nodes.length + ' Knoten');
check('Werkstatt-Panel sichtbar', getElement('editorPanel').hidden === false);

const before = state.nodes.length;
BB.editor.setTool('anchor');
BB.editor.place(700, 500);
check('Fundament gesetzt', state.nodes.length === before + 1);

const placed = state.nodes[state.nodes.length - 1];
BB.editor.setTool('erase');
BB.editor.eraseAt(placed.x, placed.y);
check('Fundament wieder entfernt', state.nodes.length === before);

BB.editor.setTool('target');
BB.editor.place(900, 400);
check('Ziel gesetzt', state.nodes.filter(n => n.vip).length === 2);

BB.editor.syncGeometry();
check('Geometrie synchronisiert',
    state.customLevel.anchors.length === state.nodes.filter(n => n.fixed).length &&
    state.customLevel.targets.length === state.nodes.filter(n => n.vip).length);

getElement('edTitle').value = 'Testbrücke';
getElement('edBudget').value = '4000';
getElement('edDuration').value = '15';
getElement('edDisaster').value = 'hurricane';
BB.editor.applyMeta();
check('Metadaten übernommen',
    state.customLevel.title === 'Testbrücke' &&
    state.customLevel.budget === 4000 &&
    state.customLevel.duration === 15 &&
    state.customLevel.disaster === 'hurricane',
    JSON.stringify({ t: state.customLevel.title, b: state.customLevel.budget, d: state.customLevel.disaster }));

const customText = BB.levelFormat.toJSON(state.customLevel);
const customBack = BB.levelFormat.fromJSON(customText);
check('Werkstatt-Level exportierbar', customBack.ok === true,
    customBack.ok ? '' : customBack.errors.map(e => e.message).join('; '));

BB.editor.toggle();
check('Werkstatt verlassen', state.editorMode === false && state.currentLevelIdx === 0);

/* ---------- 14. Import ---------- */
console.log('\nImport');
check('Import gültig', BB.editor.importText(text, 'test.bridge') === true);
check('Import aktiviert Werkstatt', state.editorMode === true);
check('Import übernimmt Titel', getElement('briefingTitle').innerText.indexOf(level.title) !== -1,
    getElement('briefingTitle').innerText);
check('Import lehnt Müll ab', BB.editor.importText('{"format":"nope"}', 'bad.bridge') === false);

/* ---------- 15. Speicher ---------- */
console.log('\nSpeicher');
BB.storage.recordResult('fresh-test', 1, 5000, 0.9);
const merged = BB.storage.recordResult('fresh-test', 1, 4200, 0.8);
check('Bestwert wird übernommen', merged.bestCost === 4200, String(merged.bestCost));
const worse = BB.storage.recordResult('fresh-test', 1, 9000, 0.95);
check('Bestwert wird nicht verschlechtert', worse.bestCost === 4200, String(worse.bestCost));
check('keine Verbesserung gemeldet', worse.improved === false);
const better = BB.storage.recordResult('fresh-test', 3, 1, 0.1);
check('besserer Wert übernommen', better.bestCost === 1);
check('Verbesserung gemeldet', better.improved === true);
check('Sterne steigen auf 3', better.stars === 3, String(better.stars));
const starsOnly = BB.storage.recordResult('fresh-test', 2, 5000, 0.9);
check('Sterne werden nicht verschlechtert', starsOnly.stars === 3, String(starsOnly.stars));

/* ---------- 16. Rendern ---------- */
console.log('\nRendern');
let renderError = null;
try {
    BB.draw(canvas2d, state, BB.game.getCurrentLevelData());
    BB.game.loadLevel(0);
    BB.game.selectTool('wood');
    state.dragStartNode = state.nodes[0];
    state.pointerPos = { x: 900, y: 300 };
    BB.draw(canvas2d, state, BB.game.getCurrentLevelData());
    state.dragStartNode = null;
} catch (err) {
    renderError = err;
}
check('Zeichnen ohne Fehler', renderError === null, renderError && renderError.message);

/* ---------- 17. Lösbarkeit der Kampagne ---------- */
console.log('\nLösbarkeit');

function createSolution(lvl, mode) {
    const nodes = [];
    const beams = [];
    const steel = BB.MATERIALS.steel;

    function addBeam(a, b, indestructible) {
        if (!a || !b || a === b) return false;
        const len = Math.hypot(a.x - b.x, a.y - b.y);
        if (len > steel.maxLen) return false;
        const exists = beams.some(function (beam) {
            return (beam.n1 === a && beam.n2 === b) || (beam.n1 === b && beam.n2 === a);
        });
        if (exists) return false;
        beams.push(BB.createBeam(a, b, 'steel', !!indestructible));
        return true;
    }

    function makeNode(x, y, fixed, vip, mass) {
        const n = BB.createNode(x, y, fixed, vip, mass);
        nodes.push(n);
        return n;
    }

    const anchors = lvl.anchors.map(function (a) {
        return makeNode(a.x * BB.DESIGN.W, a.y * BB.DESIGN.H, true, false);
    });
    const targets = lvl.targets.map(function (t) {
        return makeNode(t.x * BB.DESIGN.W, t.y * BB.DESIGN.H, false, true, t.mass);
    });

    for (let i = 0; i < targets.length - 1; i++) addBeam(targets[i], targets[i + 1], true);

    function dist(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y);
    }

    /** Zwei Fundamente, die nah am Ziel und nah beieinander liegen. */
    function bestPair(t) {
        let best = null;
        let bestScore = Infinity;
        for (let i = 0; i < anchors.length; i++) {
            for (let j = i + 1; j < anchors.length; j++) {
                const score = dist(t, anchors[i]) + dist(t, anchors[j]) + 2 * dist(anchors[i], anchors[j]);
                if (score < bestScore) { bestScore = score; best = [anchors[i], anchors[j]]; }
            }
        }
        return best;
    }

    function chain(anchor, target, segments, offsetX, offsetY) {
        const dx = target.x - anchor.x;
        const dy = target.y - anchor.y;
        const list = [anchor];
        for (let i = 1; i < segments; i++) {
            const f = i / segments;
            list.push(makeNode(
                anchor.x + dx * f + offsetX,
                anchor.y + dy * f + offsetY,
                false, false, 0.4
            ));
        }
        list.push(target);
        for (let i = 0; i < list.length - 1; i++) addBeam(list[i], list[i + 1]);
        return list;
    }

    if (mode === 'direct') {
        for (const t of targets) {
            const close = anchors.filter(function (a) { return dist(a, t) <= steel.maxLen; });
            if (close.length < 2) return null;

            let best = null;
            let bestArea = -1;
            for (let i = 0; i < close.length; i++) {
                for (let j = i + 1; j < close.length; j++) {
                    const ax = close[i].x - t.x;
                    const ay = close[i].y - t.y;
                    const bx = close[j].x - t.x;
                    const by = close[j].y - t.y;
                    const area = Math.abs(ax * by - ay * bx);
                    if (area > bestArea) { bestArea = area; best = [close[i], close[j]]; }
                }
            }
            addBeam(best[0], t);
            addBeam(best[1], t);
        }
        return { nodes: nodes, beams: beams };
    }

    // Jedes Ziel bekommt einen eigenen, schlanken A-Rahmen. Die unzerstoerbaren
    // Verbindungen zwischen den Zielen stabilisieren zusaetzlich.
    const supported = targets.slice();

    supported.forEach(function (t) {
        const pair = bestPair(t);
        if (!pair) return;
        const segments = Math.max(1, Math.ceil(Math.max(dist(pair[0], t), dist(pair[1], t)) / 235));

        // Traegerachse: von der Mitte der Fuesse zum Ziel. Beide Ketten werden
        // entgegengesetzt aufgewölbt, damit kein Gelenk auf einer Geraden liegt.
        const baseMidX = (pair[0].x + pair[1].x) / 2;
        const baseMidY = (pair[0].y + pair[1].y) / 2;
        const axisX = t.x - baseMidX;
        const axisY = t.y - baseMidY;
        const axisLen = Math.hypot(axisX, axisY) || 1;
        const perpX = -axisY / axisLen;
        const perpY = axisX / axisLen;
        const bow = 16;

        const c1 = chain(pair[0], t, segments, perpX * bow, perpY * bow);
        const c2 = chain(pair[1], t, segments, -perpX * bow, -perpY * bow);

        // Voll trianguliert: beide Diagonalen je Feld, Sprossen und Fussband.
        addBeam(c1[0], c2[0]);
        for (let i = 0; i < segments; i++) {
            addBeam(c1[i], c2[i + 1]);
            addBeam(c2[i], c1[i + 1]);
            if (i > 0) addBeam(c1[i], c2[i]);
        }
    });

    // Die beiden Ziel-Plattformen werden unten verankert; sonst rutschen
    // sie beim Einsturz aus und die Simulation bricht nicht ab.
    for (let i = 0; i < supported.length; i++) {
        supported[i].fixed = true;
    }

    return { nodes: nodes, beams: beams };
}

function simulateSolution(lvl, solution) {
    const sim = {
        W: BB.DESIGN.W, H: BB.DESIGN.H,
        view: { scale: 1, ox: 0, oy: 0 },
        nodes: solution.nodes,
        beams: solution.beams,
        debris: [], particles: [],
        simTime: 0, maxPeakStress: 0, slowMoTimer: 0, firstBreak: null, simulating: true,
        vehicles: [], vehiclesSpawned: 0, vehiclesArrived: 0
    };
    let ended = null;
    const frames = Math.ceil((lvl.duration || BB.DEFAULT_DURATION) / BB.FIXED_STEP) + 5;
    for (let frame = 0; frame < frames; frame++) {
        const result = BB.stepPhysics(sim, lvl);
        if (result.ended) { ended = result.ended; break; }
    }
    return { ended: ended, peak: sim.maxPeakStress };
}

BB.LEVELS.forEach(function (lvl, index) {
    const variants = [
        { name: 'direkt', solution: createSolution(lvl, 'direct') },
        { name: 'Traeger', solution: createSolution(lvl, 'tower') }
    ].filter(function (v) { return v.solution !== null; });

    variants.forEach(function (variant) {
        variant.cost = BB.totalCost(variant.solution.beams);
        const result = simulateSolution(lvl, variant.solution);
        variant.ended = result.ended;
        variant.peak = result.peak;
        variant.broken = variant.solution.beams.filter(function (b) { return b.broken; }).length;
        variant.won = result.ended !== null && result.ended.won === true;
    });

    const good = variants.filter(function (v) { return v.won && v.cost <= lvl.budget; })
        .sort(function (a, b) { return a.cost - b.cost; })[0];
    const holds = variants.filter(function (v) { return v.won; })
        .sort(function (a, b) { return a.cost - b.cost; })[0];
    const chosen = good || holds || variants[0];

    const label = 'Level ' + (index + 1) + ' (' + lvl.title + ')';
    check(label + ': Lösung hält', chosen.won === true,
        chosen.ended ? chosen.ended.msg : 'Simulation endete nicht');
    check(label + ': Lösung im Budget', chosen.cost <= lvl.budget,
        chosen.cost + ' $ von ' + lvl.budget + ' $');
    check(label + ': keine Strebe gebrochen', chosen.broken === 0,
        chosen.broken + ' gebrochen');
});

/* ---------- Ergebnis ---------- */
console.log('\n' + passed + ' bestanden, ' + failures.length + ' fehlgeschlagen');
if (failures.length) {
    failures.forEach(f => console.log('  - ' + f));
    process.exitCode = 1;
}

