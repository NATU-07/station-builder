// イベントログUI（体験済みイベントの一覧表示と詳細モーダル）
// UI クラスのプロトタイプを拡張する形で、ui.js 本体のサイズを抑える。

Object.assign(UI.prototype, {

    renderEventLog() {
        this.itemsContainer.innerHTML = '';
        const eventSystem = this.station.eventSystem;
        if (!eventSystem || eventSystem.seenEvents.size === 0) {
            this.itemsContainer.innerHTML = '<div style="padding:20px;color:#a89878;width:100%;text-align:center;">まだ何も起きていない</div>';
            return;
        }

        const stageNames = [
            'Stage 0: さびれた無人駅', 'Stage 1: 小さな駅', 'Stage 2: 中規模駅',
            'Stage 3: 大きな駅', 'Stage 4: 駅ビル', 'Stage 5: ターミナル駅',
            'Stage 6: 観光名所駅', 'Stage 7: スマート駅', 'Stage 8: 国際駅',
            'Stage 9: 伝説の駅'
        ];

        const seenDefs = eventSystem.eventDefs.filter(e =>
            eventSystem.seenEvents.has(e.id)
        );

        let currentStage = -1;
        for (const event of seenDefs) {
            if (event.minStage !== currentStage) {
                currentStage = event.minStage;
                const header = document.createElement('div');
                header.className = 'eventlog-stage-header';
                header.textContent = stageNames[currentStage] || ('Stage ' + currentStage);
                this.itemsContainer.appendChild(header);
            }

            const entry = document.createElement('div');
            entry.className = 'eventlog-entry';

            const hasDetail = event.story || this.getEventRewardItems(event).length > 0;
            const toggleIcon = hasDetail ? '<span class="eventlog-toggle">▶</span>' : '';

            entry.innerHTML =
                '<span class="eventlog-entry-icon">' + event.icon + '</span>' +
                '<span class="eventlog-entry-name">' + event.name + '</span>' +
                toggleIcon;

            if (hasDetail) {
                entry.style.cursor = 'pointer';
                entry.addEventListener('click', () => {
                    this.showEventLogDetail(event);
                });
            }

            this.itemsContainer.appendChild(entry);
        }
    },

    showEventLogDetail(event) {
        const existing = document.querySelector('.eventlog-detail-overlay');
        if (existing) existing.remove();
        const existingDetail = document.querySelector('.eventlog-detail');
        if (existingDetail) existingDetail.remove();

        const overlay = document.createElement('div');
        overlay.className = 'eventlog-detail-overlay';
        document.getElementById('game-wrapper').appendChild(overlay);

        const detail = document.createElement('div');
        detail.className = 'eventlog-detail';

        let html = '<button class="eventlog-detail-close">✕</button>'
            + '<div class="eventlog-detail-header">'
            + '<span class="eventlog-detail-header-icon">' + event.icon + '</span>'
            + '<span class="eventlog-detail-header-name">' + event.name + '</span>'
            + '</div>'
            + '<div class="eventlog-detail-desc">' + event.description + '</div>';

        if (event.story) {
            html += '<div class="eventlog-entry-story">' + event.story + '</div>';
        }

        const rewardItems = this.getEventRewardItems(event);
        if (rewardItems.length > 0) {
            html += '<div class="eventlog-entry-reward">' +
                rewardItems.map(i => {
                    const itemStory = i.story
                        ? '<div class="eventlog-item-story">' + i.story + '</div>'
                        : '';
                    return i.icon + ' ' + i.name + itemStory;
                }).join('') + '</div>';
        }

        detail.innerHTML = html;
        document.getElementById('game-wrapper').appendChild(detail);

        const close = () => {
            overlay.remove();
            detail.remove();
        };
        overlay.addEventListener('click', close);
        detail.querySelector('.eventlog-detail-close').addEventListener('click', close);
    },

    getEventRewardItems(event) {
        const items = [];
        const findItem = (id) => this.itemDefs.find(i => i.id === id);

        if (event.effects && event.effects.unlockItem) {
            const item = findItem(event.effects.unlockItem);
            if (item) items.push(item);
        }
        if (event.choices) {
            for (const c of event.choices) {
                if (c.effects && c.effects.unlockItem) {
                    const item = findItem(c.effects.unlockItem);
                    if (item && !items.find(i => i.id === item.id)) items.push(item);
                }
            }
        }
        if (event.buff && event.buff.timedItem) {
            const item = findItem(event.buff.timedItem);
            if (item && !items.find(i => i.id === item.id)) items.push(item);
        }
        return items;
    }

});
