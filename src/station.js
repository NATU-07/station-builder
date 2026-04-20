// ステージ別メンテナンス倍率
const STAGE_CLEAN_DECAY_MULT = [1.0, 1.0, 1.0, 1.2, 1.4, 1.6, 1.8, 2.0, 2.5, 3.0];
const STAGE_ITEM_DECAY_MULT =  [1.0, 1.0, 1.2, 1.2, 1.5, 1.5, 2.0, 2.0, 2.5, 2.5];
// イベント限定アイテムの修理/再生コスト倍率（現在ステージに応じて変動）
const EVENT_ITEM_STAGE_MULT = [1, 3, 10, 40, 150, 500, 2000, 8000, 25000, 100000];
// アップグレード/アイテム/手入れコストのステージ別スケール倍率（後半ほど高くする）
const STAGE_COST_MULT = [1, 1, 1, 1, 1, 1.3, 2, 3, 4.5, 6];

// 自動手入れ機能
const AUTO_MAINTAIN_PREMIUM_RATE = 1.2;  // オンライン中は定価の1.2倍
const AUTO_MAINTAIN_THRESHOLD = 0.3;     // 耐久30%を下回ったら発動
const AUTO_MAINTAIN_UNLOCK_STAGE = 1;
const AUTO_MAINTAIN_UNLOCK_ITEMS = 5;

class Station {
    constructor(data) {
        this.data = data;
        this.stage = 0;
        this.money = 0;
        this.purchased = new Set();
        this.lastIncomeTime = Date.now();

        // 電車システム
        this.trainTimer = 25000; // 初回は5秒後に来る
        this.trainInterval = 30000; // 以降30秒ごと
        this.trainState = 'none'; // none, arriving, stopped, departing
        this.trainX = -200;
        this.trainProgress = 0;
        this.currentPassengers = [];
        this.totalVisitors = 0;

        // アイテムシステム
        this.placedItems = []; // { instanceId, id, durability, maxDurability, effect, ... }
        this.nextItemInstanceId = 1; // 設置ごとに+1される一意ID（自動手入れ対象選択などに使用）
        this.itemData = [];
        this.unlockedEventItems = new Set(); // イベント限定アイテムの解放状態

        // 評判システム
        this.reputation = 0;
        this.reputationLevel = 0;
        this.reputationLevels = [
            { name: '無名の駅', required: 0, stars: '☆☆☆☆☆☆☆☆☆☆' },
            { name: '知る人ぞ知る駅', required: 100, stars: '★☆☆☆☆☆☆☆☆☆' },
            { name: '地元で人気の駅', required: 1000, stars: '★★☆☆☆☆☆☆☆☆' },
            { name: '話題の駅', required: 10000, stars: '★★★☆☆☆☆☆☆☆' },
            { name: '有名な駅', required: 100000, stars: '★★★★☆☆☆☆☆☆' },
            { name: '全国区の駅', required: 500000, stars: '★★★★★☆☆☆☆☆' },
            { name: '名門駅', required: 3000000, stars: '★★★★★★☆☆☆☆' },
            { name: '殿堂入りの駅', required: 20000000, stars: '★★★★★★★☆☆☆' },
            { name: '世界遺産級の駅', required: 100000000, stars: '★★★★★★★★☆☆' },
            { name: '神話の駅', required: 500000000, stars: '★★★★★★★★★☆' },
            { name: '伝説の駅', required: 2000000000, stars: '★★★★★★★★★★' }
        ];

        // きれい度（0〜100）
        this.cleanliness = 20;
        this.baseCleanDecayRate = 0.025; // 基本低下率
        this.cleanlinessDecayRate = 0.025;
        this.lastCleanTime = Date.now();

        // 汚れ蓄積システム
        this.lastCleanedAt = Date.now();

        // アップグレードボーナス
        this.upgradePassengerBonus = 0;
        this.upgradeIncomeBonus = 0;
        this.upgradeCleanPower = 0;

        // 自動手入れ機能
        this.autoMaintain = {
            enabled: false,
            selectedIds: new Set(),
            notified: false,       // 初回開放説明を表示したか
            lastTickAt: Date.now() // オンラインの手入れ判定用
        };
        this.offlineAutoMaintainReport = null; // ロード時に計算された自動手入れレポート
    }

