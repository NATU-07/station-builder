// 特殊汚れシステム（Stage 5+ で解放）
// - graffiti : 落書き。放置ペナルティなし、除去には高額コスト
// - oil      : 油汚れ。放置で1分ごと 評判-5、除去コスト中
// - trashpile: ゴミの山。放置ペナルティなし、除去で臨時収入+大金

const SPECIAL_DIRT_UNLOCK_STAGE = 5;
const SPECIAL_DIRT_MAX = 3;
// 発生間隔（ミリ秒、ランダム幅）
const SPECIAL_DIRT_SPAWN_MIN_MS = 600000;  // 10分
const SPECIAL_DIRT_SPAWN_MAX_MS = 900000;  // 15分
// 油汚れの放置ペナルティ
const OIL_PENALTY_INTERVAL_MS = 60000;  // 1分ごと
const OIL_PENALTY_AMOUNT = 5;
// ステージ別コスト倍率（station.js の STAGE_COST_MULT と同じ考え方）
const DIRT_STAGE_COST_MULT = [1, 1, 1, 1, 1, 1.3, 2, 3, 4.5, 6];

// ミニゲーム用の基本パラメータ
const GRAFFITI_SHOT_COST = 1000;     // 1発の基本コスト（Stage倍率適用）
const GRAFFITI_TARGET_COUNT = 5;      // 的の数
const OIL_DROP_TOTAL = 10;            // 出現する油滴の総数
const OIL_DROP_LIFETIME_MS = 2000;    // 油滴1個の寿命
const OIL_GAME_DURATION_MS = 8000;    // ミニゲーム制限時間
const OIL_MISS_CLEAN_PENALTY = 4;     // 逃し1個あたり きれい度 -4
const OIL_MISS_REP_PENALTY = 2;       // 逃し1個あたり 評判 -2
const OIL_PERFECT_REP_BONUS = 10;     // 全部命中で 評判 +10
const TRASH_GAME_DURATION_MS = 10000; // ゴミ連打の制限時間
const TRASH_TAP_BASE_REWARD = 600;    // 1タップあたりの基本収入（Stage倍率適用）
const TRASH_COMBO_INTERVAL_MS = 500;  // コンボ維持可能な間隔
const TRASH_MAX_COMBO_MULT = 3;       // コンボ最大倍率

const DIRT_DEFS = {
    graffiti:  { icon: '🎨', name: '落書き',   reward: 0,     story: 'スプレーで壁が汚されてしまった。色を合わせて撃ち消せ。' },
    oil:       { icon: '🛢️', name: '油汚れ',   reward: 0,     story: 'ホームに油がはねる。次々湧くから急げ！' },
    trashpile: { icon: '🗑️', name: 'ゴミの山', reward: 30000, story: 'まとめて片付けると小遣いになるぞ。連打で倍率UP！' }
};

class SpecialDirtSystem {
    constructor(station) {
        this.station = station;
        this.dirts = [];
        this.nextId = 1;
        this.spawnTimer = 0;
        this.nextSpawnInterval = this._rollInterval();
        this.lastOilPenalty = null;  // { at, amount } UI表示用
        this.lastSpawned = null;     // { at, dirt } UI通知用
    }

    // 解放済みか
    isUnlocked() {
        return this.station.stage >= SPECIAL_DIRT_UNLOCK_STAGE;
    }

    // 次の発生までの間隔（汚いほど短く）
    _rollInterval() {
        const dirtiness = Math.max(0, 1 - this.station.cleanliness / 100);
        const base = SPECIAL_DIRT_SPAWN_MIN_MS + Math.random() * (SPECIAL_DIRT_SPAWN_MAX_MS - SPECIAL_DIRT_SPAWN_MIN_MS);
        // dirtiness が高いほど 1 - 0.5 = 0.5 倍まで短縮
        return base * (1 - dirtiness * 0.5);
    }

    update(deltaMs) {
        if (!this.isUnlocked()) return;

        // 油汚れの放置ペナルティ
        for (const dirt of this.dirts) {
            if (dirt.type !== 'oil') continue;
            dirt.penaltyAccum = (dirt.penaltyAccum || 0) + deltaMs;
            if (dirt.penaltyAccum >= OIL_PENALTY_INTERVAL_MS) {
                dirt.penaltyAccum -= OIL_PENALTY_INTERVAL_MS;
                this.station.loseReputation(OIL_PENALTY_AMOUNT);
                this.lastOilPenalty = { amount: OIL_PENALTY_AMOUNT, at: Date.now() };
            }
        }

        // 発生タイマー
        if (this.dirts.length < SPECIAL_DIRT_MAX) {
            this.spawnTimer += deltaMs;
            if (this.spawnTimer >= this.nextSpawnInterval) {
                this.spawnTimer = 0;
                this.nextSpawnInterval = this._rollInterval();
                this.spawn();
            }
        } else {
            // 満杯ならタイマーを進めない（除去後すぐ発生しないように）
            this.spawnTimer = 0;
        }
    }

