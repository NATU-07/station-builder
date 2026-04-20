class EffectsManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.floatTexts = [];
        this.confetti = [];
        this.sparkles = [];
        this.screenFlash = 0;
        this.screenFlashColor = 'rgba(255,255,255,0)';
        this.screenGlow = 0;
    }

    // --- フロートテキスト（+120円 が浮かび上がる）---

    addFloatText(text, x, y, color, size) {
        this.floatTexts.push({
            text,
            x: x + (Math.random() - 0.5) * 30,
            y,
            startY: y,
            color: color || '#ffaa00',
            size: size || 16,
            life: 1.0,
            speed: 0.8 + Math.random() * 0.3
        });
    }

    addMoneyFloat(amount, x, y) {
        const text = '+' + amount.toLocaleString() + '円';
        this.addFloatText(text, x, y, '#e8a020', 15);
    }

    addVisitorFloat(count, x, y) {
        this.addFloatText('+' + count + '人', x, y - 20, '#6a9a5a', 12);
    }

    addReputationFloat(text, x, y) {
        this.addFloatText(text, x, y - 35, '#9966cc', 11);
    }

    // --- 紙吹雪（進化時）---

    triggerConfetti(cx, cy, count) {
        const colors = [
            '#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff',
            '#ff8fdb', '#ffa94d', '#74c0fc', '#b197fc'
        ];
        for (let i = 0; i < (count || 80); i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 3 + Math.random() * 6;
            this.confetti.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 4,
                color: colors[Math.floor(Math.random() * colors.length)],
                size: 4 + Math.random() * 6,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.3,
                life: 1.0,
                shape: Math.random() > 0.5 ? 'rect' : 'circle'
            });
        }
    }

    // --- スパークル（アップグレード購入時）---

    triggerSparkle(cx, cy, count) {
        for (let i = 0; i < (count || 12); i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 3;
            this.sparkles.push({
                x: cx + (Math.random() - 0.5) * 40,
                y: cy + (Math.random() - 0.5) * 20,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - 1.5,
                life: 1.0,
                size: 3 + Math.random() * 4,
                hue: 40 + Math.random() * 30
            });
        }
    }

    // --- 画面フラッシュ（進化時）---

    triggerFlash(color, intensity) {
        this.screenFlash = intensity || 0.8;
        this.screenFlashColor = color || 'rgba(255,255,200,';
    }

    // --- 画面グロー（掃除完了時の明るさ）---

    triggerGlow(intensity) {
        this.screenGlow = intensity || 0.3;
    }

    // --- 進化フル演出 ---

    triggerEvolution(cx, cy) {
        this.triggerFlash('rgba(255,220,100,', 0.9);
        this.triggerConfetti(cx, cy, 100);
        // 少し遅れて2波目
        setTimeout(() => {
            this.triggerConfetti(cx, cy - 50, 60);
        }, 300);
    }

    // --- 更新 ---

    update(delta) {
        // フロートテキスト
        this.floatTexts = this.floatTexts.filter(ft => {
            ft.y -= ft.speed;
            ft.life -= 0.015;
            return ft.life > 0;
        });

        // 紙吹雪
        this.confetti = this.confetti.filter(c => {
            c.x += c.vx;
            c.y += c.vy;
            c.vy += 0.15; // 重力
            c.vx *= 0.99;
            c.rotation += c.rotSpeed;
            c.life -= 0.008;
            return c.life > 0;
        });

        // スパークル
        this.sparkles = this.sparkles.filter(s => {
            s.x += s.vx;
            s.y += s.vy;
            s.vy += 0.05;
            s.life -= 0.025;
            return s.life > 0;
        });

        // 画面フラッシュ減衰
        if (this.screenFlash > 0) {
            this.screenFlash *= 0.92;
            if (this.screenFlash < 0.01) this.screenFlash = 0;
        }

        // 画面グロー減衰
        if (this.screenGlow > 0) {
            this.screenGlow *= 0.96;
            if (this.screenGlow < 0.01) this.screenGlow = 0;
        }
    }

    // --- 描画 ---

    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        // 画面グロー（背景の上、オブジェクトの下）
        if (this.screenGlow > 0) {
            ctx.fillStyle = 'rgba(200,255,200,' + (this.screenGlow * 0.3) + ')';
            ctx.fillRect(0, 0, w, h);
        }

        // 紙吹雪
        for (const c of this.confetti) {
            ctx.save();
            ctx.globalAlpha = Math.min(1, c.life * 2);
            ctx.translate(c.x, c.y);
            ctx.rotate(c.rotation);
            ctx.fillStyle = c.color;
            if (c.shape === 'rect') {
                ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
            } else {
                ctx.beginPath();
                ctx.arc(0, 0, c.size / 2, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // スパークル
        for (const s of this.sparkles) {
            ctx.globalAlpha = s.life;
            const glow = s.size * (0.5 + s.life * 0.5);
            ctx.fillStyle = 'hsla(' + s.hue + ', 100%, 75%, ' + (s.life * 0.4) + ')';
            ctx.beginPath();
            ctx.arc(s.x, s.y, glow * 2, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = 'hsla(' + s.hue + ', 100%, 90%, ' + s.life + ')';
            this.drawStar(s.x, s.y, glow);
        }
        ctx.globalAlpha = 1;

        // フロートテキスト
        for (const ft of this.floatTexts) {
            ctx.globalAlpha = Math.min(1, ft.life * 2.5);
            ctx.font = 'bold ' + ft.size + 'px "Zen Maru Gothic"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';

            // 影
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.fillText(ft.text, ft.x + 1, ft.y + 1);

            // 本体
            ctx.fillStyle = ft.color;
            ctx.fillText(ft.text, ft.x, ft.y);
        }
        ctx.globalAlpha = 1;

        // 画面フラッシュ（最前面）
        if (this.screenFlash > 0) {
            ctx.fillStyle = this.screenFlashColor + this.screenFlash + ')';
            ctx.fillRect(0, 0, w, h);
        }
    }

    // 星型の描画
    drawStar(x, y, r) {
        const ctx = this.ctx;
        ctx.beginPath();
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 - Math.PI / 2;
            const ax = x + Math.cos(angle) * r;
            const ay = y + Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(ax, ay);
            else ctx.lineTo(ax, ay);
            const midAngle = angle + Math.PI / 4;
            const mx = x + Math.cos(midAngle) * r * 0.35;
            const my = y + Math.sin(midAngle) * r * 0.35;
            ctx.lineTo(mx, my);
        }
        ctx.closePath();
        ctx.fill();
    }

    hasActiveEffects() {
        return this.floatTexts.length > 0
            || this.confetti.length > 0
            || this.sparkles.length > 0
            || this.screenFlash > 0
            || this.screenGlow > 0;
    }
}