    // 全アップグレードのボーナスを再計算
    recalcBonuses() {
        this.upgradePassengerBonus = 0;
        this.upgradeIncomeBonus = 0;
        this.upgradeCleanPower = 0;
        this.upgradeItemDecayMod = 0;
        let cleanDecayMod = 0;

        for (const stage of this.data.stages) {
            for (const up of stage.upgrades) {
                if (!this.purchased.has(up.id) || !up.bonus) continue;
                if (up.bonus.passenger) this.upgradePassengerBonus += up.bonus.passenger;
                if (up.bonus.income) this.upgradeIncomeBonus += up.bonus.income;
                if (up.bonus.cleanPower) this.upgradeCleanPower += up.bonus.cleanPower;
                if (up.bonus.cleanDecay) cleanDecayMod += up.bonus.cleanDecay;
                if (up.bonus.itemDecay) this.upgradeItemDecayMod += up.bonus.itemDecay;
            }
        }
        // ステージ別汚れ倍率を適用
        const stageMult = STAGE_CLEAN_DECAY_MULT[this.stage] || 1;
        this.cleanlinessDecayRate = this.baseCleanDecayRate * stageMult * Math.max(0.1, 1 + cleanDecayMod);
    }

    // アップグレードの解放条件を満たしているか
    canUnlock(upgrade) {
        if (upgrade.requireVisitors && this.totalVisitors < upgrade.requireVisitors) {
            return false;
        }
        return true;
    }

    getCurrentStageData() {
        return this.data.stages[this.stage];
    }

    getUpgrades() {
        return this.getCurrentStageData().upgrades;
    }

    getPassengerRange() {
        const sd = this.getCurrentStageData();
        const cleanBonus = this.cleanliness / 100;
        const progressBonus = this.getProgress();
        const itemBonus = 1 + this.getItemBonus('passengerBonus');
        const repBonus = this.getReputationPassengerBonus();
        const upBonus = 1 + this.upgradePassengerBonus;
        const eventMult = this.eventSystem ? this.eventSystem.getPassengerMultiplier() : 1;
        const baseMin = sd.passengersPerMin;
        const baseMax = baseMin * 2 + 2;

        const min = Math.max(1, Math.floor(baseMin * cleanBonus * itemBonus * repBonus * upBonus * eventMult));
        const max = Math.max(min + 1, Math.floor(baseMax * cleanBonus * (0.5 + progressBonus * 0.5) * itemBonus * repBonus * upBonus * eventMult));
        return { min, max };
    }

    spawnPassengers() {
        const range = this.getPassengerRange();
        const count = range.min + Math.floor(Math.random() * (range.max - range.min + 1));
        const incomeBonus = 1 + this.getItemBonus('incomeBonus') + this.upgradeIncomeBonus;
        const eventIncomeMult = this.eventSystem ? this.eventSystem.getIncomeMultiplier() : 1;
        const income = Math.floor(this.getCurrentStageData().incomePerPassenger * incomeBonus * eventIncomeMult);
        const newPassengers = [];
        for (let i = 0; i < count; i++) {
            newPassengers.push({
                x: 480 + Math.random() * 40 - 20,
                targetX: 280 + Math.random() * 380,
                y: 258,
                arrived: false,
                stayTime: 5000 + Math.random() * 10000,
                spawnTime: Date.now() + i * 300
            });
        }
        // 降りた瞬間にお金が入る
        this.money += count * income;

        // 評判加算（駅レベルが大きく影響）
        const stageBonus = (this.stage + 1) * 3;
        const cleanBonus = this.cleanliness / 100;
        const repGain = count * stageBonus * cleanBonus;
        this.addReputation(repGain);
        this.currentPassengers.push(...newPassengers);
        this.totalVisitors += count;
        return { count, earned: count * income };
    }

    updatePassengers() {
        const now = Date.now();

        this.currentPassengers = this.currentPassengers.filter(p => {
            if (now < p.spawnTime) return true;

            // 歩いて目的地へ
            if (!p.arrived) {
                const dx = p.targetX - p.x;
                p.x += dx * 0.03;
                if (Math.abs(dx) < 2) p.arrived = true;
                return true;
            }

            // 滞在時間が過ぎたら退場
            if (now - p.spawnTime > p.stayTime) return false;
            return true;
        });
    }

