// 特殊汚れのミニゲーム 3種
// - _playGraffiti: 色マッチング射撃。照準と的の色を合わせて撃つ。外しても当てても1発コスト。
// - _playOil    : もぐら叩き。制限時間内に油滴をタップで消す。逃すと きれい度＆評判減
// - _playTrash  : ゴミ連打。10秒間の連打でコンボ倍率UP、収入ゲット

class SpecialDirtGames {
    constructor(station, specialDirt, sound) {
        this.station = station;
        this.sdirt = specialDirt;
        this.sound = sound;
        this.active = false;
    }

    play(dirt) {
        if (this.active) return Promise.resolve({ cost: 0, reward: 0, cancelled: true });
        this.active = true;
        let prom;
        if (dirt.type === 'graffiti') prom = this._playGraffiti(dirt);
        else if (dirt.type === 'oil') prom = this._playOil(dirt);
        else if (dirt.type === 'trashpile') prom = this._playTrash(dirt);
        else prom = Promise.resolve({ cost: 0, reward: 0 });
        return prom.finally(() => { this.active = false; });
    }

    _showOverlay(html) {
        const overlay = document.createElement('div');
        overlay.className = 'sdirt-game-overlay';
        overlay.innerHTML =
            '<div class="sdirt-game-box">' +
            '<button class="sdirt-g-close" title="閉じる">×</button>' +
            html +
            '</div>';
        document.getElementById('game-wrapper').appendChild(overlay);
        return overlay;
    }

    // 終了処理を一元化。closeWith(result) を呼ぶだけで片付く。Promise は1度だけ解決される。
    _bindClose(overlay, resolve, cleanup) {
        let resolved = false;
        const onKey = (e) => { if (e.key === 'Escape') closeWith({ cancelled: true, cost: 0, reward: 0 }); };
        const closeWith = (result) => {
            if (resolved) return;
            resolved = true;
            if (cleanup) { try { cleanup(); } catch (e) { /* ignore */ } }
            document.removeEventListener('keydown', onKey);
            if (overlay.parentNode) overlay.remove();
            resolve(result);
        };
        document.addEventListener('keydown', onKey);
        const closeBtn = overlay.querySelector('.sdirt-g-close');
        if (closeBtn) closeBtn.addEventListener('click', () => closeWith({ cancelled: true, cost: 0, reward: 0 }));
        return closeWith;
    }

    _safePlaySound(name, vol, maxMs) {
        if (this.sound && typeof this.sound.play === 'function') {
            try { this.sound.play(name, vol, maxMs); } catch (e) { /* ignore */ }
        }
    }

