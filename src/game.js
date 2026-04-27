async function startGame() {
    let data;
    try {
        const res = await fetch('data/upgrades.json');
        if (!res.ok) throw new Error('データの読み込みに失敗しました');
        data = await res.json();
    } catch (e) {
        document.body.innerHTML = '<p style="text-align:center;padding:40px;font-size:18px;">⚠ ゲームデータの読み込みに失敗しました。ページをリロードしてください。</p>';
        return;
    }

    const canvas = document.getElementById('station-canvas');
    const station = new Station(data);
    const eventSystem = new EventSystem(station);
    station.eventSystem = eventSystem;
    const specialDirt = new SpecialDirtSystem(station);
    station.specialDirt = specialDirt;
    const effects = new EffectsManager(canvas);
    const renderer = new Renderer(canvas);
    const cleaning = new CleaningGame(canvas, station);
    const journal = new Journal();
    const sound = new SoundManager();

    // イベントデータ読み込み
    await eventSystem.loadEvents();

    // セーブデータがあればロード
    const loaded = station.load();

    // 実績
    const achievements = new Achievements(station);
    try {
        const achvRaw = localStorage.getItem('station-builder-achievements');
        if (achvRaw) achievements.loadSaveData(JSON.parse(achvRaw));
    } catch (e) { /* ignore */ }

    const ui = new UI(station, () => {});
    ui.achievements = achievements;
    ui.cleaning = cleaning;
    ui.games = new SpecialDirtGames(station, specialDirt, sound);

    // ヘルプモーダル & 解放時ヒント
    const help = new HelpManager();
    const hints = new Hints();
    window._help = help;
    window._hints = hints;

    // sound / effects は他モジュール (cleaning, achievements 等) から
    // window._sound / window._effects 経由で呼ばれているので debug 外でも公開する
    window._sound = sound;
    window._effects = effects;

    // チュートリアル
    const tutorial = new Tutorial({
        station, ui, cleaning, eventSystem, effects, journal, sound
    });

    // オフライン中の出来事を1つのレポートにまとめて表示（閉じるまで残る）
    if (loaded) {
        const sections = [];
        if (station.offlineEarned > 0) {
            const visitorText = station.offlineVisitors > 0 ? '\n🚶 来駅 +' + station.offlineVisitors + '人' : '';
            const capNote = station.offlineCapped ? '\n（12時間ぶんで頭打ち）' : '';
            sections.push({
                icon: '💰',
                title: 'おかえりなさい！',
                body: '留守の間に ' + station.offlineEarned.toLocaleString() + ' 円稼ぎました' + visitorText + capNote
            });
        }
        if (station.offlineOilPenalty) {
            sections.push({
                icon: '🛢️',
                title: '油汚れを放置した影響',
                body: '油汚れ ' + station.offlineOilCount + '個 × ' + station.offlineOilMinutes + '分\n評判 -' + station.offlineOilPenalty
            });
            station.offlineOilPenalty = null;
        }
        if (station.offlineAutoMaintainReport) {
            const r = station.offlineAutoMaintainReport;
            if (r.totalMaintains > 0 || r.brokenItems.length > 0) {
                let body = '';
                if (r.totalMaintains > 0) {
                    body += '自動手入れ ' + r.totalMaintains + '回\n-' + Math.floor(r.totalCost).toLocaleString() + '円';
                }
                if (r.brokenItems.length > 0) {
                    body += (body ? '\n' : '') + '壊れたアイテム: ' + r.brokenItems.join('、');
                }
                sections.push({ icon: '🔧', title: 'オフライン自動手入れ', body });
            }
            station.offlineAutoMaintainReport = null;
        }
        if (sections.length > 0) {
            setTimeout(() => showOfflineReport(sections, station, hints), 500);
        }
    }

    ui.onPurchase = (upgrade) => {
        if (upgrade.id === '__evolve__') {
            if (station.evolve()) {
                effects.triggerEvolution(480, 200);
                journal.show({ id: '__evolve_' + station.stage, icon: '⭐', name: station.getCurrentStageData().name }, station);
                ui.renderUpgrades();
                achievements.onEvolve(station.stage);
                station.save();
            }
            return;
        }

        if (station.purchase(upgrade)) {
            effects.triggerSparkle(480, 220, 15);
            if (window._sound) window._sound.play('stamp');
            journal.show(upgrade, station);
            ui.renderUpgrades();
            station.save();

            // 実績・チュートリアル通知
            achievements.onPurchase(upgrade.id);
            tutorial.onPurchase();

            // 最終ステージで全アップグレード完了 → クリア演出
            const lastStage = station.data.stages.length - 1;
            if (station.stage === lastStage && station.getProgress() >= 1) {
                setTimeout(() => ui.showClearCelebration(), 2500);
            }
        }
    };

    ui.renderUpgrades();

    // スマホ用: ボトムシートのトグルボタン
    const mobileToggle = document.getElementById('mobile-panel-toggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            const isOpen = document.body.classList.toggle('panel-open');
            mobileToggle.textContent = isOpen ? '▼ 閉じる' : '▲ メニュー';
        });
    }

    // スマホ横画面: お掃除FABを game-wrapper 直下に移動して position:absolute で
    // 表示する（iOS Safari は position:fixed + viewport-fit=cover で要素が
    // 画面外に隠れることがあるため、▲メニューと同じ仕組みに揃える）
    const cleanBtn = document.getElementById('clean-btn');
    const tabBarEl = document.getElementById('tab-bar');
    const wrapperEl = document.getElementById('game-wrapper');
    if (cleanBtn && tabBarEl && wrapperEl) {
        const mobileLandscapeMQ = window.matchMedia('(max-width: 1000px) and (orientation: landscape)');
        const placeFab = () => {
            if (mobileLandscapeMQ.matches) {
                if (cleanBtn.parentElement !== wrapperEl) wrapperEl.appendChild(cleanBtn);
            } else {
                if (cleanBtn.parentElement !== tabBarEl) tabBarEl.appendChild(cleanBtn);
            }
        };
        placeFab();
        mobileLandscapeMQ.addEventListener('change', placeFab);
    }

    // デバッグモード判定
    // - localhost / 127.0.0.1 / file:// は常に有効
    // - 公開URLでは ?debug=1 を付けると有効（自分だけ使える隠しコマンド用）
    const IS_DEBUG =
        ['localhost', '127.0.0.1', ''].includes(location.hostname) ||
        new URLSearchParams(location.search).get('debug') === '1';

    if (IS_DEBUG) {
        window._eventSystem = eventSystem;
        window._station = station;
        window._ui = ui;
        window._journal = journal;
        window._sound = sound;
        window._effects = effects;
        window._tutorial = tutorial;
        window._achievements = achievements;
        window._specialDirt = specialDirt;
        window._debugSpawnDirt = (type) => {
            const d = specialDirt.spawn(type);
            return d ? d.type : 'max reached';
        };
        window._debugEvent = () => {
            const result = eventSystem.triggerRandomEvent();
            if (result) {
                if (result.type === 'choice') {
                    ui.showChoiceEvent(result.event, (choiceIndex) => {
                        const r = eventSystem.resolveChoice(choiceIndex);
                        if (r) ui.showEventNotification(r.event, r.messages);
                    });
                } else {
                    ui.showEventNotification(result.event, result.messages);
                }
            }
            return result ? result.event.name : 'no event';
        };

        document.getElementById('debug-reset').addEventListener('click', () => {
            if (confirm('セーブデータを削除してリスタートしますか？')) {
                localStorage.removeItem('station-builder-save');
                localStorage.removeItem('station-builder-achievements');
                localStorage.removeItem('tutorial-completed');
                location.reload();
            }
        });

        document.getElementById('debug-stage').addEventListener('change', (e) => {
            if (e.target.value === '') return;
            station.stage = parseInt(e.target.value);
            station.trainInterval = Math.max(8000, 30000 - station.stage * 2500);
            station.recalcBonuses();
            ui.renderUpgrades();
            station.save();
            e.target.value = '';
        });
    } else {
        // 本番環境ではデバッグUIを非表示
        const debugStage = document.getElementById('debug-stage');
        const debugReset = document.getElementById('debug-reset');
        if (debugStage) debugStage.style.display = 'none';
        if (debugReset) debugReset.style.display = 'none';
    }

    // 掃除ミニゲームへの入り口は「おそうじボタン」のみ。
    // 過去にキャンバスクリックでも入れたが、誤タップで意図せず掃除画面に入る事故が
    // 多発したため削除（PC/スマホ共通で経路を一本化）。
    document.getElementById('clean-btn').addEventListener('click', () => {
        if (!cleaning.active) {
            cleaning.enter();
            tutorial.onCleanEnter();
        }
    });

    // もちものタブに赤バッジを表示/消去
    const placedTab = document.querySelector('.tab-btn[data-tab="placed"]');
    function showPlacedBadge() {
        if (!placedTab || placedTab.querySelector('.tab-badge')) return;
        const dot = document.createElement('span');
        dot.className = 'tab-badge';
        placedTab.appendChild(dot);
    }
    // もちものタブを開いたらバッジを消す
    placedTab.addEventListener('click', () => {
        const badge = placedTab.querySelector('.tab-badge');
        if (badge) badge.remove();
    });

    let lastTime = 0;
    let lastTrainMsg = 0;
    let saveTimer = 0;
    let prevTrainState = 'none';
    let prevCleaningActive = false;
    let autoMaintainAccum = 0;
    let lastSpawnedSeen = 0;
    let lastOilPenaltySeen = 0;
    // ヒント発火管理用
    let lastDirtyPenaltySeen = false;
    let lastDirtyPenaltyAt = 0;
    let prevReputationLevel = station.reputationLevel || 0;

    function showAutoMaintainUnlockModal() {
        const existing = document.querySelector('.auto-maintain-unlock-overlay');
        if (existing) return;
        const overlay = document.createElement('div');
        overlay.className = 'auto-maintain-unlock-overlay';
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(40,30,20,0.55);z-index:50;display:flex;justify-content:center;align-items:center;';
        const modal = document.createElement('div');
        modal.style.cssText = 'background:#fffaf0;border:1px solid #d4c4a8;border-radius:4px;padding:28px 36px;max-width:420px;font-family:"Zen Maru Gothic",sans-serif;color:#4a3a2a;box-shadow:0 4px 24px rgba(40,30,10,0.28);';
        modal.innerHTML =
            '<div style="font-size:16px;font-weight:700;color:#8a5a30;margin-bottom:10px;">🔧 自動手入れ機能 解放！</div>' +
            '<div style="font-size:13px;line-height:1.7;margin-bottom:14px;">' +
            'アイテムが増えてきたので、自動で手入れしてくれる機能が使えるようになりました。<br><br>' +
            '<b>もちもの</b> タブから設定できます：' +
            '<ul style="margin:8px 0 0 0;padding-left:20px;font-size:12px;line-height:1.6;">' +
            '<li>機能のオン / オフ</li>' +
            '<li>手入れするアイテムの選択（全部選択も可能）</li>' +
            '</ul><br>' +
            '<b>料金の仕組み</b>：' +
            '<ul style="margin:6px 0 0 0;padding-left:20px;font-size:12px;line-height:1.6;">' +
            '<li>プレイ中：定価の <b style="color:#b85a3a;">1.2倍</b>（手間賃）</li>' +
            '<li>留守中：<b style="color:#2a8a4a;">定価</b>（放置でもアイテムを守れる）</li>' +
            '</ul><br>' +
            '耐久が <b>30%</b> を下回ると自動で手入れします。' +
            '</div>' +
            '<div style="text-align:center;"><button class="am-close" style="padding:8px 24px;border:1px solid #c08050;border-radius:2px;background:#f8f0e8;cursor:pointer;color:#8a5a30;font-weight:700;font-family:inherit;font-size:13px;">わかった</button></div>';
        overlay.appendChild(modal);
        document.getElementById('game-wrapper').appendChild(overlay);
        const close = () => overlay.remove();
        modal.querySelector('.am-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    function gameLoop(time) {
        // delta を 100ms でキャップ：背景化からの復帰や iOS Safari の RAF 一時停止後に、
        // 1フレームで電車状態が arriving→stopped→departing→none と一気に進んで音と画面が
        // ズレる事故を防ぐ
        const rawDelta = lastTime ? time - lastTime : 16;
        const delta = Math.min(rawDelta, 100);
        lastTime = time;

        station.updateIncome();
        station.updateCleanliness();
        station.checkDirtyPenalty(delta);
        if (station.specialDirt) station.specialDirt.update(delta);
        station.updateItems();
        if (!tutorial.active) station.updateTrain(delta);
        station.updatePassengers();

        // チュートリアル中はイベント自然発火を抑制
        if (!tutorial.active) {
            const eventResult = eventSystem.update(delta);
            if (eventResult) {
                if (eventResult.type === 'choice') {
                    ui.showChoiceEvent(eventResult.event, (choiceIndex) => {
                        const result = eventSystem.resolveChoice(choiceIndex);
                        if (result) {
                            ui.showEventNotification(result.event, result.messages);
                            achievements.onEvent(eventResult.event.id);
                            station.save();
                        }
                    });
                } else if (eventResult.type === 'notification') {
                    ui.showEventNotification(eventResult.event, eventResult.messages);
                    achievements.onEvent(eventResult.event.id);
                    station.save();
                }
            }
        }

        // 電車の状態変化で音を鳴らす
        if (station.trainState !== prevTrainState) {
            if (station.trainState === 'arriving') {
                sound.play('horn', 0.12);
            } else if (station.trainState === 'departing') {
                sound.play('train', 0.12);
            } else if (station.trainState === 'stopped') {
                sound.play('coin', 0.2);
            } else if (station.trainState === 'none' && prevTrainState === 'departing') {
                setTimeout(() => sound.stopAll('train'), 1500);
            }
            prevTrainState = station.trainState;
        }

        // アイテム耐久度警告（20%以下になったら1回だけ通知）
        for (const item of station.placedItems) {
            if (item.durability <= 0) continue;
            const ratio = item.durability / item.maxDurability;
            if (ratio < 0.2 && !item._warned) {
                item._warned = true;
                ui.showMessage('⚠️ ' + item.name + ' が傷んできた…', 'もちものから手入れしよう');
                showPlacedBadge();
            }
            if (ratio >= 0.2) item._warned = false;
        }

        // アイテム壊れた通知
        if (station.lastBrokenItem) {
            const penalty = station.lastBrokenPenalty || 15;
            ui.showMessage(station.lastBrokenItem + ' がこわれた…', '評判 -' + penalty);
            station.lastBrokenItem = null;
            station.lastBrokenPenalty = null;
            showPlacedBadge();
        }

        // 特殊汚れ発生通知（大きいバナー + 音 + バッジの強調アニメ）
        if (station.specialDirt) {
            const ls = station.specialDirt.lastSpawned;
            if (ls && ls.at > lastSpawnedSeen) {
                lastSpawnedSeen = ls.at;
                const def = station.specialDirt.getDef(ls.dirt.type);
                if (def) {
                    ui.showSpecialDirtBanner(def);
                    sound.play('sdirt-spawn', 0.5);
                    // 初回特殊汚れ発生時の使い方ヒント
                    setTimeout(() => hints.show('special-dirt'), 1200);
                }
            }
            const oil = station.specialDirt.lastOilPenalty;
            if (oil && oil.at > lastOilPenaltySeen) {
                lastOilPenaltySeen = oil.at;
                ui.showMessage('🛢️ 油汚れを放置…', '評判 -' + oil.amount);
            }
        }

        // きれい度ペナルティ初発火検知（lastDirtyPenalty が新しくなった時）
        if (station.lastDirtyPenalty && !lastDirtyPenaltySeen) {
            lastDirtyPenaltySeen = true;
            hints.show('dirty-penalty');
        } else if (station.lastDirtyPenalty && station.lastDirtyPenalty.at > lastDirtyPenaltyAt) {
            lastDirtyPenaltyAt = station.lastDirtyPenalty.at;
            // 2回目以降は何もしない（hints.showは表示済みなら何もしない）
        }

        // 評判ランクアップ検知
        if (station.reputationLevel > prevReputationLevel) {
            prevReputationLevel = station.reputationLevel;
            // 初ランクアップ時のヒント
            hints.show('reputation-rank-up');
        }

        // 電車到着メッセージ + フロートテキスト
        if (station.trainState === 'stopped' && time - lastTrainMsg > 5000) {
            const incomeBonus = 1 + station.getItemBonus('incomeBonus') + station.upgradeIncomeBonus;
            const eventMult = eventSystem ? eventSystem.getIncomeMultiplier() : 1;
            const income = Math.floor(station.getCurrentStageData().incomePerPassenger * incomeBonus * eventMult);
            const count = station.currentPassengers.length;
            const earned = count * income;
            ui.showMessage('電車が到着', count + '人が降りました  +' + earned + '円');
            effects.addMoneyFloat(earned, 480, 240);
            effects.addVisitorFloat(count, 480, 240);
            lastTrainMsg = time;
        }

        // 掃除完了検出 → グロー演出 + チュートリアル通知 + 実績
        if (prevCleaningActive && !cleaning.active) {
            effects.triggerGlow(0.5);
            achievements.onClean();
            tutorial.onCleanExit();
        }
        // お掃除中は body にクラス付与: スマホ表示で
        // status-bar / FAB / 警告等を CSS で非表示にしてキャンバス内のもどるボタンを邪魔しない
        if (prevCleaningActive !== cleaning.active) {
            document.body.classList.toggle('cleaning-active', cleaning.active);
        }
        prevCleaningActive = cleaning.active;

        // 掃除ミニゲーム中はミニゲームを描画
        if (cleaning.active) {
            cleaning.update(delta);
            cleaning.draw();
        } else {
            renderer.draw(station, time);
            effects.update(delta);
            effects.draw();
        }

        ui.update();
        ui.updateBuffDisplay(eventSystem);

        // 1秒ごとに自動手入れ判定 + 開放チェック
        autoMaintainAccum += delta;
        if (autoMaintainAccum >= 1000) {
            autoMaintainAccum = 0;
            station.runAutoMaintain();
            if (station.isAutoMaintainUnlocked() && !station.autoMaintain.notified) {
                station.autoMaintain.notified = true;
                station.save();
                showAutoMaintainUnlockModal();
                ui.renderPlacedItems();
            }
        }

        // 10秒ごとに自動セーブ + 実績チェック
        saveTimer += delta;
        if (saveTimer > 10000) {
            achievements.checkAll();
            station.save();
            localStorage.setItem('station-builder-achievements', JSON.stringify(achievements.getSaveData()));
            saveTimer = 0;
        }

        requestAnimationFrame(gameLoop);
    }

    requestAnimationFrame(gameLoop);

    // チュートリアル開始（未完了かつ初期状態のプレイヤー）
    const isNewPlayer = !loaded || (station.stage === 0 && station.purchased.size === 0);
    if (isNewPlayer && !tutorial.completed) {
        setTimeout(() => tutorial.start(), 800);
    } else {
        // 既存プレイヤー: 最初のクリックでBGM開始
        const startBgmOnce = () => {
            sound.startBgm();
            document.removeEventListener('click', startBgmOnce);
        };
        document.addEventListener('click', startBgmOnce);
    }
}

