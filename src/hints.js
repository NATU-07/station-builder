// 解放時ヒント
// 新機能が初めて発生・解放されたタイミングで一度だけ表示される短いポップアップ。
// localStorage に表示済みIDを記録するので、リプレイ時は出ない。

const HINT_DEFS = {
    'auto-maintain': {
        icon: '⚙️', title: '自動手入れが解放されたよ',
        body: '「もちもの」タブから設定できる！\n選んだアイテムを自動で手入れしてくれるよ。'
    },
    'dirty-penalty': {
        icon: '⚠️', title: 'きれい度が低くて評判が下がってるよ',
        body: 'きれい度40以下が続くと15秒ごとに評判が減るよ。\n早めにお掃除しよう！'
    },
    'special-dirt': {
        icon: '🚨', title: '特殊な汚れが発生！',
        body: '通常の掃除では取れないよ。\n左の🚨バッジをタップして、ミニゲームで除去しよう。'
    },
    'offline-income': {
        icon: '⏰', title: 'おかえり！オフライン中の収入だよ',
        body: 'ゲームを閉じている間も最大12時間まで稼いでくれるよ。'
    },
    'reputation-rank-up': {
        icon: '⭐', title: '評判ランクが上がった！',
        body: '上のランクほど乗客ボーナスが増える。\n全11段階、最終ランクは「伝説の駅」だよ。'
    }
};

class Hints {
    constructor() {
        try {
            this.shown = new Set(JSON.parse(localStorage.getItem('hints-shown') || '[]'));
        } catch (_) {
            this.shown = new Set();
        }
    }

    // 一度だけ表示。表示済みなら何もしない
    show(id) {
        if (this.shown.has(id)) return false;
        const def = HINT_DEFS[id];
        if (!def) return false;
        this.shown.add(id);
        this._save();
        this._render(def);
        return true;
    }

    _save() {
        try {
            localStorage.setItem('hints-shown', JSON.stringify([...this.shown]));
        } catch (_) {}
    }

    _render(def) {
        const overlay = document.createElement('div');
        overlay.className = 'hint-overlay';
        overlay.innerHTML =
            '<div class="hint-modal">' +
              '<div class="hint-icon">' + def.icon + '</div>' +
              '<div class="hint-title">' + def.title + '</div>' +
              '<div class="hint-body">' + def.body.split('\n').map(l => '<p>' + l + '</p>').join('') + '</div>' +
              '<button class="hint-close-btn">わかった</button>' +
            '</div>';
        document.body.appendChild(overlay);
        const close = () => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        };
        overlay.querySelector('.hint-close-btn').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    }

    // デバッグ用: 表示済みフラグをリセット
    reset() {
        this.shown.clear();
        this._save();
    }
}
