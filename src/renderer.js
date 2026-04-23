class Renderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.w = canvas.width;
        this.h = canvas.height;
        this.time = 0;
        this.clouds = this.generateClouds();
        this.sparkles = [];

        // 背景画像の読み込み
        this.bgDay = new Image();
        this.bgDay.src = 'assets/ゲーム画像/bg_day.jpg';
        this.bgEvening = new Image();
        this.bgEvening.src = 'assets/ゲーム画像/bg_evening.jpg';
        this.bgNight = new Image();
        this.bgNight.src = 'assets/ゲーム画像/bg_night.jpg';
        this.bgLoaded = false;

        let loadCount = 0;
        const totalImages = 4;
        const onLoad = () => { loadCount++; if (loadCount >= totalImages) this.bgLoaded = true; };
        this.bgDay.onload = onLoad;
        this.bgEvening.onload = onLoad;
        this.bgNight.onload = onLoad;

        // 駅舎画像
        this.stationImg0 = new Image();
        this.stationImg0.src = 'assets/ゲーム画像/Gemini_Generated_Image_bnggwhbnggwhbngg_transparent.png';
        this.stationImg0.onload = onLoad;

        this.stationImg1 = new Image();
        this.stationImg1.src = 'assets/ゲーム画像/station_stage0.png';
        this.stationImg1.onload = () => {};

        this.stationImg2 = new Image();
        this.stationImg2.src = 'assets/ゲーム画像/_9034b37d-22dd-4ec5-aa08-eb17be5a4f1e_transparent.png';
        this.stationImg2.onload = () => {};

        this.stationImg3 = new Image();
        this.stationImg3.src = 'assets/ゲーム画像/_8f75d721-02a3-4029-b001-b942d267a82f_transparent.png';
        this.stationImg3.onload = () => {};

        this.stationImg4 = new Image();
        this.stationImg4.src = 'assets/ゲーム画像/station_stage4.png';
        this.stationImg4.onload = () => {};

        this.stationImg5 = new Image();
        this.stationImg5.src = 'assets/ゲーム画像/station_stage5.png';
        this.stationImg5.onload = () => {};

        this.stationImg6 = new Image();
        this.stationImg6.src = 'assets/ゲーム画像/station_stage6.png';
        this.stationImg6.onload = () => {};

        this.stationImg7 = new Image();
        this.stationImg7.src = 'assets/ゲーム画像/station_stage7.png';
        this.stationImg7.onload = () => {};

        this.stationImg8 = new Image();
        this.stationImg8.src = 'assets/ゲーム画像/station_stage8.png';
        this.stationImg8.onload = () => {};

        this.stationImg9 = new Image();
        this.stationImg9.src = 'assets/ゲーム画像/station_stage9.png';
        this.stationImg9.onload = () => {};

        // 電車画像
        this.trainImg = new Image();
        this.trainImg.src = 'assets/ゲーム画像/電車１_transparent.png';
        this.trainImg.onload = () => {};
    }

    getCurrentBg() {
        const hour = new Date().getHours();
        // 6〜16時: 朝昼、16〜19時: 夕方、19〜6時: 夜
        if (hour >= 6 && hour < 16) return this.bgDay;
        if (hour >= 16 && hour < 19) return this.bgEvening;
        return this.bgNight;
    }

    addSparkle(x, y) {
        for (let i = 0; i < 5; i++) {
            this.sparkles.push({
                x: x + Math.random() * 30 - 15,
                y: y + Math.random() * 20 - 10,
                life: 1.0,
                speed: 0.5 + Math.random() * 0.5
            });
        }
    }

    generateClouds() {
        const clouds = [];
        for (let i = 0; i < 5; i++) {
            clouds.push({
                x: Math.random() * this.w,
                y: 30 + Math.random() * 60,
                size: 30 + Math.random() * 40,
                speed: 0.1 + Math.random() * 0.2
            });
        }
        return clouds;
    }

    draw(station, time) {
        this.time = time;
        this.ctx.clearRect(0, 0, this.w, this.h);

        // 背景画像があればそれを描画、なければ従来の描画
        if (this.bgLoaded) {
            const bg = this.getCurrentBg();
            this.ctx.drawImage(bg, 0, 0, this.w, this.h);
        } else {
            this.drawSky(station.stage);
            this.drawClouds();
            this.drawMountains();
            this.drawGround();
            this.drawRailroad();
        }

        this.drawStation(station);
        this.drawPassengers(station);
        this.drawTrain(station);
        this.drawCleanlinessBar(station);
        this.drawSparkles();
    }

    drawSparkles() {
        this.sparkles = this.sparkles.filter(s => {
            s.life -= 0.02;
            s.y -= s.speed;
            if (s.life <= 0) return false;

            this.ctx.fillStyle = 'rgba(255, 255, 200, ' + s.life + ')';
            this.ctx.font = (10 + s.life * 6) + 'px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('✦', s.x, s.y);
            return true;
        });
    }

    drawSky(stage) {
        const colors = [
            ['#e8c8a0', '#f4dcc4'], // 0: 無人駅
            ['#c4d8e8', '#e4eef4'], // 1: 小さな駅
            ['#a8cce8', '#d4e8f4'], // 2: 中規模駅
            ['#88bbe8', '#c4ddf4'], // 3: 大きな駅
            ['#78aae4', '#b4d4f8'], // 4: 駅ビル
            ['#6899dd', '#a4ccf0'], // 5: ターミナル駅
            ['#5888d4', '#94bce8'], // 6: 観光名所駅
            ['#4878cc', '#84ace0'], // 7: スマート駅
            ['#3868c4', '#749cd8'], // 8: 国際駅
            ['#2858bc', '#648cd0']  // 9: 伝説の駅
        ];
        const [top, bottom] = colors[stage] || colors[0];
        const grad = this.ctx.createLinearGradient(0, 0, 0, 250);
        grad.addColorStop(0, top);
        grad.addColorStop(1, bottom);
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 0, this.w, 250);
    }

    drawClouds() {
        this.ctx.fillStyle = 'rgba(255,255,255,0.6)';
        for (const c of this.clouds) {
            c.x += c.speed;
            if (c.x > this.w + 50) c.x = -50;
            this.drawSoftEllipse(c.x, c.y, c.size, c.size * 0.5);
        }
    }

    drawSoftEllipse(x, y, w, h) {
        this.ctx.beginPath();
        this.ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
        this.ctx.fill();
    }

    drawMountains() {
        this.ctx.fillStyle = 'rgba(120,140,120,0.3)';
        this.ctx.beginPath();
        this.ctx.moveTo(0, 250);
        for (let x = 0; x <= this.w; x += 40) {
            const y = 200 + Math.sin(x * 0.008) * 30 + Math.sin(x * 0.015) * 15;
            this.ctx.lineTo(x, y);
        }
        this.ctx.lineTo(this.w, 250);
        this.ctx.closePath();
        this.ctx.fill();
    }

    drawGround() {
        // 地面（草地）
        const grad = this.ctx.createLinearGradient(0, 280, 0, this.h);
        grad.addColorStop(0, '#88aa66');
        grad.addColorStop(1, '#668844');
        this.ctx.fillStyle = grad;
        this.ctx.fillRect(0, 280, this.w, this.h - 280);

        // ホーム
        this.ctx.fillStyle = '#c4b8a4';
        this.ctx.fillRect(250, 270, 460, 30);
        this.ctx.fillStyle = '#b4a894';
        this.ctx.fillRect(250, 295, 460, 5);
    }

    drawRailroad() {
        const y = 310;
        // レール
        this.ctx.strokeStyle = '#888';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(0, y);
        this.ctx.lineTo(this.w, y);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.moveTo(0, y + 12);
        this.ctx.lineTo(this.w, y + 12);
        this.ctx.stroke();

        // 枕木
        this.ctx.fillStyle = '#8b7355';
        for (let x = 0; x < this.w; x += 30) {
            this.ctx.fillRect(x, y - 2, 16, 16);
        }
    }

    drawStation(station) {
        const stage = station.stage;
        const cx = 480;
        const baseY = 270;

        const drawFns = [
            this.drawStage0, this.drawStage1, this.drawStage2,
            this.drawStage3, this.drawStage4, this.drawStage5,
            this.drawStage6, this.drawStage7, this.drawStage8, this.drawStage9
        ];
        const fn = drawFns[stage] || drawFns[drawFns.length - 1];
        fn.call(this, cx, baseY, station);
    }

    drawStage0(cx, baseY, station) {
        // さびれた無人駅：画像を使用
        if (this.stationImg0.complete && this.stationImg0.naturalWidth > 0) {
            const imgW = 200;
            const imgH = 200;
            this.ctx.drawImage(this.stationImg0, cx - imgW / 2, baseY - imgH + 20, imgW, imgH);
        }

        const ups = station.purchased;

        // 掃除前の雑草（駅舎の周辺に描画）
        if (!ups.has('clean_platform')) {
            this.ctx.fillStyle = 'rgba(80,120,40,0.6)';
            for (let i = 0; i < 8; i++) {
                const gx = 270 + i * 55;
                const gy = baseY - 5;
                this.ctx.beginPath();
                this.ctx.moveTo(gx, gy);
                this.ctx.lineTo(gx - 3, gy - 12);
                this.ctx.lineTo(gx + 3, gy - 10);
                this.ctx.fill();
            }
        }

        // ベンチ（駅舎の横に表示）
        if (ups.has('fix_bench')) {
            this.ctx.fillStyle = '#aa8866';
            this.ctx.fillRect(cx + 100, baseY - 10, 30, 6);
            this.ctx.fillRect(cx + 102, baseY - 4, 4, 10);
            this.ctx.fillRect(cx + 124, baseY - 4, 4, 10);
        }
    }

    drawStage1(cx, baseY, station) {
        // 小さな駅：画像を使用
        if (this.stationImg1.complete && this.stationImg1.naturalWidth > 0) {
            const imgW = 280;
            const imgH = 280;
            this.ctx.drawImage(this.stationImg1, cx - imgW / 2, baseY - imgH + 20, imgW, imgH);
        }

        const ups = station.purchased;
        if (ups.has('add_cleaning_tools')) {
            this.ctx.fillStyle = '#8b7355';
            this.ctx.fillRect(cx - 65, baseY - 15, 3, 18);
            this.ctx.fillStyle = '#ccaa44';
            this.ctx.fillRect(cx - 60, baseY - 5, 10, 8);
        }
        if (ups.has('add_light')) {
            this.ctx.fillStyle = '#ffee88';
            this.drawSoftEllipse(cx - 70, baseY - 30, 8, 8);
            this.drawSoftEllipse(cx + 70, baseY - 30, 8, 8);
        }
        if (ups.has('add_bulletin')) {
            this.ctx.fillStyle = '#8b6914';
            this.ctx.fillRect(cx + 85, baseY - 35, 24, 20);
            this.ctx.fillStyle = '#fff8dc';
            this.ctx.fillRect(cx + 87, baseY - 33, 20, 16);
            this.ctx.fillStyle = '#cc4444';
            this.ctx.fillRect(cx + 89, baseY - 30, 6, 3);
            this.ctx.fillStyle = '#4488cc';
            this.ctx.fillRect(cx + 97, baseY - 30, 6, 3);
        }
        if (ups.has('add_clock')) {
            this.ctx.fillStyle = '#fff';
            this.ctx.beginPath();
            this.ctx.arc(cx, baseY - 65, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(cx - 1, baseY - 72, 2, 8);
        }
        if (ups.has('add_flowerbed')) {
            const flowers = ['#ff6688', '#ffaa44', '#ff88cc', '#88aaff'];
            for (let i = 0; i < 6; i++) {
                this.ctx.fillStyle = flowers[i % flowers.length];
                this.drawSoftEllipse(cx - 80 + i * 15, baseY + 5, 5, 5);
                this.ctx.fillStyle = '#44aa22';
                this.ctx.fillRect(cx - 81 + i * 15, baseY + 5, 2, 8);
            }
        }
        if (ups.has('add_ticket')) {
            this.ctx.fillStyle = '#778899';
            this.ctx.fillRect(cx + 60, baseY - 30, 16, 30);
            this.ctx.fillStyle = '#aabbcc';
            this.ctx.fillRect(cx + 62, baseY - 25, 12, 8);
        }
    }

    drawStage2(cx, baseY, station) {
        // 中規模駅：画像を使用
        if (this.stationImg2.complete && this.stationImg2.naturalWidth > 0) {
            const imgW = 350;
            const imgH = 320;
            this.ctx.drawImage(this.stationImg2, cx - imgW / 2, baseY - imgH + 50, imgW, imgH);
        }

        const ups = station.purchased;
        if (ups.has('add_vending')) {
            this.ctx.fillStyle = '#cc3333';
            this.ctx.fillRect(cx - 115, baseY - 30, 14, 25);
            this.ctx.fillStyle = '#fff';
            this.ctx.fillRect(cx - 113, baseY - 27, 10, 8);
        }
        if (ups.has('add_kiosk')) {
            this.ctx.fillStyle = '#dd8844';
            this.ctx.fillRect(cx + 110, baseY - 35, 40, 35);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('売店', cx + 130, baseY - 15);
        }
        if (ups.has('add_lockers')) {
            this.ctx.fillStyle = '#5577aa';
            for (let i = 0; i < 3; i++) {
                this.ctx.fillRect(cx + 155, baseY - 30 + i * 11, 18, 9);
                this.ctx.strokeStyle = '#334466';
                this.ctx.strokeRect(cx + 155, baseY - 30 + i * 11, 18, 9);
            }
        }
        if (ups.has('add_toilet')) {
            this.ctx.fillStyle = '#99aabb';
            this.ctx.fillRect(cx - 150, baseY - 10, 30, 25);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '10px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🚻', cx - 135, baseY + 8);
        }
        if (ups.has('add_bicycle')) {
            this.ctx.fillStyle = '#888';
            for (let i = 0; i < 3; i++) {
                this.ctx.beginPath();
                this.ctx.arc(cx - 160 + i * 16, baseY + 12, 5, 0, Math.PI * 2);
                this.ctx.stroke();
            }
            this.ctx.fillStyle = '#aaa';
            this.ctx.fillRect(cx - 175, baseY + 2, 50, 2);
        }
        if (ups.has('add_atm')) {
            this.ctx.fillStyle = '#336699';
            this.ctx.fillRect(cx + 95, baseY - 28, 14, 28);
            this.ctx.fillStyle = '#88ccff';
            this.ctx.fillRect(cx + 97, baseY - 24, 10, 8);
            this.ctx.fillStyle = '#ddd';
            this.ctx.fillRect(cx + 99, baseY - 12, 6, 3);
        }
        if (ups.has('add_waitroom')) {
            this.ctx.fillStyle = '#ccbb99';
            this.ctx.fillRect(cx - 150, baseY - 50, 50, 40);
            this.ctx.fillStyle = '#ddeeff';
            this.ctx.fillRect(cx - 145, baseY - 42, 14, 12);
            this.ctx.fillRect(cx - 125, baseY - 42, 14, 12);
        }
        if (ups.has('add_elevator')) {
            this.ctx.fillStyle = '#778899';
            this.ctx.fillRect(cx + 95, baseY - 65, 20, 35);
            this.ctx.fillStyle = '#aabbcc';
            this.ctx.fillRect(cx + 98, baseY - 55, 14, 20);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🛗', cx + 105, baseY - 30);
        }
    }

    drawStage3(cx, baseY, station) {
        // 大きな駅：画像を使用
        if (this.stationImg3.complete && this.stationImg3.naturalWidth > 0) {
            const imgW = 420;
            const imgH = 340;
            this.ctx.drawImage(this.stationImg3, cx - imgW / 2, baseY - imgH + 20, imgW, imgH);
        }

        const ups = station.purchased;
        if (ups.has('add_watercooler')) {
            this.ctx.fillStyle = '#88bbdd';
            this.ctx.fillRect(cx + 145, baseY - 18, 10, 18);
            this.ctx.fillStyle = '#aaddff';
            this.ctx.fillRect(cx + 146, baseY - 15, 8, 6);
        }
        if (ups.has('add_wifi')) {
            this.ctx.fillStyle = 'rgba(68,136,255,0.7)';
            this.ctx.font = '10px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('📶 Free WiFi', cx, baseY - 115);
        }
        if (ups.has('add_display')) {
            this.ctx.fillStyle = '#112233';
            this.ctx.fillRect(cx - 40, baseY - 105, 80, 12);
            this.ctx.fillStyle = '#44ff88';
            this.ctx.font = '8px monospace';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('次の電車 3分後', cx, baseY - 96);
        }
        if (ups.has('add_decoration')) {
            const decos = ['🎋', '🎍', '🏮'];
            for (let i = 0; i < 3; i++) {
                this.ctx.font = '12px sans-serif';
                this.ctx.textAlign = 'center';
                this.ctx.fillText(decos[i], cx - 130 + i * 20, baseY - 100);
            }
        }
        if (ups.has('add_security')) {
            this.ctx.fillStyle = '#556677';
            this.ctx.fillRect(cx - 180, baseY - 70, 35, 40);
            this.ctx.fillStyle = '#ddeeff';
            this.ctx.fillRect(cx - 176, baseY - 65, 12, 10);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('駅員室', cx - 163, baseY - 38);
        }
        if (ups.has('add_cafe')) {
            this.ctx.fillStyle = '#885533';
            this.ctx.fillRect(cx + 160, baseY - 50, 50, 50);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '9px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('☕ CAFE', cx + 185, baseY - 25);
        }
        if (ups.has('add_bakery')) {
            this.ctx.fillStyle = '#cc9955';
            this.ctx.fillRect(cx + 160, baseY - 95, 45, 42);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '9px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🥯 パン', cx + 183, baseY - 72);
        }
        if (ups.has('add_bookstore')) {
            this.ctx.fillStyle = '#664433';
            this.ctx.fillRect(cx - 190, baseY - 50, 45, 50);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '9px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('📚 書店', cx - 167, baseY - 25);
        }
        if (ups.has('add_ekiben')) {
            this.ctx.fillStyle = '#dd6633';
            this.ctx.fillRect(cx - 190, baseY - 95, 45, 42);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '9px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🍱 駅弁', cx - 167, baseY - 72);
        }
        if (ups.has('add_plaza')) {
            this.ctx.fillStyle = '#ccbbaa';
            this.ctx.fillRect(cx - 140, baseY + 5, 280, 20);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '9px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('🚕 タクシー乗り場    🚌 バス停', cx, baseY + 18);
        }
    }

    drawStage4(cx, baseY, station) {
        // 駅ビル：画像を使用
        if (this.stationImg4.complete && this.stationImg4.naturalWidth > 0) {
            const imgW = 500;
            const imgH = 280;
            this.ctx.drawImage(this.stationImg4, cx - imgW / 2, baseY - imgH + 20, imgW, imgH);
        }

        const ups = station.purchased;
        if (ups.has('add_laundry')) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('🧺', cx - 150, baseY - 55);
        }
        if (ups.has('add_rooftop')) {
            this.ctx.fillStyle = '#55aa44';
            this.ctx.fillRect(cx - 160, baseY - 195, 120, 10);
            const trees = ['🌿', '🌳', '🌿'];
            this.ctx.font = '10px sans-serif';
            for (let i = 0; i < 3; i++) {
                this.ctx.fillText(trees[i], cx - 150 + i * 40, baseY - 197);
            }
        }
        if (ups.has('add_observatory')) {
            this.ctx.fillStyle = '#556688';
            this.ctx.fillRect(cx + 50, baseY - 210, 60, 25);
            this.ctx.fillStyle = '#aaddff';
            this.ctx.fillRect(cx + 55, baseY - 207, 50, 15);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '7px "Zen Maru Gothic"';
            this.ctx.fillText('🌅 展望', cx + 80, baseY - 195);
        }
        if (ups.has('add_coworking')) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('💻 CO-WORK', cx + 115, baseY - 140);
        }
        if (ups.has('add_apparel')) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('👗 FASHION', cx - 145, baseY - 140);
        }
        if (ups.has('add_arcade')) {
            this.ctx.fillStyle = '#442266';
            this.ctx.fillRect(cx + 190, baseY - 50, 45, 50);
            this.ctx.fillStyle = '#ff66cc';
            this.ctx.font = '9px "Zen Maru Gothic"';
            this.ctx.fillText('🎮 GAME', cx + 212, baseY - 25);
        }
        if (ups.has('add_foodcourt')) {
            this.ctx.fillStyle = '#dd6622';
            this.ctx.fillRect(cx - 230, baseY - 50, 45, 50);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('🍔 FOOD', cx - 207, baseY - 25);
        }
        if (ups.has('add_drugstore')) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('🛍️ DRUG', cx - 145, baseY - 100);
        }
        if (ups.has('add_clinic')) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.85)';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('🏥 医院', cx + 115, baseY - 100);
        }
        if (ups.has('add_fitness')) {
            this.ctx.fillStyle = '#446688';
            this.ctx.fillRect(cx + 190, baseY - 100, 45, 45);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('🏋️ GYM', cx + 212, baseY - 78);
        }
        if (ups.has('add_bank')) {
            this.ctx.fillStyle = '#335544';
            this.ctx.fillRect(cx - 230, baseY - 100, 45, 45);
            this.ctx.fillStyle = '#fff';
            this.ctx.font = '8px "Zen Maru Gothic"';
            this.ctx.fillText('🏦 BANK', cx - 207, baseY - 78);
        }
        if (ups.has('add_cinema')) {
            this.ctx.fillStyle = '#221133';
            this.ctx.fillRect(cx - 80, baseY - 210, 80, 25);
            this.ctx.fillStyle = '#ff8844';
            this.ctx.font = '9px "Zen Maru Gothic"';
            this.ctx.fillText('🎬 CINEMA', cx - 40, baseY - 195);
        }
    }

    drawTrain(station) {
        if (station.trainState === 'none') return;

        const x = station.trainX;
        const y = 295;

        if (this.trainImg.complete && this.trainImg.naturalWidth > 0) {
            const imgW = 650;
            const imgH = 260;
            this.ctx.drawImage(this.trainImg, x - imgW / 2, y - imgH + 110, imgW, imgH);
        }

        // 到着通知
        if (station.trainState === 'arriving') {
            this.ctx.fillStyle = 'rgba(60,50,40,0.7)';
            this.ctx.font = '13px "Zen Maru Gothic"';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('電車が来ます…', 480, 245);
        }
    }

    drawPassengers(station) {
        const now = Date.now();
        const colors = ['#5a4a6a', '#6a5a4a', '#4a5a6a', '#5a6a4a', '#6a4a5a'];

        for (let i = 0; i < station.currentPassengers.length; i++) {
            const p = station.currentPassengers[i];
            if (now < p.spawnTime) continue;

            const color = colors[i % colors.length];
            this.ctx.fillStyle = color;

            // 頭
            this.ctx.beginPath();
            this.ctx.arc(p.x, p.y - 10, 4, 0, Math.PI * 2);
            this.ctx.fill();

            // 体
            this.ctx.fillRect(p.x - 3, p.y - 6, 6, 12);

            // 足（歩行アニメ）
            if (!p.arrived) {
                const legOffset = Math.sin(now * 0.01 + i) * 3;
                this.ctx.fillRect(p.x - 2, p.y + 6, 2, 4 + legOffset);
                this.ctx.fillRect(p.x + 1, p.y + 6, 2, 4 - legOffset);
            } else {
                this.ctx.fillRect(p.x - 2, p.y + 6, 2, 4);
                this.ctx.fillRect(p.x + 1, p.y + 6, 2, 4);
            }
        }
    }

    drawCleanlinessBar(station) {
        const x = 820;
        const y = this.h - 20;
        const w = 120;
        const h = 10;
        const ratio = station.cleanliness / 100;

        this.ctx.fillStyle = 'rgba(0,0,0,0.3)';
        this.ctx.fillRect(x, y, w, h);

        // 色：きれいなら緑、汚いなら赤
        if (ratio > 0.6) this.ctx.fillStyle = '#66bb44';
        else if (ratio > 0.3) this.ctx.fillStyle = '#ccaa22';
        else this.ctx.fillStyle = '#cc4422';

        this.ctx.fillRect(x, y, w * ratio, h);

        this.ctx.fillStyle = '#fff';
        this.ctx.font = '9px "Zen Maru Gothic"';
        this.ctx.textAlign = 'left';
        this.ctx.fillText('🧹 きれい度 ' + Math.floor(station.cleanliness) + '%', x, y - 3);
    }
}