    // 電車の状態更新
    updateTrain(deltaMs) {
        this.trainTimer += deltaMs;

        switch (this.trainState) {
            case 'none':
                if (this.trainTimer >= this.trainInterval) {
                    this.trainState = 'arriving';
                    this.trainTimer = 0;
                    this.trainProgress = 0;
                }
                break;

            case 'arriving':
                this.trainProgress += deltaMs / 2000; // 2秒で到着
                this.trainX = -200 + this.trainProgress * 680; // -200 → 480
                if (this.trainProgress >= 1) {
                    this.trainState = 'stopped';
                    this.trainTimer = 0;
                    this.trainX = 480;
                    this.spawnPassengers();
                }
                break;

            case 'stopped':
                if (this.trainTimer >= 3000) { // 3秒停車
                    this.trainState = 'departing';
                    this.trainTimer = 0;
                    this.trainProgress = 0;
                }
                break;

            case 'departing':
                this.trainProgress += deltaMs / 2000;
                this.trainX = 480 + this.trainProgress * 680; // 480 → 1160
                if (this.trainProgress >= 1) {
                    this.trainState = 'none';
                    this.trainTimer = 0;
                }
                break;
        }
    }

    // きれい度の低下
    updateCleanliness() {
        const now = Date.now();
        const elapsed = (now - this.lastCleanTime) / 1000;
        this.cleanliness = Math.max(0, this.cleanliness - this.cleanlinessDecayRate * elapsed);
        this.lastCleanTime = now;
    }

    // 掃除する（きれい度回復）
    clean(amount) {
        this.cleanliness = Math.min(100, this.cleanliness + amount);
        // 実際に掃除した場合のみタイマーリセット
        if (amount > 0) {
            this.lastCleanedAt = Date.now();
        }
    }

    // 最後の掃除からの経過秒数
    getSecondsSinceLastClean() {
        return (Date.now() - this.lastCleanedAt) / 1000;
    }

    // --- 評判 ---

    getReputationInfo() {
        return this.reputationLevels[this.reputationLevel];
    }

    getNextReputationInfo() {
        if (this.reputationLevel >= this.reputationLevels.length - 1) return null;
        return this.reputationLevels[this.reputationLevel + 1];
    }

    addReputation(amount) {
        const mult = this.eventSystem ? this.eventSystem.getReputationGainMultiplier() : 1;
        this.reputation += amount * mult;
        this.updateReputationLevel();
    }

    loseReputation(amount) {
        this.reputation = Math.max(0, this.reputation - amount);
        this.updateReputationLevel();
    }

    updateReputationLevel() {
        for (let i = this.reputationLevels.length - 1; i >= 0; i--) {
            if (this.reputation >= this.reputationLevels[i].required) {
                this.reputationLevel = i;
                return;
            }
        }
        this.reputationLevel = 0;
    }

    getReputationPassengerBonus() {
        return 1 + this.reputationLevel * 0.08;
    }

    // --- アイテム ---

    // アイテムの実コスト（後半ステージほど高額）
    getItemCost(itemDef) {
        const mult = STAGE_COST_MULT[this.stage] || 1;
        return Math.ceil((itemDef.cost || 0) * mult);
    }

    placeItem(itemDef) {
        const cost = this.getItemCost(itemDef);
        if (this.money < cost) return false;
        this.money -= cost;
        const newInstanceId = this.nextItemInstanceId++;
        this.placedItems.push({
            instanceId: newInstanceId,
            id: itemDef.id,
            name: itemDef.name,
            icon: itemDef.icon,
            durability: itemDef.durability,
            maxDurability: itemDef.durability,
            effect: itemDef.effect,
            decayRate: itemDef.decayRate,
            decayType: itemDef.decayType,
            lastDecay: Date.now()
        });
        // 自動手入れONなら新アイテムも自動的に対象に含める
        if (this.autoMaintain && this.autoMaintain.enabled) {
            this.autoMaintain.selectedIds.add(newInstanceId);
        }
        return true;
    }