    // 強制的に1個発生（type未指定ならランダム）
    spawn(type) {
        if (this.dirts.length >= SPECIAL_DIRT_MAX) return null;
        const types = Object.keys(DIRT_DEFS);
        const chosen = type && DIRT_DEFS[type] ? type : types[Math.floor(Math.random() * types.length)];
        const dirt = {
            id: this.nextId++,
            type: chosen,
            spawnedAt: Date.now(),
            penaltyAccum: 0
        };
        this.dirts.push(dirt);
        this.lastSpawned = { at: Date.now(), dirt };
        return dirt;
    }

    getDef(type) {
        return DIRT_DEFS[type];
    }

    getRemovalCost(dirt) {
        const def = DIRT_DEFS[dirt.type];
        if (!def) return 0;
        const mult = DIRT_STAGE_COST_MULT[this.station.stage] || 1;
        return Math.ceil(def.baseCost * mult);
    }

    getRemovalReward(dirt) {
        const def = DIRT_DEFS[dirt.type];
        if (!def) return 0;
        const mult = DIRT_STAGE_COST_MULT[this.station.stage] || 1;
        return Math.ceil(def.reward * mult);
    }

    // 汚れ除去（デバッグ/旧API用。通常はミニゲーム経由の resolveRemoval を使う）
    remove(id) {
        const idx = this.dirts.findIndex(d => d.id === id);
        if (idx < 0) return { ok: false, reason: 'not-found' };
        const dirt = this.dirts[idx];
        const reward = this.getRemovalReward(dirt);
        this.station.money += reward;
        this.dirts.splice(idx, 1);
        return { ok: true, cost: 0, reward, type: dirt.type, name: DIRT_DEFS[dirt.type].name };
    }

    // ミニゲーム結果を受けて除去を確定する
    resolveRemoval(id, result) {
        const idx = this.dirts.findIndex(d => d.id === id);
        if (idx < 0) return { ok: false, reason: 'not-found' };
        const dirt = this.dirts[idx];
        const cost = Math.max(0, Math.floor(result.cost || 0));
        const reward = Math.max(0, Math.floor(result.reward || 0));
        this.station.money = Math.max(0, this.station.money - cost) + reward;
        this.dirts.splice(idx, 1);
        return {
            ok: true, cost, reward,
            type: dirt.type, name: DIRT_DEFS[dirt.type].name
        };
    }

    // ミニゲーム設定値
    getConfig() {
        return {
            GRAFFITI_SHOT_COST, GRAFFITI_TARGET_COUNT,
            OIL_DROP_TOTAL, OIL_DROP_LIFETIME_MS, OIL_GAME_DURATION_MS,
            OIL_MISS_CLEAN_PENALTY, OIL_MISS_REP_PENALTY, OIL_PERFECT_REP_BONUS,
            TRASH_GAME_DURATION_MS, TRASH_TAP_BASE_REWARD,
            TRASH_COMBO_INTERVAL_MS, TRASH_MAX_COMBO_MULT,
            stageMult: DIRT_STAGE_COST_MULT[this.station.stage] || 1
        };
    }

    clearAll() {
        this.dirts = [];
    }

    getSaveData() {
        return {
            dirts: this.dirts.map(d => ({
                id: d.id,
                type: d.type,
                spawnedAt: d.spawnedAt,
                penaltyAccum: d.penaltyAccum || 0
            })),
            nextId: this.nextId,
            spawnTimer: this.spawnTimer,
            nextSpawnInterval: this.nextSpawnInterval
        };
    }

    loadSaveData(data) {
        if (!data) return;
        this.dirts = (data.dirts || []).filter(d => DIRT_DEFS[d.type]);
        this.nextId = data.nextId || (this.dirts.reduce((m, d) => Math.max(m, d.id), 0) + 1);
        this.spawnTimer = data.spawnTimer || 0;
        this.nextSpawnInterval = data.nextSpawnInterval || this._rollInterval();
    }
}
