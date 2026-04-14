// Игровая логика и данные
class Game {
    constructor() {
        this.currentChapter = 'intro';
        this.playerData = {
            visitedChapters: ['intro'],
            choicesHistory: [],
            inventory: [],
            status: {
                mental: 'В здравом рассудке', // В здравом рассудке, На грани, В панике
                physical: 'Бодр', // Бодр, Устал, Изможден
                emotional: 'Спокоен' // Спокоен, Напряжен, Отчаян
            },
            achievements: [],
            storyFlags: {}
        };
        this.story = this.initStory();
        this.settings = {
            enableMusic: true,
            enableSounds: true,
            musicVolume: 50,
            soundVolume: 70,
            enableEffects: true,
            enableBloodEffect: true,
            enableSmokeEffect: true,
            enableLightingEffect: true,
            enableFlashEffect: true,
            autosave: true,
            fontSize: 18,
            contrast: 'normal',
            accessibilityMode: false,
            autoScroll: false,
            scrollSpeed: 50,
            soundSubtitles: false
        };
        this.gameTitle = 'Мор. Эпоха мёртвых';
        this.achievements = this.initAchievements();
        this.weather = 'snow'; // snow, rain, fog, clear
        this.timeOfDay = 'day'; // day, night, dawn, dusk
        this.gameStats = {
            totalPlayTime: 0,
            startTime: Date.now(),
            deaths: 0,
            restarts: 0,
            choicesCount: 0
        };
        this.socialStats = this.loadSocialStats();
        this.premium = {
            active: this.checkPremiumStatus(),
            features: {
                unlimitedSaves: false,
                exclusiveChapters: false,
                removeAds: false,
                prioritySupport: false
            }
        };
    }
    
    checkPremiumStatus() {
        // Проверяем премиум-статус из localStorage (в реальном приложении это будет проверка на сервере)
        const premiumData = localStorage.getItem('pandemic_game_premium');
        if (premiumData) {
            try {
                const data = JSON.parse(premiumData);
                this.premium.features = { ...this.premium.features, ...data.features };
                return data.active || false;
            } catch (e) {
                return false;
            }
        }
        return false;
    }
    
    activatePremium(features) {
        this.premium.active = true;
        this.premium.features = { ...this.premium.features, ...features };
        localStorage.setItem('pandemic_game_premium', JSON.stringify({
            active: true,
            features: this.premium.features,
            activatedAt: Date.now()
        }));
    }
    
    isPremiumFeatureAvailable(feature) {
        return this.premium.active && this.premium.features[feature];
    }
    