// オフライン中の出来事を一括表示するモーダル（ユーザーが閉じるまで残る）
function showOfflineReport(sections, station, hints) {
    const overlay = document.createElement('div');
    overlay.className = 'hint-overlay';
    const sectionHtml = sections.map(s =>
        '<div class="offline-section">' +
            '<div class="offline-section-icon">' + s.icon + '</div>' +
            '<div class="offline-section-info">' +
                '<div class="offline-section-title">' + s.title + '</div>' +
                '<div class="offline-section-body">' + s.body.split('\n').map(l => '<p>' + l + '</p>').join('') + '</div>' +
            '</div>' +
        '</div>'
    ).join('');
    overlay.innerHTML =
        '<div class="hint-modal" style="max-width:420px;">' +
            '<div class="hint-icon">📬</div>' +
            '<div class="hint-title">留守中のできごと</div>' +
            '<div class="offline-sections">' + sectionHtml + '</div>' +
            '<button class="hint-close-btn">わかった</button>' +
        '</div>';
    document.body.appendChild(overlay);
    const close = () => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        // 閉じた後に初回ヒントを表示（重ならないように）
        if (station.offlineEarned > 0 && hints) {
            setTimeout(() => hints.show('offline-income'), 300);
        }
    };
    overlay.querySelector('.hint-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
}

startGame();
