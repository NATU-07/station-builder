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

    // チュートリアル
    const tutorial = new Tutorial({
        station, ui, cleaning, eventSystem, effects, journal, sound
    });

    // オフライン収入の表示
    if (loaded && station.offlineEarned > 0) {
        setTimeout(() => {
            const visitorText = station.offlineVisitors > 0 ? '  🚶 +' + station.offlineVisitors + '人' : '';
            const capNote = station.offlineCapped ? '（12時間ぶんで頭打ち）' : '';
            ui.showMessage('💰 おかえりなさい！', '留守の間に ' + station.offlineEarned.toLocaleString() + ' 円たまりました' + visitorText + capNote);
        }, 500);
    }

    // オフライン油汚れペナルティ表示
    if (loaded && station.offlineOilPenalty) {
        const oilPenalty = station.offlineOilPenalty;
        const oilCount = station.offlineOilCount;
        const oilMinutes = station.offlineOilMinutes;
        setTimeout(() => {
            ui.showMessage(
                '🛢️ 油汚れを放置した影響',
                '油汚れ ' + oilCount + '個 × ' + oilMinutes + '分  /  評判 -' + oilPenalty
            );
        }, 2800);
        station.offlineOilPenalty = null;
    }

    // オフライン自動手入れレポート表示
    if (loaded && station.offlineAutoMaintainReport) {
        const r = station.offlineAutoMaintainReport;
        if (r.totalMaintains > 0 || r.brokenItems.length > 0) {
            setTimeout(() => {
                let sub = '';
                if (r.totalMaintains > 0) {
                    sub += '自動手入れ ' + r.totalMaintains + '回 / -' + Math.floor(r.totalCost).toLocaleString() + '円';
                }
                if (r.brokenItems.length > 0) {
                    sub += (sub ? ' / ' : '') + '壊れた: ' + r.brokenItems.join('、');
                }
                ui.showMessage('🔧 オフライン自動手入れ', sub);
            }, 2200);
        }
        station.offlineAutoMaintainReport = null;
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

    // おそうじボタンで掃除ミニゲームに入る
    document.getElementById('clean-btn').addEventListener('click', () => {
        if (!cleaning.active) {
            cleaning.enter();
            tutorial.onCleanEnter();
        }
    });

    // キャンバスクリックでも掃除ミニゲームに入る
    canvas.addEventListener('click', (e) => {
        if (cleaning.active) return;
        // チュートリアル中はキャンバスクリックで掃除に入らせない
        if (tutorial.active) return;

        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (canvas.height / rect.height);

        if (y > 200 && y < 350 && x > 150 && x < 810) {
            cleaning.enter();
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
        const delta = lastTime ? time - lastTime : 16;
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
                }
            }
            const oil = station.specialDirt.lastOilPenalty;
            if (oil && oil.at > lastOilPenaltySeen) {
                lastOilPenaltySeen = oil.at;
                ui.showMessage('🛢️ 油汚れを放置…', '評判 -' + oil.amount);
            }
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

startGame();