    updateItems() {
        const now = Date.now();
        const itemStageMult = STAGE_ITEM_DECAY_MULT[this.stage] || 1;
        const itemUpgradeMod = Math.max(0.1, 1 + (this.upgradeItemDecayMod || 0));
        const decaySlowdown = 0.4; // 全体的に劣化を遅くする
        for (const item of this.placedItems) {
            const elapsed = (now - item.lastDecay) / 1000;
            item.lastDecay = now;
            if (item.durability <= 0) continue;
            item.durability -= item.decayRate * elapsed * itemStageMult * itemUpgradeMod * decaySlowdown;
            if (item.durability <= 0) {
                item.durability = 0;
                const originalItem = this.itemData.find(d => d.id === item.id);
                const cost = originalItem ? originalItem.cost : 50;
                const penalty = this.calcBrokenPenalty(cost);
                this.loseReputation(penalty);
                this.lastBrokenItem = item.name;
                this.lastBrokenPenalty = penalty;
            }
        }
    }

    // アイテム破損時の評判ペナルティ計算（ステージ後半ほど重い＋現評判の割合も削る）
    calcBrokenPenalty(cost) {
        const BROKEN_PENALTY_STAGE_MULT = [1, 1.2, 1.5, 2, 3, 5, 8, 12, 18, 25];
        const basePenalty = Math.max(10, Math.floor(20 + cost * 0.5));
        const stageMult = BROKEN_PENALTY_STAGE_MULT[this.stage] || 1;
        const repPortion = Math.floor((this.reputation || 0) * 0.02);
        return Math.floor(basePenalty * stageMult) + repPortion;
    }

    getRepairCost(index) {
        if (index < 0 || index >= this.placedItems.length) return 0;
        const item = this.placedItems[index];
        const originalItem = this.itemData.find(d => d.id === item.id);
        const baseCost = (originalItem ? originalItem.cost : 10) * 0.2;
        // イベント限定アイテムは現在ステージでスケーリング
        if (originalItem && originalItem.eventOnly) {
            const mult = EVENT_ITEM_STAGE_MULT[this.stage] || 1;
            return Math.ceil(baseCost * mult);
        }
        const stageMult = STAGE_COST_MULT[this.stage] || 1;
        return Math.ceil(baseCost * stageMult);
    }

    maintainItem(index) {
        if (index < 0 || index >= this.placedItems.length) return false;
        const cost = this.getRepairCost(index);
        if (this.money < cost) return false;
        this.money -= cost;
        const item = this.placedItems[index];
        item.durability = Math.min(item.maxDurability, item.durability + item.maxDurability * 0.3);
        return cost;
    }

    // --- 自動手入れ機能 ---

    isAutoMaintainUnlocked() {
        return this.stage >= AUTO_MAINTAIN_UNLOCK_STAGE
            && this.placedItems.length >= AUTO_MAINTAIN_UNLOCK_ITEMS;
    }

    // オンライン版のコスト（プレミアム倍率）
    getAutoMaintainPremiumCost(index) {
        return Math.ceil(this.getRepairCost(index) * AUTO_MAINTAIN_PREMIUM_RATE);
    }

    // オンライン中の自動手入れチェック（毎秒ぐらいで呼ばれる想定）
    runAutoMaintain() {
        if (!this.autoMaintain.enabled) return;
        if (!this.isAutoMaintainUnlocked()) return;
        const threshold = AUTO_MAINTAIN_THRESHOLD;
        for (let i = 0; i < this.placedItems.length; i++) {
            const item = this.placedItems[i];
            if (item.durability <= 0) continue;
            if (!this.autoMaintain.selectedIds.has(item.instanceId)) continue;
            if (item.durability >= item.maxDurability * threshold) continue;
            const cost = this.getAutoMaintainPremiumCost(i);
            if (this.money < cost) continue;
            this.money -= cost;
            item.durability = Math.min(item.maxDurability, item.durability + item.maxDurability * 0.3);
        }
    }

