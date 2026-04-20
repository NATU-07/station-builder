// Stage 5〜9 の描画拡張（Renderer のプロトタイプに追加）

// ヘルパー: テナント看板を描画
Renderer.prototype.drawTenant = function(x, y, w, h, color, label) {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
    this.ctx.fillStyle = '#fff';
    this.ctx.font = '8px "Zen Maru Gothic"';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(label, x + w / 2, y + h / 2 + 3);
};

// ヘルパー: ビル窓を描画
Renderer.prototype.drawWindows = function(x, y, cols, rows, cellW, cellH, color) {
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x + c * cellW, y + r * cellH, cellW - 4, cellH - 4);
        }
    }
};

Renderer.prototype.drawStage5 = function(cx, baseY, station) {
    // ターミナル駅: 画像を使用
    if (this.stationImg5 && this.stationImg5.complete && this.stationImg5.naturalWidth > 0) {
        const imgW = 520;
        const imgH = 290;
        this.ctx.drawImage(this.stationImg5, cx - imgW / 2, baseY - imgH + 20, imgW, imgH);
    }
    const ups = station.purchased;
    if (ups.has('add_vip_lounge')) this.drawTenant(cx + 220, baseY - 50, 40, 50, '#885533', '👑 VIP');
    if (ups.has('add_hotel_gate')) this.drawTenant(cx - 260, baseY - 50, 40, 50, '#446688', '🏨 HOTEL');
};

Renderer.prototype.drawStage6 = function(cx, baseY, station) {
    // 観光名所駅: 画像を使用
    if (this.stationImg6 && this.stationImg6.complete && this.stationImg6.naturalWidth > 0) {
        const imgW = 780;
        const imgH = 294;
        this.ctx.drawImage(this.stationImg6, cx - imgW / 2, baseY - imgH + 20, imgW, imgH);
    }
    const ups = station.purchased;
    if (ups.has('add_footbath')) this.drawTenant(cx + 260, baseY - 30, 40, 30, '#4488aa', '♨ 足湯');
    if (ups.has('add_onsen')) this.drawTenant(cx - 300, baseY - 30, 45, 30, '#aa6644', '🧖 温泉');
};

Renderer.prototype.drawStage7 = function(cx, baseY, station) {
    // スマート駅: 画像を使用
    if (this.stationImg7 && this.stationImg7.complete && this.stationImg7.naturalWidth > 0) {
        const imgW = 720;
        const imgH = 300;
        this.ctx.drawImage(this.stationImg7, cx - imgW / 2, baseY - imgH + 30, imgW, imgH);
    }
    const ups = station.purchased;
    if (ups.has('add_digital_signage')) {
        this.ctx.fillStyle = '#112233';
        this.ctx.fillRect(cx - 60, baseY - 290, 120, 14);
        this.ctx.fillStyle = '#44ff88';
        this.ctx.font = '8px monospace';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('SMART STATION  Next: 2min', cx, baseY - 281);
    }
};

Renderer.prototype.drawStage8 = function(cx, baseY, station) {
    // 国際駅: 画像を使用
    if (this.stationImg8 && this.stationImg8.complete && this.stationImg8.naturalWidth > 0) {
        const imgW = 780;
        const imgH = 330;
        this.ctx.drawImage(this.stationImg8, cx - imgW / 2, baseY - imgH + 20, imgW, imgH);
    }
};

Renderer.prototype.drawStage9 = function(cx, baseY, station) {
    // 伝説の駅: 画像を使用
    if (this.stationImg9 && this.stationImg9.complete && this.stationImg9.naturalWidth > 0) {
        const imgW = 880;
        const imgH = 350;
        this.ctx.drawImage(this.stationImg9, cx - imgW / 2, baseY - imgH + 30, imgW, imgH);
    }
};
