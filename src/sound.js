class SoundManager {
    constructor() {
        this.sounds = {};
        this.enabled = true;
        this.volume = 0.5;
        this.bgm = null;
        this.bgmVolume = 0.25;
        this.bgmPlaying = false;
        this.audioCtx = null;
        this.loadAll();
        this.loadBgm();
    }

    loadAll() {
        const files = {
            coin: 'assets/sounds/お金を落とす1.mp3',
            sweep: 'assets/sounds/ほうきで掃く.mp3',
            flip: 'assets/sounds/カードをめくる.mp3',
            pen: 'assets/sounds/シャーペンで字を書く.mp3',
            stamp: 'assets/sounds/スタンプ.mp3',
            weed: 'assets/sounds/草むしり.mp3',
            horn: 'assets/sounds/電車のクラクション1.mp3',
            train: 'assets/sounds/電車通過2.mp3',
        };
        for (const [key, src] of Object.entries(files)) {
            const audio = new Audio(src);
            audio.volume = this.volume;
            audio.preload = 'auto';
            this.sounds[key] = audio;
        }
    }

    play(name, volumeOverride) {
        if (!this.enabled) return;
        const sound = this.sounds[name];
        if (!sound) return;
        const clone = sound.cloneNode();
        clone.volume = volumeOverride !== undefined ? volumeOverride : this.volume;
        clone.play().catch(() => {});
        // 再生中リストに追加（停止用）
        this._playing = this._playing || {};
        this._playing[name] = this._playing[name] || [];
        this._playing[name].push(clone);
        clone.addEventListener('ended', () => {
            const list = this._playing[name];
            if (list) {
                const idx = list.indexOf(clone);
                if (idx >= 0) list.splice(idx, 1);
            }
        });
    }

    // 指定した名前の再生中の音をフェードアウトして停止
    stopAll(name) {
        if (!this._playing || !this._playing[name]) return;
        for (const audio of this._playing[name]) {
            // フェードアウト
            const fadeOut = setInterval(() => {
                if (audio.volume > 0.05) {
                    audio.volume = Math.max(0, audio.volume - 0.05);
                } else {
                    audio.pause();
                    clearInterval(fadeOut);
                }
            }, 50);
        }
        this._playing[name] = [];
    }

    // ループ再生（ペン音など）
    startLoop(name, volumeOverride) {
        if (!this.enabled) return;
        const sound = this.sounds[name];
        if (!sound) return;
        this.stopLoop(name);
        const loop = sound.cloneNode();
        loop.volume = volumeOverride !== undefined ? volumeOverride : this.volume * 0.6;
        loop.loop = true;
        loop.play().catch(() => {});
        this._activeLoops = this._activeLoops || {};
        this._activeLoops[name] = loop;
    }

    stopLoop(name) {
        if (!this._activeLoops || !this._activeLoops[name]) return;
        this._activeLoops[name].pause();
        this._activeLoops[name] = null;
    }

    // --- BGM ---

    loadBgm() {
        this.bgm = new Audio('assets/sounds/VSQ_MUSIC_0101_piano_chime.mp3');
        this.bgm.loop = true;
        this.bgm.volume = this.bgmVolume;
        this.bgm.preload = 'auto';
    }

    startBgm() {
        if (!this.enabled || !this.bgm || this.bgmPlaying) return;
        this.bgm.volume = this.bgmVolume;
        this.bgm.play().catch(() => {});
        this.bgmPlaying = true;
    }

    // --- 合成効果音（掃除ミニゲーム用）---

    _ensureAudioCtx() {
        if (!this.audioCtx && typeof AudioContext !== 'undefined') {
            this.audioCtx = new AudioContext();
        }
        return this.audioCtx;
    }

    // 汚れ1個片付けた瞬間の「ポン」音
    playPop() {
        if (!this.enabled) return;
        const ctx = this._ensureAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        const freq = 800 + Math.random() * 400;
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.1);
        gain.gain.setValueAtTime(0.25 * this.volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.15);
    }

    // 手入れ時の「キラッ」音
    playChime() {
        if (!this.enabled) return;
        const ctx = this._ensureAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const freqs = [1318.5, 1975.5];
        freqs.forEach((freq, i) => {
            const t = now + i * 0.05;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.18 * this.volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        });
    }

    // 全部片付けた瞬間のファンファーレ
    playFanfare() {
        if (!this.enabled) return;
        const ctx = this._ensureAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((freq, i) => {
            const t = now + i * 0.12;
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, t);
            gain.gain.setValueAtTime(0.3 * this.volume, t);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t);
            osc.stop(t + 0.4);
        });
    }

    stopBgm() {
        if (!this.bgm || !this.bgmPlaying) return;
        // フェードアウト
        const fadeOut = setInterval(() => {
            if (this.bgm.volume > 0.02) {
                this.bgm.volume = Math.max(0, this.bgm.volume - 0.02);
            } else {
                this.bgm.pause();
                this.bgm.currentTime = 0;
                this.bgmPlaying = false;
                clearInterval(fadeOut);
            }
        }, 50);
    }
}