    // ================ 落書き：往復ターゲット狙撃 ================
    _playGraffiti(dirt) {
        return new Promise(resolve => {
            const cfg = this.sdirt.getConfig();
            const colors = ['red', 'blue', 'yellow', 'green'];
            const colorHex = { red: '#d84848', blue: '#3578d0', yellow: '#e0b020', green: '#48a85a' };
            const colorLabel = { red: '赤', blue: '青', yellow: '黄', green: '緑' };
            const targetEmoji = { red: '🔴', blue: '🔵', yellow: '🟡', green: '🟢' };

            const targetCount = cfg.GRAFFITI_TARGET_COUNT;
            const shotCost = Math.ceil(cfg.GRAFFITI_SHOT_COST * cfg.stageMult);

            const targets = [];
            for (let i = 0; i < targetCount; i++) {
                targets.push({ color: colors[Math.floor(Math.random() * colors.length)] });
            }

            let currentIdx = 0;
            let shots = 0;
            let locked = false;  // ヒット演出中は入力ブロック

            const overlay = this._showOverlay(
                '<div class="sdirt-g-title">🎨 照準に重なった瞬間に同色ボタン！</div>' +
                '<div class="sdirt-g-sub">5個順番、後ほど速くなる / 1発 -' + shotCost.toLocaleString() + '円（外しても同額）/ ESC で中断</div>' +
                '<div class="sdirt-g-stat">' +
                  '消した <span id="gf-hits">0</span>/' + targetCount +
                  ' / 発射 <span id="gf-shots">0</span>発' +
                  ' / コスト <span id="gf-cost">¥0</span>' +
                '</div>' +
                '<div class="sdirt-g-arena sdirt-g-arena-aim" id="gf-arena">' +
                  '<div class="sdirt-g-aim-zone"></div>' +
                  '<div class="sdirt-g-aim-line"></div>' +
                  '<button class="sdirt-g-moving-target" id="gf-target"></button>' +
                '</div>' +
                '<div class="sdirt-g-aim-row">発射: ' +
                  colors.map(c =>
                    '<button class="sdirt-g-color" data-c="' + c + '" ' +
                    'style="background:' + colorHex[c] + '" title="' + colorLabel[c] + '"></button>'
                  ).join('') +
                '</div>'
            );
            let rafId = null;
            const closeWith = this._bindClose(overlay, resolve, () => {
                if (rafId) cancelAnimationFrame(rafId);
            });

            const arena = overlay.querySelector('#gf-arena');
            const targetEl = overlay.querySelector('#gf-target');
            const aimZoneEl = overlay.querySelector('.sdirt-g-aim-zone');
            const hitsEl = overlay.querySelector('#gf-hits');
            const shotsEl = overlay.querySelector('#gf-shots');
            const costEl = overlay.querySelector('#gf-cost');
            const aimBtns = overlay.querySelectorAll('.sdirt-g-color');

            // アリーナのサイズは描画後に取得
            const arenaW = arena.clientWidth || 400;
            const targetW = 44;
            const maxX = arenaW - targetW;

            // 速度（1つ目=遅い、5つ目=速い、往復）
            const baseSpeed = 140;   // px/s
            const maxSpeed = 440;    // px/s
            const getSpeed = (idx) =>
                baseSpeed + (targetCount <= 1 ? 0 : (idx / (targetCount - 1)) * (maxSpeed - baseSpeed));

            let x = 0;
            let dir = 1;  // +1:右へ, -1:左へ
            let speed = getSpeed(0);

            const loadCurrent = () => {
                const t = targets[currentIdx];
                targetEl.textContent = targetEmoji[t.color];
                targetEl.style.filter = 'drop-shadow(0 0 8px ' + colorHex[t.color] + ')';
                x = 0;
                dir = 1;
                speed = getSpeed(currentIdx);
            };
            loadCurrent();

            let lastT = performance.now();
            const loop = (now) => {
                const dt = Math.min(0.05, (now - lastT) / 1000);
                lastT = now;
                if (!locked) {
                    x += dir * speed * dt;
                    if (x <= 0) { x = 0; dir = 1; }
                    else if (x >= maxX) { x = maxX; dir = -1; }
                    targetEl.style.left = x + 'px';
                }
                rafId = requestAnimationFrame(loop);
            };
            rafId = requestAnimationFrame(loop);

            const fire = (shotColor) => {
                if (locked) return;
                shots++;
                shotsEl.textContent = shots;
                costEl.textContent = '¥' + (shots * shotCost).toLocaleString();

                // 画面実座標で判定（CSSの%計算とロジックのズレを回避）
                const tRect = targetEl.getBoundingClientRect();
                const zRect = aimZoneEl.getBoundingClientRect();
                const tCenter = tRect.left + tRect.width / 2;
                const inZone = tCenter >= zRect.left && tCenter <= zRect.right;
                const t = targets[currentIdx];

                if (inZone && t.color === shotColor) {
                    // HIT
                    locked = true;
                    // ファイル長 1962ms だと長く感じるので 1200ms でカット
                    this._safePlaySound('spray-hit', 0.5, 1200);
                    targetEl.classList.add('sdirt-g-hit');
                    currentIdx++;
                    hitsEl.textContent = currentIdx;
                    setTimeout(() => {
                        targetEl.classList.remove('sdirt-g-hit');
                        if (currentIdx >= targetCount) {
                            // 全ターゲット撃破 → クリア音
                            this._safePlaySound('trash-reward', 0.5);
                            if (rafId) cancelAnimationFrame(rafId);
                            closeWith({ cost: shots * shotCost, reward: 0, extra: { shots, hits: targetCount } });
                        } else {
                            loadCurrent();
                            locked = false;
                        }
                    }, 450);
                } else {
                    // MISS（コストは同じだけ取られる）
                    this._safePlaySound('spray-miss', 0.5);
                    targetEl.classList.add('sdirt-g-shake');
                    setTimeout(() => targetEl.classList.remove('sdirt-g-shake'), 280);
                }
            };
            aimBtns.forEach(btn => {
                btn.addEventListener('click', () => fire(btn.dataset.c));
            });
        });
    }