    loadSocialStats() {
        // Загружаем статистику из localStorage (в реальном приложении это будет сервер)
        const saved = localStorage.getItem('pandemic_game_social_stats');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return {
                    choiceStats: {}, // {choiceId: count}
                    endingStats: {}, // {endingId: count}
                    totalPlayers: 0
                };
            }
        }
        return {
            choiceStats: {},
            endingStats: {},
            totalPlayers: 0
        };
    }
    
    saveSocialStats() {
        localStorage.setItem('pandemic_game_social_stats', JSON.stringify(this.socialStats));
    }
    
    recordChoice(choiceId, choiceText) {
        if (!this.socialStats.choiceStats[choiceId]) {
            this.socialStats.choiceStats[choiceId] = { count: 0, text: choiceText };
        }
        this.socialStats.choiceStats[choiceId].count++;
        this.gameStats.choicesCount++;
        this.saveSocialStats();
    }
    
    recordEnding(endingId) {
        if (!this.socialStats.endingStats[endingId]) {
            this.socialStats.endingStats[endingId] = 0;
        }
        this.socialStats.endingStats[endingId]++;
        this.saveSocialStats();
    }
    
    getChoicePercentage(choiceId) {
        const total = Object.values(this.socialStats.choiceStats).reduce((sum, stat) => sum + stat.count, 0);
        if (total === 0) return 0;
        const choiceCount = this.socialStats.choiceStats[choiceId]?.count || 0;
        return Math.round((choiceCount / total) * 100);
    }
    
    updatePlayTime() {
        const currentTime = Date.now();
        const elapsed = currentTime - this.gameStats.startTime;
        this.gameStats.totalPlayTime += elapsed;
        this.gameStats.startTime = currentTime;
    }
    
    initAchievements() {
        return {
            'survivor': {
                id: 'survivor',
                name: 'Выживший',
                description: 'Пройти первую главу',
                icon: '🛡️',
                unlocked: false
            },
            'defender': {
                id: 'defender',
                name: 'Защитник',
                description: 'Спасти Троя',
                icon: '🐕',
                unlocked: false
            },
            'explorer': {
                id: 'explorer',
                name: 'Исследователь',
                description: 'Посетить все локации',
                icon: '🗺️',
                unlocked: false
            },
            'shooter': {
                id: 'shooter',
                name: 'Стрелок',
                description: 'Победить мутанта',
                icon: '🎯',
                unlocked: false
            },
            'savior': {
                id: 'savior',
                name: 'Спаситель',
                description: 'Найти антибиотики',
                icon: '💊',
                unlocked: false
            },
            'curiosity_kills': {
                id: 'curiosity_kills',
                name: 'Любопытство убивает',
                description: 'Открыть секретную концовку в первой главе',
                icon: '🩸',
                unlocked: false
            }
        };
    }
    
    unlockAchievement(achievementId) {
        if (this.achievements[achievementId] && !this.achievements[achievementId].unlocked) {
            this.achievements[achievementId].unlocked = true;
            this.playerData.achievements.push(achievementId);
            this.save();
            this.showAchievementNotification(this.achievements[achievementId]);
            return true;
        }
        return false;
    }
    
    showAchievementNotification(achievement) {
        // Создаем уведомление о достижении
        const notification = document.createElement('div');
        notification.className = 'achievement-notification';
        notification.innerHTML = `
            <div class="achievement-icon">${achievement.icon}</div>
            <div class="achievement-text">
                <div class="achievement-title">Достижение разблокировано!</div>
                <div class="achievement-name">${achievement.name}</div>
            </div>
        `;
        document.body.appendChild(notification);
        
        // Анимация появления
        setTimeout(() => notification.classList.add('show'), 10);
        
        // Удаляем через 3 секунды
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 500);
        }, 3000);
    }
    
    checkAchievements() {
        // Проверяем достижения на основе прогресса
        if (this.playerData.visitedChapters.length > 1 && !this.achievements.survivor.unlocked) {
            this.unlockAchievement('survivor');
        }
        
        // Проверяем другие достижения по мере прохождения
        const visitedChapters = this.playerData.visitedChapters;
        if (visitedChapters.includes('troy_injured') && visitedChapters.includes('return_to_troy')) {
            if (!this.achievements.defender.unlocked) {
                this.unlockAchievement('defender');
            }
        }
        
        if (visitedChapters.includes('mutant_attack')) {
            if (!this.achievements.shooter.unlocked) {
                this.unlockAchievement('shooter');
            }
        }
        
        if (visitedChapters.includes('hospital_search') || visitedChapters.includes('pharmacy_search')) {
            if (!this.achievements.savior.unlocked) {
                this.unlockAchievement('savior');
            }
        }

        if (visitedChapters.includes('chapter1_curiosity_kills_ending')) {
            if (!this.achievements.curiosity_kills.unlocked) {
                this.unlockAchievement('curiosity_kills');
            }
        }
    }
    
    addToInventory(item) {
        if (!this.playerData.inventory.find(i => i.id === item.id)) {
            this.playerData.inventory.push(item);
            this.save();
            return true;
        }
        return false;
    }
    
    removeFromInventory(itemId) {
        const index = this.playerData.inventory.findIndex(i => i.id === itemId);
        if (index !== -1) {
            this.playerData.inventory.splice(index, 1);
            this.save();
            return true;
        }
        return false;
    }
    
    hasItem(itemId) {
        return this.playerData.inventory.some(i => i.id === itemId);
    }

    setFlag(flagName) {
        if (!flagName) return;
        if (!this.playerData.storyFlags) {
            this.playerData.storyFlags = {};
        }
        this.playerData.storyFlags[flagName] = true;
    }

    hasFlag(flagName) {
        return Boolean(this.playerData.storyFlags && this.playerData.storyFlags[flagName]);
    }
    
    updateStatus(statusChanges) {
        if (typeof statusChanges.mental === 'string' && statusChanges.mental.trim()) {
            this.playerData.status.mental = statusChanges.mental;
        }
        if (typeof statusChanges.physical === 'string' && statusChanges.physical.trim()) {
            this.playerData.status.physical = statusChanges.physical;
        }
        if (typeof statusChanges.emotional === 'string' && statusChanges.emotional.trim()) {
            this.playerData.status.emotional = statusChanges.emotional;
        }
        this.save();
    }
    
    // Метод для изменения статуса на основе числовых значений (для обратной совместимости)
    updateStatsFromValues(values) {
        // Ментальное состояние
        if (values.morale !== undefined) {
            if (values.morale >= 70) {
                this.playerData.status.mental = 'В здравом рассудке';
            } else if (values.morale >= 40) {
                this.playerData.status.mental = 'На грани';
            } else {
                this.playerData.status.mental = 'В панике';
            }
        }
        
        // Физическое состояние
        if (values.stamina !== undefined) {
            if (values.stamina >= 70) {
                this.playerData.status.physical = 'Бодр';
            } else if (values.stamina >= 40) {
                this.playerData.status.physical = 'Устал';
            } else {
                this.playerData.status.physical = 'Изможден';
            }
        }
        
        // Эмоциональное состояние
        if (values.emotional !== undefined) {
            if (values.emotional >= 70) {
                this.playerData.status.emotional = 'Спокоен';
            } else if (values.emotional >= 40) {
                this.playerData.status.emotional = 'Напряжен';
            } else {
                this.playerData.status.emotional = 'Отчаян';
            }
        }
        
        this.save();
    }

    initStory() {
        return {
            intro: {
                title: 'Глава 1. Первые шаги в хаосе',
                text: 'Я лежал, считая удары сердца.\nДед тихо похрапывал.\nМинуты тянулись мучительно долго.\nТрой поднял голову, будто чувствуя мои мысли.\n— Тсс… — прошептал я.\n\nЯ медленно поднялся, стараясь не скрипнуть половицей.\nНатянул куртку, нащупал фонарик и охотничий нож.\nДверь скрипнула, когда я приоткрыл её.\nХолод ворвался внутрь, будто ждал этого.\n\nСнег под ногами был плотный, хрустящий.\nЛуна освещала двор бледным светом.\nТрой тихо вышел следом.\nСледы были всё ещё там.\nГлубокие.\nНеровные.\nОни уходили за сарай.\n\nЯ сделал шаг вперёд.\nИ услышал звук.\nХрип.\nНе человеческий.\nТрой зарычал.',
                background: 'images/winter_village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/long-lingering-sound-after-firing.mp3', delay: 2500 },
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Rychanie_zlojj_sobaki_73912976.mp3', delay: 5000 }
                ],
                choices: [
                    { text: 'Вернуться домой', next: 'chapter1_return_home', effects: { emotional: 'Напряжен' } },
                    { text: 'Пойти по следам', next: 'chapter1_death', effects: { physical: 'Изможден', mental: 'В панике', emotional: 'Отчаян' } },
                    { text: 'Лечь спать', next: 'chapter2' }
                ]
            },
            chapter1_return_home: {
                title: 'Глава 1. Возвращение в дом',
                text: 'Я замер, всматриваясь в темноту за сараем. Хрип повторился — тихий, рваный, словно кто-то пытался вдохнуть через разорванное горло.\nТрой напрягся, шерсть на его загривке поднялась дыбом. Он тихо зарычал, не сводя взгляда с темноты.\n\nЯ почувствовал, как холод пробирается не только под одежду, но и куда-то глубже — в грудь, под рёбра.\n— Ну нет… — прошептал я едва слышно и медленно сделал шаг назад, стараясь не издавать ни звука. Снег под ногами предательски хрустел.\n\nТрой неохотно попятился вместе со мной, всё ещё рыча в темноту.\nЯ осторожно закрыл дверь и запер засов. Дом встретил привычной тишиной и запахом старого дерева.\nИз соседней комнаты доносилось ровное дыхание деда. Он спал.\n\nЯ прислонился спиной к двери, несколько секунд просто стоял, слушая, как бешено колотится сердце. Ладони дрожали, хотя в доме было теплее, чем снаружи.\nТрой подошёл ближе и ткнулся носом в мою руку. Я машинально провёл ладонью по его голове.\n— Всё нормально… — тихо сказал я, больше себе, чем ему, снял куртку и лёг, укрывшись тяжёлым одеялом.\n\nСердце постепенно замедлялось, но тревога никуда не исчезла.\nТрой устроился у кровати, положив голову на лапы, но не спал — его уши время от времени вздрагивали, будто он прислушивался к каждому звуку за стенами дома.\nЯ закрыл глаза.\nСквозь сон мне казалось, что ветер за окном иногда звучит слишком похоже на дыхание.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter2' }
                ]
            },
            chapter1_death: {
                title: 'Глава 1. За сараем',
                text: 'Я сделал ещё шаг вперёд, стараясь идти осторожно. Следы уходили за сарай.\nСнег здесь был глубже. Следы становились беспорядочнее, будто тот, кто их оставил, несколько раз падал.\nТрой шёл рядом, напряжённый, низко опустив голову. Его рычание стало глухим и непрерывным.\nЯ направил луч фонарика вперёд.\n\nСначала я ничего не увидел.\nПотом свет зацепился за фигуру.\n\nОна стояла возле аккуратно сложенных за сараем дров, спиной ко мне. Плечи были перекошены, голова опущена вниз. Руки висели слишком свободно, будто кости внутри не держали их как нужно.\n— Эй… — вырвалось у меня почти шёпотом.\n\nФигура медленно повернулась.\nЛицо было бледным, изорванным, губы растянуты в неестественной гримасе. Глаза смотрели пусто, но двигались рывками, будто искали источник звука.\nТрой зарычал громче.\n\nЗаражённый резко дёрнулся и бросился вперёд.\nЯ отшатнулся, поскользнувшись на снегу. Всё произошло слишком быстро. Его тело двигалось рвано, но невероятно стремительно.\nЯ успел только поднять нож.\n\nУдар.\n\nМы рухнули в снег. Холод мгновенно пробился сквозь одежду. Я пытался удержать его, упираясь рукой в грудь. От него пахло сыростью, кровью и чем-то гнилым.\nОн хрипел, щёлкал пастью и рвал мою одежду руками.\n\nЯ вслепую бил ножом. Лезвие входило под рёбра. Раз. Второй раз.\nЗаражённый даже не замедлился.\nЕго пальцы вцепились в мою куртку и потянули вниз. Я попытался вывернуться, но он оказался сильнее.\n\nТрой, вцепившись в него, пытался оторвать его от меня.\nЗаражённый навалился всем телом. Его лицо оказалось слишком близко. Я почувствовал резкую боль в шее, когда зубы впились в кожу.\n\nМир резко сузился.\nЯ пытался оттолкнуть его, бил, но руки быстро теряли силу. Снег вокруг темнел, расплываясь в глазах.\nТрой рычал и рвал его — отчаянно, надрывно.\nЯ попытался вдохнуть.\n\nВоздуха не хватало. Заражённый делал укус за укусом.\nМысли путались.\nХолод становился мягким.\nТихим.\n\nПоследнее, что я услышал — вой Троя, разрывающий ночную тишину.\nА потом всё исчезло.',
                background: 'images/mutant_attack.jpg',
                tensionMusic: true,
                choices: [
                    { text: 'К концовке', next: 'chapter1_curiosity_kills_ending' }
                ]
            },
            chapter1_curiosity_kills_ending: {
                title: 'Концовка: Любопытство убивает',
                text: '',
                background: 'images/ending-curiosity-kills.png',
                imageEnding: true,
                endingCaption: 'Любопытство убивает.',
                menuMusic: true,
                darkIntroMs: 2000,
                choices: [
                    { text: 'Вернуться', next: 'intro' }
                ]
            },
            chapter2: {
                title: 'Глава 2. Тень опасности',
                text: 'Дни тянулись, и всё вокруг начинало казаться неизменным, как белые сугробы, покрывавшие нашу деревню. Мы с дедушкой, как могли, старались поддерживать порядок. Запасы еды, которые мы закупили ещё до эпидемии, постепенно истощались, но в ближайшем роднике всегда была чистая вода. Кроме того, на ферме было достаточно мяса от овец, которых мы разводили, но ресурсы не вечны, и мы понимали, что рано или поздно придётся искать новые способы выживания.\n\nС каждым днём всё больше мы ощущали приближение хаоса. Снаружи слышались шаги, а иногда и рёв заражённых, но они оставались на безопасном расстоянии. Мы стали осторожнее, особенно когда на ночь запирали двери и окна, а днём всегда проверяли, не появились ли новые следы в снегу.\nОднажды утром, когда мы с дедушкой снова выходили проверять территорию, Трой резко напрягся, шерсть на загривке поднялась дыбом, а глухое рычание прорвалось из его груди. Его разноцветные глаза внимательно всматривались в густой туман, как будто он уже видел то, что мы только предчувствовали. Я положил руку на его голову и попытался его успокоить, но в ту же секунду вдалеке, в дымке зимнего тумана, я заметил два силуэта, медленно движущихся в нашу сторону. Их движения были странными, как у людей, но искажёнными, неестественными.\n\n— Саша, оставайся здесь, — сказал дедушка, сразу взяв ружьё в руки.\n\nЯ хотел возразить, но дедушка был решителен. Трой снова зарычал, и я заметил, как оба силуэта резко начали ускоряться. Они рванули в нашу сторону, распознавая запах.\n\nЗаражённые двигались не так быстро, как в фильмах, но их резкие, неуклюжие шаги всё равно приближались с ужасной скоростью. В этот момент, пока дедушка пытался прицелиться, один из заражённых подскользнулся в глубоком снегу и упал, издавая нечеловеческие звуки. Дедушка, не теряя времени, выстрелил в первого. Тот так и остался лежать.\n\n— Саша, назад! — крикнул дедушка, когда второй заражённый приблизился слишком близко.\n\nОн выстрелил снова, и второй заражённый рухнул, но, несмотря на это, начал ползти, слабо цепляясь за снег. Ещё один выстрел — и всё стихло.\n\nМы стояли в тишине, ощущая тяжесть случившегося. Это было близко. Они чувствуют нас по запаху. Сколько их ещё будет? И сколько времени нам осталось до того, как мы окажемся не готовы?\n\nЧерез некоторое время после того происшествия нам с дедушкой пришлось стать ещё осторожнее. Мы проверяли следы каждое утро и вечер. И хотя мы были уверены, что ещё несколько заражённых могли появиться, мы не ожидали, что столкнёмся с чем-то намного хуже.',
                background: 'images/winter_village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 1200 },
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 4500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter3' },
                    { 
                        text: 'Прислушаться', 
                        next: 'chapter2_pause',
                        effects: { emotional: 'Напряжен' },
                        items: [{ id: 'knife', name: 'Нож', icon: '🔪' }]
                    }
                ]
            },
            chapter3: {
                title: 'Глава 3. В ночной тьме',
                text: 'Прошло несколько дней после нашей встречи с мутантом. Мы старались держать всё под контролем: проверяли территорию, искали следы и пытались быть на шаг впереди угрозы. Но с каждым днём тревога становилась всё сильнее.\n\nУтром, когда я собирался идти на ферму, дедушка задержался — искал ещё одну пачку патронов.\n— Подожди меня, Саша, вместе пойдём, — сказал он строго.\n— Да ничего не случится, дед, — отмахнулся я и пошёл вперёд.\n\nНа подходе к хлеву я заметил, что Трой ведёт себя иначе: его уши были прижаты, а глаза настороженно бегали по сторонам. Он рычал низко и протяжно.\n\nВ этот момент тишину разорвал хриплый, резкий звук. Из темноты, словно молния, вылетела огромная фигура. Это был он — мутант. Его тело, скрючённое и покрытое буграми, двигалось неровно, но с невероятной скоростью. Глаза, светящиеся ненавистью, искажённое лицо с язвами внушали первобытный страх.\n\nЯ замер, но инстинкты взяли верх. Схватив ружьё, я выстрелил. Мутант отлетел назад, но тут же поднялся, издавая глухой хрип, напоминающий звериный рык. Он бежал на меня. Я перезаряжал ружьё, но пальцы дрожали.\n\nВ этот момент Трой бросился вперёд. Пёс с невообразимой яростью прыгнул на мутанта, вцепившись в его горло. Его белоснежная шерсть моментально окрасилась кровью, но он не сдавался.\n\n— Трой! Нет! — крик вырвался из меня.\n\nЯ прицелился и выстрелил. Пуля пробила мутанту голову, его тело замерло и рухнуло в снег.\n\nТрой тоже упал, тяжело дыша. Вся его спина была покрыта кровавыми ранами, а дыхание стало прерывистым.\n— Трой! Нет, дружище, держись! — я упал на колени рядом с ним.\n\nДедушка, услышав выстрелы, выбежал из дома.\n— Он выживет, — твёрдо сказал дед. — Но раны серьёзные. Без антибиотиков не выкарабкается.\n— Я найду их, — сказал я твёрдо.',
                background: 'images/mutant_attack.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/-rychanie-monstra-i-napadenie-na-cheloveka.mp3', delay: 1000 },
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 1800 },
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Gromkijj_lajj_sobaki_zvuk_73912985.mp3', delay: 3500 }
                ],
                choices: [
                    { 
                        text: 'Продолжить', 
                        next: 'chapter4',
                        effects: { mental: 'На грани', emotional: 'Напряжен' }
                    },
                    { 
                        text: 'Проверить всё ли цело', 
                        next: 'chapter3_pause',
                        effects: { physical: 'Устал' }
                    }
                ]
            },
            chapter4: {
                title: 'Глава 4. Поиски',
                text: 'Ветер яростно бил мне в лицо, пронизывая кожу, но я не ощущал холода — мысли были заняты только одной целью. Найти антибиотики. Мы не могли позволить Трою умереть, и я знал, что если не действовать сейчас, может быть слишком поздно.\n\nПервым делом я решил обыскать все дома в деревне. Дом за домом я проверял дверные ручки и окна, но почти все они были закрыты, и мне пришлось использовать ломик, чтобы вскрыть замки. С каждой вскрытой дверью я испытывал чувство всё большей пустоты.\n\nВ одном доме я нашёл пару коробочек с таблетками, но они были от простуды и болей в горле — совсем не то, что нужно для Троя. В другом доме — несколько старых аптечек, но ни одной с антибиотиками.\n\nЯ вскрыл последний замок в доме на краю деревни и с раздражением оглядел комнату. Пусто. Не было ни антибиотиков, ни даже чего-то минимально полезного.\n\nНаконец я понял, что в деревне мне ничего не найти. Мне нужно было идти дальше — в соседнее село. Но метель усилилась, а дороги замело так, что я даже не знал, смогу ли дойти туда пешком.\n\nКак только я оказался за пределами деревни, холод ударил сильнее, но я уже не обращал внимания. Снег был повсюду, скрывая дорогу и ориентиры. Приходилось идти практически на ощупь, полагаясь на едва заметные линии деревьев вдоль обочины.\n\nНеожиданно мне показалось, что я услышал шаги. Я замер, прислушиваясь. В тишине было что-то тревожное. Шорох шагов раздался снова, и я понял, что это не ветер.\n\nНо это был всего лишь белый заяц, напуганный моими движениями. Давление в груди немного ослабло, и я продолжил путь.',
                background: 'images/village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 1200 },
                    { file: 'audio/Sound_05356.mp3', delay: 2600 }
                ],
                choices: [
                    { 
                        text: 'Продолжить', 
                        next: 'chapter5',
                        effects: { physical: 'Устал' }
                    },
                    { 
                        text: 'Остановиться и осмотреться', 
                        next: 'chapter4_pause',
                        effects: { emotional: 'Напряжен' }
                    }
                ]
            },
            chapter5: {
                title: 'Глава 5. Заброшенное село',
                text: 'Двигаясь осторожно, я обошёл несколько домов. Заражённые стояли на улицах, замёрзшие и покрытые инеем. Они выглядели как статуи, замерев в странных позах. Мороз их удерживал, но я знал: стоит температуре подняться — они оживут.\n\nВскоре я нашёл аптеку. Осмотрев полки, я нашёл несколько упаковок антибиотиков, бинтов и обезболивающие. Спрятал всё в рюкзак, но тут услышал шорох.\n\nВ дальнем углу аптеки двигалась фигура. Свет фонаря выхватил женщину в медицинском халате. Её пустые глаза и искажённое лицо не оставляли сомнений — заражённая. Она бросилась на меня. Я вскинул ружьё и выстрелил. Грохот эхом разнёсся по всей улице.\n\nЭтот звук привлёк мутанта. Его рёв стал ближе, заставляя меня поторопиться.\n\nПеред тем как покинуть село, я решил сделать ещё один отчаянный шаг. Полицейский участок. Возможно, там найдётся оружие или хотя бы патроны.\n\nВнутри был небольшой арсенал: пара пистолетов, несколько коробок с патронами для них и, самое главное, автомат Калашникова. Автомат был в отличном состоянии, почти как новый. Я забрал всё, что мог унести.\n\nКогда я уже собирался выйти, в коридоре раздался скрип. Заражённый в полицейской форме бросился на меня. Я выстрелил. Звук разнёсся по всему зданию. Теперь времени у меня не было совсем.\n\nЯ бросился к выходу, слыша, как где-то далеко раздаётся знакомый рёв мутанта.',
                background: 'images/pharmacy.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/sound_17934.mp3', delay: 1500 },
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 2500 },
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 3500 }
                ],
                choices: [
                    { 
                        text: 'Продолжить', 
                        next: 'chapter6',
                        items: [
                            { id: 'antibiotics', name: 'Антибиотики', icon: '💊' },
                            { id: 'bandages', name: 'Бинты', icon: '🩹' },
                            { id: 'ammo', name: 'Патроны', icon: '🔫' }
                        ],
                        flags: ['antibiotics_found']
                    },
                    { 
                        text: 'Проверить укрытия', 
                        next: 'chapter5_pause',
                        effects: { mental: 'На грани' }
                    }
                ]
            },
            chapter6: {
                title: 'Глава 6. Тени за спиной',
                text: 'Ночь в лесу сгущалась с каждой минутой, обволакивая всё вокруг мраком. Воздух морозно кусал за щеки, а тишина будто давила на уши, создавая ощущение глухого вакуума.\n\nКогда я, наконец, добрался до дома и открыл дверь, меня тут же встретил Трой. Он радостно завыл, тяжело дыша, и попытался встать, несмотря на рану.\n\nМы сразу занялись Троем. Дедушка крепко удерживал пса, пока я готовил шприц. После укола мы сменили бинты.\n\nЕдва мы закончили, как раздался слабый скрежет. Будто кто-то водил когтями по дереву. Затем раздалось глухое рычание прямо за дверью.\n\n— Кто-то здесь, — голос дедушки был напряжённым.\n\nДверь треснула, и когтистая лапа мутанта с силой прорвалась внутрь. Я выстрелил. Лапа исчезла. Мы замерли, ожидая новой атаки, но всё стихло.\n\nСледы уходили в сторону фермы.\n— Он пошёл к овцам, — проговорил дед.',
                background: 'images/night.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 1200 },
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 2800 }
                ],
                choices: [
                    { 
                        text: 'Продолжить', 
                        next: 'chapter7',
                        effects: { mental: 'На грани', physical: 'Устал' }
                    },
                    { 
                        text: 'Убедиться в безопасности дома', 
                        next: 'chapter6_pause',
                        effects: { emotional: 'Напряжен' }
                    }
                ]
            },
            chapter7: {
                title: 'Глава 7. Хозяин села',
                text: 'Прошла неделя с тех пор, как я вернулся из села. Трой уже уверенно ходил, хотя иногда прихрамывал. Мы с дедушкой каждую ночь слышали шум на ферме: мутант возвращался, ломал загоны и утаскивал овец. С каждым разом его наглость росла.\n\nМы с дедушкой несколько раз пытались подкараулить его в хлеву. Но мутант был слишком умен. Он будто чувствовал наше присутствие и не показывался.\n\n— Он играет с нами, — сказал дедушка однажды ночью.\n\nЯ решился на опасный шаг — пойти по следам чудовища и найти его логово.\n\nВ селе я увидел его. Мутант передвигался на четырёх конечностях, осматривал свои владения. Он вдруг остановился, поднял голову и зарычал, разрывая ночную тишину. И резко рванул в сторону деревни.\n\nКогда я добрался до дома, дверь была сорвана с петель. Дедушки и Троя не было.\n\nФерма была разрушена. Посреди хаоса сидел мутант. Он пожирал овцу. Я поднял автомат и выстрелил. Очередь прошила его тело. Он бросился на меня. Я выстрелил ещё раз — пули попали в его голову, и он рухнул замертво.\n\nЯ стоял посреди разрушенной фермы, тяжело дыша. Вместо облегчения я чувствовал тревогу. Где дедушка? Где Трой?',
                background: 'images/farm.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/-rychanie-monstra-i-napadenie-na-cheloveka.mp3', delay: 1000 },
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 2500 }
                ],
                choices: [
                    { 
                        text: 'Продолжить', 
                        next: 'chapter8',
                        effects: { mental: 'На грани' }
                    },
                    { 
                        text: 'Проверить следы вокруг фермы', 
                        next: 'chapter7_pause',
                        effects: { emotional: 'Напряжен' }
                    }
                ]
            },
            chapter8: {
                title: 'Глава 8. Следы',
                text: 'Я стоял на разрушенной ферме, чувствуя, как опустошение заполняет грудь. Рядом лежало тело мутанта. Дом был пуст. Но крови не было — значит, дедушка и Трой могли быть живы.\n\nВозле входа я увидел чёткие отпечатки дедушкиных ботинок и лап Троя. Они вели к дороге.\n\nСледы тянулись через старое шоссе, напрямую в сторону села. У окраины я увидел два тела заражённых. Один был застрелен из ружья — дробь оставила характерные повреждения. Второй заражённый был убит иначе, как будто тяжёлым предметом.\n\nИ ещё кое-что: следы снегоходов. Они начинались неподалёку от тел заражённых и вели из села в сторону города.\n\nСледы дедушки и Троя обрывались там, где начинались полосы от снегоходов.\n— Они забрали их, — сказал я вслух.\n\nГород находился всего в 15 километрах отсюда. Других зацепок у меня не было.',
                background: 'images/village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 1200 }
                ],
                choices: [
                    { 
                        text: 'Продолжить', 
                        next: 'chapter9',
                        effects: { physical: 'Устал' }
                    },
                    { 
                        text: 'Осмотреть следы внимательнее', 
                        next: 'chapter8_pause',
                        effects: { emotional: 'Напряжен' }
                    }
                ]
            },
            chapter9: {
                title: 'Глава 9. Дорога домой',
                text: 'Я шёл уже несколько часов. Дорога напоминала белое полотно, бесконечно тянущееся вдаль. Снег тихо скрипел под ногами. В рюкзаке лежали консервы, вода и патроны.\n\nВдруг справа, из леса, донёсся низкий хриплый звук. Это был заражённый. Он рванул вперёд, и я выстрелил. Заражённый упал на снег.\n\nВыстрел наверняка привлёк внимание других опасностей. Я поспешил прочь. Мой путь лежал к городу.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 1800 }
                ],
                choices: [
                    { 
                        text: 'Продолжить', 
                        next: 'chapter10',
                        effects: { mental: 'На грани' }
                    },
                    { 
                        text: 'Перевести дыхание', 
                        next: 'chapter9_pause',
                        effects: { physical: 'Устал' }
                    }
                ]
            },
            chapter10: {
                title: 'Глава 10. Пепел воспоминаний',
                text: 'Я стоял на пустой улице, глядя на разрушенный город. Где искать дедушку? Я решил пойти в нашу квартиру.\n\nДверь была открыта. В комнате, где когда-то царила теплота, в кресле сидела фигура. Женщина, которая раньше была моей матерью, держала в руках старый фотоальбом. Её глаза… они уже не были живыми. Она была заражённой.\n\nОна поднялась, сделала шаг ко мне. Я прицелился.\n— Прости… — прошептал я.\nВыстрел. Мать упала.\n\nЯ быстро покинул квартиру. Следующей целью стал дом отца. В доме царила тишина. Я устроился на диване и попытался уснуть. Но ночью раздался рев мутанта. Он был рядом.',
                background: 'images/city.jpg',
                music: 'audio/sad.mp3',
                sounds: [
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 2200 },
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 4200 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter11' },
                    { text: 'Осмотреть комнату внимательнее', next: 'chapter10_pause' },
                    { text: 'Осмотреть двор', next: 'chapter10_alt' }
                ]
            },
            chapter11: {
                title: 'Глава 11. На руинах прошлого',
                text: 'Утро наступило неожиданно. Я почти не спал. Город встретил меня молчанием.\n\nВ разрушенном магазине я нашёл несколько банок консервов и бутылку воды. Когда я потянулся к банке, за полкой что-то зашуршало. Это оказалась крыса.\n\nЯ заметил следы, ведущие к старому заводу. Внутри было темно, но из глубины доносились приглушённые звуки. В будке охраны я увидел девушку. Она была ранена. В этот момент появился мутант. Я выстрелил и убил его.\n\nДевушка назвалась Полиной. Я обработал её рану и предложил убежище.',
                background: 'images/city.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 1200 },
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 3600 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter12' },
                    { text: 'Проверить завод еще раз', next: 'chapter11_pause' },
                    { text: 'Проверить припасы', next: 'chapter11_alt' }
                ]
            },
            chapter12: {
                title: 'Глава 12. Новые знакомые',
                text: 'Проснулся я от необычного запаха — что-то аппетитное доносилось из кухни. Полина готовила завтрак. Мы поговорили. Она рассказала, как потеряла семью и осталась одна. Я рассказал о дедушке.\n\nПосле завтрака я отправился в город за припасами. Там меня встретила группа вооружённых людей. Они забрали оружие и повели на тракторный завод.\n\nВ главном цехе сидел мужчина — Сергей Альбертович, смотрящий этого места. Рядом с ним появился Платон. Старый друг. Но его улыбка была холодной.',
                background: 'images/hospital.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter13' },
                    { text: 'Поговорить с Полиной подробнее', next: 'chapter12_pause', flags: ['polina_trust'] },
                    { text: 'Остаться настороже', next: 'chapter12_alt' }
                ]
            },
            chapter13: {
                title: 'Глава 13. Смотритель',
                text: 'Смотритель оказался дядей Платона. Я увидел Троя на цепи.\n\n— Зачем? — вырвалось у меня. — Зачем держать его на цепи?\n— Пусть сторожит. Хоть для чего-то сгодится, — ответил Смотритель.\n\nМеня отвели в общий сектор. Ночью пришёл Платон и рассказал, что дедушку увезли в Арзамас. Он пообещал помочь забрать Троя.\n\nДнём я устроил пожар, чтобы отвлечь охрану. В хаосе я сорвал цепь и забрал Троя. Мы бежали в ночь.',
                background: 'images/night.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/short-click-of-a-computer-mouse.mp3', delay: 1500 },
                    { file: 'audio/fire_zkyuzme_.mp3', delay: 2800 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter14' },
                    { text: 'Обдумать план побега', next: 'chapter13_pause' },
                    { text: 'Прислушаться к шумам', next: 'chapter13_alt' }
                ]
            },
            chapter14: {
                title: 'Глава 14. Холод',
                text: 'Метель выла. Мир сжался до нескольких метров впереди. Я шёл, потому что остановиться означало лечь и не встать. Трой шёл рядом, тяжело, упрямо.\n\nНа пути стояли замёрзшие заражённые. Один из них треснул, как лёд. Он начал двигаться. Я ускорил шаг. Вдали раздался рёв мутанта.\n\nЯ добрался до дома, где оставил Полину. Внутри был хаос. Полины не было. На снегу — следы снегоходов. Те же, что увезли дедушку. Я собрал припасы и пошёл по следам в сторону Арзамаса.',
                background: 'images/night.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 2000 },
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 3200 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter15' },
                    { text: 'Осмотреть дом внимательнее', next: 'chapter14_pause' },
                    { text: 'Свернуть к сараю', next: 'chapter14_alt' }
                ]
            },
            chapter15: {
                title: 'Глава 15. Белая смерть',
                text: 'Мы вышли из дома. Снег хрустел под ногами. Впереди — белый пустырь и заражённые. Мы обошли их, стараясь не шуметь. Рев мутанта доносился издалека.\n\nМы нашли укрытие в заброшенном доме. Там пряталась старая заражённая. Я ударил её прикладом, но она ожила. Пришлось стрелять.\n\nВыстрел привлёк мародёров. Они окружили нас. В этот момент мутант ворвался через окно, сметая всех. Я выстрелил весь магазин. Мутант исчез, утащив одного из мародёров.\n\nДом снова погрузился в тишину.',
                background: 'images/journey.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 1800 },
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 3200 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter16' },
                    { text: 'Проверить окружение', next: 'chapter15_pause' },
                    { text: 'Укрепить укрытие', next: 'chapter15_alt' }
                ]
            },
            chapter16: {
                title: 'Глава 16. Смерть не приговор',
                text: 'Шум в ушах утихал. Дом выстыл за ночь. Мародёры лежали там же, где упали. Я обыскал их и нашёл патроны, нож и аптечку.\n\nОдин из мародёров вдруг зашевелился. Он поднялся. Я понял: вирус везде. Если мозг цел — смерть не конец.\n\nТрой бросился на него. Я ударил прикладом. Тело обмякло окончательно.\n\nЯ собрал патроны и вышел. Впереди была дорога.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Gromkijj_lajj_sobaki_zvuk_73912985.mp3', delay: 2000 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter17' },
                    { text: 'Собраться с силами', next: 'chapter16_pause' },
                    { text: 'Перевязать Троя', next: 'chapter16_alt', flags: ['troy_saved'] }
                ]
            },
            chapter17: {
                title: 'Глава 17. Дорога',
                text: 'Мы медленно продвигались по заснеженному полю. Вдали, среди обломков машин, я заметил движения — заражённые. Мы обошли их, прячась за сугробами и остатками машин. Рев мутанта доносился издалека.\n\nСнег продолжал идти, дорога растягивалась на километры. Впереди показался серый силуэт города.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 1500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter18' },
                    { text: 'Осмотреть дорогу', next: 'chapter17_pause' },
                    { text: 'Проверить машины', next: 'chapter17_alt' }
                ]
            },
            chapter18: {
                title: 'Глава 18. Арзамас',
                text: 'Мы прошли мимо указателя: «Арзамас — город Гайдара». За путями начинались складские здания. Из-за угла вышел мутант. Он был крупнее всех, кого я видел раньше. Его тело было покрыто рубцами и старыми пулевыми отверстиями.\n\nОн рванул. Я открыл огонь. Трой бросился на него и получил удар. Последняя пуля вошла мутанту прямо в глаз. Он рухнул.\n\nЯ подбежал к Трою. Он был ранен, но жив.\n\nИ тогда я услышал далёкий звук моторов. Со стороны города шли машины. Военные.\n\n— ОРУЖИЕ НА ЗЕМЛЮ! — раздался крик.\n\nЯ подчинился. Троя окружили. Солдат сказал, что он будет жить.',
                background: 'images/city.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 1600 },
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 2800 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter19' },
                    { text: 'Проверить Троя', next: 'chapter18_pause' },
                    { text: 'Осмотреть склад', next: 'chapter18_alt' }
                ]
            },
            chapter19: {
                title: 'Глава 19. Завод',
                text: 'Меня привезли на завод. Владимир встретил меня. Он посмотрел на Троя и сказал, что пса вылечат.\n\nВ медпункте Трою обработали рану. Полина была там. Она выжила — её забрали военные.\n\nВладимир сказал, что дедушка здесь. Я должен был увидеть его утром.',
                background: 'images/hospital.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter20' },
                    { text: 'Осмотреть завод', next: 'chapter19_pause' },
                    { text: 'Проверить медпункт', next: 'chapter19_alt' }
                ]
            },
            chapter20: {
                title: 'Глава 20. Военный завод',
                text: 'Я проснулся в комнате. На стуле лежала тёплая форма. Троя в комнате не было — он был в медпункте. Владимир гладил его, и Трой позволял.\n\nВ столовой я ел вместе с Владимиром и Полиной. Владимир объяснил, что завод — опорная точка. Здесь есть еда, тепло и защита. Он сказал, что такие, как я, им нужны.\n\nМы прошли по цехам. Затем Владимир отвёл меня к деду. Дедушка был жив, но потерял память. Он не узнал меня.\n\nЯ вышел из цеха, чувствуя холод сильнее любого мороза. Полина стояла рядом. Я сказал, что останусь. Пока.',
                background: 'images/city.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Остаться на заводе', next: 'chapter21_good' },
                    { text: 'Собраться с мыслями', next: 'chapter20_pause' },
                    { text: 'Осмотреть периметр', next: 'chapter20_alt' }
                ]
            },
            chapter21: {
                title: 'Глава 21. Плохая концовка',
                text: 'Утром Владимир дал мне задание: колонна из трёх машин пропала. Я должен был проверить. Полина настояла идти со мной.\n\nКолонна оказалась засадой. Снайпер убил капитана. Людей окружили вооружённые. Среди них был Платон.\n\nОн увидел Полину и понял, что она важна для меня. Платон выстрелил в неё. Она упала. Я бросился на Платона, но нас разняли. Военные ворвались и перебили людей Смотрителя.\n\nПолина умерла у меня на руках.\n\nВладимир протянул мне пистолет.\n— Добей шавку.\n\nЯ нажал на курок.\n\n*Конец. Мир забрал у тебя всё.*',
                background: 'images/night.jpg',
                tensionMusic: true,
                sounds: [
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 1800 },
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 3200 }
                ],
                choices: [
                    { text: 'Начать заново', next: 'intro' }
                ]
            },
            chapter1_pause: {
                title: 'Тихая пауза',
                text: 'Ты задерживаешься у окна. В тишине слышен только скрип снега да редкие шорохи за стеной. Кажется, сама деревня затаила дыхание.',
                background: 'images/winter_village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter2' }
                ]
            },
            chapter2_pause: {
                title: 'Невольная тревога',
                text: 'Ты прислушиваешься к ветру. Где-то далеко в снегу будто что-то шевельнулось. Трой снова напрягся, но рядом — только пустота.',
                background: 'images/winter_village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/Sound_05356.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter3' }
                ]
            },
            chapter3_pause: {
                title: 'Передышка',
                text: 'Ты проверяешь крепления на ружье и оглядываешь двор. Следов новых нет, но тревога не отпускает.',
                background: 'images/mutant_attack.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/short-click-of-a-computer-mouse.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter4' }
                ]
            },
            chapter4_pause: {
                title: 'Мгновение тишины',
                text: 'Ты останавливаешься у края деревни. Снег заметает следы, и кажется, что мир вокруг остановился.',
                background: 'images/village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter5' }
                ]
            },
            chapter5_pause: {
                title: 'Тихий коридор',
                text: 'Ты заглядываешь в соседний дом. Полки пусты, но на полу видны свежие следы. Здесь кто-то был совсем недавно.',
                background: 'images/pharmacy.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/sound_17934.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter6' }
                ]
            },
            chapter6_pause: {
                title: 'Сквозь холод',
                text: 'Ты проверяешь запоры и окна. На рамах свежие царапины, но пока всё держится.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/Sound_05356.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter7' }
                ]
            },
            chapter7_pause: {
                title: 'Следы у забора',
                text: 'Ты находишь новые отпечатки у загона. Они слишком крупные для обычного заражённого.',
                background: 'images/farm.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter8' }
                ]
            },
            chapter8_pause: {
                title: 'Поворот',
                text: 'Ты проводишь рукой по следам снегоходов. Значит, кто-то ещё здесь жив.',
                background: 'images/village.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter9' }
                ]
            },
            chapter9_pause: {
                title: 'Короткая пауза',
                text: 'Ты переводишь дыхание и проверяешь магазин. Патронов немного, и это тревожит.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter10' }
                ]
            },
            chapter10_pause: {
                title: 'Осколки прошлого',
                text: 'Ты задерживаешься у дверного проёма, осматривая комнату ещё раз. Слишком тихо для города.',
                background: 'images/city.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter11' }
                ]
            },
            chapter11_pause: {
                title: 'Сомнения',
                text: 'Ты осматриваешь двор завода и пытаешься запомнить выходы. Если придётся уходить, дорога должна быть ясной.',
                background: 'images/city.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter12' }
                ]
            },
            chapter12_pause: {
                title: 'Разговоры',
                text: 'Ты спрашиваешь Полину о том, что она видела в городе. Она говорит мало, но в её голосе слышится усталость.',
                background: 'images/hospital.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter13' }
                ]
            },
            chapter13_pause: {
                title: 'План',
                text: 'Ты мысленно перебираешь варианты. Главное — выбрать момент, когда охрана отвлечётся.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/short-click-of-a-computer-mouse.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter14' }
                ]
            },
            chapter14_pause: {
                title: 'Следы',
                text: 'Ты находишь свежие следы в снегу. Они ведут туда, где ты уже был. Значит, время на исходе.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter15' }
                ]
            },
            chapter15_pause: {
                title: 'Настороженность',
                text: 'Ты проверяешь окна и двери. Тишина обманчива — стоит ошибиться, и всё закончится.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/sound_17934.mp3', delay: 3500 }
                ],
                choices: [
                    { text: 'Продолжить', next: 'chapter16' }
                ]
            },
            chapter16_pause: {
                title: 'Правило',
                text: 'Ты проверяешь патроны и снова напоминаешь себе: только в голову.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter17' }
                ]
            },
            chapter17_pause: {
                title: 'Осторожность',
                text: 'Ты следишь за дорогой и за снегом. Любая ошибка может стать последней.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter18' }
                ]
            },
            chapter18_pause: {
                title: 'Проверка',
                text: 'Ты опускаешься рядом с Троем и проверяешь его дыхание. Он держится.',
                background: 'images/city.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter19' }
                ]
            },
            chapter19_pause: {
                title: 'Новый порядок',
                text: 'Ты осматриваешь завод: люди заняты делом, охрана на постах. Здесь всё иначе, чем снаружи.',
                background: 'images/hospital.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter20' }
                ]
            },
            chapter20_pause: {
                title: 'Сдержанность',
                text: 'Ты стараешься держать себя в руках. Слишком многое потеряно, чтобы сорваться сейчас. Но выбор всё равно за тобой.',
                background: 'images/city.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Остаться на заводе', next: 'chapter21_good' },
                    { text: 'Уйти ночью', next: 'chapter21' },
                    { 
                        text: 'Сделка за лекарства', 
                        next: 'chapter21_secret',
                        requiresItem: 'antibiotics',
                        requiresFlags: ['antibiotics_found', 'polina_trust', 'troy_saved']
                    }
                ]
            },
            chapter21_pause: {
                title: 'Тишина после боли',
                text: 'Ты стоишь, сжимая пальцы на холодном металле. Мир снова стал тише, но внутри — только пустота.',
                background: 'images/night.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Начать заново', next: 'intro' }
                ]
            },
            chapter10_alt: {
                title: 'Двор дома',
                text: 'Ты выходишь во двор. Снег лежит нетронутым, и от этого становится ещё холоднее. Никаких свежих следов — только тишина.',
                background: 'images/city.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter11' }
                ]
            },
            chapter11_alt: {
                title: 'Запасы',
                text: 'Ты проверяешь остатки припасов. Консервы заканчиваются, воды мало. Придётся рисковать и идти дальше.',
                background: 'images/city.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter12' }
                ]
            },
            chapter12_alt: {
                title: 'Тревога',
                text: 'Ты остаёшься настороже. Люди вокруг слишком уверены, а у тебя внутри — непривычная тревога.',
                background: 'images/hospital.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter13' }
                ]
            },
            chapter13_alt: {
                title: 'Шорохи',
                text: 'Ты прислушиваешься к коридорам. Где-то скрипит металл, где-то шуршит ткань. Ночь слишком живая.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter14' }
                ]
            },
            chapter14_alt: {
                title: 'Сарай',
                text: 'Ты обходишь дом и заглядываешь в сарай. Пусто. Но в углу лежит старый канистр с топливом — пригодится.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter15' }
                ]
            },
            chapter15_alt: {
                title: 'Укрепление',
                text: 'Ты переставляешь мебель и закрываешь разбитые окна. Это даёт минуту передышки, но не решает проблему.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter16' }
                ]
            },
            chapter16_alt: {
                title: 'Перевязка',
                text: 'Ты проверяешь рану Троя и туго перематываешь бинтом. Пёс терпит, но глаза выдают боль.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter17' }
                ]
            },
            chapter17_alt: {
                title: 'Машины',
                text: 'Ты осматриваешь брошенные машины. В одной — пустые обоймы и следы чужих шагов. Здесь кто-то был недавно.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter18' }
                ]
            },
            chapter18_alt: {
                title: 'Склад',
                text: 'Ты заглядываешь в складские здания. Полки пусты, но на полу валяется армейская аптечка.',
                background: 'images/city.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter19' }
                ]
            },
            chapter19_alt: {
                title: 'Медпункт',
                text: 'Ты заходишь в медпункт. Запах антисептика и слабый свет лампы — редкое ощущение безопасности.',
                background: 'images/hospital.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Продолжить', next: 'chapter20' }
                ]
            },
            chapter20_alt: {
                title: 'Периметр',
                text: 'Ты обходишь периметр завода. Патрули на месте, люди смотрят напряжённо. Здесь не расслабиться. Внутри всё сжимается — это не дом, а клетка.',
                background: 'images/city.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Сбежать ночью', next: 'chapter21' },
                    { text: 'Уйти вместе с Полиной', next: 'chapter21_neutral' },
                    { text: 'Вернуться в цех', next: 'chapter20_pause' }
                ]
            },
            chapter21_good: {
                title: 'Глава 21. Хорошая концовка',
                text: 'Ты остаёшься на заводе. Время идёт, и ты постепенно учишься жить в новом порядке. Дедушка не вспоминает прошлое, но рядом с ним тебе спокойнее. Полина остаётся рядом, и вместе вы помогаете Трою восстановиться.\n\nТы больше не один. Это не старый мир, но здесь есть шанс.\n\n*Конец. Ты выбрал жизнь.*',
                background: 'images/city.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Начать заново', next: 'intro' }
                ]
            },
            chapter21_neutral: {
                title: 'Глава 21. Нейтральная концовка',
                text: 'Вы уходите вместе с Полиной. Ночью город кажется живым, хотя вокруг только пустота. Вы находите тихий дом у окраины и решаете остаться там. Дедушка остаётся на заводе — выбор дался тяжело, но иначе было нельзя.\n\nТрой рядом. Вы живы, и это главное, но внутри остаётся чувство, что что-то важное осталось позади.\n\n*Конец. Ты выбрал путь между страхом и надеждой.*',
                background: 'images/night.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Начать заново', next: 'intro' }
                ]
            },
            chapter21_secret: {
                title: 'Глава 21. Тайная концовка',
                text: 'Ты приносишь Владимиру лекарства и предлагаешь сделку: Трой и дедушка — в обмен на ваши знания и помощь. Он долго молчит, затем кивает.\n\nТроя забирают к деду. Ты остаёшься рядом, и постепенно дед начинает узнавать тебя — сначала взглядом, затем короткими словами. Полина тоже рядом. На заводе появляется ощущение дома.\n\n*Конец. Ты выкупил своё будущее.*',
                background: 'images/city.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Начать заново', next: 'intro' }
                ]
            },
            window: {
                title: 'У окна',
                text: 'Вы подошли к окну и пристально всматриваетесь в зимний пейзаж. Вдалеке виднеются силуэты деревьев, покрытых снегом. Ветра нет, но что-то кажется... неправильным. Вдалеке вы слышите странные звуки — похоже на стрельбу из соседнего села.',
                background: 'images/window_view.jpg',
                music: 'audio/ambient_winter.mp3',
                sounds: [
                    { file: 'audio/long-lingering-sound-after-firing.mp3', delay: 3000 } // "слышите странные звуки — похоже на стрельбу" - дальняя стрельба (один раз)
                ],
                choices: [
                    { text: 'Сообщить дедушке о звуках', next: 'sounds_report' },
                    { text: 'Внимательно наблюдать за происходящим', next: 'observation' }
                ]
            },
            grandfather_plan: {
                title: 'План дедушки',
                text: 'Вы поворачиваетесь к дедушке. Александр Романович продолжает проверять ружьё, но его взгляд серьёзен.\n\n— Дед, что мы будем делать дальше? — спрашиваете вы.\n\nДед поднимает голову и смотрит на вас внимательно:\n— Саша, главное сейчас — выжить. Мы здесь, в деревне, в безопасности. Снегопады укрыли нас словно щитом. Но нужно быть готовыми ко всему.',
                background: 'images/grandfather.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Предложить составить план обороны', next: 'defense_plan' },
                    { text: 'Спросить о родителях', next: 'parents_question' }
                ]
            },
            troy_pet: {
                title: 'Трой',
                text: 'Вы подходите к камину и садитесь рядом с Троем. Пёс поднимает голову и смотрит на вас своими разноцветными глазами — один голубой, другой карий. Его взгляд полон понимания и верности.\n\nВы гладите его по голове, и Трой тихо вздыхает, успокаиваясь под вашими ладонями. Его шерсть мягкая и тёплая. Вы чувствуете связь с этим верным другом, который всегда был рядом в самые трудные моменты.\n\nДедушка с улыбкой наблюдает за вами:\n— Хороший пёс, Трой. Он чует опасность раньше нас.',
                background: 'images/troy.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Поговорить с дедушкой о Трое', next: 'grandfather_plan' },
                    { text: 'Продолжить наблюдать за окном', next: 'window' }
                ]
            },
            first_night: {
                title: 'Первая ночь странных звуков',
                text: 'Тревожные знаки появились неожиданно. Была поздняя ночь, когда Трой зарычал, подняв голову. Его разноцветные глаза внимательно смотрели в темноту в окне.\n\n— Что такое, дружок? — пробормотали вы, направляясь к двери.\n\nДедушка остановил вас, быстро схватил ружьё и вышел первым. Вдалеке под луной виднелся силуэт, медленно продвигающийся по глубокому снегу. Шаги были неуверенными, а движения — неестественными.\n\n— Бери Троя и в дом, — сказал дедушка суровым тоном.\n\nВы послушались, затащили пса в дом. Дедушка вошёл следом и тщательно запер вход. Всю ночь вы ворочались, думая о странном силуэте.',
                background: 'images/night.jpg',
                // Убрали tensionMusic - это не самый напряженный момент
                sounds: [
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Rychanie_zlojj_sobaki_73912976.mp3', delay: 800 }, // "Трой зарычал" - настороженное рычание
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 3000 } // "Шаги были неуверенными" - шаги по снегу (один раз)
                ],
                choices: [
                    { text: 'Насторожиться и подготовиться', next: 'preparation' },
                    { text: 'Попытаться уснуть', next: 'sleep_attempt' }
                ]
            },
            mutant_attack: {
                title: 'Атака мутанта',
                text: 'Из темноты, словно молния, вылетела огромная фигура. Это был он — мутант. Его тело, скрючённое и покрытое буграми, двигалось неровно, но с невероятной скоростью. Глаза, светящиеся ненавистью, искажённое лицо с язвами внушали первобытный страх.\n\nВы замерли, но инстинкты взяли верх. Схватив ружьё, вы выстрелили. Мутант отлетел назад, но тут же поднялся, издавая глухой хрип, напоминающий звериный рык.\n\nОн бежал на вас. Вы перезаряжали ружьё, но пальцы дрожали, а время казалось замедлилось. В этот момент Трой бросился вперёд.\n\nПёс с невообразимой яростью прыгнул на мутанта, вцепившись в его горло. Мутант зашипел и задержался, пытаясь сбросить его, но Трой держался мёртвой хваткой. Его белоснежная шерсть моментально окрасилась кровью, но он не сдавался, издавая яростный рык.\n\n— Трой! Нет! — крик вырвался из вас.\n\nВы прицелились и выстрелили. Пуля пробила мутанту голову, его тело замерло и рухнуло в снег.',
                background: 'images/mutant_attack.jpg',
                tensionMusic: true, // Самый напряженный момент - тревожная музыка
                sounds: [
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 2000 }, // "вы выстрелили" - первый выстрел
                    { file: 'audio/monster-whirr_zk8rqsv_.mp3', delay: 2500 }, // "издавая глухой хрип, напоминающий звериный рык" - рык мутанта
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Gromkijj_lajj_sobaki_zvuk_73912985.mp3', delay: 4500 }, // "издавая яростный рык" - яростное рычание Троя
                    { file: 'audio/aa8b64ca38f350.mp3', delay: 5500 } // "Вы прицелились и выстрелили" - второй выстрел
                ],
                choices: [
                    { text: 'Подбежать к Трою', next: 'troy_injured' },
                    { text: 'Оглядеться вокруг на наличие других опасностей', next: 'check_danger' }
                ]
            },
            troy_injured: {
                title: 'Трой ранен',
                text: 'Трой тоже упал, тяжело дыша. Вся его спина была покрыта кровавыми ранами, а дыхание стало прерывистым.\n\n— Трой! Нет, дружище, держись! — вы упали на колени рядом с ним, чувствуя, как холод пробирается сквозь одежду.\n\nПёс поднял взгляд, его разноцветные глаза смотрели прямо на вас, полные боли и верности. Он тихо скулил, но попытался подняться, несмотря на раны.\n\n— Лежи, не двигайся, — прошептали вы, погладив его по голове. — Мы вытащим тебя.\n\nДедушка, услышав выстрелы, выбежал из дома. Увидев вас, он на мгновение замер, а потом подбежал, опустившись рядом.\n\n— Он выживет, — твёрдо сказал дед, глядя на Троя. — Но раны серьёзные. Без антибиотиков не выкарабкается.',
                background: 'images/troy_injured.jpg',
                music: 'audio/sad.mp3',
                sounds: [
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Sobaka_dyshit_vysunuv_yazyk_73912973.mp3', delay: 500 }, // "тяжело дыша" - тяжелое дыхание (один раз)
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Sobaka_skulit_zvuk_73912972.mp3', delay: 2000 } // "Он тихо скулил" - скуление (один раз)
                ],
                choices: [
                    { text: 'Отправиться искать антибиотики в ближайший город', next: 'search_antibiotics' },
                    { text: 'Попытаться найти лекарства в деревне', next: 'village_medicine' },
                    { text: 'Остаться с Троем и надеяться на лучшее', next: 'stay_with_troy' }
                ]
            },
            sounds_report: {
                title: 'Странные звуки',
                text: 'Вы поворачиваетесь к дедушке:\n— Дед, слышишь? Вдалеке что-то происходит — похоже на стрельбу.\n\nДедушка откладывает ружьё и внимательно прислушивается. Его лицо становится серьёзным.\n\n— Да, слышу. Это из соседнего села. — Он тяжело вздыхает. — Значит, добрались и туда.\n\nВы замечаете, как Трой насторожился, его уши прижаты, глаза внимательно следят за окнами.',
                background: 'images/window_view.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это просто разговор
                sounds: [
                    { file: 'audio/long-lingering-sound-after-firing.mp3', delay: 1000 } // "похоже на стрельбу" - дальняя стрельба (один раз)
                ],
                choices: [
                    { text: 'Спросить, что это может быть', next: 'grandfather_plan' },
                    { text: 'Предложить проверить, что происходит', next: 'first_night' }
                ]
            },
            observation: {
                title: 'Наблюдение',
                text: 'Вы продолжаете внимательно смотреть в окно. Тишина кажется зловещей. Вдалеке вы замечаете движение — что-то тёмное медленно перемещается по снегу.\n\nТрой встаёт и подходит к окну, низко рыча. Его поведение настораживает вас ещё больше.\n\nДедушка подходит к вам:\n— Видишь что-то, Саша?\n\nВы указываете на силуэт вдалеке, но он уже скрылся за деревьями.',
                background: 'images/window_view.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это просто наблюдение
                sounds: [
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Rychanie_zlojj_sobaki_73912976.mp3', delay: 2000 } // "низко рыча" - настороженное рычание (один раз)
                ],
                choices: [
                    { text: 'Сказать дедушке о том, что видели', next: 'first_night' },
                    { text: 'Продолжить наблюдать', next: 'first_night' }
                ]
            },
            defense_plan: {
                title: 'План обороны',
                text: '— Дед, может, нам стоит составить план на случай, если что-то произойдёт? — предлагаете вы.\n\nДедушка кивает:\n— Правильно думаешь. У нас есть ружья, патроны, еда. Дом крепкий, окна можно заделать. Главное — быть настороже и не паниковать.\n\nОн показывает вам, где хранятся дополнительные патроны и оружие. Вы вместе осматриваете дом, проверяя каждую дверь и окно.',
                background: 'images/grandfather.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Спросить, можем ли мы помочь родителям', next: 'parents_question' },
                    { text: 'Продолжить укреплять оборону', next: 'morning_after' }
                ]
            },
            parents_question: {
                title: 'Вопрос о родителях',
                text: '— Дед, а родители? Можем ли мы им помочь? — спрашиваете вы, голос дрожит.\n\nДедушка на мгновение замирает, затем тяжело вздыхает:\n— Саша, город в 15 километрах отсюда. Дороги завалены снегом, и там... — он жестом показывает в сторону города. — Там уже всё охвачено хаосом. Мы не сможем добраться туда сейчас, не рискуя всеми нашими жизнями.\n\nОн подходит и кладёт руку на ваше плечо:\n— Они знали, что делать. Если смогут — выберутся. Но сейчас мы должны заботиться о себе.',
                background: 'images/grandfather.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Согласиться с дедом', next: 'morning_after' },
                    { text: 'Настаивать на помощи родителям', next: 'morning_after' }
                ]
            },
            preparation: {
                title: 'Подготовка',
                text: 'Вы не можете уснуть, поэтому встаёте и проверяете, всё ли на месте. Ружьё готово, патроны под рукой. Вы подходите к окну и смотрите в темноту.\n\nТрой следует за вами, его взгляд насторожен. Вы гладите его по голове, успокаивая и себя, и его.\n\nДедушка тоже не спит. Он сидит в кресле с ружьём на коленях, внимательно слушая каждый звук.\n\n— Держись, Саша, — говорит он тихо. — Мы справимся.',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это спокойная подготовка, нет звуков в тексте
                choices: [
                    { text: 'Попытаться уснуть', next: 'sleep_attempt' },
                    { text: 'Дежурить вместе с дедом', next: 'morning_after' }
                ]
            },
            sleep_attempt: {
                title: 'Беспокойная ночь',
                text: 'Вы ложитесь обратно, пытаясь заснуть, но сон не идёт. Мысли о том, что происходит в мире, не дают покоя. Вы думаете о родителях, о брате, о том, что может произойти дальше.\n\nТрой укладывается рядом с вашей кроватью, его дыхание успокаивает. Постепенно вы погружаетесь в беспокойный сон, полный тревожных сновидений.\n\nУтром вас будит голос дедушки: "Саша, вставай!"',
                background: 'images/night.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Проснуться', next: 'morning_after' }
                ]
            },
            morning_after: {
                title: 'Утро после ночи',
                text: 'Наутро вы с дедушкой обнаружили следы. Они были глубокими и ворочались по снегу, словно человек еле передвигал ноги, и были окутаны пятнами крови. Дед осмотрел их и тяжело вздохнул:\n\n— Они уже здесь. Теперь всегда запирай двери, и даже днём будь настороже.\n\nВ этот день вы поняли, что заражённые добрались до вашей деревни.',
                background: 'images/morning.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это просто обнаружение следов, не активная опасность
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 1000 } // "следы... словно человек еле передвигал ноги" - шаги по снегу (один раз, не зацикленные)
                ],
                choices: [
                    { text: 'Отправиться проверить ферму', next: 'farm_check' },
                    { text: 'Остаться дома и укрепить оборону', next: 'defense_strengthen' }
                ]
            },
            farm_check: {
                title: 'На ферме',
                text: 'Утром, когда вы собирались идти на ферму, дедушка задержался — искал ещё одну пачку патронов.\n\n— Подожди меня, Саша, вместе пойдём, — сказал он строго.\n\n— Да ничего не случится, дед, — отмахнулись вы, уверенные в своей правоте, и пошли вперёд.\n\nСнег скрипел под ногами, воздух был резким, морозным. Лёгкий ветер пробегал сквозь деревья, заставляя их скрипеть, будто предупреждая об опасности. На подходе к хлеву вы заметили, что Трой ведёт себя иначе: его уши были прижаты, а глаза настороженно бегали по сторонам. Он рычал низко и протяжно, словно чуял что-то чужое.\n\n— Что там, друг? — вы наклонились, чтобы успокоить его.\n\nВ этот момент тишину разорвал хриплый, резкий звук.',
                background: 'images/farm.jpg',
                tensionMusic: true, // Тревожная музыка - перед атакой на ферме (оставляем, это критический момент)
                sounds: [
                    { file: 'audio/2-steps-on-soft-snow_z1hnzm4u.mp3', delay: 1500 }, // "Снег скрипел под ногами" - скрип снега (один раз)
                    { file: 'audio/Sound_05356.mp3', delay: 2500 }, // "деревья... скрипеть" - скрип деревьев на ветру (один раз)
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Rychanie_zlojj_sobaki_73912976.mp3', delay: 3500 }, // "Он рычал низко и протяжно" - настороженное рычание Троя
                    { file: 'audio/-rychanie-monstra-i-napadenie-na-cheloveka.mp3', delay: 4000 } // "хриплый, резкий звук" - хрип мутанта (один раз)
                ],
                choices: [
                    { text: 'Приготовить ружьё', next: 'mutant_attack' },
                    { text: 'Кричать дедушке', next: 'mutant_attack' }
                ]
            },
            search_antibiotics: {
                title: 'Поиск антибиотиков',
                text: 'Вы твёрдо решили найти антибиотики. Город находится в 15 километрах, и дорога будет опасной, но вы должны спасти Троя. Дед недовольно качает головой, но понимает вашу решимость. Он даёт вам дополнительные патроны и советует быть осторожным.\n\nВы отправляетесь в путь через заснеженную равнину. Впереди много опасностей, но вы готовы сражаться за жизнь своего друга.',
                background: 'images/journey.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это просто описание пути, нет активной опасности
                choices: [
                    { text: 'Продолжить путь к городу', next: 'city_approach' }
                ]
            },
            city_approach: {
                title: 'Приближение к городу',
                text: 'Город появляется вдалеке. Дым поднимается из нескольких зданий, и вы видите разрушения. Улицы пустынны, но вы чувствуете, что это не значит, что они безопасны.\n\nВы ищете аптеку или больницу, где могут быть антибиотики. Первая аптека разграблена — витрины разбиты, полки пусты. Вы продолжаете поиск, стараясь не привлекать внимания.',
                background: 'images/city.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это описание города, не активная опасность
                sounds: [
                    { file: 'audio/fire_zkyuzme_.mp3', delay: 1000 }, // "Дым поднимается из нескольких зданий" - горящие здания (один раз)
                    { file: 'audio/00165-1.mp3', delay: 2500 } // "витрины разбиты" - разбитое стекло (один раз)
                ],
                choices: [
                    { text: 'Искать больницу', next: 'hospital_search' },
                    { text: 'Проверить ещё несколько аптек', next: 'pharmacy_search' }
                ]
            },
            hospital_search: {
                title: 'Больница',
                text: 'Вы находите больницу. Здание выглядит пустым и зловещим. Вы осторожно входите внутрь, ружьё наготове.\n\nКоридоры тёмные и тихие. Вы ищете аптеку больницы, где должны быть лекарства. Наконец находите её — дверь частично открыта. Внутри темно, но вы видите полки с лекарствами.\n\nАнтибиотики! Вы нашли их! Схватив несколько упаковок, вы спешите обратно.',
                background: 'images/hospital.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это просто поиск, нет активной опасности
                sounds: [
                    { file: 'audio/9bc3b5d66459ce3.mp3', delay: 1500 }, // "Вы осторожно входите внутрь" - шаги в коридоре (один раз)
                    { file: 'audio/sound_17934.mp3', delay: 3000 } // "дверь частично открыта" - скрип двери (один раз)
                ],
                choices: [
                    { text: 'Вернуться к Трою', next: 'return_to_troy' }
                ]
            },
            pharmacy_search: {
                title: 'Поиск в аптеках',
                text: 'Вы проверяете ещё несколько аптек. В одной из них вы находите то, что искали — антибиотики! Их немного, но должно хватить.\n\nВы спешно собираете лекарства, постоянно оглядываясь, и готовитесь к обратному пути.',
                background: 'images/pharmacy.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это просто поиск, нет активной опасности
                choices: [
                    { text: 'Вернуться к Трою', next: 'return_to_troy' }
                ]
            },
            return_to_troy: {
                title: 'Возвращение',
                text: 'Путь обратно кажется ещё длиннее, но вы идёте быстрее, зная, что у вас есть лекарство для Троя.\n\nНаконец вы видите дом дедушки. Вы вбегаете внутрь и видите, что Трой всё ещё дышит, хотя дыхание стало ещё слабее.\n\nДедушка быстро вводит антибиотики. Проходят томительные минуты ожидания. Трой медленно приходит в себя, его глаза открываются, и он слабо виляет хвостом.\n\n— Он выживет, — говорит дедушка с облегчением. — Ты справился, Саша.',
                background: 'images/troy_recovery.jpg',
                music: 'audio/ending.mp3',
                choices: [
                    { text: 'Обнять Троя', next: 'epilogue' },
                    { text: 'Поблагодарить дедушку', next: 'epilogue' }
                ]
            },
            check_danger: {
                title: 'Проверка окружения',
                text: 'Вы быстро оглядываетесь вокруг, проверяя, нет ли других опасностей. Никого не видно, но напряжение не спадает. Только потом вы замечаете, что Трой тяжело дышит, припав к земле.\n\n— Трой! — вы бросаетесь к нему, понимая, что произошло.',
                background: 'images/farm.jpg',
                music: 'audio/sad.mp3',
                // Убрали tensionMusic - опасность уже миновала, это момент осознания
                sounds: [
                    { file: 'audio/Zvuk_laya_sobaki_Lajj_sobaki_The_sound_of_a_dog_barking_-_Sobaka_dyshit_vysunuv_yazyk_73912973.mp3', delay: 1000 } // "Трой тяжело дышит" - тяжелое дыхание
                ],
                choices: [
                    { text: 'Подбежать к Трою', next: 'troy_injured' }
                ]
            },
            village_medicine: {
                title: 'Поиск в деревне',
                text: 'Вы решаете поискать лекарства в деревне. Дедушка остаётся с Троем, а вы идёте по заснеженным улицам, проверяя дома соседей.\n\nМногие дома пусты — жители либо уехали, либо... вы стараетесь не думать об этом. В доме соседа-фермера вы находите небольшую аптечку с обезболивающими, но антибиотиков нет.\n\nВремя идёт, а Трой нуждается в помощи.',
                background: 'images/village.jpg',
                music: 'audio/ambient_winter.mp3',
                // Убрали tensionMusic - это просто поиск, нет активной опасности
                choices: [
                    { text: 'Решить идти в город за антибиотиками', next: 'search_antibiotics' },
                    { text: 'Вернуться к Трою с тем, что нашли', next: 'stay_with_troy' }
                ]
            },
            stay_with_troy: {
                title: 'Рядом с другом',
                text: 'Вы решаете остаться с Троем. Дедушка обрабатывает раны тем, что есть, но вы видите в его глазах тревогу.\n\nТрой лежит у камина, тяжело дыша. Его глаза смотрят на вас с преданностью и болью.\n\n— Он выкарабкается, — говорит дедушка, но в его голосе нет уверенности.\n\nПроходят часы. Вы сидите рядом с Троем, гладя его по голове. Ночь проходит в тревоге и надежде.',
                background: 'images/troy_injured.jpg',
                music: 'audio/sad.mp3',
                choices: [
                    { text: 'Продолжить ухаживать за Троем', next: 'epilogue' },
                    { text: 'Решить всё-таки искать антибиотики', next: 'search_antibiotics' }
                ]
            },
            defense_strengthen: {
                title: 'Укрепление обороны',
                text: 'Вы решаете остаться дома и укрепить оборону. Вместе с дедушкой вы проверяете все окна и двери, заделываете щели, расставляете ловушки.\n\nДедушка показывает вам старые охотничьи хитрости — как правильно расставить сигналы тревоги, как укрепить входы, чтобы никто не мог незаметно проникнуть в дом.\n\n— Главное, Саша, — говорит он, — не паниковать. Паника — наш главный враг.',
                background: 'images/grandfather.jpg',
                music: 'audio/ambient_winter.mp3',
                choices: [
                    { text: 'Спросить, что делать дальше', next: 'farm_check' },
                    { text: 'Предложить проверить ферму', next: 'farm_check' }
                ]
            },
            epilogue: {
                title: 'Эпилог',
                text: 'Трой выздоравливает. Его раны заживают, и он снова встаёт на ноги, хотя движение даётся ему нелегко. Но он жив, и это главное.\n\nВаше путешествие в город показало вам, насколько опасен стал мир. Но вы также узнали, что способны на многое ради тех, кого любите.\n\nВпереди ещё много испытаний, но вы знаете — вместе вы справитесь. Вместе с дедушкой и Троем вы будете бороться за жизнь в этом новом, жестоком мире.\n\n*Конец первой части истории.*\n\n*Ваше приключение продолжается...*',
                background: 'images/epilogue.jpg',
                music: 'audio/ending.mp3',
                choices: [
                    { text: 'Начать заново', next: 'intro' }
                ]
            }
        };
    }

    getChapter(chapterId) {
        return this.story[chapterId] || this.story.intro;
    }

    makeChoice(choiceIndex) {
        const chapter = this.getChapter(this.currentChapter);
        if (chapter.choices && chapter.choices[choiceIndex]) {
            const choice = chapter.choices[choiceIndex];
            
            // Проверяем требования выбора (например, наличие предметов/флагов)
            if (choice.requiresItem && !this.hasItem(choice.requiresItem)) {
                return false; // Не можем сделать этот выбор без нужного предмета
            }
            if (choice.requiresFlags && Array.isArray(choice.requiresFlags)) {
                const allFlags = choice.requiresFlags.every(flag => this.hasFlag(flag));
                if (!allFlags) {
                    return false;
                }
            }
            
            // Применяем эффекты выбора (изменение статусов)
            if (choice.effects) {
                const hasTextStatuses =
                    (typeof choice.effects.mental === 'string' && choice.effects.mental.trim()) ||
                    (typeof choice.effects.physical === 'string' && choice.effects.physical.trim()) ||
                    (typeof choice.effects.emotional === 'string' && choice.effects.emotional.trim());
                const hasNumericStatuses =
                    typeof choice.effects.morale === 'number' ||
                    typeof choice.effects.stamina === 'number' ||
                    typeof choice.effects.emotional === 'number';

                if (hasTextStatuses) {
                    this.updateStatus(choice.effects);
                }
                if (hasNumericStatuses) {
                    this.updateStatsFromValues(choice.effects);
                }
            }
            
            // Добавляем предметы, если они есть в выборе
            if (choice.items) {
                choice.items.forEach(item => this.addToInventory(item));
            }

            // Устанавливаем сюжетные флаги
            if (choice.flags && Array.isArray(choice.flags)) {
                choice.flags.forEach(flag => this.setFlag(flag));
            }
            
            const choiceId = `${this.currentChapter}_${choiceIndex}`;
            
            this.playerData.choicesHistory.push({
                chapter: this.currentChapter,
                choice: choice.text,
                choiceId: choiceId,
                timestamp: Date.now()
            });
            
            // Записываем статистику выбора
            this.recordChoice(choiceId, choice.text);
            
            this.currentChapter = choice.next;
            this.playerData.visitedChapters.push(this.currentChapter);
            
            // Проверяем достижения после выбора
            this.checkAchievements();
            
            return true;
        }
        return false;
    }

    save(slotId = 'default') {
        // Обновляем время игры перед сохранением
        this.updatePlayTime();
        
        // Проверяем премиум для множественных сохранений
        if (slotId !== 'default' && !this.isPremiumFeatureAvailable('unlimitedSaves')) {
            return false; // Только одно сохранение без премиума
        }
        
        const data = {
            currentChapter: this.currentChapter,
            playerData: this.playerData,
            achievements: Object.keys(this.achievements).reduce((acc, key) => {
                acc[key] = this.achievements[key].unlocked;
                return acc;
            }, {}),
            weather: this.weather,
            timeOfDay: this.timeOfDay,
            gameStats: this.gameStats,
            timestamp: Date.now()
        };
        
        const saveKey = slotId === 'default' ? 'pandemic_game_save' : `pandemic_game_save_${slotId}`;
        localStorage.setItem(saveKey, JSON.stringify(data));
        
        // Сохраняем список слотов для премиум-пользователей
        if (this.isPremiumFeatureAvailable('unlimitedSaves')) {
            const slots = this.getSaveSlots();
            if (!slots.includes(slotId)) {
                slots.push(slotId);
                localStorage.setItem('pandemic_game_save_slots', JSON.stringify(slots));
            }
        }
        
        return true;
    }
    
    getSaveSlots() {
        const saved = localStorage.getItem('pandemic_game_save_slots');
        if (saved) {
            try {
                return JSON.parse(saved);
            } catch (e) {
                return ['default'];
            }
        }
        return ['default'];
    }
    
    load(slotId = 'default') {
        const saveKey = slotId === 'default' ? 'pandemic_game_save' : `pandemic_game_save_${slotId}`;
        const saved = localStorage.getItem(saveKey);
        if (saved) {
            try {
                const data = JSON.parse(saved);
                this.currentChapter = data.currentChapter || 'intro';
                this.playerData = {
                    ...this.playerData,
                    ...data.playerData,
                    status: data.playerData?.status || {
                        mental: 'В здравом рассудке',
                        physical: 'Бодр',
                        emotional: 'Спокоен'
                    },
                    achievements: data.playerData?.achievements || [],
                    storyFlags: data.playerData?.storyFlags || {}
                };
                
                // Восстанавливаем достижения
                if (data.achievements) {
                    Object.keys(data.achievements).forEach(key => {
                        if (this.achievements[key]) {
                            this.achievements[key].unlocked = data.achievements[key];
                        }
                    });
                }
                
                this.weather = data.weather || 'snow';
                this.timeOfDay = data.timeOfDay || 'day';
                
                if (data.gameStats) {
                    this.gameStats = { ...this.gameStats, ...data.gameStats };
                    this.gameStats.startTime = Date.now(); // Сбрасываем время начала сессии
                }

                // Проверяем достижения на основе прогресса
                this.checkAchievements();
                
                return true;
            } catch (e) {
                console.error('Ошибка загрузки сохранения:', e);
                return false;
            }
        }
        return false;
    }

    restart() {
        this.updatePlayTime(); // Сохраняем время перед рестартом
        this.gameStats.restarts++;
        this.gameStats.deaths++;
        
        this.currentChapter = 'intro';
        this.playerData = {
            visitedChapters: ['intro'],
            choicesHistory: [],
            inventory: [],
            status: {
                mental: 'В здравом рассудке',
                physical: 'Бодр',
                emotional: 'Спокоен'
            },
            achievements: [],
            storyFlags: {}
        };
        this.weather = 'snow';
        this.timeOfDay = 'day';
        this.gameStats.startTime = Date.now();
        
        // Сбрасываем все достижения
        Object.keys(this.achievements).forEach(key => {
            this.achievements[key].unlocked = false;
        });
    }
}