    // オフライン中の自動手入れシミュレーション
    // 1分ステップで劣化と手入れをシミュレート
    runOfflineAutoMaintain(offlineSec) {
        if (!this.autoMaintain.enabled) return null;
        if (!this.isAutoMaintainUnlocked()) return null;
        if (offlineSec <= 0 || this.placedItems.length === 0) return null;

        const stepSec = 60;
        const steps = Math.min(Math.floor(offlineSec / stepSec), 60 * 24 * 7); // 最大1週間
        if (steps <= 0) return null;

        const itemStageMult = STAGE_ITEM_DECAY_MULT[this.stage] || 1;
        const itemUpgradeMod = Math.max(0.1, 1 + (this.upgradeItemDecayMod || 0));
        const decaySlowdown = 0.4;
        const threshold = AUTO_MAINTAIN_THRESHOLD;

        let totalMaintains = 0;
        let totalCost = 0;
        let brokenItems = [];

        for (let s = 0; s < steps; s++) {
            for (let i = 0; i < this.placedItems.length; i++) {
                const item = this.placedItems[i];
                if (item.durability <= 0) continue;
                // 劣化
                item.durability -= item.decayRate * stepSec * itemStageMult * itemUpgradeMod * decaySlowdown;
                // 自動手入れ対象なら閾値チェック
                const isSelected = this.autoMaintain.selectedIds.has(item.instanceId);
                if (isSelected && item.durability < item.maxDurability * threshold && item.durability > 0) {
                    const cost = this.getRepairCost(i); // オフラインは定価
                    if (this.money >= cost) {
                        this.money -= cost;
                        item.durability = Math.min(
                            item.maxDurability,
                            item.durability + item.maxDurability * 0.3
                        );
                        totalMaintains++;
                        totalCost += cost;
                    }
                }
                // 破損チェック
                if (item.durability <= 0) {
                    item.durability = 0;
                    const originalItem = this.itemData.find(d => d.id === item.id);
                    const c = originalItem ? originalItem.cost : 50;
                    const penalty = this.calcBrokenPenalty(c);
                    this.loseReputation(penalty);
                    brokenItems.push(item.name);
                }
            }
        }

        // lastDecayを現在に更新（二重劣化防止）
        for (const item of this.placedItems) item.lastDecay = Date.now();

        return { totalMaintains, totalCost, brokenItems, offlineSec };
    }

    // 壊れたアイテムを再生
    restoreItem(index) {
        if (index < 0 || index >= this.placedItems.length) return false;
        const item = this.placedItems[index];
        if (item.durability > 0) return false;
        const cost = this.getRestoreCost(index);
        if (this.money < cost) return false;
        this.money -= cost;
        item.durability = item.maxDurability;
        return cost;
    }

    getRestoreCost(index) {
        if (index < 0 || index >= this.placedItems.length) return 0;
        const item = this.placedItems[index];
        const originalItem = this.itemData.find(d => d.id === item.id);
        const baseCost = originalItem ? originalItem.cost : item.maxDurability;
        const restorePenalty = 1.5; // 再生は購入価格の1.5倍（壊すと損）
        // イベント限定アイテムは現在ステージでスケーリング
        if (originalItem && originalItem.eventOnly) {
            const mult = EVENT_ITEM_STAGE_MULT[this.stage] || 1;
            return Math.ceil(baseCost * restorePenalty * mult);
        }
        return Math.ceil(baseCost * restorePenalty);
    }

    getSellPrice(index) {
        if (index < 0 || index >= this.placedItems.length) return 0;
        const item = this.placedItems[index];
        const originalItem = this.itemData.find(d => d.id === item.id);
        const baseCost = originalItem ? originalItem.cost : item.maxDurability;
        const ratio = item.durability / item.maxDurability;
        // 売却額 = 元値の70% × 耐久比率（壊れてたら0）
        const sellRate = 0.7;
        if (originalItem && originalItem.eventOnly) {
            const mult = EVENT_ITEM_STAGE_MULT[this.stage] || 1;
            return Math.floor(baseCost * sellRate * ratio * mult);
        }
        return Math.floor(baseCost * sellRate * ratio);
    }

    sellItem(index) {
        if (index < 0 || index >= this.placedItems.length) return false;
        const price = this.getSellPrice(index);
        const sold = this.placedItems[index];
        this.money += price;
        this.placedItems.splice(index, 1);
        if (sold && sold.instanceId != null) {
            this.autoMaintain.selectedIds.delete(sold.instanceId);
        }
        return price;
    }

    isEventItem(index) {
        if (index < 0 || index >= this.placedItems.length) return false;
        const item = this.placedItems[index];
        const originalItem = this.itemData.find(d => d.id === item.id);
        return originalItem && originalItem.eventOnly;
    }

    removeItem(index) {
        if (index < 0 || index >= this.placedItems.length) return;
        this.placedItems.splice(index, 1);
    }

    getItemBonus(type) {
        let total = 0;
        for (const item of this.placedItems) {
            const ratio = item.durability / item.maxDurability;
            if (item.effect[type]) {
                total += item.effect[type] * ratio;
            }
        }
        return total;
    }

