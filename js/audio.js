/**
 * audio.js – kurze prozedurale Effekte über WebAudio.
 * Der AudioContext wird erst beim ersten Ton erzeugt (Autoplay-Regeln).
 */
(function () {
    'use strict';
    const BB = window.BB = window.BB || {};

    let audioCtx = null;

    function getContext() {
        if (!audioCtx) {
            const Ctor = window.AudioContext || window.webkitAudioContext;
            if (!Ctor) return null;
            audioCtx = new Ctor();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    const SOUNDS = {
        build: {
            type: 'sine', gain: 0.15, dur: 0.07,
            freq: function (osc, now) {
                osc.frequency.setValueAtTime(240, now);
                osc.frequency.exponentialRampToValueAtTime(520, now + 0.07);
            }
        },
        ding: {
            type: 'triangle', gain: 0.18, dur: 0.3,
            freq: function (osc, now) {
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.setValueAtTime(1320, now + 0.1);
            }
        },
        delete: {
            type: 'sine', gain: 0.15, dur: 0.09,
            freq: function (osc, now) {
                osc.frequency.setValueAtTime(280, now);
                osc.frequency.exponentialRampToValueAtTime(100, now + 0.09);
            }
        },
        snap: {
            type: 'sawtooth', gain: 0.3, dur: 0.22,
            freq: function (osc, now) {
                osc.frequency.setValueAtTime(130, now);
                osc.frequency.exponentialRampToValueAtTime(38, now + 0.22);
            }
        },
        win: {
            type: 'sine', gain: 0.2, dur: 0.45,
            freq: function (osc, now) {
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.setValueAtTime(659, now + 0.2);
            }
        }
    };

    BB.playSound = function (type) {
        if (BB.storage && BB.storage.getSettings().muted) return;
        const spec = SOUNDS[type];
        if (!spec) return;
        const ctx = getContext();
        if (!ctx) return;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = spec.type;
        osc.connect(gain);
        gain.connect(ctx.destination);

        const now = ctx.currentTime;
        spec.freq(osc, now);
        gain.gain.setValueAtTime(spec.gain, now);
        gain.gain.linearRampToValueAtTime(0.01, now + spec.dur);

        osc.start(now);
        osc.stop(now + spec.dur);
    };
})();
