// 駅データの保存・読み込み・オフライン収入計算
// Station クラスのプロトタイプを拡張する形で、station.js 本体のサイズを抑える。
// load() は長くなりがちだったので、オフライン処理を _applyOfflineSimulation に分離している。

Object.assign(Station.prototype, {

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
            specialDirt: this.specialDirt ? this.specialDirt.getSaveData() : null,
            dirtyTickAccum: this.dirtyTickAccum,
            savedAt: Date.now()
        };
        localStorage.setItem('station-builder-save', JSON.stringify(data));
    },

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

            this.nextItemInstanceId = data.nextItemInstanceId || 1;
            this.placedItems = (data.placedItems || []).map(item => ({
                ...item,
                instanceId: item.instanceId != null ? item.instanceId : this.nextItemInstanceId++,
                lastDecay: Date.now()
            }));
            // 古いセーブ救済: 最大instanceId+1 を next にする
            for (const it of this.placedItems) {
                if (it.instanceId >= this.nextItemInstanceId) {
                    this.nextItemInstanceId = it.instanceId + 1;
                }
            }

            this.unlockedEventItems = new Set(data.unlockedEventItems || []);
            if (this.eventSystem && data.events) this.eventSystem.loadSaveData(data.events);

            if (data.autoMaintain) {
                this.autoMaintain.enabled = !!data.autoMaintain.enabled;
                this.autoMaintain.selectedIds = new Set(data.autoMaintain.selectedIds || []);
                this.autoMaintain.notified = !!data.autoMaintain.notified;
            }

            if (this.specialDirt && data.specialDirt) this.specialDirt.loadSaveData(data.specialDirt);
            this.dirtyTickAccum = data.dirtyTickAccum || 0;

            this.recalcBonuses();

            if (data.savedAt) this._applyOfflineSimulation(data.savedAt);
            return true;
        } catch (e) {
            return false;
        }
    },

    _applyOfflineSimulation(savedAt) {
        const OFFLINE_CAP_SEC = 12 * 3600; // 12時間で頭打ち
        const rawOfflineSec = (Date.now() - savedAt) / 1000;
        const offlineSec = Math.min(rawOfflineSec, OFFLINE_CAP_SEC);
        this.offlineCapped = rawOfflineSec > OFFLINE_CAP_SEC;
        this.offlineSeconds = offlineSec;

        const sd = this.getCurrentStageData();
        const upBonus = 1 + this.upgradeIncomeBonus;
        const passivePerSec = this.getIncomePerMin() / 60 + this.getAutoIncome() / 60;
        // 電車到着の推定収入（50%をオフラインに適用、特殊汚れによる乗客ペナルティも反映）
        const sdirtPassengerMult = this.getSpecialDirtPassengerMult();
        const trainIncome = sd.passengersPerMin * sd.incomePerPassenger * upBonus / 60 * 0.5 * sdirtPassengerMult;
        const offlineIncome = (passivePerSec + trainIncome) * offlineSec;
        const offlineVisitors = Math.floor(sd.passengersPerMin * offlineSec / 60 * 0.3);
        if (offlineIncome > 0) {
            this.money += offlineIncome;
            this.totalVisitors += offlineVisitors;
            this.offlineEarned = Math.floor(offlineIncome);
            this.offlineVisitors = offlineVisitors;
        }

        // 自動手入れがONならオフライン劣化＋自動手入れを実行（キャップ後の秒数で）
        this.offlineAutoMaintainReport = this.runOfflineAutoMaintain(offlineSec);

        // 油汚れの放置ペナルティ（オフライン中もキャップなしで累積）
        if (this.specialDirt) {
            const oilDirts = this.specialDirt.dirts.filter(d => d.type === 'oil');
            if (oilDirts.length > 0) {
                const oilMinutes = Math.floor(rawOfflineSec / 60);
                const oilPenalty = oilDirts.length * oilMinutes * 5;
                if (oilPenalty > 0) {
                    this.loseReputation(oilPenalty);
                    this.offlineOilPenalty = oilPenalty;
                    this.offlineOilMinutes = oilMinutes;
                    this.offlineOilCount = oilDirts.length;
                }
            }
        }
    }

});