    getAutoIncome() {
        let total = 0;
        for (const item of this.placedItems) {
            const ratio = item.durability / item.maxDurability;
            if (item.effect.autoIncome) {
                total += item.effect.autoIncome * ratio;
            }
        }
        return total;
    }

    getIncomePerMin() {
        const sd = this.getCurrentStageData();
        // 乗客数（getPassengerRangeの平均値を使う）
        const range = this.getPassengerRange();
        const avgPassengers = (range.min + range.max) / 2;
        // 電車到着回数/分
        const trainsPerMin = 60000 / this.trainInterval;
        // 1人あたりの収入
        const incomeBonus = 1 + this.getItemBonus('incomeBonus') + this.upgradeIncomeBonus;
        const eventIncomeMult = this.eventSystem ? this.eventSystem.getIncomeMultiplier() : 1;
        const incomePerPerson = sd.incomePerPassenger * incomeBonus * eventIncomeMult;
        // 電車収入 + 自動収入
        return Math.floor(avgPassengers * incomePerPerson * trainsPerMin);
    }

    // アップグレードの実コスト（後半ステージほど高額）
    getUpgradeCost(upgrade) {
        const mult = STAGE_COST_MULT[this.stage] || 1;
        return Math.ceil((upgrade.cost || 0) * mult);
    }

    canAfford(upgrade) {
        return this.money >= this.getUpgradeCost(upgrade);
    }

    purchase(upgrade) {
        if (this.purchased.has(upgrade.id) || !this.canAfford(upgrade)) return false;
        if (!this.canUnlock(upgrade)) return false;
        this.money -= this.getUpgradeCost(upgrade);
        this.purchased.add(upgrade.id);

        // 掃除系のアップグレードはきれい度も上がる
        if (upgrade.id === 'clean_platform') this.clean(30);

        // ボーナス適用
        if (upgrade.bonus) {
            if (upgrade.bonus.reputation) this.addReputation(upgrade.bonus.reputation);
        }
        this.recalcBonuses();
        return true;
    }

    getProgress() {
        const ups = this.getUpgrades();
        if (ups.length === 0) return 1;
        const done = ups.filter(u => this.purchased.has(u.id)).length;
        return done / ups.length;
    }

    // 進化に必要な累計利用客数
    getEvolveRequiredVisitors() {
        const reqs = [100, 500, 2000, 8000, 25000, 60000, 150000, 350000, 800000];
        return reqs[this.stage] || 0;
    }

    canEvolve() {
        if (this.getProgress() < 1) return false;
        if (this.stage >= this.data.stages.length - 1) return false;
        if (this.totalVisitors < this.getEvolveRequiredVisitors()) return false;
        return true;
    }

    // 進化条件の達成状況（UI表示用）
    getEvolveStatus() {
        const reqVisitors = this.getEvolveRequiredVisitors();
        return {
            allUpgrades: this.getProgress() >= 1,
            visitorsOk: this.totalVisitors >= reqVisitors,
            requiredVisitors: reqVisitors,
            currentVisitors: this.totalVisitors
        };
    }

    evolve() {
        if (!this.canEvolve()) return false;
        this.stage++;
        // 10段階: 30s→27.5s→25s→...→8s
        this.trainInterval = Math.max(8000, 30000 - this.stage * 2500);
        // 進化で大量の評判ボーナス
        const evolveRepBonus = [0, 50, 200, 800, 3000, 8000, 20000, 50000, 120000, 300000];
        this.addReputation(evolveRepBonus[this.stage] || 0);
        return true;
    }

    // --- セーブ/ロード ---

    save() {
        const data = {
            stage: this.stage,
            money: this.money,
            purchased: Array.from(this.purchased),
            cleanliness: this.cleanliness,
            totalVisitors: this.totalVisitors,
            reputation: this.reputation,
            reputationLevel: this.reputationLevel,
            trainInterval: this.trainInterval,
            lastCleanedAt: this.lastCleanedAt,
            placedItems: this.placedItems.map(item => ({
                instanceId: item.instanceId,
                id: item.id,
                name: item.name,
                icon: item.icon,
                durability: item.durability,
                maxDurability: item.maxDurability,
                effect: item.effect,
                decayRate: item.decayRate,
                decayType: item.decayType
            })),
            nextItemInstanceId: this.nextItemInstanceId,
            unlockedEventItems: Array.from(this.unlockedEventItems),
            events: this.eventSystem ? this.eventSystem.getSaveData() : null,
            autoMaintain: {
                enabled: this.autoMaintain.enabled,
                selectedIds: Array.from(this.autoMaintain.selectedIds),
                notified: this.autoMaintain.notified
            },
            savedAt: Date.now()
        };
        localStorage.setItem('station-builder-save', JSON.stringify(data));
    }

