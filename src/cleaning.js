class CleaningGame {
    constructor(canvas, station) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.station = station;
        this.active = false;
        this.transition = 0;
        this.transitioning = false;
        this.entering = false;

        this.currentTool = 0;
        this.toolDefs = [
            { name: '✋ 手', desc: '雑草を引き抜く', target: 'weed' },
            { name: '🪶 はたき', desc: 'ほこりをはたく', target: 'dust' },
            { name: '🧹 ほうき', desc: 'ゴミをはく', target: 'trash' }
        ];

        this.items = [];
        this.particles = [];
        this.totalCleaned = 0;
        this.completedTimer = 0;

        this.pointerDown = false;
        this.pointerX = 0;
        this.pointerY = 0;
        this.startX = 0;
        this.startY = 0;
        this.grabbedItem = null;
        this.swipeTrail = [];

        this.onDown = this.handleDown.bind(this);
        this.onMove = this.handleMove.bind(this);
        this.onUp = this.handleUp.bind(this);
    }

    enter() {
        this.active = true;
        this.transitioning = true;
        this.entering = true;
        this.transition = 0;
        this.totalCleaned = 0;
        this.completedTimer = 0;
        this.currentTool = 0;
        this.particles = [];
        this.generateItems();
        this.canvas.addEventListener('pointerdown', this.onDown);
        this.canvas.addEventListener('pointermove', this.onMove);
        this.canvas.addEventListener('pointerup', this.onUp);
    }

    exit() {
        this.transitioning = true;
        this.entering = false;
        if (window._sound) {
            window._sound.stopLoop('weed');
            window._sound.stopLoop('sweep');
        }
        // 掃除効率バフを適用
        const cleanMult = this.station.eventSystem
            ? this.station.eventSystem.getCleanPowerMultiplier() : 1;
        // 全部掃除したらきれい度100%に（バフで減衰）
        if (this.isComplete()) {
            const maxClean = Math.floor(100 * cleanMult);
            this.station.cleanliness = Math.min(100, Math.max(this.station.cleanliness, maxClean));
            this.station.lastCleanedAt = Date.now();
        } else if (this.totalCleaned > 0) {
            this.station.clean(Math.floor(this.totalCleaned * cleanMult));
        }
        this.canvas.removeEventListener('pointerdown', this.onDown);
        this.canvas.removeEventListener('pointermove', this.onMove);
        this.canvas.removeEventListener('pointerup', this.onUp);
    }

    generateItems() {
        this.items = [];
        const w = this.canvas.width;
        const positions = [];
        const stage = this.station.stage;

        // きれい度に応じて汚れ数を決定（汚いほど多い）
        const dirtiness = 100 - this.station.cleanliness;
        // dirtiness 0〜5: 汚れなし、5〜100: 1〜15個
        const totalDirt = Math.min(15, Math.floor(dirtiness / 6));

        // 汚れがなければ何も生成しない
        if (totalDirt <= 0) return;

        // ステージに応じて汚れの比率を決める
        let weedRatio, dustRatio, trashRatio;
        if (stage <= 1) {
            weedRatio = 0.5; dustRatio = 0.35; trashRatio = 0.15;
        } else if (stage <= 3) {
            weedRatio = 0.2; dustRatio = 0.45; trashRatio = 0.35;
        } else {
            weedRatio = 0.1; dustRatio = 0.4; trashRatio = 0.5;
        }

        const weedCount = Math.max(0, Math.round(totalDirt * weedRatio));
        const dustCount = Math.max(0, Math.round(totalDirt * dustRatio));
        const trashCount = Math.max(0, totalDirt - weedCount - dustCount);

        const placeItem = (obj) => {
            for (let attempt = 0; attempt < 20; attempt++) {
                const x = 80 + Math.random() * (w - 160);
                const y = 150 + Math.random() * 140;
                const tooClose = positions.some(p =>
                    Math.abs(p.x - x) < 50 && Math.abs(p.y - y) < 40
                );
                if (!tooClose) {
                    obj.x = x;
                    obj.y = y;
                    positions.push({ x, y });
                    return;
                }
            }
            obj.x = 80 + Math.random() * (w - 160);
            obj.y = 150 + Math.random() * 140;
        };

        for (let i = 0; i < weedCount; i++) {
            const item = {
                type: 'weed', pullY: 0, state: 'idle',
                size: 20 + Math.random() * 12,
                variant: Math.floor(Math.random() * 3),
                wobble: 0, x: 0, y: 0
            };
            placeItem(item);
            this.items.push(item);
        }

        for (let i = 0; i < dustCount; i++) {
            const item = {
                type: 'dust', opacity: 1, swipeCount: 0,
                state: 'idle', size: 30 + Math.random() * 20, x: 0, y: 0
            };
            placeItem(item);
            this.items.push(item);
        }

        const trashEmojis = ['🍂', '📄', '🥤', '🍬', '🧻', '👟'];
        for (let i = 0; i < trashCount; i++) {
            const item = {
                type: 'trash', state: 'idle',
                emoji: trashEmojis[Math.floor(Math.random() * trashEmojis.length)],
                vx: 0, vy: 0, size: 18, x: 0, y: 0
            };
            placeItem(item);
            this.items.push(item);
        }
    }

    toCanvas(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height)
        };
    }

    handleDown(e) {
        e.preventDefault();
        const { x, y } = this.toCanvas(e);
        this.pointerDown = true;
        this.pointerX = x;
        this.pointerY = y;
        this.startX = x;
        this.startY = y;

        if (this.handleToolbarClick(x, y)) return;
        if (x > this.canvas.width - 80 && y < 45) { this.exit(); return; }

        const tool = this.toolDefs[this.currentTool];
        this.grabbedItem = this.getItemAt(x, y, tool.target);
        if (this.grabbedItem && this.grabbedItem.type === 'weed') {
            this.grabbedItem.state = 'grabbing';
            if (window._sound) window._sound.startLoop('weed', 0.3);
        }
        if (tool.target === 'dust' || tool.target === 'trash') {
            if (window._sound) window._sound.startLoop('sweep', 0.3);
        }
        this.swipeTrail = [{ x, y }];
    }

    handleMove(e) {
        e.preventDefault();
        const { x, y } = this.toCanvas(e);
        this.pointerX = x;
        this.pointerY = y;
        if (!this.pointerDown) return;

        this.swipeTrail.push({ x, y });
        if (this.swipeTrail.length > 20) this.swipeTrail.shift();

        const tool = this.toolDefs[this.currentTool];

        if (tool.target === 'weed' && this.grabbedItem) {
            this.handleWeedPull(y);
        } else if (tool.target === 'dust') {
            this.handleDustSwipe(x, y);
        } else if (tool.target === 'trash') {
            this.handleTrashSweep(x, y);
        }
    }

    handleUp(e) {
        e.preventDefault();
        this.pointerDown = false;
        if (this.grabbedItem && this.grabbedItem.type === 'weed'
            && this.grabbedItem.state !== 'done') {
            this.grabbedItem.state = 'idle';
        }
        this.grabbedItem = null;
        this.swipeTrail = [];
        // 操作音を止める
        if (window._sound) {
            window._sound.stopLoop('weed');
            window._sound.stopLoop('sweep');
        }
    }

    handleWeedPull(y) {
        const item = this.grabbedItem;
        const dy = this.startY - y;
        item.pullY = Math.max(0, dy);
        item.wobble = Math.sin(Date.now() * 0.02) * 3 * (item.pullY / 80);

        if (item.pullY > 80) {
            item.state = 'done';
            this.totalCleaned += 3 + this.station.upgradeCleanPower;
            this.addParticles(item.x, item.y, 'earth', 10);
            this.grabbedItem = null;
            if (window._sound) {
                window._sound.stopLoop('weed');
                window._sound.playPop();
            }
        }
    }

    handleDustSwipe(x, y) {
        for (const item of this.items) {
            if (item.type !== 'dust' || item.state === 'done') continue;
            if (Math.abs(x - item.x) < item.size && Math.abs(y - item.y) < item.size) {
                item.swipeCount++;
                item.opacity = Math.max(0, 1 - item.swipeCount / 18);
                if (Math.random() > 0.6) {
                    this.addParticles(x, y, 'dust', 2);
                }
                if (item.swipeCount > 18) {
                    item.state = 'done';
                    this.totalCleaned += 2 + this.station.upgradeCleanPower;
                    this.addParticles(item.x, item.y, 'sparkle', 6);
                    if (window._sound) window._sound.playPop();
                }
            }
        }
    }

    handleTrashSweep(x, y) {
        for (const item of this.items) {
            if (item.type !== 'trash' || item.state === 'done') continue;
            if (Math.abs(x - item.x) < 35 && Math.abs(y - item.y) < 35) {
                if (this.swipeTrail.length > 3) {
                    const prev = this.swipeTrail[this.swipeTrail.length - 4];
                    item.vx += (x - prev.x) * 0.3;
                    item.vy += (y - prev.y) * 0.3;
                }
            }
        }
    }

    getItemAt(x, y, targetType) {
        for (const item of this.items) {
            if (item.type !== targetType || item.state === 'done') continue;
            if (Math.abs(x - item.x) < item.size + 5
                && Math.abs(y - item.y) < item.size + 5) {
                return item;
            }
        }
        return null;
    }

    handleToolbarClick(x, y) {
        const h = this.canvas.height;
        if (y < h - 60) return false;
        const btnW = 130;
        const gap = 10;
        const startX = (this.canvas.width - btnW * 3 - gap * 2) / 2;
        for (let i = 0; i < 3; i++) {
            const bx = startX + i * (btnW + gap);
            if (x >= bx && x <= bx + btnW && y >= h - 55 && y <= h - 10) {
                this.currentTool = i;
                return true;
            }
        }
        return false;
    }

    addParticles(x, y, type, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 16,
                y: y + (Math.random() - 0.5) * 16,
                vx: (Math.random() - 0.5) * 5,
                vy: -Math.random() * 4 - 1,
                life: 1, type,
                size: 3 + Math.random() * 4
            });
        }
    }

    isEmpty() {
        return this.items.length === 0;
    }

    isComplete() {
        return this.items.length > 0 && this.items.every(i => i.state === 'done');
    }

    update(delta) {
        if (this.transitioning) {
            const speed = delta / 350;
            if (this.entering) {
                this.transition = Math.min(1, this.transition + speed);
                if (this.transition >= 1) this.transitioning = false;
            } else {
                this.transition = Math.max(0, this.transition - speed);
                if (this.transition <= 0) {
                    this.transitioning = false;
                    this.active = false;
                }
            }
        }

        for (const item of this.items) {
            if (item.type === 'trash' && item.state !== 'done') {
                item.x += item.vx;
                item.y += item.vy;
                item.vx *= 0.9;
                item.vy *= 0.9;
                if (item.x < -30 || item.x > this.canvas.width + 30
                    || item.y < -30 || item.y > this.canvas.height + 30) {
                    item.state = 'done';
                    this.totalCleaned += 2 + this.station.upgradeCleanPower;
                    if (window._sound) window._sound.playPop();
                }
            }
            if (item.type === 'weed' && item.state === 'idle' && item.pullY > 0) {
                item.pullY *= 0.82;
                if (item.pullY < 0.5) item.pullY = 0;
            }
        }

        this.particles = this.particles.filter(p => {
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.12;
            p.life -= 0.025;
            return p.life > 0;
        });

        if (this.isEmpty() && this.completedTimer === 0) {
            this.completedTimer = Date.now();
        }
        if (this.isComplete() && this.completedTimer === 0) {
            this.completedTimer = Date.now();
            this.addParticles(this.canvas.width / 2, 200, 'sparkle', 20);
            if (window._sound) window._sound.playFanfare();
        }
        if (this.completedTimer > 0 && Date.now() - this.completedTimer > 2500) {
            this.exit();
        }
    }

    draw() {
        if (!this.active) return false;
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (this.transition < 1) {
            ctx.save();
            ctx.beginPath();
            const r = this.transition * Math.max(w, h) * 1.2;
            ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
            ctx.clip();
        }

        this.drawBackground();

        if (this.isEmpty()) {
            this.drawEmpty();
        } else {
            this.drawItems();
            this.drawSwipeTrail();
            this.drawParticles();
            this.drawToolbar();
            this.drawProgress();
            if (this.isComplete()) this.drawComplete();
        }
        this.drawExitBtn();

        if (this.transition < 1) ctx.restore();
        return true;
    }

    drawBackground() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#e4eef4';
        ctx.fillRect(0, 0, w, 120);

        const grad = ctx.createLinearGradient(0, 120, 0, h - 70);
        grad.addColorStop(0, '#d8ccb8');
        grad.addColorStop(1, '#c8bca8');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 120, w, h - 190);

        ctx.strokeStyle = 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1;
        for (let x = 0; x < w; x += 80) {
            ctx.beginPath(); ctx.moveTo(x, 120); ctx.lineTo(x, h - 70); ctx.stroke();
        }
        for (let y = 120; y < h - 70; y += 60) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
        }

        ctx.fillStyle = '#b4a894';
        ctx.fillRect(0, h - 75, w, 8);
        ctx.fillStyle = 'rgba(250,246,240,0.97)';
        ctx.fillRect(0, h - 67, w, 67);
    }

    drawItems() {
        for (const item of this.items) {
            if (item.state === 'done') continue;
            if (item.type === 'weed') this.drawWeed(item);
            else if (item.type === 'dust') this.drawDust(item);
            else if (item.type === 'trash') this.drawTrash(item);
        }
    }

    drawWeed(item) {
        const ctx = this.ctx;
        const x = item.x + (item.wobble || 0);
        const y = item.y - item.pullY;
        const s = item.size;

        if (item.pullY > 10) {
            ctx.strokeStyle = '#8b6914';
            ctx.lineWidth = 2;
            const rLen = Math.min(item.pullY * 0.5, 25);
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(item.x, item.y);
                ctx.lineTo(item.x + i * 7, item.y + rLen);
                ctx.stroke();
            }
        }

        ctx.strokeStyle = '#3a9918';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - s); ctx.stroke();

        ctx.fillStyle = '#4dbb2a';
        for (let i = 0; i < 3; i++) {
            const ly = y - s * 0.3 - i * s * 0.25;
            const dir = i % 2 === 0 ? 1 : -1;
            ctx.beginPath();
            ctx.ellipse(x + dir * 9, ly, 11, 5, dir * 0.4, 0, Math.PI * 2);
            ctx.fill();
        }

        if (item.state === 'grabbing') {
            const prog = Math.min(1, item.pullY / 80);
            ctx.fillStyle = `rgba(255,220,80,${0.15 + prog * 0.2})`;
            ctx.beginPath(); ctx.arc(x, y, s + 8, 0, Math.PI * 2); ctx.fill();

            ctx.fillStyle = '#cc8822';
            ctx.font = 'bold 18px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('⬆', x, y - s - 12);
        }
    }

    drawDust(item) {
        const ctx = this.ctx;
        ctx.globalAlpha = item.opacity;

        ctx.fillStyle = '#a09585';
        ctx.beginPath();
        ctx.ellipse(item.x, item.y, item.size * 0.7, item.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#b0a595';
        for (let i = 0; i < 5; i++) {
            const a = (i / 5) * Math.PI * 2 + item.x * 0.01;
            const r = item.size * (0.3 + (i % 3) * 0.15);
            ctx.beginPath();
            ctx.arc(item.x + Math.cos(a) * r, item.y + Math.sin(a) * r * 0.5,
                3 + (i % 3) * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawTrash(item) {
        const ctx = this.ctx;
        ctx.font = item.size + 'px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.emoji, item.x, item.y);

        ctx.fillStyle = 'rgba(0,0,0,0.06)';
        ctx.beginPath();
        ctx.ellipse(item.x, item.y + item.size * 0.6, item.size * 0.5, 3, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    drawSwipeTrail() {
        if (!this.pointerDown || this.swipeTrail.length < 3) return;
        const ctx = this.ctx;
        const tool = this.toolDefs[this.currentTool];
        if (tool.target === 'weed') return;

        ctx.strokeStyle = tool.target === 'dust'
            ? 'rgba(180,160,130,0.35)' : 'rgba(100,140,90,0.35)';
        ctx.lineWidth = tool.target === 'dust' ? 18 : 24;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(this.swipeTrail[0].x, this.swipeTrail[0].y);
        for (let i = 1; i < this.swipeTrail.length; i++) {
            ctx.lineTo(this.swipeTrail[i].x, this.swipeTrail[i].y);
        }
        ctx.stroke();
    }

    drawParticles() {
        const ctx = this.ctx;
        for (const p of this.particles) {
            ctx.globalAlpha = p.life;
            if (p.type === 'earth') {
                ctx.fillStyle = '#8b6914';
            } else if (p.type === 'dust') {
                ctx.fillStyle = '#b0a090';
            } else {
                ctx.fillStyle = '#ffdd44';
            }
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }

    drawToolbar() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        const btnW = 130;
        const gap = 10;
        const sx = (w - btnW * 3 - gap * 2) / 2;

        for (let i = 0; i < 3; i++) {
            const bx = sx + i * (btnW + gap);
            const by = h - 57;
            const on = this.currentTool === i;

            ctx.fillStyle = on ? '#fff8ee' : '#f0e8dc';
            ctx.strokeStyle = on ? '#cc8844' : '#d4c4a8';
            ctx.lineWidth = on ? 3 : 1;
            this.roundRect(bx, by, btnW, 42, 8);
            ctx.fill(); ctx.stroke();

            ctx.fillStyle = on ? '#5a4a3a' : '#8a7a5a';
            ctx.font = (on ? 'bold ' : '') + '13px "Zen Maru Gothic"';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.toolDefs[i].name, bx + btnW / 2, by + 14);

            ctx.fillStyle = '#999';
            ctx.font = '10px "Zen Maru Gothic"';
            ctx.fillText(this.toolDefs[i].desc, bx + btnW / 2, by + 32);
        }
    }

    drawExitBtn() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        this.roundRect(w - 80, 8, 70, 32, 6);
        ctx.fill();
        ctx.strokeStyle = '#d4c4a8';
        ctx.lineWidth = 1;
        this.roundRect(w - 80, 8, 70, 32, 6);
        ctx.stroke();

        ctx.fillStyle = '#5a4a3a';
        ctx.font = '12px "Zen Maru Gothic"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✕ もどる', w - 45, 24);
    }

    drawProgress() {
        const ctx = this.ctx;
        const total = this.items.length;
        const done = this.items.filter(i => i.state === 'done').length;

        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        this.roundRect(10, 8, 220, 32, 6);
        ctx.fill();

        ctx.fillStyle = '#5a4a3a';
        ctx.font = 'bold 13px "Zen Maru Gothic"';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧹 おそうじ ' + done + '/' + total
            + '  きれい度 +' + this.totalCleaned, 20, 24);
    }

    drawComplete() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.fillRect(0, 0, w, h - 67);

        ctx.fillStyle = '#5a4a3a';
        ctx.font = 'bold 28px "Zen Maru Gothic"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✨ ピカピカ！ ✨', w / 2, h / 2 - 20);

        ctx.font = '16px "Zen Maru Gothic"';
        ctx.fillStyle = '#8a7a5a';
        ctx.fillText('きれい度 +' + this.totalCleaned, w / 2, h / 2 + 15);
    }

    drawEmpty() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;

        ctx.fillStyle = '#5a4a3a';
        ctx.font = 'bold 24px "Zen Maru Gothic"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('✨ ここはきれいです ✨', w / 2, h / 2 - 30);

        ctx.font = '14px "Zen Maru Gothic"';
        ctx.fillStyle = '#8a7a5a';
        ctx.fillText('汚れはまだたまっていません', w / 2, h / 2 + 5);
        ctx.fillText('しばらくすると汚れが出てきます', w / 2, h / 2 + 25);
    }

    roundRect(x, y, w, h, r) {
        const ctx = this.ctx;
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
    }
}
