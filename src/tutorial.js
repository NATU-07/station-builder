class Tutorial {
    constructor(opts) {
        this.station = opts.station;
        this.ui = opts.ui;
        this.cleaning = opts.cleaning;
        this.eventSystem = opts.eventSystem;
        this.effects = opts.effects;
        this.journal = opts.journal;
        this.sound = opts.sound;

        this.step = 0;
        this.active = false;
        this.completed = localStorage.getItem('tutorial-completed') === 'true';
        this.overlay = null;
        this.hint = null;
        this.waitingFor = null; // 何を待っているか
    }

    start() {
        if (this.completed) return;
        this.active = true;
        this.step = -1;
        this.runStep();
    }

    // --- ステップ定義 ---

    runStep() {
        if (!this.active) return;
        this.cleanup();

        switch (this.step) {
            case -1: return this.stepStartScreen();
            case 0: return this.stepJournalIntro();
            case 1: return this.stepHintClean();
            case 2: return this.stepCleaningGuide();
            case 3: return this.stepAfterClean();
            case 4: return this.stepHintUpgrade();
            case 5: return this.stepExplainTrain();
            case 6: return this.stepExplainShop();
            case 7: return this.stepExplainPlaced();
            case 8: return this.stepPreEvent();
            case 9: return this.stepWaitEvent();
            case 10: return this.stepExplainEventItems();
            case 11: return this.stepComplete();
            default: return this.finish();
        }
    }

    advance() {
        this.step++;
        this.runStep();
    }

    // Step -1: スタート画面（音声許可のためのユーザー操作）
    stepStartScreen() {
        const wrapper = document.getElementById('game-wrapper');

        this.overlay = document.createElement('div');
        this.overlay.className = 'tut-overlay';
        this.overlay.style.background = 'rgba(20,15,10,0.75)';
        wrapper.appendChild(this.overlay);

        this.hint = document.createElement('div');
        this.hint.className = 'tut-start-screen';
        this.hint.innerHTML =
            '<div class="tut-start-icon">🚉</div>' +
            '<div class="tut-start-title">さびれた駅</div>' +
            '<div class="tut-start-sub">あなたはこの駅の新しい駅長です</div>' +
            '<button class="tut-start-btn">はじめる</button>';
        wrapper.appendChild(this.hint);

        this.hint.querySelector('.tut-start-btn').addEventListener('click', () => {
            // このクリックでブラウザの音声許可が得られる
            if (this.sound) {
                this.sound.play('flip', 0.3);
                this.sound.startBgm();
            }
            this.cleanup();
            this.advance();
        });
    }

    // Step 0: 駅長就任ジャーナル
    stepJournalIntro() {
        const entry = {
            text: '今日からこの駅の駅長になった。\n\nさびれた無人駅。\n雑草だらけのホーム。\n錆びた看板。\n\nでも、ここから始めよう。\nこの駅を、みんなの駅にするんだ。',
            stamp: '🚉 駅長就任'
        };

        // ジャーナルのDOMだけ作らせて、アニメは自分で制御する
        this.journal.show({ id: '__tutorial_intro', icon: '📖', name: '就任' }, this.station);
        setTimeout(() => {
            // journal.show() が起動した最初のアニメーションを停止
            if (this.journal.writeTimer) {
                clearInterval(this.journal.writeTimer);
                this.journal.writeTimer = null;
            }
            if (window._sound) window._sound.stopLoop('pen');

            const textEl = document.getElementById('journal-text');
            const stampEl = document.getElementById('journal-stamp');
            if (textEl) textEl.innerHTML = '';
            if (stampEl) {
                stampEl.textContent = entry.stamp;
                stampEl.style.display = 'none';
                stampEl.classList.remove('journal-stamp-animate');
            }
            // チュートリアル用テキストでアニメーション再起動
            this.journal.animateWriting(
                document.getElementById('journal-overlay'),
                entry
            );
        }, 200);

        // ジャーナルが閉じたら次へ
        this.waitForJournalClose(() => this.advance());
    }

    // Step 1: おそうじボタンを押させる
    stepHintClean() {
        const cleanBtn = document.getElementById('clean-btn');
        this.showHint(
            '🧹 まずはホームをきれいにしよう！\n「おそうじ」ボタンを押してみて',
            cleanBtn,
            null // ボタンを押したら自動で進む
        );
        this.waitingFor = 'clean-enter';
    }

    // Step 2: 掃除のやり方ガイド
    stepCleaningGuide() {
        // 掃除モードに入ったはず
        this.showCanvasHint(
            '🌿 雑草を見つけたら、上にスワイプして引き抜こう！\n\n' +
            '✋ 手 → 雑草を引き抜く\n' +
            '🪶 はたき → ほこりをこする\n' +
            '🧹 ほうき → ゴミをはき出す\n\n' +
            '下のバーで道具を切り替えられるよ',
            () => {
                // ヒントを閉じたら掃除を進めさせる
                this.waitingFor = 'clean-exit';
            }
        );
    }

    // Step 3: 掃除終了後
    stepAfterClean() {
        this.showCenterHint(
            '✨ きれいになった！\n\n' +
            'きれい度が高いと乗客が増えるよ。\n' +
            '放っておくとまた汚れるから、\n' +
            'こまめにおそうじしよう！',
            () => this.advance()
        );
    }

    // Step 4: アップグレード購入
    stepHintUpgrade() {
        // せつびタブに切り替え
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(t => {
            if (t.dataset.tab === 'upgrades') t.click();
        });

        setTimeout(() => {
            const firstBtn = document.querySelector('.upgrade-btn:not(.purchased)');
            this.showHint(
                '🔧 設備を買って駅をよくしよう！\n「ホームの掃除」は無料だよ。タップしてみて！',
                firstBtn,
                null
            );
            this.waitingFor = 'purchase';
        }, 300);
    }

    // Step 5: 電車と収入の説明
    stepExplainTrain() {
        this.showCenterHint(
            '🚃 電車が来ると乗客が降りてお金がもらえるよ！\n\n' +
            '設備を揃えると乗客が増える → お金が貯まる\n' +
            '→ もっと設備が買える → 駅が進化する！\n\n' +
            'すべての設備を揃えると、次のステージに進化できるよ',
            () => this.advance()
        );
    }

    // Step 6: おみせタブの説明
    stepExplainShop() {
        // おみせタブに切り替え
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(t => {
            if (t.dataset.tab === 'shop') t.click();
        });

        setTimeout(() => {
            this.showCenterHint(
                '🛍️ 「おみせ」タブではアイテムが買えるよ！\n\n' +
                '🚶 ひとを呼ぶもの → 乗客が増える\n' +
                '💛 こころを満たすもの → 評判が上がる\n' +
                '💰 おかねを稼ぐもの → 自動収入\n\n' +
                'アイテムには耐久度があって、\n' +
                '時間が経つと壊れてしまうから注意！\n\n' +
                'ステージが上がると新しい商品が増えるよ',
                () => this.advance()
            );
        }, 300);
    }

    // Step 7: もちものタブの説明
    stepExplainPlaced() {
        // もちものタブに切り替え
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(t => {
            if (t.dataset.tab === 'placed') t.click();
        });

        setTimeout(() => {
            this.showCenterHint(
                '🎒 「もちもの」タブでは設置したアイテムを管理できるよ\n\n' +
                '📊 耐久度バー → 残りの寿命\n' +
                '🔧 手入れ → お金を払って耐久度を回復\n' +
                '💔 壊れたら → 「なおす」で復活（ちょっと高い）\n' +
                '💸 売る → いらなくなったら売却\n\n' +
                'ステージが上がるとアイテムの劣化が早くなるよ。\n' +
                'こまめに手入れしよう！',
                () => {
                    // せつびタブに戻す
                    const tabs = document.querySelectorAll('.tab-btn');
                    tabs.forEach(t => {
                        if (t.dataset.tab === 'upgrades') t.click();
                    });
                    this.advance();
                }
            );
        }, 300);
    }

    // Step 8: イベント予告
    stepPreEvent() {
        this.showCenterHint(
            '📢 駅ではときどきイベントが起きるよ！\n\n' +
            'イベントには選択肢があることも。\n' +
            '実際に体験してみよう！',
            () => {
                this.advance();
            }
        );
    }

    // Step 9: イベント強制発火 → 解決を待つ
    stepWaitEvent() {
        // 迷子のネコを強制発火（choice型で分かりやすい）
        const catEvent = this.eventSystem.eventDefs.find(e => e.id === 'stray_cat');
        if (!catEvent) {
            // イベントデータがなければスキップ
            this.advance();
            return;
        }

        // お金が足りないと選択できないので補充
        if (this.station.money < 200) {
            this.station.money = 200;
        }

        this.eventSystem.seenEvents.add(catEvent.id);
        this.eventSystem.pendingEvent = catEvent;

        // UIにイベントを表示
        this.ui.showChoiceEvent(catEvent, (choiceIndex) => {
            const result = this.eventSystem.resolveChoice(choiceIndex);
            if (result) {
                this.ui.showEventNotification(result.event, result.messages);
                this.station.save();
            }
            // イベント解決後に次へ
            setTimeout(() => this.advance(), 2000);
        });

        this.waitingFor = 'event-resolve';
    }

    // Step 10: イベント限定アイテムの説明
    stepExplainEventItems() {
        this.showCenterHint(
            '🎁 イベントで手に入る「おもいでの品」は\n特別なアイテムだよ！\n\n' +
            '⚠️ 大事なこと：\n' +
            'おもいでの品の値段は、ステージが上がると\n' +
            'どんどん高くなっていくよ！\n\n' +
            'たとえば Stage 0 で 100円のものが\n' +
            'Stage 2 では 2,500円、\n' +
            'Stage 4 では 75,000円に...\n\n' +
            '欲しいものは早めに買うのがコツ！',
            () => this.advance()
        );
    }

    // Step 11: 完了
    stepComplete() {
        this.showCenterHint(
            '🎉 チュートリアル完了！\n\n' +
            'あとは自由にこの駅を発展させよう。\n' +
            'おそうじ、設備、おみせ、イベント...\n' +
            'すべてを駆使して伝説の駅を目指そう！\n\n' +
            '...駅長さん、がんばって！',
            () => this.finish()
        );
    }

    finish() {
        this.active = false;
        this.completed = true;
        this.waitingFor = null;
        localStorage.setItem('tutorial-completed', 'true');
        this.cleanup();
    }

    // --- 外部からの通知 ---

    onCleanEnter() {
        if (!this.active) return;
        if (this.waitingFor === 'clean-enter') {
            this.waitingFor = null;
            this.cleanup();
            this.advance();
        }
    }

    onCleanExit() {
        if (!this.active) return;
        if (this.waitingFor === 'clean-exit') {
            this.waitingFor = null;
            this.advance();
        }
    }

    onPurchase() {
        if (!this.active) return;
        if (this.waitingFor === 'purchase') {
            this.waitingFor = null;
            // オーバーレイとヒントを消して日誌を操作可能にする
            this.cleanup();
            // ジャーナルが閉じるのを待ってから次へ
            this.waitForJournalClose(() => this.advance());
        }
    }

    // --- UI表示 ---

    // 要素を指すヒント（半透明オーバーレイ+スポットライト）
    showHint(text, targetEl, onDismiss) {
        this.cleanup();

        const wrapper = document.getElementById('game-wrapper');
        // オーバーレイ
        this.overlay = document.createElement('div');
        this.overlay.className = 'tut-overlay';
        wrapper.appendChild(this.overlay);

        // ターゲットをハイライト
        if (targetEl) {
            targetEl.classList.add('tut-spotlight');
            this._spotlightEl = targetEl;
        }

        // ヒントバブル
        this.hint = document.createElement('div');
        this.hint.className = 'tut-hint';
        this.hint.innerHTML = this.formatHintText(text);
        wrapper.appendChild(this.hint);

        // 位置調整（画面端からはみ出さないようにクランプ）
        if (targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const wrapRect = wrapper.getBoundingClientRect();
            const hintW = 380; // max-width
            const margin = 16;
            let hintX = rect.left - wrapRect.left + rect.width / 2;
            const minX = margin + hintW / 2;
            const maxX = wrapRect.width - margin - hintW / 2;
            hintX = Math.max(minX, Math.min(maxX, hintX));
            const hintY = rect.top - wrapRect.top - 10;
            this.hint.style.left = hintX + 'px';
            this.hint.style.bottom = (wrapRect.height - hintY) + 'px';
            this.hint.style.transform = 'translateX(-50%)';
            this.hint.classList.add('tut-hint-arrow');
        }

        if (onDismiss) {
            const btn = document.createElement('button');
            btn.className = 'tut-btn';
            btn.textContent = 'わかった';
            btn.addEventListener('click', () => {
                this.cleanup();
                onDismiss();
            });
            this.hint.appendChild(btn);
        }

        // onDismissがなくターゲットがある場合、オーバーレイ越しにターゲットをクリック可能にする
        if (!onDismiss && targetEl) {
            this.overlay.addEventListener('click', (e) => {
                const rect = targetEl.getBoundingClientRect();
                if (e.clientX >= rect.left && e.clientX <= rect.right &&
                    e.clientY >= rect.top && e.clientY <= rect.bottom) {
                    targetEl.click();
                }
            });
        }
    }

    // 画面中央のヒント（掃除説明など）
    showCenterHint(text, onDismiss) {
        this.cleanup();

        const wrapper = document.getElementById('game-wrapper');
        this.overlay = document.createElement('div');
        this.overlay.className = 'tut-overlay';
        wrapper.appendChild(this.overlay);

        this.hint = document.createElement('div');
        this.hint.className = 'tut-hint tut-hint-center';
        this.hint.innerHTML = this.formatHintText(text);

        const btn = document.createElement('button');
        btn.className = 'tut-btn';
        btn.textContent = 'わかった';
        btn.addEventListener('click', () => {
            if (this.sound) this.sound.play('flip', 0.3);
            this.cleanup();
            if (onDismiss) onDismiss();
        });
        this.hint.appendChild(btn);
        wrapper.appendChild(this.hint);
    }

    // Canvas上のヒント（掃除中に表示）
    showCanvasHint(text, onDismiss) {
        this.cleanup();

        const wrapper = document.getElementById('game-wrapper');
        this.overlay = document.createElement('div');
        this.overlay.className = 'tut-overlay tut-overlay-canvas';
        wrapper.appendChild(this.overlay);

        this.hint = document.createElement('div');
        this.hint.className = 'tut-hint tut-hint-canvas';
        this.hint.innerHTML = this.formatHintText(text);

        const btn = document.createElement('button');
        btn.className = 'tut-btn';
        btn.textContent = 'やってみる！';
        btn.addEventListener('click', () => {
            if (this.sound) this.sound.play('flip', 0.3);
            this.cleanup();
            if (onDismiss) onDismiss();
        });
        this.hint.appendChild(btn);
        wrapper.appendChild(this.hint);
    }

    formatHintText(text) {
        return '<div class="tut-hint-text">' +
            text.replace(/\n/g, '<br>') + '</div>';
    }

    cleanup() {
        if (this.overlay && this.overlay.parentNode) {
            this.overlay.remove();
        }
        if (this.hint && this.hint.parentNode) {
            this.hint.remove();
        }
        if (this._spotlightEl) {
            this._spotlightEl.classList.remove('tut-spotlight');
            this._spotlightEl = null;
        }
        this.overlay = null;
        this.hint = null;
    }

    // --- ユーティリティ ---

    waitForJournalClose(cb) {
        const check = setInterval(() => {
            if (!this.journal.isShowing) {
                clearInterval(check);
                setTimeout(cb, 400);
            }
        }, 200);
    }
}