    load() {
        const raw = localStorage.getItem('station-builder-save');
        if (!raw) return false;

        try {
            const data = JSON.parse(raw);
            this.stage = data.stage || 0;
            this.money = data.money || 0;
            this.purchased = new Set(data.purchased || []);
            this.cleanliness = data.cleanliness || 20;
            this.totalVisitors = data.totalVisitors || 0;
            this.reputation = data.reputation || 0;
            this.reputationLevel = data.reputationLevel || 0;
            this.updateReputationLevel();
            this.trainInterval = data.trainInterval || 30000;
            this.lastCleanedAt = data.lastCleanedAt || Date.now();

            // アイテム復元（旧セーブのinstanceId補完）
            this.nextItemInstanceId = data.nextItemInstanceId || 1;
            this.placedItems = (data.placedItems || []).map(item => ({
                ...item,
                instanceId: item.instanceId != null ? item.instanceId : this.nextItemInstanceId++,
                lastDecay: Date.now()
            }));
            // 再計算: 最大instanceId+1を next にする（古いセーブ救済）
            for (const it of this.placedItems) {
                if (it.instanceId >= this.nextItemInstanceId) {
                    this.nextItemInstanceId = it.instanceId + 1;
                }
            }

            // イベント限定アイテム復元
            this.unlockedEventItems = new Set(data.unlockedEventItems || []);

            // イベントデータ復元
            if (this.eventSystem && data.events) {
                this.eventSystem.loadSaveData(data.events);
            }

            // 自動手入れ設定復元
            if (data.autoMaintain) {
                this.autoMaintain.enabled = !!data.autoMaintain.enabled;
                this.autoMaintain.selectedIds = new Set(data.autoMaintain.selectedIds || []);
                this.autoMaintain.notified = !!data.autoMaintain.notified;
            }

            // ボーナス再計算
            this.recalcBonuses();

            // オフライン収入を計算（電車到着分の50%も加算）
            if (data.savedAt) {
                const OFFLINE_CAP_SEC = 12 * 3600; // 12時間で頭打ち
                const rawOfflineSec = (Date.now() - data.savedAt) / 1000;
                const offlineSec = Math.min(rawOfflineSec, OFFLINE_CAP_SEC);
                this.offlineCapped = rawOfflineSec > OFFLINE_CAP_SEC;
                this.offlineSeconds = offlineSec;
                const sd = this.getCurrentStageData();
                const upBonus = 1 + this.upgradeIncomeBonus;
                const passivePerSec = this.getIncomePerMin() / 60 + this.getAutoIncome() / 60;
                // 電車到着の推定収入（50%をオフラインに適用）
                const trainIncome = sd.passengersPerMin * sd.incomePerPassenger * upBonus / 60 * 0.5;
                const offlineIncome = (passivePerSec + trainIncome) * offlineSec;
                // オフライン中の推定利用客数も加算
                const offlineVisitors = Math.floor(sd.passengersPerMin * offlineSec / 60 * 0.3);
                if (offlineIncome > 0) {
                    this.money += offlineIncome;
                    this.totalVisitors += offlineVisitors;
                    this.offlineEarned = Math.floor(offlineIncome);
                    this.offlineVisitors = offlineVisitors;
                }

                // 自動手入れがONならオフライン劣化＋自動手入れを実行（キャップ後の秒数で）
                this.offlineAutoMaintainReport = this.runOfflineAutoMaintain(offlineSec);
            }

            return true;
        } catch (e) {
            return false;
        }
    }

    updateIncome() {
        const now = Date.now();
        const elapsed = (now - this.lastIncomeTime) / 1000;
        // 自動収入のみ毎秒加算（電車収入はspawnPassengersで別途加算）
        const autoPerSec = this.getAutoIncome() / 60;
        this.money += autoPerSec * elapsed;
        this.lastIncomeTime = now;
    }
}
