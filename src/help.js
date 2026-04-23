// ヘルプメニュー
// タブバーの「❓」ボタンから開ける、各機能のリファレンス。
// チュートリアルとは独立した「いつでも参照できる説明書」

const HELP_SECTIONS = [
    {
        id: 'cleaning', icon: '🧹', title: 'お掃除',
        body:
            'ホームを清潔に保つ基本操作です。「おそうじ」ボタンから開始。\n' +
            '\n' +
            '・✋ 手 — 雑草を上にスワイプして引き抜く\n' +
            '・🪶 はたき — ほこりをこすって落とす\n' +
            '・🧹 ほうき — ゴミをはき出す\n' +
            '\n' +
            'きれい度が高いほど乗客が増えます。放置するとどんどん下がるのでこまめに。'
    },
    {
        id: 'upgrades', icon: '🔧', title: 'せつび（アップグレード）',
        body:
            '駅そのものをよくする買い切り型の改善です。\n' +
            '\n' +
            '・「せつび」タブから購入\n' +
            '・1回買えば永続効果\n' +
            '・全アップグレードを揃えると次のStageへ進化できる\n' +
            '・Stageごとに利用できる設備が増える'
    },
    {
        id: 'shop', icon: '🛍️', title: 'おみせ（アイテム）',
        body:
            '配置型のアイテムを買って効果を発動します。\n' +
            '\n' +
            '・🚶 ひとを呼ぶ — 乗客が増える\n' +
            '・💛 こころを満たす — 評判が上がる\n' +
            '・💰 おかねを稼ぐ — 自動収入\n' +
            '\n' +
            '【耐久度】時間や使用で減少。0になると効果が止まり「壊れた」状態になります。\n' +
            'Stageが上がるほど劣化が早くなるので注意。'
    },
    {
        id: 'placed', icon: '🎒', title: 'もちもの（手入れ・売却）',
        body:
            '設置済みアイテムを管理するタブです。\n' +
            '\n' +
            '・📊 耐久度バー — 残り寿命を表示\n' +
            '・🔧 手入れ — お金を払って耐久度を回復\n' +
            '・💔 なおす — 壊れたアイテムを復活（修理より高い）\n' +
            '・💸 売る — いらないアイテムを売却'
    },
    {
        id: 'auto-maintain', icon: '⚙️', title: '自動手入れ',
        body:
            'Stage 1+ かつアイテム5個以上設置で解放されます。\n' +
            '\n' +
            '・「もちもの」タブから ON/OFF 切替\n' +
            '・選んだアイテムを自動で手入れしてくれる\n' +
            '・お金は通常通りかかる\n' +
            '・新しく設置したアイテムは自動で対象に追加\n' +
            '\n' +
            '中盤以降、アイテムが増えると手動が大変なので必須機能。'
    },
    {
        id: 'events', icon: '📢', title: 'イベント',
        body:
            'プレイ中ランダムで発生する出来事です。\n' +
            '\n' +
            '・「即時発動」型 — お金や評判が増減\n' +
            '・「選択肢」型 — プレイヤーが決断、結果が変わる\n' +
            '・「バフ」型 — 一定時間ボーナスやペナルティ\n' +
            '\n' +
            '一部の選択でしか手に入らない「イベント限定アイテム」もあるので慎重に。'
    },
    {
        id: 'eventlog', icon: '📔', title: 'おもいで（イベント履歴）',
        body:
            '今までに体験したイベントの履歴を見られます。\n' +
            '・体験済みのイベントだけ表示\n' +
            '・タップすると詳細やストーリーを再読できる\n' +
            '・イベント限定アイテムの解放条件もここで確認'
    },
    {
        id: 'special-dirt', icon: '🚨', title: '特殊な汚れ（Stage 5+）',
        body:
            'Stage 5 以降で 10〜15分に1回ランダム発生する3種類の汚れ。\n' +
            '\n' +
            '・🎨 落書き — 放置すると 乗客 -10%／個\n' +
            '・🛢️ 油汚れ — 放置で 1分ごとに評判 -5／個（オフライン中も累積）\n' +
            '・🗑️ ゴミの山 — 放置で アイテム効果 -10%／個（除去で報酬）\n' +
            '\n' +
            '通常の掃除では取れません。バッジをタップして専用ミニゲームで除去。'
    },
    {
        id: 'dirty-penalty', icon: '⚠️', title: 'きれい度ペナルティ',
        body:
            'きれい度が **40以下** の状態が続くと、15秒ごとに評判 -3 のペナルティ。\n' +
            '\n' +
            '・危険域では画面に赤い警告バナーとカウントダウンが出る\n' +
            '・評判が下がると乗客ボーナスが減る\n' +
            '・きれい度を 40より上 に戻せばすぐ止まる\n' +
            '\n' +
            'こまめにお掃除するのが基本。'
    },
    {
        id: 'offline', icon: '⏰', title: 'オフライン収入',
        body:
            'ゲームを閉じている間も自動でお金がたまる仕組みです。\n' +
            '\n' +
            '・最大 12時間 ぶんまで（それ以上は頭打ち）\n' +
            '・自動収入＋電車収入の50%が適用される\n' +
            '・自動手入れ ON ならアイテムの劣化処理も走る\n' +
            '・特殊汚れの油汚れは オフライン中もペナルティ累積するので放置注意'
    },
    {
        id: 'evolve', icon: '🌟', title: 'Stage進化',
        body:
            'すべてのアップグレード達成で次のステージへ進化できます。\n' +
            '\n' +
            '・全部で 10段階（Stage 0 さびれた無人駅 → Stage 9 伝説の駅）\n' +
            '・上ステージほど乗客・収入が大きいが要件も上がる\n' +
            '・進化すると新しい設備・アイテム・イベントが解放\n' +
            '・きれい度はリセット、お金とアイテムは持ち越し'
    },
    {
        id: 'reputation', icon: '⭐', title: '評判ランク',
        body:
            '評判ポイントを貯めると上がるランクシステムです。\n' +
            '\n' +
            '・全11段階（無名の駅 〜 伝説の駅）\n' +
            '・ランクが高いほど乗客ボーナスが増える\n' +
            '・イベントの選択や設備の購入で評判が増える\n' +
            '・きれい度ペナルティや一部のイベントで評判が減ることも'
    },
    {
        id: 'achievements', icon: '🏆', title: '実績',
        body:
            '各種条件達成でアンロックされる収集要素です。\n' +
            '\n' +
            '・「🏆」タブから一覧を確認\n' +
            '・隠し実績もある（解除されるまで内容は伏せ字）\n' +
            '・解放時にバナーで通知'
    }
];

class HelpManager {
    constructor() {
        this._open = false;
        this._setupButton();
    }

    _setupButton() {
        const btn = document.getElementById('help-btn');
        if (btn) btn.addEventListener('click', () => this.open());
    }

    open() {
        if (this._open) return;
        this._open = true;
        const overlay = document.createElement('div');
        overlay.className = 'help-overlay';
        overlay.innerHTML =
            '<div class="help-modal">' +
              '<div class="help-header">' +
                '<h2>❓ ヘルプ</h2>' +
                '<button class="help-close" aria-label="閉じる">✕</button>' +
              '</div>' +
              '<div class="help-body">' +
                HELP_SECTIONS.map(s =>
                  '<details class="help-section">' +
                    '<summary><span class="help-icon">' + s.icon + '</span>' + s.title + '</summary>' +
                    '<div class="help-content">' + s.body.split('\n').map(l => l.trim() === '' ? '<br>' : '<p>' + l + '</p>').join('') + '</div>' +
                  '</details>'
                ).join('') +
              '</div>' +
            '</div>';
        document.body.appendChild(overlay);

        const close = () => this.close(overlay);
        overlay.querySelector('.help-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    close(overlay) {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        this._open = false;
    }
}
