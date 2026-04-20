class Achievements {
    constructor(station) {
        this.station = station;
        this.unlocked = new Set();
        this.cleanCount = 0;
        this.repairCount = 0;
        this.notifyQueue = []; // 通知キュー
        this.showingNotify = false;

        this.defs = [
            // --- おそうじ ---
            { id: 'first_clean', icon: '🧹', name: 'はじめの一歩', desc: '初めておそうじした', hidden: false },
            { id: 'clean_10', icon: '🧼', name: 'きれい好き', desc: '10回おそうじした', hidden: false },
            { id: 'clean_50', icon: '✨', name: '掃除の達人', desc: '50回おそうじした', hidden: false },
            { id: 'perfect_clean', icon: '🌟', name: 'ピカピカ！', desc: 'きれい度を100%にした', hidden: false },

            // --- アップグレード ---
            { id: 'first_upgrade', icon: '🔧', name: '改装開始', desc: '初めて設備を買った', hidden: false },
            { id: 'stage_complete', icon: '📋', name: '準備万端', desc: 'ステージの全設備を揃えた', hidden: false },

            // --- 進化 ---
            { id: 'evolve_1', icon: '🏠', name: '小さな駅へ', desc: 'Stage 1に進化した', hidden: false },
            { id: 'evolve_2', icon: '🏢', name: '中規模駅へ', desc: 'Stage 2に進化した', hidden: false },
            { id: 'evolve_3', icon: '🏬', name: '大きな駅へ', desc: 'Stage 3に進化した', hidden: false },
            { id: 'evolve_4', icon: '🏙️', name: '駅ビルへ', desc: 'Stage 4に進化した', hidden: false },
            { id: 'evolve_5', icon: '🚉', name: 'ターミナル駅へ', desc: 'Stage 5に進化した', hidden: true },
            { id: 'evolve_6', icon: '🗾', name: '観光名所駅へ', desc: 'Stage 6に進化した', hidden: true },
            { id: 'evolve_7', icon: '🤖', name: 'スマート駅へ', desc: 'Stage 7に進化した', hidden: true },
            { id: 'evolve_8', icon: '🌍', name: '国際駅へ', desc: 'Stage 8に進化した', hidden: true },
            { id: 'evolve_9', icon: '👑', name: '伝説の駅へ', desc: 'Stage 9に進化した', hidden: true },

            // --- 利用客 ---
            { id: 'visitors_100', icon: '👤', name: 'はじめての常連', desc: '累計100人が利用した', hidden: false },
            { id: 'visitors_1k', icon: '👥', name: 'にぎわいの駅', desc: '累計1,000人が利用した', hidden: false },
            { id: 'visitors_10k', icon: '🚶', name: '1万人突破', desc: '累計10,000人が利用した', hidden: false },
            { id: 'visitors_100k', icon: '🎊', name: '大盛況', desc: '累計100,000人が利用した', hidden: true },
            { id: 'visitors_1m', icon: '🏆', name: 'ミリオン駅', desc: '累計1,000,000人が利用した', hidden: true },

            // --- お金 ---
            { id: 'money_1k', icon: '💰', name: 'へそくり', desc: '1,000円貯めた', hidden: false },
            { id: 'money_10k', icon: '💴', name: '小金持ち', desc: '10,000円貯めた', hidden: false },
            { id: 'money_100k', icon: '💎', name: '資産家', desc: '100,000円貯めた', hidden: true },
            { id: 'money_1m', icon: '🤑', name: '大富豪', desc: '1,000,000円貯めた', hidden: true },

            // --- 評判 ---
            { id: 'rep_popular', icon: '⭐', name: '地元で人気', desc: '「地元で人気の駅」になった', hidden: false },
            { id: 'rep_famous', icon: '🌟', name: '全国区', desc: '「全国区の駅」になった', hidden: true },
            { id: 'rep_legend', icon: '🏅', name: '伝説', desc: '「伝説の駅」になった', hidden: true },

            // --- イベント ---
            { id: 'first_event', icon: '📢', name: 'はじめてのイベント', desc: 'イベントを初めて体験した', hidden: false },
            { id: 'events_10', icon: '📖', name: 'イベントコレクター', desc: '10種類のイベントを体験した', hidden: false },
            { id: 'cat_rescue', icon: '🐱', name: 'ネコの恩返し', desc: '迷子のネコを保護した', hidden: true },

            // --- アイテム ---
            { id: 'first_item', icon: '🛍️', name: 'はじめてのお買い物', desc: 'アイテムを初めて設置した', hidden: false },
            { id: 'repair_10', icon: '🔨', name: '修理上手', desc: 'アイテムを10回手入れした', hidden: false },

            // --- 特別 ---
            { id: 'game_clear', icon: '🎖️', name: '伝説の駅長', desc: '最終ステージで全設備を揃えた', hidden: true },
        ];
    }

    // --- チェック（毎フレームではなく、イベント発生時に呼ぶ）---

    checkAll() {
        const s = this.station;
        this.check('visitors_100', s.totalVisitors >= 100);
        this.check('visitors_1k', s.totalVisitors >= 1000);
        this.check('visitors_10k', s.totalVisitors >= 10000);
        this.check('visitors_100k', s.totalVisitors >= 100000);
        this.check('visitors_1m', s.totalVisitors >= 1000000);

        this.check('money_1k', s.money >= 1000);
        this.check('money_10k', s.money >= 10000);
        this.check('money_100k', s.money >= 100000);
        this.check('money_1m', s.money >= 1000000);

        this.check('rep_popular', s.reputationLevel >= 2);
        this.check('rep_famous', s.reputationLevel >= 5);
        this.check('rep_legend', s.reputationLevel >= 10);

        this.check('perfect_clean', s.cleanliness >= 100);
    }

    onClean() {
        this.cleanCount++;
        this.check('first_clean', true);
        this.check('clean_10', this.cleanCount >= 10);
        this.check('clean_50', this.cleanCount >= 50);
    }

    onPurchase(upgradeId) {
        this.check('first_upgrade', true);
        if (this.station.getProgress() >= 1) {
            this.check('stage_complete', true);
        }
    }

    onEvolve(stage) {
        if (stage >= 1 && stage <= 9) {
            this.check('evolve_' + stage, true);
        }
    }

    onEvent(eventId) {
        this.check('first_event', true);
        if (eventId === 'stray_cat') {
            this.check('cat_rescue', true);
        }
        const es = this.station.eventSystem;
        if (es && es.seenEvents.size >= 10) {
            this.check('events_10', true);
        }
    }

    onPlaceItem() {
        this.check('first_item', true);
    }

    onRepair() {
        this.repairCount++;
        this.check('repair_10', this.repairCount >= 10);
    }

    onGameClear() {
        this.check('game_clear', true);
    }

    // --- 内部 ---

    check(id, condition) {
        if (!condition || this.unlocked.has(id)) return;
        this.unlocked.add(id);
        const def = this.defs.find(d => d.id === id);
        if (def) {
            this.notifyQueue.push(def);
            this.showNext();
        }
    }

    // --- 通知表示 ---

    showNext() {
        if (this.showingNotify || this.notifyQueue.length === 0) return;
        this.showingNotify = true;
        const def = this.notifyQueue.shift();

        const el = document.createElement('div');
        el.className = 'achv-notify';
        el.innerHTML =
            '<span class="achv-notify-icon">' + def.icon + '</span>' +
            '<span class="achv-notify-info">' +
                '<span class="achv-notify-label">実績解除！</span>' +
                '<span class="achv-notify-name">' + def.name + '</span>' +
            '</span>';
        document.getElementById('game-wrapper').appendChild(el);

        if (window._sound) window._sound.play('stamp', 0.3);

        setTimeout(() => {
            el.classList.add('achv-notify-out');
            setTimeout(() => {
                el.remove();
                this.showingNotify = false;
                this.showNext();
            }, 500);
        }, 3000);
    }

    // --- 一覧パネル ---

    renderList(container) {
        container.innerHTML = '';
        const total = this.defs.length;
        const done = this.unlocked.size;

        const header = document.createElement('div');
        header.style.cssText = 'width:100%;font-size:12px;color:#8a7a5a;margin-bottom:6px;';
        header.textContent = '🏆 実績 ' + done + ' / ' + total;
        container.appendChild(header);

        for (const def of this.defs) {
            const got = this.unlocked.has(def.id);
            const el = document.createElement('div');
            el.className = 'achv-item' + (got ? ' achv-done' : '');

            if (got) {
                el.innerHTML =
                    '<span class="achv-item-icon">' + def.icon + '</span>' +
                    '<span class="achv-item-info">' +
                        '<span class="achv-item-name">' + def.name + '</span>' +
                        '<span class="achv-item-desc">' + def.desc + '</span>' +
                    '</span>';
            } else if (def.hidden) {
                el.innerHTML =
                    '<span class="achv-item-icon" style="opacity:0.3;">❓</span>' +
                    '<span class="achv-item-info">' +
                        '<span class="achv-item-name" style="color:#bbb;">？？？</span>' +
                        '<span class="achv-item-desc" style="color:#ccc;">隠し実績</span>' +
                    '</span>';
            } else {
                el.innerHTML =
                    '<span class="achv-item-icon" style="opacity:0.3;">' + def.icon + '</span>' +
                    '<span class="achv-item-info">' +
                        '<span class="achv-item-name" style="color:#aaa;">' + def.name + '</span>' +
                        '<span class="achv-item-desc" style="color:#bbb;">' + def.desc + '</span>' +
                    '</span>';
            }
            container.appendChild(el);
        }
    }

    // --- セーブ/ロード ---

    getSaveData() {
        return {
            unlocked: Array.from(this.unlocked),
            cleanCount: this.cleanCount,
            repairCount: this.repairCount
        };
    }

    loadSaveData(data) {
        if (!data) return;
        this.unlocked = new Set(data.unlocked || []);
        this.cleanCount = data.cleanCount || 0;
        this.repairCount = data.repairCount || 0;
    }
}
