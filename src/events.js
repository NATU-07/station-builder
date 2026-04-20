class EventSystem {
    constructor(station) {
        this.station = station;
        this.eventDefs = [];
        this.activeBuffs = [];   // { id, buff, endsAt }
        this.pendingEvent = null; // 選択待ちイベント
        this.lastEventTime = Date.now();
        this.eventCooldown = 60000; // 最短60秒間隔
        this.eventHistory = [];     // 直近のイベントID（重複防止）
        this.maxHistory = 5;
        this.seenEvents = new Set(); // 永久イベント履歴（イベント記録用）
    }

    async loadEvents() {
        try {
            const res = await fetch('data/events.json');
            const data = await res.json();
            this.eventDefs = data.events;
        } catch (e) {
            this.eventDefs = [];
        }
    }

    // ゲームループから毎フレーム呼ぶ
    update(deltaMs) {
        this.updateBuffs();

        // 選択イベント表示中は新しいイベントを出さない
        if (this.pendingEvent) return null;

        const now = Date.now();
        const elapsed = now - this.lastEventTime;
        if (elapsed < this.eventCooldown) return null;

        // 60〜180秒ごとにイベント判定（ステージが上がると頻度UP）
        const stageBonus = this.station.stage * 0.1;
        const chance = (deltaMs / 1000) * (0.005 + stageBonus * 0.002);
        if (Math.random() > chance) return null;

        return this.triggerRandomEvent();
    }

    triggerRandomEvent() {
        const stage = this.station.stage;
        const candidates = this.eventDefs.filter(e =>
            e.minStage <= stage
            && !this.eventHistory.includes(e.id)
            && !this.isUnlockCompleted(e)
        );
        if (candidates.length === 0) return null;

        // 重み付き抽選
        const totalWeight = candidates.reduce((sum, e) => sum + (e.weight || 1), 0);
        let roll = Math.random() * totalWeight;
        let chosen = candidates[0];
        for (const e of candidates) {
            roll -= (e.weight || 1);
            if (roll <= 0) { chosen = e; break; }
        }

        this.lastEventTime = Date.now();
        this.eventHistory.push(chosen.id);
        if (this.eventHistory.length > this.maxHistory) {
            this.eventHistory.shift();
        }
        this.seenEvents.add(chosen.id);

        return this.processEvent(chosen);
    }

    processEvent(event) {
        if (event.type === 'choice') {
            this.pendingEvent = event;
            return { type: 'choice', event };
        }

        if (event.type === 'conditional') {
            return this.processConditional(event);
        }

        // instant or buff
        const result = { type: 'notification', event, messages: [] };

        if (event.effects) {
            const msg = this.applyEffects(event.effects);
            if (msg) result.messages.push(msg);
        }

        if (event.type === 'buff' && event.buff) {
            this.addBuff(event.id, event.buff, event.duration || 60);
            result.messages.push(this.formatBuffText(event.buff, event.duration || 60));
        }

        return result;
    }

    processConditional(event) {
        const cond = event.condition;
        let passed = true;

        if (cond.minCleanliness && this.station.cleanliness < cond.minCleanliness) {
            passed = false;
        }

        if (passed) {
            this.applyEffects(event.successEffects);
            return {
                type: 'notification',
                event,
                messages: [event.successMessage]
            };
        } else {
            this.applyEffects(event.failEffects);
            return {
                type: 'notification',
                event,
                messages: [event.failMessage]
            };
        }
    }

    // 選択イベントで選んだ結果を処理
    resolveChoice(choiceIndex) {
        if (!this.pendingEvent) return null;
        const event = this.pendingEvent;
        const choice = event.choices[choiceIndex];
        this.pendingEvent = null;

        if (!choice) return null;

        // スケーリングされたコスト計算
        const scaledCost = this.getScaledCost(choice.cost || 0, event.minStage);

        // コストチェック
        if (scaledCost > 0 && this.station.money < scaledCost) {
            return {
                type: 'notification',
                event,
                messages: ['お金が足りません...']
            };
        }

        if (scaledCost > 0) {
            this.station.money -= scaledCost;
        }

        const result = { type: 'notification', event, messages: [choice.message] };
        this.applyEffects(choice.effects);

        // 選択肢にバフがあれば適用
        if (choice.buff) {
            this.addBuff(event.id, choice.buff, choice.buffDuration || 60);
            result.messages.push(this.formatBuffText(choice.buff, choice.buffDuration || 60));
        }

        return result;
    }

    applyEffects(effects) {
        if (!effects) return '';
        const parts = [];

        if (effects.money) {
            this.station.money += effects.money;
            if (effects.money > 0) parts.push('+' + effects.money + '円');
            else parts.push(effects.money + '円');
        }

        if (effects.moneyPercent) {
            const amount = Math.max(
                effects.moneyMin || 0,
                Math.floor(this.station.money * effects.moneyPercent)
            );
            this.station.money += amount;
            parts.push('+' + amount + '円');
        }

        if (effects.reputation) {
            if (effects.reputation > 0) {
                this.station.addReputation(effects.reputation);
                parts.push('評判 +' + effects.reputation);
            } else {
                this.station.loseReputation(Math.abs(effects.reputation));
                parts.push('評判 ' + effects.reputation);
            }
        }

        if (effects.cleanliness) {
            this.station.cleanliness = Math.max(0,
                Math.min(100, this.station.cleanliness + effects.cleanliness));
            if (effects.cleanliness > 0) parts.push('きれい度 +' + effects.cleanliness);
            else parts.push('きれい度 ' + effects.cleanliness);
        }

        if (effects.unlockItem) {
            this.station.unlockedEventItems.add(effects.unlockItem);
            parts.push('🎁 レアアイテム解放！');
        }

        if (effects.durabilityDamagePercent) {
            const pct = effects.durabilityDamagePercent / 100;
            for (const item of this.station.placedItems) {
                item.durability = Math.max(1, item.durability * (1 - pct));
            }
            parts.push('全アイテム耐久 -' + effects.durabilityDamagePercent + '%');
        }

        return parts.join('  ');
    }

    // ステージ差に応じたコスト倍率（現在ステージ - イベント出現ステージ）
    getScaledCost(baseCost, minStage) {
        if (baseCost <= 0) return 0;
        const diff = this.station.stage - (minStage || 0);
        const mults = [1, 5, 25, 120, 500, 2000, 8000, 30000, 100000, 400000];
        const mult = mults[Math.min(Math.max(diff, 0), mults.length - 1)];
        return Math.floor(baseCost * mult);
    }

    // アイテム解放済みイベントの重複チェック
    isUnlockCompleted(event) {
        const unlocked = this.station.unlockedEventItems;
        // instant/buff の直接 unlockItem
        if (event.effects && event.effects.unlockItem && unlocked.has(event.effects.unlockItem)) {
            return true;
        }
        // choice の unlockItem（全解放済みなら出さない）
        if (event.type === 'choice' && event.choices) {
            const unlockChoices = event.choices.filter(c =>
                c.effects && c.effects.unlockItem
            );
            if (unlockChoices.length > 0 &&
                unlockChoices.every(c => unlocked.has(c.effects.unlockItem))) {
                return true;
            }
        }
        return false;
    }

    // バフ管理
    addBuff(id, buff, durationSec) {
        // 同IDのバフは上書き
        this.activeBuffs = this.activeBuffs.filter(b => b.id !== id);
        this.activeBuffs.push({
            id,
            buff,
            endsAt: Date.now() + durationSec * 1000
        });
    }

    updateBuffs() {
        const now = Date.now();
        this.activeBuffs = this.activeBuffs.filter(b => b.endsAt > now);
    }

    getPassengerMultiplier() {
        let mult = 1;
        for (const b of this.activeBuffs) {
            if (b.buff.passengerMult) mult *= b.buff.passengerMult;
        }
        return mult;
    }

    getIncomeMultiplier() {
        let mult = 1;
        for (const b of this.activeBuffs) {
            if (b.buff.incomeMult) mult *= b.buff.incomeMult;
        }
        return mult;
    }

    getActiveTimedItems() {
        const items = [];
        for (const b of this.activeBuffs) {
            if (b.buff.timedItem) items.push(b.buff.timedItem);
        }
        return items;
    }

    getCleanPowerMultiplier() {
        let mult = 1;
        for (const b of this.activeBuffs) {
            if (b.buff.cleanPowerMult) mult *= b.buff.cleanPowerMult;
        }
        return mult;
    }

    getReputationGainMultiplier() {
        let mult = 1;
        for (const b of this.activeBuffs) {
            if (b.buff.reputationGainMult) mult *= b.buff.reputationGainMult;
        }
        return mult;
    }

    hasActiveBuffs() {
        return this.activeBuffs.length > 0;
    }

    getActiveBuffSummary() {
        const now = Date.now();
        return this.activeBuffs.map(b => {
            const remaining = Math.ceil((b.endsAt - now) / 1000);
            const parts = [];
            if (b.buff.passengerMult) parts.push('乗客x' + b.buff.passengerMult);
            if (b.buff.incomeMult) parts.push('収益x' + b.buff.incomeMult);
            if (b.buff.cleanPowerMult) parts.push('掃除x' + b.buff.cleanPowerMult);
            if (b.buff.reputationGainMult) parts.push('評判獲得x' + b.buff.reputationGainMult);
            return parts.join(' ') + ' (' + remaining + '秒)';
        });
    }

    // セーブ用
    getSaveData() {
        return {
            activeBuffs: this.activeBuffs,
            lastEventTime: this.lastEventTime,
            eventHistory: this.eventHistory,
            seenEvents: Array.from(this.seenEvents)
        };
    }

    // ロード用
    loadSaveData(data) {
        if (!data) return;
        this.activeBuffs = data.activeBuffs || [];
        this.lastEventTime = data.lastEventTime || Date.now();
        this.eventHistory = data.eventHistory || [];
        this.seenEvents = new Set(data.seenEvents || data.eventHistory || []);
    }

    formatBuffText(buff, duration) {
        const parts = [];
        if (buff.passengerMult) parts.push('乗客 x' + buff.passengerMult);
        if (buff.incomeMult) parts.push('収益 x' + buff.incomeMult);
        if (buff.cleanPowerMult) parts.push('掃除効率 x' + buff.cleanPowerMult);
        if (buff.reputationGainMult) parts.push('評判獲得 x' + buff.reputationGainMult);
        return parts.join(' / ') + ' (' + duration + '秒間)';
    }
}