    // ================ 油汚れ：もぐら叩き ================
    _playOil(dirt) {
        return new Promise(resolve => {
            const cfg = this.sdirt.getConfig();
            const total = cfg.OIL_DROP_TOTAL;
            const duration = cfg.OIL_GAME_DURATION_MS;
            const lifetime = cfg.OIL_DROP_LIFETIME_MS;
            const startAt = Date.now();
            let spawned = 0;
            let hits = 0;
            let misses = 0;

            const overlay = this._showOverlay(
                '<div class="sdirt-g-title">🛢️ 油を次々タップ！</div>' +
                '<div class="sdirt-g-sub">逃した数だけ きれい度＆評判ダウン。全部取ればボーナス！ (ESC で中断)</div>' +
                '<div class="sdirt-g-stat">ヒット <span id="oil-hit">0</span>/' + total + ' / 残り <span id="oil-time">' + (duration / 1000) + '</span>秒</div>' +
                '<div class="sdirt-g-arena" id="oil-arena"></div>'
            );
            const arena = overlay.querySelector('#oil-arena');
            const hitEl = overlay.querySelector('#oil-hit');
            const timeEl = overlay.querySelector('#oil-time');

            let spawnTimer, uiTimer, endTimer;
            const closeWith = this._bindClose(overlay, resolve, () => {
                if (spawnTimer) clearInterval(spawnTimer);
                if (uiTimer) clearInterval(uiTimer);
                if (endTimer) clearTimeout(endTimer);
            });

            const spawnInterval = Math.floor(duration / total * 0.85);
            spawnTimer = setInterval(() => {
                if (spawned >= total) { clearInterval(spawnTimer); return; }
                spawned++;
                const drop = document.createElement('button');
                drop.className = 'sdirt-g-oil';
                drop.textContent = '🛢️';
                drop.style.left = (16 + Math.random() * 336) + 'px';
                drop.style.top = (12 + Math.random() * 120) + 'px';
                let caught = false;
                const expireTimer = setTimeout(() => {
                    if (caught) return;
                    caught = true;
                    misses++;
                    drop.classList.add('sdirt-g-fade');
                    setTimeout(() => drop.remove(), 280);
                }, lifetime);
                drop.addEventListener('click', () => {
                    if (caught) return;
                    caught = true;
                    clearTimeout(expireTimer);
                    hits++;
                    hitEl.textContent = hits;
                    drop.classList.add('sdirt-g-hit');
                    // 連打されるので 350ms でカット
                    this._safePlaySound('oil-tap', 0.4, 350);
                    setTimeout(() => drop.remove(), 280);
                });
                arena.appendChild(drop);
            }, spawnInterval);

            uiTimer = setInterval(() => {
                const remain = Math.max(0, Math.ceil((duration - (Date.now() - startAt)) / 1000));
                timeEl.textContent = remain;
            }, 200);

            endTimer = setTimeout(() => {
                clearInterval(spawnTimer);
                clearInterval(uiTimer);
                // タイムアップ時に残っている油滴＋未到達分はmiss扱い
                const uncaught = total - hits - misses;
                misses += uncaught;
                const cleanPenalty = misses * cfg.OIL_MISS_CLEAN_PENALTY;
                const repPenalty = misses * cfg.OIL_MISS_REP_PENALTY;
                this.station.cleanliness = Math.max(0, this.station.cleanliness - cleanPenalty);
                if (repPenalty > 0) this.station.loseReputation(repPenalty);
                let bonus = 0;
                if (misses === 0) {
                    bonus = cfg.OIL_PERFECT_REP_BONUS;
                    this.station.addReputation(bonus);
                }
                // 結果表示
                const resultHtml =
                    '<div class="sdirt-g-result">' +
                    '<div class="sdirt-g-result-main">' + (misses === 0 ? '🌟 パーフェクト！' : '拭き取り完了') + '</div>' +
                    '<div>ヒット ' + hits + ' / ミス ' + misses + '</div>' +
                    (cleanPenalty ? '<div class="sdirt-g-neg">きれい度 -' + cleanPenalty + '</div>' : '') +
                    (repPenalty ? '<div class="sdirt-g-neg">評判 -' + repPenalty + '</div>' : '') +
                    (bonus ? '<div class="sdirt-g-pos">評判 +' + bonus + '</div>' : '') +
                    '</div>';
                arena.innerHTML = resultHtml;
                // クリア音（全種共通）
                this._safePlaySound('trash-reward', 0.5);
                setTimeout(() => closeWith({ cost: 0, reward: 0, extra: { hits, misses, cleanPenalty, repPenalty, bonus } }), 1600);
            }, duration);
        });
    }

