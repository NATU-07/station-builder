class UI {
    constructor(station, onPurchase) {
        this.station = station;
        this._onPurchase = onPurchase;
        this.onPurchase = null;
        this.stageNameEl = document.getElementById('stage-name');
        this.reputationEl = document.getElementById('reputation-display');
        this.moneyEl = document.getElementById('money-display');
        this.passengerEl = document.getElementById('passenger-display');
        this.progressBar = document.getElementById('progress-bar');
        this.upgradesContainer = document.getElementById('upgrades-container');
        this.itemsContainer = document.getElementById('items-container');
        this.messagePopup = document.getElementById('message-popup');
        this.messageText = document.getElementById('message-text');
        this.messageSub = document.getElementById('message-sub');
        this.currentTab = 'upgrades';
        this.itemDefs = [];

        this.setupTabs();
        this.loadItems();
        this.setupSpecialDirtModal();
    }

    // 特殊汚れUI（setupSpecialDirtModal / renderSpecialDirtList / updateWarnings /
    //              showSpecialDirtBanner など）は src/specialDirtUI.js で定義
    // イベントログUI（renderEventLog / showEventLogDetail / getEventRewardItems）
    //              は src/eventLogUI.js で定義

    setupTabs() {
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentTab = tab.dataset.tab;
                if (window._sound) window._sound.play('flip', 0.3);
                this.refreshTab();
            });
        });
    }

    async loadItems() {
        try {
            const res = await fetch('data/items.json');
            const data = await res.json();
            this.itemDefs = data.items;
            this.station.itemData = data.items;
        } catch (e) {
            this.itemDefs = [];
        }
    }

    refreshTab() {
        if (this.currentTab === 'upgrades') {
            this.upgradesContainer.style.display = 'flex';
            this.itemsContainer.style.display = 'none';
            this.renderUpgrades();
        } else if (this.currentTab === 'shop') {
            this.upgradesContainer.style.display = 'none';
            this.itemsContainer.style.display = 'flex';
            this.renderShop();
        } else if (this.currentTab === 'placed') {
            this.upgradesContainer.style.display = 'none';
            this.itemsContainer.style.display = 'flex';
            this.renderPlacedItems();
        } else if (this.currentTab === 'eventlog') {
            this.upgradesContainer.style.display = 'none';
            this.itemsContainer.style.display = 'flex';
            this.renderEventLog();
        } else if (this.currentTab === 'achievements') {
            this.upgradesContainer.style.display = 'none';
            this.itemsContainer.style.display = 'flex';
            if (this.achievements) {
                this.achievements.renderList(this.itemsContainer);
            }
        }
    }

    update() {
        const sd = this.station.getCurrentStageData();
        this.stageNameEl.textContent = sd.name;
        this.updateStageProgress();
        const repInfo = this.station.getReputationInfo();
        const nextRep = this.station.getNextReputationInfo();
        const repText = repInfo.stars + ' ' + repInfo.name;
        const repProgress = nextRep ? ' (' + Math.floor(this.station.reputation) + '/' + nextRep.required + ')' : ' (MAX)';
        this.reputationEl.textContent = repText + repProgress;
        const incomePerMin = Math.floor(this.station.getIncomePerMin() + this.station.getAutoIncome());
        this.moneyEl.textContent = this.formatMoney(Math.floor(this.station.money)) + ' 円';
        this.passengerEl.textContent = '駅にいる人: ' + this.station.currentPassengers.length + '人  |  累計: ' + this.formatMoney(this.station.totalVisitors) + '人';

        // 収入表示の更新
        if (!this.incomeEl) {
            this.incomeEl = document.createElement('span');
            this.incomeEl.style.cssText = 'font-size:11px;color:#8a7a5a;';
            this.moneyEl.parentNode.appendChild(this.incomeEl);
        }
        this.incomeEl.textContent = '(+' + this.formatMoney(incomePerMin) + '円/分)';
        this.progressBar.style.width = (this.station.getProgress() * 100) + '%';

        // アップグレードタブの場合、購入可能状態を更新
        if (this.currentTab === 'upgrades') {
            this.updateUpgradeButtons();
        }
        // 設置済みタブの場合、耐久値バーだけ更新（再描画しない）
        if (this.currentTab === 'placed') {
            this.updatePlacedItemBars();
        }
        // 警告表示・特殊汚れバッジの更新
        this.updateWarnings();
    }

    renderUpgrades() {
        this.upgradesContainer.innerHTML = '';
        const ups = this.station.getUpgrades();

        if (ups.length === 0) {
            this.upgradesContainer.innerHTML = '<div style="text-align:center;width:100%;padding:20px;color:#888;font-size:16px;">🎉 すべてのアップグレード完了！</div>';
            return;
        }

        for (const up of ups) {
            const btn = document.createElement('button');
            btn.className = 'upgrade-btn';
            const isPurchased = this.station.purchased.has(up.id);
            const canAfford = this.station.canAfford(up);
            const canUnlock = this.station.canUnlock(up);

            if (isPurchased) btn.classList.add('purchased');
            else if (!canUnlock) btn.classList.add('locked');
            else if (!canAfford) btn.classList.add('locked');

            const effectTags = up.effect ? this.buildEffectTags(up.effect) : '';
            const upCost = this.station.getUpgradeCost(up);
            let costText = this.formatMoney(upCost) + ' 円';
            if (isPurchased) {
                costText = '✅ 済み';
            } else if (!canUnlock) {
                costText = '🔒 累計 ' + this.formatMoney(up.requireVisitors) + '人で解放';
            }

            btn.innerHTML = `
                <span class="upgrade-icon">${up.icon}</span>
                <span class="upgrade-info">
                    <span class="upgrade-name">${up.name}</span>
                    <span class="upgrade-cost">${costText}</span>
                    <span class="upgrade-desc">${up.description}</span>
                    ${effectTags}
                </span>`;

            if (!isPurchased && canAfford && canUnlock) {
                btn.addEventListener('click', () => (this.onPurchase || this._onPurchase)(up));
            }
            this.upgradesContainer.appendChild(btn);
        }

        // 進化ボタン（最終ステージ以外で全アップグレード購入後に表示）
        if (this.station.stage < this.station.data.stages.length - 1 && this.station.getProgress() >= 1) {
            const status = this.station.getEvolveStatus();
            const evolveBtn = document.createElement('button');
            evolveBtn.className = 'upgrade-btn';

            if (status.visitorsOk) {
                evolveBtn.style.background = '#fff4dd';
                evolveBtn.style.borderColor = '#ffaa44';
                evolveBtn.innerHTML = `
                    <span class="upgrade-icon">⭐</span>
                    <span class="upgrade-info">
                        <span class="upgrade-name">駅を進化させる！</span>
                        <span class="upgrade-cost">次の段階へ</span>
                    </span>`;
                evolveBtn.addEventListener('click', () => (this.onPurchase || this._onPurchase)({ id: '__evolve__' }));
            } else {
                evolveBtn.classList.add('locked');
                evolveBtn.style.background = '#fff4dd';
                evolveBtn.style.borderColor = '#ddbb77';
                evolveBtn.innerHTML = `
                    <span class="upgrade-icon">🔒</span>
                    <span class="upgrade-info">
                        <span class="upgrade-name">駅を進化させる！</span>
                        <span class="upgrade-cost">累計 ${this.formatMoney(status.requiredVisitors)}人 必要（現在: ${this.formatMoney(status.currentVisitors)}人）</span>
                    </span>`;
            }
            this.upgradesContainer.appendChild(evolveBtn);
        }
    }

    renderShop() {
        this.itemsContainer.innerHTML = '';

        if (this.itemDefs.length === 0) {
            this.itemsContainer.innerHTML = '<div style="padding:20px;color:#888;">読み込み中...</div>';
            return;
        }

        const categories = {
            attract: 'ひとを呼ぶもの',
            satisfy: 'こころを満たすもの',
            income: 'おかねを稼ぐもの'
        };

        for (const [cat, label] of Object.entries(categories)) {
            const placedIds = new Set(this.station.placedItems.map(p => p.id));
            const items = this.itemDefs.filter(i =>
                i.category === cat
                && (i.requireStage || 0) <= this.station.stage
                && !i.eventOnly
            );
            if (items.length === 0) continue;

            const header = document.createElement('div');
            header.style.cssText = 'width:100%;font-size:11px;color:#8a7a5a;font-weight:700;margin-top:4px;';
            header.textContent = label;
            this.itemsContainer.appendChild(header);

            for (const item of items) {
                const isPlaced = placedIds.has(item.id);
                const displayCost = this.station.getItemCost(item);
                const canAfford = !isPlaced && this.station.money >= displayCost;
                const btn = document.createElement('button');
                btn.className = 'item-btn';
                if (isPlaced) {
                    btn.style.opacity = '0.5';
                    btn.style.cursor = 'default';
                } else if (!canAfford) {
                    btn.style.opacity = '0.4';
                }

                const shopTags = this.buildShopEffectTags(item.effect);
                const costText = isPlaced
                    ? '<span style="font-size:10px;color:#88aa66;font-weight:700;">設置ずみ</span>'
                    : '<span style="font-size:10px;color:#8a6a3a;">' + this.formatMoney(displayCost) + '円 | 耐久:' + item.durability + '</span>';
                btn.innerHTML =
                    '<span style="font-size:18px;">' + item.icon + '</span>' +
                    '<span style="display:flex;flex-direction:column;">' +
                        '<span style="font-weight:700;">' + item.name + '</span>' +
                        '<span style="font-size:10px;color:#888;">' + item.description + '</span>' +
                        costText +
                        shopTags +
                    '</span>';

                if (!isPlaced && canAfford) {
                    btn.addEventListener('click', () => {
                        if (this.station.placeItem(item)) {
                            if (window._sound) window._sound.play('stamp');
                            this.showMessage(item.name + ' を置いた', item.description);
                            this.renderShop();
                        }
                    });
                }
                this.itemsContainer.appendChild(btn);
            }
        }

        // イベント限定アイテム
        this.renderEventItems();
    }

    renderEventItems() {
        // 永久解放されたイベントアイテム + バフ中の限定アイテム
        const unlocked = this.station.unlockedEventItems;
        const timedIds = this.station.eventSystem
            ? this.station.eventSystem.getActiveTimedItems() : [];

        const placedIds = new Set(this.station.placedItems.map(p => p.id));
        const eventItems = this.itemDefs.filter(i =>
            i.eventOnly && (unlocked.has(i.id) || timedIds.includes(i.id))
        );
        if (eventItems.length === 0) return;

        const header = document.createElement('div');
        header.style.cssText = 'width:100%;font-size:11px;color:#cc6600;font-weight:700;margin-top:8px;';
        header.textContent = 'おもいでの品';
        this.itemsContainer.appendChild(header);

        const stageMult = EVENT_ITEM_STAGE_MULT[this.station.stage] || 1;
        for (const item of eventItems) {
            const isPlaced = placedIds.has(item.id);
            const scaledCost = Math.ceil(item.cost * stageMult);
            const canAfford = !isPlaced && this.station.money >= scaledCost;
            const isTimed = timedIds.includes(item.id) && !unlocked.has(item.id);
            const btn = document.createElement('button');
            btn.className = 'item-btn';
            btn.style.borderColor = '#ffaa33';
            btn.style.background = '#fff8ee';
            if (isPlaced) {
                btn.style.opacity = '0.5';
                btn.style.cursor = 'default';
            } else if (!canAfford) {
                btn.style.opacity = '0.4';
            }

            const timedTag = isTimed ? '<span style="color:#cc4400;font-size:9px;font-weight:700;">期間限定</span>' : '';
            const shopTags = this.buildShopEffectTags(item.effect);
            const costText = isPlaced
                ? '<span style="font-size:10px;color:#88aa66;font-weight:700;">設置ずみ</span>'
                : '<span style="font-size:10px;color:#cc6600;">' + this.formatMoney(scaledCost) + '円 | 耐久:' + item.durability + '</span>';
            btn.innerHTML =
                '<span style="font-size:18px;">' + item.icon + '</span>' +
                '<span style="display:flex;flex-direction:column;">' +
                    '<span style="font-weight:700;color:#cc6600;">' + item.name + '</span>' +
                    timedTag +
                    '<span style="font-size:10px;color:#888;">' + item.description + '</span>' +
                    costText +
                    shopTags +
                '</span>';

            if (canAfford) {
                const costForPurchase = scaledCost;
                btn.addEventListener('click', () => {
                    if (this.station.money >= costForPurchase) {
                        this.station.money -= costForPurchase;
                        // placeItemにコスト0で渡す（既に引いたので）
                        const fakeItem = { ...item, cost: 0 };
                        this.station.placeItem(fakeItem);
                        if (window._sound) window._sound.play('stamp');
                        this.showMessage(item.name + ' を置いた', '-' + this.formatMoney(costForPurchase) + '円');
                        this.renderShop();
                    }
                });
            }
            this.itemsContainer.appendChild(btn);
        }
    }

    renderPlacedItems() {
        this.itemsContainer.innerHTML = '';
        const items = this.station.placedItems;

        if (items.length === 0) {
            this.itemsContainer.innerHTML = '<div style="padding:20px;color:#a89878;width:100%;text-align:center;">まだなにも置いていない</div>';
            return;
        }

        // 自動手入れパネル
        this.renderAutoMaintainPanel(items);

        const amUnlocked = this.station.isAutoMaintainUnlocked();
        const amEnabled = this.station.autoMaintain.enabled;
        const amSelected = this.station.autoMaintain.selectedIds;

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const ratio = item.durability / item.maxDurability;
            const isBroken = item.durability <= 0;
            const btn = document.createElement('div');
            btn.className = 'item-btn';
            if (isBroken) btn.classList.add('broken');
            else if (ratio < 0.2) btn.classList.add('broken');
            else if (ratio < 0.5) btn.classList.add('warn');

            const fillColor = isBroken ? '#999' : ratio > 0.5 ? '#66bb44' : ratio > 0.2 ? '#ccaa22' : '#cc4422';
            const statusLabel = isBroken
                ? '<span style="font-size:9px;color:#b85a3a;font-weight:700;">こわれてしまった</span>'
                : '<span class="dur-label" style="font-size:9px;color:#888;">耐久: ' + Math.floor(item.durability) + ' / ' + item.maxDurability + '</span>';

            const sellPrice = this.station.getSellPrice(i);
            const actionBtn = isBroken
                ? '<button class="restore-btn" style="font-size:10px;padding:3px 8px;border:1px solid #c08050;border-radius:2px;background:#f8f0e8;cursor:pointer;color:#8a5a30;font-weight:700;">なおす ' + this.formatMoney(this.station.getRestoreCost(i)) + '円</button>'
                : '<button class="maintain-btn" style="font-size:10px;padding:3px 8px;border:1px solid #a0b880;border-radius:2px;background:#f0f4e8;cursor:pointer;color:#5a7a3a;">手入れ ' + this.formatMoney(this.station.getRepairCost(i)) + '円</button>';
            const sellBtn = '<button class="sell-btn" style="font-size:10px;padding:3px 8px;border:1px solid #b0a090;border-radius:2px;background:#f4f0ea;cursor:pointer;color:#8a7a6a;">売る ' + this.formatMoney(sellPrice) + '円</button>';

            const isSelected = amSelected.has(item.instanceId);
            const amBadge = amUnlocked && !isBroken
                ? '<button class="am-item-toggle" data-idx="' + i + '" title="自動手入れ対象" style="font-size:10px;padding:2px 6px;border:1px solid ' + (isSelected ? '#88aa44' : '#ccc4b0') + ';border-radius:2px;background:' + (isSelected ? '#e8f4d8' : '#f4f0ea') + ';cursor:pointer;color:' + (isSelected ? '#4a7a2a' : '#8a7a6a') + ';font-family:inherit;">🔧 ' + (isSelected ? 'ON' : 'OFF') + '</button>'
                : '';

            btn.innerHTML =
                '<span style="font-size:18px;' + (isBroken ? 'opacity:0.4;' : '') + '">' + item.icon + '</span>' +
                '<span style="display:flex;flex-direction:column;flex:1;">' +
                    '<span style="font-weight:700;font-size:12px;' + (isBroken ? 'color:#999;' : '') + '">' + item.name + '</span>' +
                    '<div class="durability-bar">' +
                        '<div class="durability-fill" style="width:' + (ratio * 100) + '%;background:' + fillColor + ';"></div>' +
                    '</div>' +
                    statusLabel +
                '</span>' +
                '<span style="display:flex;gap:4px;flex-direction:column;">' + amBadge + actionBtn + sellBtn + '</span>';

            if (isBroken) {
                const restoreBtn = btn.querySelector('.restore-btn');
                restoreBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const cost = this.station.getRestoreCost(i);
                    const result = this.station.restoreItem(i);
                    if (result) {
                        this.showMessage(item.name + ' が蘇った', '-' + this.formatMoney(cost) + '円');
                        this.renderPlacedItems();
                    } else {
                        this.showMessage('お金が足りない…', 'あと ' + this.formatMoney(cost - Math.floor(this.station.money)) + '円');
                    }
                });
            } else {
                const maintainBtn = btn.querySelector('.maintain-btn');
                maintainBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const cost = this.station.getRepairCost(i);
                    const result = this.station.maintainItem(i);
                    if (result) {
                        if (window._sound) window._sound.playChime();
                        this.showMessage(item.name + ' の手入れをした', '-' + this.formatMoney(cost) + '円');
                        this.renderPlacedItems();
                    } else {
                        this.showMessage('お金が足りない…', 'あと ' + this.formatMoney(cost - Math.floor(this.station.money)) + '円');
                    }
                });
            }

            // 売却ボタン
            const sellBtnEl = btn.querySelector('.sell-btn');
            sellBtnEl.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showSellConfirm(i, item);
            });

            // 自動手入れ 個別ON/OFFトグル
            const amBtn = btn.querySelector('.am-item-toggle');
            if (amBtn) {
                amBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    if (this.station.autoMaintain.selectedIds.has(item.instanceId)) {
                        this.station.autoMaintain.selectedIds.delete(item.instanceId);
                    } else {
                        this.station.autoMaintain.selectedIds.add(item.instanceId);
                    }
                    this.station.save();
                    this.renderPlacedItems();
                });
            }

            this.itemsContainer.appendChild(btn);
        }
    }

    renderAutoMaintainPanel(items) {
        if (!this.station.isAutoMaintainUnlocked()) return;
        const am = this.station.autoMaintain;
        const panel = document.createElement('div');
        // ON/OFF でパネル全体の色が変わる
        const bg = am.enabled ? '#eaf6e0' : '#f5efe4';
        const border = am.enabled ? '#88b866' : '#d4c4a8';
        panel.style.cssText = 'width:100%;background:' + bg + ';border:2px solid ' + border + ';border-radius:4px;padding:12px 14px;margin-bottom:10px;font-family:"Zen Maru Gothic",sans-serif;font-size:12px;color:#4a3a2a;transition:background 0.2s,border-color 0.2s;';

        // 大きいON/OFFトグルボタン
        const toggleBg = am.enabled ? '#5aaa3a' : '#bbb0a0';
        const toggleLabel = am.enabled ? 'ON' : 'OFF';
        const toggleBtn =
            '<button class="am-toggle-big" style="font-size:16px;font-weight:700;padding:8px 22px;border:none;border-radius:24px;background:' + toggleBg + ';color:#fff;cursor:pointer;font-family:inherit;box-shadow:0 2px 6px rgba(0,0,0,0.15);min-width:90px;letter-spacing:1px;">' + toggleLabel + '</button>';

        panel.innerHTML =
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">' +
                '<div style="flex:1;min-width:200px;">' +
                    '<div style="font-size:14px;font-weight:700;color:#8a5a30;margin-bottom:2px;">🔧 自動手入れ機能</div>' +
                    '<div style="font-size:10px;color:#888;line-height:1.5;">耐久30%以下で自動発動 / プレイ中は1.2倍・留守中は定価</div>' +
                '</div>' +
                toggleBtn +
            '</div>' +
            '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:10px;padding-top:8px;border-top:1px dashed ' + (am.enabled ? '#b0d088' : '#d4c4a8') + ';">' +
                '<span style="font-size:11px;color:#666;font-weight:700;">対象アイテム:</span>' +
                '<button class="am-select-all" style="font-size:10px;padding:3px 10px;border:1px solid #88aa55;border-radius:2px;background:#f0f8e0;cursor:pointer;color:#4a7a2a;font-family:inherit;font-weight:700;">全部選択</button>' +
                '<button class="am-deselect-all" style="font-size:10px;padding:3px 10px;border:1px solid #b0a090;border-radius:2px;background:#f4f0ea;cursor:pointer;color:#8a7a6a;font-family:inherit;">全部解除</button>' +
                '<span style="font-size:11px;color:' + (am.enabled ? '#4a7a2a' : '#888') + ';font-weight:700;margin-left:auto;">' + am.selectedIds.size + ' / ' + items.filter(it => it.durability > 0).length + ' 個が対象</span>' +
            '</div>';
        this.itemsContainer.appendChild(panel);

        panel.querySelector('.am-toggle-big').addEventListener('click', () => {
            this.station.autoMaintain.enabled = !this.station.autoMaintain.enabled;
            if (window._sound) window._sound.play('stamp');
            this.station.save();
            this.renderPlacedItems();
        });
        panel.querySelector('.am-select-all').addEventListener('click', () => {
            for (const item of items) {
                if (item.durability > 0) this.station.autoMaintain.selectedIds.add(item.instanceId);
            }
            this.station.save();
            this.renderPlacedItems();
        });
        panel.querySelector('.am-deselect-all').addEventListener('click', () => {
            this.station.autoMaintain.selectedIds.clear();
            this.station.save();
            this.renderPlacedItems();
        });
    }

    showSellConfirm(index, item) {
        const isEvent = this.station.isEventItem(index);
        const price = this.station.getSellPrice(index);

        // 確認モーダル生成
        const existing = document.querySelector('.sell-confirm-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.className = 'sell-confirm-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(40,30,20,0.5);z-index:40;display:flex;justify-content:center;align-items:center;';

        let message = '<b>' + item.name + '</b> を売りますか？<br>' +
            '<span style="color:#8a7a5a;font-size:13px;">売却額: ' + this.formatMoney(price) + '円</span>';

        if (isEvent) {
            message += '<br><span style="color:#b85a3a;font-size:11px;margin-top:6px;display:block;">おもいでの品です。再購入時はステージに応じて値段が変わります。</span>';
        }

        const modal = document.createElement('div');
        modal.style.cssText = 'background:#f8f2e8;border:1px solid #d4c4a8;border-radius:4px;padding:24px 32px;max-width:320px;text-align:center;box-shadow:0 4px 20px rgba(40,30,10,0.25);font-family:"Zen Maru Gothic",sans-serif;font-size:14px;color:#4a3a2a;';
        modal.innerHTML = '<div style="margin-bottom:16px;">' + message + '</div>' +
            '<div style="display:flex;gap:8px;justify-content:center;">' +
                '<button class="sell-yes" style="padding:8px 20px;border:1px solid #c08050;border-radius:2px;background:#f8f0e8;cursor:pointer;color:#8a5a30;font-weight:700;font-family:inherit;font-size:13px;">売る</button>' +
                '<button class="sell-no" style="padding:8px 20px;border:1px solid #b0a090;border-radius:2px;background:#f4f0ea;cursor:pointer;color:#8a7a6a;font-family:inherit;font-size:13px;">やめる</button>' +
            '</div>';

        overlay.appendChild(modal);
        document.getElementById('game-wrapper').appendChild(overlay);

        const close = () => overlay.remove();

        modal.querySelector('.sell-no').addEventListener('click', close);
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        modal.querySelector('.sell-yes').addEventListener('click', () => {
            const earned = this.station.sellItem(index);
            if (window._sound) window._sound.play('coin');
            this.showMessage(item.name + ' を売った', '+' + this.formatMoney(earned) + '円');
            close();
            this.renderPlacedItems();
        });
    }

    updatePlacedItemBars() {
        const items = this.station.placedItems;
        const itemBtns = this.itemsContainer.querySelectorAll('.item-btn');

        // アイテム数が変わったら再描画
        if (items.length !== itemBtns.length) {
            this.renderPlacedItems();
            return;
        }

        // 壊れた瞬間を検知（restore-btnがないのにdurability=0のアイテムがある）
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const btn = itemBtns[i];
            if (item.durability <= 0 && !btn.querySelector('.restore-btn')) {
                this.renderPlacedItems();
                return;
            }
        }

        // バーだけ更新（再描画しない）
        const bars = this.itemsContainer.querySelectorAll('.durability-fill');
        const labels = this.itemsContainer.querySelectorAll('.dur-label');
        let labelIdx = 0;
        for (let i = 0; i < items.length && i < bars.length; i++) {
            const item = items[i];
            if (item.durability <= 0) continue;
            const ratio = item.durability / item.maxDurability;
            const fillColor = ratio > 0.5 ? '#66bb44' : ratio > 0.2 ? '#ccaa22' : '#cc4422';
            bars[i].style.width = (ratio * 100) + '%';
            bars[i].style.background = fillColor;
            if (labels[labelIdx]) {
                labels[labelIdx].textContent = '耐久: ' + Math.floor(item.durability) + ' / ' + item.maxDurability;
                labelIdx++;
            }
        }
    }

    updateUpgradeButtons() {
        const ups = this.station.getUpgrades();
        const btns = this.upgradesContainer.querySelectorAll('.upgrade-btn');
        let needsRerender = false;

        for (let i = 0; i < ups.length && i < btns.length; i++) {
            const up = ups[i];
            const btn = btns[i];
            const isPurchased = this.station.purchased.has(up.id);
            if (isPurchased) continue;

            const canAfford = this.station.canAfford(up);
            const canUnlock = this.station.canUnlock(up);
            const wasLocked = btn.classList.contains('locked');
            const isNowBuyable = canAfford && canUnlock;

            if (wasLocked && isNowBuyable) {
                needsRerender = true;
                break;
            }
            if (!wasLocked && !isNowBuyable) {
                needsRerender = true;
                break;
            }
        }

        if (needsRerender) this.renderUpgrades();
    }

    updateStageProgress() {
        const el = document.getElementById('stage-progress');
        if (!el) return;
        const total = this.station.data.stages.length;
        const current = this.station.stage;
        let html = '<span>Stage ' + current + '/' + (total - 1) + '</span>';
        for (let i = 0; i < total; i++) {
            const cls = i < current ? 'done' : i === current ? 'current' : '';
            html += '<span class="stage-dot ' + cls + '"></span>';
        }
        el.innerHTML = html;
    }

    formatMoney(num) {
        return num.toLocaleString();
    }

    buildEffectTags(effectStr) {
        const parts = effectStr.split(' / ');
        return '<span style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px;">' +
            parts.map(p => {
                let cls = 'progress';
                if (p.includes('乗客')) cls = 'passenger';
                else if (p.includes('収益')) cls = 'income';
                else if (p.includes('評判')) cls = 'reputation';
                else if (p.includes('きれい') || p.includes('掃除')) cls = 'clean';
                return '<span class="effect-tag ' + cls + '">' + p + '</span>';
            }).join('') + '</span>';
    }

    buildShopEffectTags(effect) {
        const tags = [];
        if (effect.passengerBonus) {
            tags.push('<span class="effect-tag passenger">乗客 +' + Math.round(effect.passengerBonus * 100) + '%</span>');
        }
        if (effect.incomeBonus) {
            tags.push('<span class="effect-tag income">収益 +' + Math.round(effect.incomeBonus * 100) + '%</span>');
        }
        if (effect.autoIncome) {
            tags.push('<span class="effect-tag income">自動収入 +' + effect.autoIncome + '円/分</span>');
        }
        if (tags.length === 0) return '';
        return '<span style="display:flex;gap:3px;flex-wrap:wrap;margin-top:2px;">' + tags.join('') + '</span>';
    }

    // --- イベント記録タブ ---

    // renderEventLog / showEventLogDetail / getEventRewardItems は
    // src/eventLogUI.js で UI.prototype に追加される

    showMessage(text, sub) {
        this.messageText.textContent = text;
        this.messageSub.textContent = sub || '';
        this.messagePopup.style.display = 'block';
        setTimeout(() => { this.messagePopup.style.display = 'none'; }, 2000);
    }

    // --- クリア演出 ---

    showClearCelebration() {
        const overlay = document.getElementById('clear-overlay');
        const msg = document.getElementById('clear-message');
        const stats = document.getElementById('clear-stats');
        const closeBtn = document.getElementById('clear-close-btn');

        msg.innerHTML = 'さびれた無人駅から始まった物語。<br>'
            + 'たくさんの人が降り立ち、たくさんの思い出が生まれ、<br>'
            + 'この駅は「伝説」になりました。';

        stats.innerHTML = '累計利用客: ' + this.formatMoney(this.station.totalVisitors) + '人<br>'
            + '評判: ' + this.station.getReputationInfo().name + '<br>'
            + '設置アイテム: ' + this.station.placedItems.length + '個';

        overlay.style.display = 'flex';

        closeBtn.addEventListener('click', () => {
            overlay.style.display = 'none';
        });
    }

    // --- イベントUI ---

    showEventNotification(event, messages) {
        const text = event.icon + ' ' + event.name;
        const msgLine = messages.length > 0 ? messages.join('  ') : (event.description || '');
        this.messageText.textContent = text;
        this.messageSub.textContent = msgLine;
        this.messagePopup.style.display = 'block';
        setTimeout(() => { this.messagePopup.style.display = 'none'; }, 3500);
    }

    showChoiceEvent(event, onChoice) {
        // 選択イベント用モーダルを動的生成
        let modal = document.getElementById('event-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'event-modal';
            document.getElementById('game-wrapper').appendChild(modal);
        }

        const eventSystem = this.station.eventSystem;
        const scaledCosts = event.choices.map(c =>
            eventSystem ? eventSystem.getScaledCost(c.cost || 0, event.minStage) : (c.cost || 0)
        );

        let choicesHtml = '';
        for (let i = 0; i < event.choices.length; i++) {
            const c = event.choices[i];
            const costTag = scaledCosts[i] > 0
                ? '<span class="event-choice-cost">-' + this.formatMoney(scaledCosts[i]) + '円</span>'
                : '';
            choicesHtml += '<button class="event-choice-btn" data-index="' + i + '" data-cost="' + scaledCosts[i] + '">'
                + c.label + costTag + '</button>';
        }

        const storyHtml = event.story
            ? '<div class="event-modal-story">' + event.story + '</div>'
            : '';

        modal.innerHTML = '<div class="event-modal-content">'
            + '<div class="event-modal-icon">' + event.icon + '</div>'
            + '<div class="event-modal-title">' + event.name + '</div>'
            + '<div class="event-modal-desc">' + event.description + '</div>'
            + storyHtml
            + '<div id="event-modal-warning" style="display:none;text-align:center;color:#cc4444;font-weight:700;font-size:13px;margin-bottom:8px;"></div>'
            + '<div class="event-modal-choices">' + choicesHtml + '</div>'
            + '</div>';

        modal.style.display = 'flex';

        const buttons = modal.querySelectorAll('.event-choice-btn');
        const warningEl = document.getElementById('event-modal-warning');
        const station = this.station;
        const formatMoney = this.formatMoney.bind(this);

        // ボタンの有効/無効を更新する関数
        const updateButtons = () => {
            buttons.forEach(btn => {
                const cost = parseInt(btn.dataset.cost);
                const canAfford = cost <= 0 || station.money >= cost;
                btn.style.opacity = canAfford ? '1' : '0.4';
                btn.style.cursor = canAfford ? 'pointer' : 'not-allowed';
            });
        };

        // 初回更新
        updateButtons();

        // 定期的にボタン状態を更新（お金が貯まったら選択可能に）
        const updateInterval = setInterval(() => {
            if (modal.style.display === 'none') {
                clearInterval(updateInterval);
                return;
            }
            updateButtons();
        }, 500);

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                const index = parseInt(btn.dataset.index);
                const cost = parseInt(btn.dataset.cost);
                const canAfford = cost <= 0 || station.money >= cost;

                if (!canAfford) {
                    // お金が足りない！テロップ表示
                    warningEl.textContent = 'お金が足りないみたい…  あと ' + formatMoney(cost - Math.floor(station.money)) + '円';
                    warningEl.style.display = 'block';
                    warningEl.style.animation = 'none';
                    warningEl.offsetHeight; // reflow
                    warningEl.style.animation = 'event-warning-shake 0.4s ease';
                    return;
                }

                // 選択実行
                clearInterval(updateInterval);
                warningEl.style.display = 'none';
                modal.style.display = 'none';
                onChoice(index);
            });
        });
    }

    updateBuffDisplay(eventSystem) {
        let buffEl = document.getElementById('buff-display');
        if (!buffEl) {
            buffEl = document.createElement('div');
            buffEl.id = 'buff-display';
            document.getElementById('info-bar').appendChild(buffEl);
        }

        if (!eventSystem || !eventSystem.hasActiveBuffs()) {
            buffEl.style.display = 'none';
            return;
        }

        const summaries = eventSystem.getActiveBuffSummary();
        buffEl.style.display = 'inline-block';
        buffEl.textContent = '✨ ' + summaries.join(' | ');
    }
}
