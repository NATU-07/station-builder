// 特殊汚れUI（バッジ・モーダル・発生バナー）
// UI クラスのプロトタイプを拡張する形で、ui.js 本体のサイズを抑える。
// 読み込み順: ui.js → specialDirtUI.js（index.html で後に置く）

Object.assign(UI.prototype, {

    setupSpecialDirtModal() {
        const badge = document.getElementById('special-dirt-badge');
        if (badge) badge.addEventListener('click', () => this.openSpecialDirtModal());
        const closeBtn = document.getElementById('sdirt-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this.closeSpecialDirtModal());
        const modal = document.getElementById('sdirt-modal');
        if (modal) modal.addEventListener('click', (e) => {
            if (e.target === modal) this.closeSpecialDirtModal();
        });
    },

    openSpecialDirtModal() {
        this.renderSpecialDirtList();
        const modal = document.getElementById('sdirt-modal');
        if (modal) modal.style.display = 'flex';
    },

    closeSpecialDirtModal() {
        const modal = document.getElementById('sdirt-modal');
        if (modal) modal.style.display = 'none';
    },

    renderSpecialDirtList() {
        const container = document.getElementById('sdirt-list');
        if (!container || !this.station.specialDirt) return;
        const dirts = this.station.specialDirt.dirts;
        if (dirts.length === 0) {
            container.innerHTML = '<div class="sdirt-empty">特殊な汚れはありません</div>';
            return;
        }
        const actionLabels = {
            graffiti: '🎯 撃って消す',
            oil: '🧽 拭き取る',
            trashpile: '💪 連打で片付ける'
        };
        const warnLabels = {
            graffiti: '⚠ 放置で 乗客 -10% / 個',
            oil: '⚠ 放置で 1分ごとに評判 -5 / 個',
            trashpile: '⚠ 放置で アイテム効果 -10% / 個'
        };
        container.innerHTML = '';
        for (const dirt of dirts) {
            const def = this.station.specialDirt.getDef(dirt.type);
            if (!def) continue;
            const entry = document.createElement('div');
            entry.className = 'sdirt-entry';
            const warnHtml = warnLabels[dirt.type]
                ? '<div class="sdirt-warn">' + warnLabels[dirt.type] + '</div>'
                : '';
            entry.innerHTML =
                '<span class="sdirt-icon">' + def.icon + '</span>' +
                '<div class="sdirt-info">' +
                    '<div class="sdirt-name">' + def.name + '</div>' +
                    '<div class="sdirt-story">' + def.story + '</div>' +
                    warnHtml +
                '</div>' +
                '<button class="sdirt-btn">' + (actionLabels[dirt.type] || 'プレイ') + '</button>';

            const btn = entry.querySelector('.sdirt-btn');
            if (btn) btn.addEventListener('click', () => this.launchSpecialDirtGame(dirt));
            container.appendChild(entry);
        }
    },

    launchSpecialDirtGame(dirt) {
        if (!this.games || this.games.active) return;
        this.closeSpecialDirtModal();
        this.games.play(dirt).then(result => {
            result = result || {};
            if (result.cancelled) {
                this.renderSpecialDirtList();
                this.updateWarnings();
                return;
            }
            const resolved = this.station.specialDirt.resolveRemoval(dirt.id, result);
            if (resolved.ok) {
                const sub = (result.reward ? '+' + this.formatMoney(result.reward) + '円 ' : '') +
                            (result.cost ? '-' + this.formatMoney(result.cost) + '円' : '');
                this.showMessage('✨ ' + resolved.name + ' 完了', sub || '除去しました');
                this.station.save();
            }
            this.renderSpecialDirtList();
            this.updateWarnings();
        });
    },

    updateWarnings() {
        // お掃除中はキャンバスに「🧹 おそうじ X/Y」テキストが左上に出るので
        // 警告バナーと特殊汚れバッジを隠す（位置がかぶる + 掃除中は対応もできない）
        const cleaningActive = !!(this.cleaning && this.cleaning.active);

        const dw = document.getElementById('dirty-warning');
        const dangerous = this.station.isCleanlinessDangerous();
        const showWarning = dangerous && !cleaningActive;
        if (dw) dw.style.display = showWarning ? 'block' : 'none';
        if (showWarning) this._updateDirtyCountdown();

        const badge = document.getElementById('special-dirt-badge');
        const count = this.station.specialDirt ? this.station.specialDirt.dirts.length : 0;
        const showBadge = count > 0 && !cleaningActive;
        if (badge) {
            badge.style.display = showBadge ? 'block' : 'none';
            if (count > 0 && count !== this._lastBadgeCount) {
                // タイプごとのアイコンを並べて表示
                const icons = this.station.specialDirt.dirts
                    .map(d => this.station.specialDirt.getDef(d.type).icon).join('');
                badge.innerHTML = '🚨 <span class="sdirt-badge-icons">' + icons + '</span>'
                    + '<span id="sdirt-count">' + count + '</span> 件の特殊な汚れ';
                this._lastBadgeCount = count;
            } else if (count === 0) {
                this._lastBadgeCount = 0;
            }
        }

        // モーダルが開いている時は「件数が変わった時だけ」再描画
        // （毎フレーム innerHTML で再構築するとクリックが死ぬため）
        const modal = document.getElementById('sdirt-modal');
        if (modal && modal.style.display === 'flex' && this._lastSdirtCount !== count) {
            this._lastSdirtCount = count;
            this.renderSpecialDirtList();
        }
    },

    // 危険域での「あとN秒で評判-3」カウントダウンと進捗バーを更新
    // 毎フレーム呼ばれるが textContent と style.width は値が変わったときだけ書き込む
    // （innerHTML再構築はクリックを殺すので絶対NG）
    _updateDirtyCountdown() {
        const tickMs = this.station.DIRTY_TICK_MS;
        const accum = Math.min(tickMs, this.station.dirtyTickAccum);
        const sec = Math.max(0, Math.ceil((tickMs - accum) / 1000));
        const secEl = document.getElementById('dirty-countdown-sec');
        if (secEl && secEl.textContent !== String(sec)) {
            secEl.textContent = String(sec);
        }
        const fill = document.getElementById('dirty-progress-fill');
        if (fill) {
            const pct = Math.min(100, Math.round((accum / tickMs) * 100));
            if (this._lastDirtyPct !== pct) {
                this._lastDirtyPct = pct;
                fill.style.width = pct + '%';
            }
        }
    },

    // 発生時の大きなバナー表示
    showSpecialDirtBanner(def) {
        document.querySelectorAll('.sdirt-new-banner').forEach(b => b.remove());
        const banner = document.createElement('div');
        banner.className = 'sdirt-new-banner';
        banner.innerHTML =
            '<div class="sdirt-banner-icon">' + def.icon + '</div>' +
            '<div class="sdirt-banner-text">' +
              '<div class="sdirt-banner-title">🚨 ' + def.name + ' が発生！</div>' +
              '<div class="sdirt-banner-sub">' + def.story + '</div>' +
            '</div>';
        document.getElementById('game-wrapper').appendChild(banner);

        const badge = document.getElementById('special-dirt-badge');
        if (badge) {
            badge.classList.remove('sdirt-badge-new');
            void badge.offsetWidth;
            badge.classList.add('sdirt-badge-new');
        }
        setTimeout(() => {
            banner.classList.add('sdirt-banner-fade');
            setTimeout(() => banner.remove(), 500);
        }, 3500);
    }

});