    // ================ ゴミの山：連打 ================
    _playTrash(dirt) {
        return new Promise(resolve => {
            const cfg = this.sdirt.getConfig();
            const duration = cfg.TRASH_GAME_DURATION_MS;
            const base = Math.ceil(cfg.TRASH_TAP_BASE_REWARD * cfg.stageMult);
            const comboInterval = cfg.TRASH_COMBO_INTERVAL_MS;
            const maxMult = cfg.TRASH_MAX_COMBO_MULT;
            const startAt = Date.now();
            let taps = 0;
            let combo = 0;
            let lastTapAt = 0;
            let reward = 0;
            let maxMultReached = 1;

            const overlay = this._showOverlay(
                '<div class="sdirt-g-title">🗑️ ゴミ連打！</div>' +
                '<div class="sdirt-g-sub">10秒間連打！間隔を空けずに叩くとコンボ倍率 最大x' + maxMult + ' (ESC で中断)</div>' +
                '<div class="sdirt-g-stat">収入 <span id="tr-reward">¥0</span> / コンボ x<span id="tr-combo">1.0</span> / 残り <span id="tr-time">' + (duration / 1000) + '</span>秒</div>' +
                '<div class="sdirt-g-arena sdirt-g-arena-center">' +
                '<button id="tr-tap" class="sdirt-g-trash-btn">🗑️</button>' +
                '</div>'
            );
            let uiTimer, endTimer;
            const closeWith = this._bindClose(overlay, resolve, () => {
                if (uiTimer) clearInterval(uiTimer);
                if (endTimer) clearTimeout(endTimer);
            });
            const rewardEl = overlay.querySelector('#tr-reward');
            const comboEl = overlay.querySelector('#tr-combo');
            const timeEl = overlay.querySelector('#tr-time');
            const btn = overlay.querySelector('#tr-tap');

            const getMult = () => 1 + Math.min(maxMult - 1, combo / 6);

            btn.addEventListener('click', () => {
                const now = Date.now();
                if (now - startAt > duration) return;
                taps++;
                if (now - lastTapAt < comboInterval) combo++;
                else combo = 1;
                lastTapAt = now;
                const mult = getMult();
                if (mult > maxMultReached) maxMultReached = mult;
                reward += Math.ceil(base * mult);
                rewardEl.textContent = '¥' + reward.toLocaleString();
                comboEl.textContent = mult.toFixed(1);
                // 連打前提なので 200ms でカット
                this._safePlaySound('trash-tap', 0.3, 200);
                btn.classList.remove('sdirt-g-pop');
                void btn.offsetWidth;
                btn.classList.add('sdirt-g-pop');
            });

            uiTimer = setInterval(() => {
                const remain = Math.max(0, Math.ceil((duration - (Date.now() - startAt)) / 1000));
                timeEl.textContent = remain;
                if (Date.now() - lastTapAt > comboInterval && combo > 0) {
                    combo = Math.max(0, combo - 1);
                    comboEl.textContent = getMult().toFixed(1);
                }
            }, 200);

            endTimer = setTimeout(() => {
                clearInterval(uiTimer);
                btn.disabled = true;
                this._safePlaySound('trash-reward', 0.5);
                const arena = overlay.querySelector('.sdirt-g-arena');
                arena.innerHTML =
                    '<div class="sdirt-g-result">' +
                    '<div class="sdirt-g-result-main">🎉 お疲れ！</div>' +
                    '<div>連打 ' + taps + '回 / 最大コンボ x' + maxMultReached.toFixed(1) + '</div>' +
                    '<div class="sdirt-g-pos">収入 +' + reward.toLocaleString() + '円</div>' +
                    '</div>';
                setTimeout(() => closeWith({ cost: 0, reward, extra: { taps, maxMult: maxMultReached } }), 1500);
            }, duration);
        });
    }
}
