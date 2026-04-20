class Journal {
    constructor() {
        this.isShowing = false;
        this.writeTimer = null;
    }

    // アップグレード購入時に日誌を表示
    show(upgrade, station) {
        // 既存の日誌があれば閉じる
        const existing = document.getElementById('journal-overlay');
        if (existing) {
            this.close(existing);
        }
        this.isShowing = true;

        const entry = this.getJournalEntry(upgrade, station);
        const overlay = document.createElement('div');
        overlay.id = 'journal-overlay';
        overlay.innerHTML = this.buildHTML(entry);
        document.getElementById('game-wrapper').appendChild(overlay);

        // 書き込みアニメーション開始
        setTimeout(() => {
            overlay.classList.add('journal-visible');
            if (window._sound) window._sound.play('flip', 0.3);
            this.animateWriting(overlay, entry);
        }, 100);
    }

    buildHTML(entry) {
        const date = this.getGameDate();
        return '<div class="journal-book">'
            + '<div class="journal-spine"></div>'
            + '<div class="journal-page">'
            +   '<div class="journal-date">' + date + '</div>'
            +   '<div class="journal-lines">'
            +     '<div id="journal-text" class="journal-text"></div>'
            +   '</div>'
            +   '<div id="journal-stamp" class="journal-stamp" style="display:none;">'
            +     entry.stamp
            +   '</div>'
            +   '<div id="journal-close" class="journal-close" style="display:none;">'
            +     '— 日誌を閉じる —'
            +   '</div>'
            + '</div>'
            + '</div>';
    }

    animateWriting(overlay, entry) {
        const textEl = document.getElementById('journal-text');
        const stampEl = document.getElementById('journal-stamp');
        const closeEl = document.getElementById('journal-close');
        const text = entry.text;
        let idx = 0;

        if (window._sound) window._sound.startLoop('pen', 0.2);

        this.writeTimer = setInterval(() => {
            if (idx < text.length) {
                const char = text[idx];
                if (char === '\n') {
                    textEl.innerHTML += '<br>';
                } else {
                    const span = document.createElement('span');
                    span.className = 'journal-char';
                    span.textContent = char;
                    span.style.animationDelay = '0s';
                    textEl.appendChild(span);
                }
                idx++;
            } else {
                clearInterval(this.writeTimer);
                if (window._sound) window._sound.stopLoop('pen');
                // スタンプ演出
                setTimeout(() => {
                    if (window._sound) window._sound.play('stamp', 0.5);
                    stampEl.style.display = 'block';
                    stampEl.classList.add('journal-stamp-animate');
                    // 閉じるボタン表示
                    setTimeout(() => {
                        closeEl.style.display = 'block';
                        closeEl.addEventListener('click', () => this.close(overlay));
                        overlay.addEventListener('click', (e) => {
                            if (e.target === overlay) this.close(overlay);
                        });
                    }, 800);
                }, 400);
            }
        }, 50); // 1文字50msで書き込み
    }

    close(overlay) {
        this.isShowing = false;
        if (this.writeTimer) {
            clearInterval(this.writeTimer);
            this.writeTimer = null;
        }
        if (window._sound) window._sound.stopLoop('pen');
        if (overlay && overlay.parentNode) {
            overlay.classList.remove('journal-visible');
            setTimeout(() => {
                if (overlay.parentNode) overlay.remove();
            }, 400);
        }
    }

    getGameDate() {
        const now = new Date();
        return (now.getMonth() + 1) + '月 ' + now.getDate() + '日';
    }

    getJournalEntry(upgrade, station) {
        // 進化エントリー
        const evolveEntries = {
            '__evolve_1': {
                text: '駅が生まれ変わった。\nもうさびれた無人駅じゃない。\n\n小さいけれど、\n確かに「誰かの駅」になった。\nここからが本当の始まりだ。',
                stamp: '小さな駅へ'
            },
            '__evolve_2': {
                text: 'ホームに人が増えてきた。\n朝の通勤客、\n買い物帰りのおばさん。\n\n名前を覚えてもらえる\n駅になってきた。',
                stamp: '中規模駅へ'
            },
            '__evolve_3': {
                text: 'もう「小さな駅」とは\n呼ばせない。\n\n売店の灯り、\nコーヒーの香り、\n子どもたちの声。\n街の心臓が、ここで脈打つ。',
                stamp: '大きな駅へ'
            },
            '__evolve_4': {
                text: '見上げると、\nビルが空に伸びている。\n\nあの廃墟みたいな駅が\nここまで来たなんて。\n信じられない。\nでも、これは現実だ。',
                stamp: '駅ビルへ'
            },
            '__evolve_5': {
                text: '快速が止まるようになった。\n複数の路線が交差する。\n\nこの駅を通らずに\nどこへも行けない。\nそんな存在になった。',
                stamp: 'ターミナル駅へ'
            },
            '__evolve_6': {
                text: '遠くの県から\nわざわざ来る人がいる。\n\n「あの駅に行きたい」\nそう言ってもらえることが、\n何より嬉しい。',
                stamp: '観光名所駅へ'
            },
            '__evolve_7': {
                text: 'AIが改札を開け、\nロボットが床を磨く。\n\n技術の力で、\nもっと多くの人を\n迎えられるようになった。',
                stamp: 'スマート駅へ'
            },
            '__evolve_8': {
                text: '外国語が飛び交っている。\nスーツケースの車輪の音。\n\nこの駅は日本だけのもの\nじゃなくなった。\n世界の駅になったんだ。',
                stamp: '国際駅へ'
            },
            '__evolve_9': {
                text: 'さびれた無人駅から\n始まった物語。\n\n雑草を抜いた日、\nベンチを直した日、\n最初のお客さんが来た日。\n\n全部覚えている。\n\nこの駅は、伝説になった。',
                stamp: '伝説の駅へ'
            },
        };

        if (evolveEntries[upgrade.id]) {
            return evolveEntries[upgrade.id];
        }

        // アップグレード別の日誌エントリー
        const entries = {
            // Stage 0
            'clean_platform': {
                text: 'ホームの雑草を引き抜いた。\n腰が痛い。でも、少しだけ\n駅らしくなった気がする。\n\n誰かがここを通るとき、\n「きれいになったな」と\n思ってくれたら嬉しい。',
                stamp: '✨ 第一歩 ✨'
            },
            'fix_bench': {
                text: 'ベンチを修理した。\n釘を打ち直し、板を磨いた。\n\n座ってみると、夕日がきれいに\n見える角度だった。\nこの駅、いい場所にあるな。',
                stamp: '🪑 修復完了'
            },
            'add_sign': {
                text: 'やっと駅名の看板をつけた。\n「ここは駅なんだ」と\n誰にでもわかるようになった。\n\n当たり前のことだけど、\n名前があるって大事だ。',
                stamp: '🪧 命名'
            },
            'fix_roof': {
                text: '屋根の修理が終わった。\nもう雨漏りしない。\n\n雨の日に来てくれるお客さんを\n濡らさずに迎えられる。\nそれだけで十分だ。',
                stamp: '🏠 雨よけ完成'
            },
            // Stage 1
            'add_cleaning_tools': {
                text: 'ほうきとバケツを揃えた。\n道具があると掃除が捗る。\n\n毎朝の日課になりそうだ。',
                stamp: '🧹 清掃強化'
            },
            'add_light': {
                text: '照明を設置した。\n夜のホームに灯りが灯る。\n\n帰りの遅い人が\n安心して降りられるように。',
                stamp: '💡 夜道の灯'
            },
            'add_bulletin': {
                text: '掲示板をつけた。\n地元のイベントや\nバスの時刻表を貼った。\n\nおばあちゃんが\n「見やすいね」と笑った。',
                stamp: '📋 情報発信'
            },
            'add_clock': {
                text: '時計を設置した。\n「次の電車まであと何分」が\nわかるだけで、人は安心する。\n\n時を刻む音が\n駅に命を吹き込んだ気がした。',
                stamp: '🕐 時を刻む'
            },
            'add_flowerbed': {
                text: '花壇を作った。\nパンジーとチューリップ。\n\n電車を待つ間、\n花を眺める人が増えた。\n駅が少し華やいだ。',
                stamp: '🌷 花の駅'
            },
            'add_ticket': {
                text: '券売機を設置した。\nボタンを押すとカチャンと\n切符が出てくる。\n\nこの音を聞くたびに思う。\nここは本当に「駅」なんだ。',
                stamp: '🎫 有人駅 認定！'
            },
            // Stage 2
            'add_vending': {
                text: '自販機コーナーができた。\nガタンと缶が落ちる音。\n\n暑い日も寒い日も、\nここで一息つける場所になった。',
                stamp: '🥤 休憩所'
            },
            'add_kiosk': {
                text: '売店がオープンした。\nお弁当、お菓子、新聞。\n\n「いってらっしゃい」「おかえり」\nそんな声が聞こえる駅になった。',
                stamp: '🏪 売店開業'
            },
            'add_toilet': {
                text: 'トイレが完成した。\n清潔で明るいトイレ。\n\n当たり前のものが揃うことの\n大切さを噛みしめている。',
                stamp: '🚻 基本の「き」'
            },
            'add_waitroom': {
                text: '待合室が完成した。\n空調が効いて快適。\n\n真夏の炎天下も、\n真冬の吹雪も、\nもう怖くない。',
                stamp: '🏢 憩いの場'
            },
            'add_elevator': {
                text: 'エレベーターが動き出した。\n\nベビーカーのお母さんが\n「助かります」と微笑んだ。\n\nすべての人に開かれた駅へ。',
                stamp: '🛗 バリアフリー'
            },
            // Stage 3
            'add_cafe': {
                text: 'カフェがオープンした。\n香り高いコーヒーの匂いが\nホームまで漂ってくる。\n\n「ちょっとここで降りよう」\nそんな人が増えた。',
                stamp: '☕ 寄り道の誘惑'
            },
            'add_plaza': {
                text: '駅前広場が完成した。\nバス停、タクシー乗り場。\n\nこの駅を起点に、\n街全体が動き出した気がする。',
                stamp: '🏛️ 交通の要'
            },
            // Stage 4
            'add_rooftop': {
                text: '屋上庭園が完成した。\n都会のオアシス。\n\nさびれた無人駅から始まった\nこの物語は、いつの間にか\n空に手が届くところまで来た。',
                stamp: '🌿 天空の庭'
            },
            'add_cinema': {
                text: 'シネコンが完成した。\nスクリーンに映るのは\n夢と冒険の物語。\n\nでも、この駅の物語だって\n負けていないと思う。',
                stamp: '🎬 夢の映画館'
            },
            // Stage 2 残り
            'add_lockers': {
                text: 'コインロッカーを並べた。\n旅行鞄を預けて、\n身軽に街へ繰り出す人たち。\n\nこの駅が「旅の拠点」に\nなり始めている。',
                stamp: '📦 荷物番'
            },
            'add_bicycle': {
                text: '駐輪場を整備した。\n朝、自転車の列ができる。\n\nペダルを漕いで来る人が\nいるということは、\nこの駅が「日常」になった証だ。',
                stamp: '🚲 日常の駅'
            },
            'add_atm': {
                text: 'ATMが光っている。\n急にお金が必要になっても\nここで降りれば大丈夫。\n\n「便利」は人を呼ぶ。',
                stamp: '🏧 頼れる駅'
            },
            // Stage 3 残り
            'add_watercooler': {
                text: '冷水機を置いた。\nたった一杯の水だけど、\n暑い日にはこれが命綱になる。\n\n小さな気遣いが、\n大きな信頼を育てるんだ。',
                stamp: '🚰 おもてなし'
            },
            'add_wifi': {
                text: '無料Wi-Fiを開放した。\nスマホを覗く若者たちが\nベンチに増えた。\n\n電波が届く場所には、\n人が集まるものらしい。',
                stamp: '📶 電波の灯台'
            },
            'add_display': {
                text: '電光掲示板が点いた。\n緑色の文字が流れていく。\n「次の電車 3分後」。\n\nたったそれだけの情報が、\n人の不安を消してくれる。',
                stamp: '📺 安心の光'
            },
            'add_decoration': {
                text: '季節の飾りを吊るした。\n春は桜、夏は風鈴、\n秋は紅葉、冬は雪だるま。\n\nホームに季節が巡るたび、\n駅が少しずつ愛されていく。',
                stamp: '🎍 四季の駅'
            },
            'add_security': {
                text: '駅員室を広げた。\n制服姿が増えると、\n空気が引き締まる。\n\n安全は、見えないところで\n誰かが守っている。',
                stamp: '👮 守りの盾'
            },
            'add_bakery': {
                text: 'パンの匂いが漂ってくる。\n焼きたてのクロワッサン。\n\n降りるつもりのなかった人が\n思わずドアを開けた。\n匂いは最強の集客装置だ。',
                stamp: '🥯 誘惑の香り'
            },
            'add_bookstore': {
                text: '小さな書店を開いた。\n文庫本を手に取る人、\n旅行ガイドを眺める人。\n\n静かな時間が流れる場所が、\n駅の中にもあっていい。',
                stamp: '📚 言葉の停車場'
            },
            'add_ekiben': {
                text: '駅弁の販売を始めた。\n蓋を開けた瞬間の幸福を、\nこの駅から届けたい。\n\n旅は、駅弁を選ぶところから\n始まっている。',
                stamp: '🍱 旅の味'
            },
            // Stage 4 残り
            'add_laundry': {
                text: 'ランドリーを併設した。\n洗濯機の回る音が\n妙に落ち着く。\n\n生活に寄り添う駅。\nそれが次の一歩だった。',
                stamp: '🧺 暮らしの駅'
            },
            'add_observatory': {
                text: '展望テラスから見る夜景。\n街の灯りが宝石みたいだ。\n\nいつか誰かが、\nここでプロポーズするかも\nしれない。',
                stamp: '🌅 夜景の特等席'
            },
            'add_coworking': {
                text: 'コワーキングスペースを\n作った。ノートPCの\nキーボード音が響く。\n\n電車を待つ時間が、\n仕事をする時間に変わった。',
                stamp: '🏢 働く駅'
            },
            'add_apparel': {
                text: 'おしゃれな服屋ができた。\nウィンドウに映る\nマネキンが駅を彩る。\n\n「あの駅、なんかいいよね」\nそう言われ始めた。',
                stamp: '👗 街の顔'
            },
            'add_arcade': {
                text: 'ゲームセンターが賑やかだ。\nクレーンゲームに\n挑む子どもたちの歓声。\n\n駅が「遊び場」にもなった。',
                stamp: '🎮 遊びの殿堂'
            },
            'add_foodcourt': {
                text: 'フードコートが完成した。\nラーメン、カレー、うどん。\n迷う時間も楽しい。\n\n家族連れの笑い声が\n天井に反響している。',
                stamp: '🍔 食の広場'
            },
            'add_drugstore': {
                text: 'ドラッグストアが開いた。\n歯ブラシから薬まで、\nなんでも揃う。\n\n毎日来てくれる人がいる。\nそれが一番嬉しい。',
                stamp: '🛍️ 毎日の駅'
            },
            'add_clinic': {
                text: '診療所ができた。\n「駅のお医者さん」がいる\n安心感は計り知れない。\n\n健康を守る駅。\n新しい役割だ。',
                stamp: '🏥 命の番人'
            },
            'add_fitness': {
                text: 'ジムがオープンした。\n仕事帰りに汗を流す人々。\n\n体を動かした後の\n一杯のプロテイン。\n駅が生活そのものになった。',
                stamp: '🏋️ 鍛える駅'
            },
            'add_bank': {
                text: '銀行の支店ができた。\nスーツ姿の人が増えた。\n\nお金が動く場所には、\n人も、信頼も集まる。',
                stamp: '🏦 信頼の証'
            },
            // Stage 5
            'add_express_platform': {
                text: '快速が止まるようになった。\nあの通過していた電車が、\nこの駅のために\n速度を落としてくれる。\n\n認められた、と思った。',
                stamp: '🚄 快速停車'
            },
            'add_transfer_passage': {
                text: '乗換通路が繋がった。\n他の路線からの人が\n流れ込んでくる。\n\nこの駅は、もう\n一本の線路の駅じゃない。',
                stamp: '🚶 交差する路線'
            },
            'add_escalator': {
                text: 'エスカレーターが動き出す。\n重い荷物を持つ人、\n杖をつくお年寄り。\n\nみんなが楽に移動できる。\nそれだけで十分な理由だ。',
                stamp: '🔼 上へ'
            },
            'add_pressure_washer': {
                text: '高圧洗浄機を導入した。\n水の勢いで\n汚れが吹き飛んでいく。\n\n広い駅を\nきれいに保つのは大変だ。\nでも、やるしかない。',
                stamp: '🔫 清掃革命'
            },
            'add_concourse': {
                text: 'コンコースが広がった。\n待ち合わせの人だかり。\n\n「あの柱の前で」が\n合言葉になる日も近い。',
                stamp: '🏛️ 広場'
            },
            'add_extra_gates': {
                text: '改札を増やした。\n朝のラッシュがスムーズに。\n\nピッ、ピッ、ピッ。\n改札音が心地よいリズムを\n刻んでいる。',
                stamp: '🚪 流れる改札'
            },
            'add_taxi_terminal': {
                text: 'タクシー乗り場ができた。\n「○○までお願いします」\nドアが閉まり、走り出す。\n\nこの駅から始まる旅が\nまた一つ増えた。',
                stamp: '🚕 出発点'
            },
            'add_bus_terminal': {
                text: 'バスターミナルが完成した。\n路線図が壁一面に広がる。\n\nこの駅は点ではなく、\n線になった。\nいや、もう「面」かもしれない。',
                stamp: '🚌 広がる路線'
            },
            'add_vip_lounge': {
                text: 'VIPラウンジを作った。\n革張りのソファに\n静かな音楽。\n\n特別な空間が、\n特別なお客様を呼ぶ。',
                stamp: '👑 特別な場所'
            },
            'add_hotel_gate': {
                text: 'ホテルと直結した。\n改札を出ればすぐベッド。\n\n遠くから来た人が\n「ここに泊まりたい」と\n思ってくれる駅になった。',
                stamp: '🏨 夢の入口'
            },
            // Stage 6
            'add_footbath': {
                text: '足湯から湯気が立ち上る。\n靴を脱いで、ふぅと一息。\n\n旅の疲れが\nじんわりと溶けていく。\nこの駅だけの贅沢だ。',
                stamp: '♨️ 癒しの湯'
            },
            'add_souvenir_street': {
                text: 'お土産街がオープンした。\n名産品が所狭しと並ぶ。\n\n「何を買って帰ろう」\nその悩みも旅の一部だ。',
                stamp: '🎁 思い出市場'
            },
            'add_tourist_info': {
                text: '観光案内所を開いた。\n笑顔のスタッフが\n地図を広げて説明する。\n\n言葉が通じなくても、\n笑顔は通じる。',
                stamp: 'ℹ️ 旅の案内人'
            },
            'add_japanese_garden': {
                text: '和風庭園が完成した。\n池に映る空、\n石を伝う水の音。\n\nこの駅の中に、\n日本の四季が\nそっと息づいている。',
                stamp: '🎋 静寂の庭'
            },
            'add_rickshaw': {
                text: '人力車が走り出した。\n車夫の掛け声と\n車輪の音が響く。\n\n古いものと新しいものが\n共存する。それがこの駅だ。',
                stamp: '🛺 風の旅人'
            },
            'add_photo_spot': {
                text: '写真映えスポットを\n整備した。\nスマホを構える若者たち。\n\nこの駅の風景が、\n誰かのSNSに載っている。\n不思議な気持ちだ。',
                stamp: '📸 映える駅'
            },
            'add_mascot_shop': {
                text: 'ご当地キャラの\nグッズショップ。\nぬいぐるみが棚に並ぶ。\n\n「かわいい！」の声が\n駅じゅうに響いている。',
                stamp: '🧸 愛される顔'
            },
            'add_ekiben_gp': {
                text: '全国の駅弁が集まった。\n北から南まで、\n日本中の味がここに。\n\nここは駅であり、\n「食の交差点」だ。',
                stamp: '🍱 味の博覧会'
            },
            'add_onsen': {
                text: '温泉施設が完成した。\n源泉から湯が湧き出す。\n\n駅で温泉に入れるなんて、\n夢みたいだ。\nでも、これは現実だ。',
                stamp: '🧖 湯けむりの駅'
            },
            'add_sky_terrace': {
                text: '展望テラスを拡張した。\n夕日が沈む瞬間、\n言葉を失う。\n\nこの景色を見るためだけに\n降りる価値がある。',
                stamp: '🌅 絶景の駅'
            },
            // Stage 7
            'add_ai_gate': {
                text: 'AI改札が始動した。\n顔を見せるだけで\nゲートが開く。\n\n未来は、もうここにある。',
                stamp: '🤖 未来の扉'
            },
            'add_digital_signage': {
                text: 'デジタルサイネージが輝く。\n触れると情報が飛び出す。\n\n案内板が「会話」をする。\n時代は変わったものだ。',
                stamp: '📱 光る案内'
            },
            'add_clean_robot': {
                text: '清掃ロボットが走っている。\n小さな体でせっせと\n床を磨いていく。\n\nいつの間にか、\n「あの子」と呼ばれ始めた。',
                stamp: '🧹 小さな相棒'
            },
            'add_smart_payment': {
                text: 'キャッシュレス完全対応。\nスマホをかざすだけ。\n\n財布を忘れても\nこの駅なら困らない。\n便利って、すごいことだ。',
                stamp: '💳 手ぶらの駅'
            },
            'add_robot_cafe': {
                text: 'ロボットがコーヒーを\n淹れてくれる。\n正確で、丁寧で、ブレない。\n\nでも、たまには人の手で\n淹れたのも飲みたくなる。',
                stamp: '☕ 機械の手'
            },
            'add_auto_locker': {
                text: '自動配送ロッカーが\n並んでいる。\nネットで買ったものを\n駅で受け取れる。\n\n駅が「暮らしの中心」に\nなりつつある。',
                stamp: '📦 届く駅'
            },
            'add_crowd_display': {
                text: '混雑状況がリアルタイムで\n表示される。\n「今は空いてる」の一言が\n行動を変える。\n\nデータは、思いやりだ。',
                stamp: '📊 見える安心'
            },
            'add_led_system': {
                text: 'LED照明に全面切り替えた。\n柔らかな光が\n夜の駅を包む。\n\n省エネなのに、\n前より美しくなった。',
                stamp: '💡 光の衣替え'
            },
            'add_5g_station': {
                text: '5Gアンテナが立った。\nどこにいても\n通信が途切れない。\n\nこの駅は電波の海だ。\nみんながつながっている。',
                stamp: '📡 つながる駅'
            },
            'add_iot_sensors': {
                text: 'IoTセンサーを\n駅中に仕込んだ。\n温度、湿度、人の流れ。\n\n駅が自分の状態を\n「感じ取れる」ようになった。',
                stamp: '🔬 感じる駅'
            },
            // Stage 8
            'add_duty_free': {
                text: '免税店がオープンした。\nブランド品が輝くショーケース。\n\n世界中の旅行者が\nここで買い物をしていく。\n国境を越えた駅だ。',
                stamp: '🛍️ 世界の駅'
            },
            'add_ai_concierge': {
                text: '50言語対応のAIが\n案内してくれる。\n\n「Thank you」「Merci」\n「ありがとう」\nどの言葉も、ここでは通じる。',
                stamp: '🌐 言葉の架け橋'
            },
            'add_airport_bus': {
                text: '空港直通バスが走り出した。\nスーツケースを引く人々が\n改札をくぐる。\n\nこの駅は空と\nつながった。',
                stamp: '✈️ 空への扉'
            },
            'add_exchange': {
                text: '両替所のレートが\nリアルタイムで動く。\n\nドル、ユーロ、元。\n数字の向こうに、\nそれぞれの旅がある。',
                stamp: '💱 通貨の交差点'
            },
            'add_premium_lounge2': {
                text: 'プレミアムラウンジ。\nシャンパンと静寂。\n\n世界を飛び回る人が\nここで束の間の休息をとる。\n最高のおもてなしとは何か。',
                stamp: '🥂 至高の空間'
            },
            'add_intl_food': {
                text: '各国の料理が集まった。\nタイ、イタリア、\nメキシコ、韓国。\n\nフォークの音が万国共通の\n幸福を奏でている。',
                stamp: '🍜 食の国連'
            },
            'add_maintenance_team': {
                text: '専門のメンテチームが\n常駐するようになった。\n\n「異常なし」の報告が\n毎朝届く。\nその一言が、何より心強い。',
                stamp: '🔧 守りの要'
            },
            'add_conference': {
                text: '国際会議室が完成した。\n同時通訳ブース付き。\n\n世界の知恵が\nこの駅に集まる日が\n来るとは思わなかった。',
                stamp: '🏢 知の拠点'
            },
            'add_luxury_hotel': {
                text: '五つ星ホテルが直結した。\n赤い絨毯が\n改札まで伸びている。\n\nかつてのさびれた無人駅。\nその面影はもう、どこにもない。',
                stamp: '🏰 夢の宮殿'
            },
            'add_duty_free_vend': {
                text: '免税自販機ネットワーク。\n24時間、眠らない。\n\n深夜便で着いた旅行者も\nすぐにお土産が買える。\n駅は決して眠らない。',
                stamp: '🤖 不夜城'
            },
            // Stage 9
            'add_tower': {
                text: '駅前にタワーが建った。\n街のどこからでも見える\nランドマーク。\n\n「あの塔の下の駅」\nそう呼ばれるようになった。',
                stamp: '🗼 天を衝く'
            },
            'add_underground_mall': {
                text: '地下に巨大モールが広がる。\n雨の日も、嵐の日も、\n人は絶えない。\n\n地上と地下。\nこの駅は二つの顔を持つ。',
                stamp: '🛒 地下の街'
            },
            'add_heliport': {
                text: '屋上にヘリポート。\nプロペラの音が空に響く。\n\n空から降り立つ人がいる駅。\n冗談みたいだけど、本当だ。',
                stamp: '🚁 空の入口'
            },
            'add_aquarium': {
                text: '駅の中に水族館ができた。\n青い水槽の向こうで\n魚が泳いでいる。\n\n電車を待つ間に\n海を見られる駅なんて、\n世界にここだけだ。',
                stamp: '🐠 海の窓'
            },
            'add_planetarium': {
                text: 'プラネタリウムで\n満天の星空を見上げる。\n\n天井に広がる宇宙。\nこの駅は、地上にいながら\n星に手が届く場所になった。',
                stamp: '🌌 星の駅'
            },
            'add_auto_maintenance': {
                text: 'AIが全設備を\n自動で管理している。\n異常を予測し、\n壊れる前に直す。\n\n人の手を離れても、\n駅は生き続ける。',
                stamp: '⚙️ 自律する駅'
            },
            'add_concert_hall': {
                text: 'コンサートホールに\n音楽が響く。\n世界的なアーティストが\nこの駅で演奏する。\n\n拍手の波が\nホームまで届いてくる。',
                stamp: '🎵 響く駅'
            },
            'add_theme_park': {
                text: 'テーマパークが\n駅に直結した。\n子どもたちの歓声。\n回るメリーゴーラウンド。\n\n夢を見に来る場所。\nそれがこの駅だ。',
                stamp: '🎢 夢の国'
            },
            'add_art_museum': {
                text: '美術館に\n世界の名画が並ぶ。\n静かに絵を眺める人々。\n\n電車の音と芸術が\n共存する不思議な空間。\nこれがこの駅の答えだ。',
                stamp: '🖼️ 美の殿堂'
            },
            'add_sky_deck': {
                text: 'スカイデッキに立つ。\n360度のパノラマ。\n風が頬を撫でる。\n\nここまで来たんだ。\nあのさびれた無人駅から。',
                stamp: '🌤️ 頂の景色'
            },
            'add_monument': {
                text: '記念碑に文字を刻んだ。\nこの駅の歴史。\n歩んできた道のり。\n\n通りすがりの人が\n足を止めて読んでいる。\n忘れないでほしい。',
                stamp: '🏆 刻まれた歴史'
            },
            'add_station_master': {
                text: '駅長室の窓から\nすべてが見渡せる。\nホーム、改札、街並み。\n\nさびれた無人駅だった\nあの日から、ずっと\nここを見守ってきた。\n\nこれが、私の駅だ。',
                stamp: '🎖️ 伝説の駅長'
            },
        };

        // 特別なエントリーがあればそれを返す
        if (entries[upgrade.id]) {
            return entries[upgrade.id];
        }

        // デフォルトの自動生成エントリー
        return {
            text: upgrade.name + 'が完成した。\n' + upgrade.description + '\n\nまた一歩、理想の駅に\n近づいた気がする。',
            stamp: upgrade.icon + ' 完成！'
        };
    }
}
