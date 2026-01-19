// Главное приложение
let game;
let tg;
let previousScreen = 'main-menu-screen'; // Отслеживаем предыдущий экран для кнопки "Назад"
let inventoryVisible = false;
const SHARE_LINK = window.SHARE_LINK || 'https://t.me/your_bot';
const SHARE_TEXT = window.SHARE_TEXT || 'Попробуй квест-игру "Мор. Эпоха мёртвых".';

function isPremiumActive() {
    return Boolean(game && game.premium && game.premium.active);
}

function requirePremiumAccess() {
    if (isPremiumActive()) {
        return true;
    }
    showNotification('Доступно только в полной версии.');
    showScreen('premium-screen');
    return false;
}
const PAYMENTS_API_BASE = window.PAYMENTS_API_BASE || 'http://localhost:9000';
const PENDING_PAYMENT_KEY = 'pandemic_game_pending_payment';
const PREMIUM_FEATURES = {
    unlimitedSaves: true,
    exclusiveChapters: true,
    removeAds: true,
    prioritySupport: true,
    exclusiveSkins: true,
    extendedStats: true
};

function getTelegramUserId() {
    if (tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id) {
        return tg.initDataUnsafe.user.id;
    }
    return null;
}

function savePendingPayment(payment) {
    localStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(payment));
}

function getPendingPayment() {
    const raw = localStorage.getItem(PENDING_PAYMENT_KEY);
    if (!raw) {
        return null;
    }
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function clearPendingPayment() {
    localStorage.removeItem(PENDING_PAYMENT_KEY);
}

function openPaymentUrl(url) {
    if (tg && tg.openLink) {
        try {
            tg.openLink(url);
            return;
        } catch (e) {
            // fallback below
        }
    }
    window.location.href = url;
}

async function syncPremiumStatus() {
    const userId = getTelegramUserId();
    if (!userId) {
        return;
    }
    try {
        const response = await fetch(`${PAYMENTS_API_BASE}/api/premium/status?user_id=${encodeURIComponent(userId)}`);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (data.active && game) {
            game.activatePremium(PREMIUM_FEATURES);
        }
    } catch (e) {
        // Тихо игнорируем сетевые ошибки
    }
}

async function checkPendingPaymentStatus() {
    const pending = getPendingPayment();
    if (!pending || !pending.payment_id) {
        return;
    }
    try {
        const response = await fetch(`${PAYMENTS_API_BASE}/api/payments/status?payment_id=${encodeURIComponent(pending.payment_id)}`);
        if (!response.ok) {
            return;
        }
        const data = await response.json();
        if (data.paid && game) {
            game.activatePremium(PREMIUM_FEATURES);
            clearPendingPayment();
            showNotification('Оплата подтверждена! Полная версия активирована.');
        }
    } catch (e) {
        // Оставляем оплату в ожидании
    }
}

// Инициализация приложения
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация Telegram WebApp
    tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    // Устанавливаем тему Telegram (тёмную)
    if (tg) {
        tg.setHeaderColor('#1a1a1a');
        tg.setBackgroundColor('#0f0f0f');
    }
    
    // Инициализация игры
    game = new Game();

    // Синхронизация премиум-статуса с сервером оплаты
    syncPremiumStatus();
    checkPendingPaymentStatus();
    
    // Загрузка настроек
    loadSettings();
    
    // Показываем главное меню при входе
    showScreen('main-menu-screen');
    
    // Запускаем музыку меню
    startMenuMusic();
    
    // Обработчик для первого взаимодействия пользователя (для запуска музыки, если автозапуск заблокирован)
    // Этот обработчик добавлен для дополнительной надежности, основной запуск через startMenuMusic
    const handleFirstInteraction = (e) => {
        const menuMusic = document.getElementById('menu-music');
        if (menuMusic && menuMusic.paused) {
            menuMusic.play().catch(e => {
                console.log('Не удалось запустить музыку меню при первом взаимодействии:', e);
            });
        }
        // Удаляем обработчики после первого взаимодействия
        document.removeEventListener('click', handleFirstInteraction, true);
        document.removeEventListener('touchstart', handleFirstInteraction, true);
        document.removeEventListener('mousedown', handleFirstInteraction, true);
        document.removeEventListener('keydown', handleFirstInteraction, true);
    };
    
    // Добавляем обработчики для первого взаимодействия (используем capture phase)
    document.addEventListener('click', handleFirstInteraction, { once: true, capture: true });
    document.addEventListener('touchstart', handleFirstInteraction, { once: true, capture: true });
    document.addEventListener('mousedown', handleFirstInteraction, { once: true, capture: true });
    document.addEventListener('keydown', handleFirstInteraction, { once: true, capture: true });
    
    // Настройка обработчиков
    setupEventHandlers();
    
    // Настройка меню
    setupMenu();
    
    // Добавляем звук клика ко всем кнопкам и интерактивным элементам
    setupClickSounds();
    
    // Регистрируем Service Worker для офлайн-режима
    registerServiceWorker();
    
    // Создаем панель статусов при инициализации
    createStatusPanel();
    
    // Инициализация панели статусов
    updateStatusDisplay();
    
});

// Регистрация Service Worker
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/service-worker.js')
                .then((registration) => {
                    console.log('Service Worker зарегистрирован:', registration.scope);
                    
                    // Проверяем обновления Service Worker каждые 60 секунд
                    setInterval(() => {
                        registration.update();
                    }, 60000);
                    
                    // Принудительно обновляем при активации нового Service Worker
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'activated') {
                                console.log('Новый Service Worker активирован. Обновляем страницу...');
                                // Очищаем кэш и перезагружаем страницу
                                clearAllCaches().then(() => {
                                    window.location.reload();
                                });
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.log('Ошибка регистрации Service Worker:', error);
                });
        });
    }
}

// Функция для очистки всех кэшей
async function clearAllCaches() {
    if ('caches' in window) {
        try {
            const cacheNames = await caches.keys();
            await Promise.all(
                cacheNames.map(cacheName => {
                    console.log('Очистка кэша:', cacheName);
                    return caches.delete(cacheName);
                })
            );
            console.log('Все кэши очищены');
            return true;
        } catch (error) {
            console.error('Ошибка при очистке кэшей:', error);
            return false;
        }
    }
    return false;
}

// Функция для принудительного обновления (можно вызвать из консоли или добавить в настройки)
window.forceUpdate = async function() {
    if (confirm('Принудительно обновить игру? Это очистит кэш и перезагрузит страницу.')) {
        console.log('Начинаем принудительное обновление...');
        await clearAllCaches();
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('Service Worker отменен');
        }
        console.log('Перезагружаем страницу...');
        window.location.reload(true);
    }
};

// Экспортируем функцию очистки кэша глобально
window.clearAllCaches = clearAllCaches;

// Добавляем алиасы для удобства (на случай опечаток)
window.forceupdate = window.forceUpdate;
window.forcsUpdate = window.forceUpdate;
window.forcsupdate = window.forceUpdate;

// Добавляем подсказку в консоль при загрузке
console.log('%c💡 Подсказка: Используйте forceUpdate() для принудительного обновления игры', 'color: #4CAF50; font-weight: bold;');
console.log('Доступные функции: forceUpdate(), clearAllCaches()');

// Универсальная функция очистки кэша (работает даже если основной код не загрузился)
window.clearCacheNow = async function() {
    console.log('Очистка кэша...');
    try {
        // Очищаем все кэши
        if ('caches' in window) {
            const cacheNames = await caches.keys();
            console.log('Найдено кэшей:', cacheNames.length);
            await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
            console.log('✅ Все кэши очищены');
        }
        
        // Отменяем Service Worker
        if ('serviceWorker' in navigator) {
            const registrations = await navigator.serviceWorker.getRegistrations();
            console.log('Найдено Service Workers:', registrations.length);
            await Promise.all(registrations.map(reg => reg.unregister()));
            console.log('✅ Service Workers отменены');
        }
        
        console.log('🔄 Перезагружаем страницу с очисткой кэша...');
        // Принудительная перезагрузка с очисткой кэша
        window.location.href = window.location.href + (window.location.href.includes('?') ? '&' : '?') + '_nocache=' + Date.now();
    } catch (error) {
        console.error('Ошибка при очистке кэша:', error);
        alert('Ошибка при очистке кэша. Попробуйте: Ctrl+Shift+R для жесткой перезагрузки');
    }
};

console.log('%c⚡ Быстрая очистка: clearCacheNow()', 'color: #2196F3; font-weight: bold;');

// Обработчик для подсказок при опечатках в консоли
window.addEventListener('error', (event) => {
    if (event.message && event.message.includes('is not defined')) {
        const funcName = event.message.match(/(\w+) is not defined/)?.[1];
        if (funcName && funcName.toLowerCase().includes('force') || funcName.toLowerCase().includes('update')) {
            console.warn(`%c⚠️ Возможно, вы имели в виду forceUpdate()?`, 'color: #FF9800; font-weight: bold;');
            console.log('Попробуйте: forceUpdate()');
        }
    }
});

function setupEventHandlers() {
    // Кнопки выбора
    const choicesContainer = document.getElementById('choices-container');
    if (choicesContainer) {
        choicesContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('choice-btn')) {
                const index = parseInt(e.target.dataset.index);
                handleChoice(index);
            }
        });
    }
    
    // Кнопка меню
    const menuBtn = document.getElementById('menu-btn');
    if (menuBtn) {
        // Фиксируем позицию кнопки ПЕРЕД добавлением обработчика
        menuBtn.style.setProperty('transform', 'none', 'important');
        menuBtn.style.setProperty('translate', 'none', 'important');
        menuBtn.style.setProperty('position', 'relative', 'important');
        menuBtn.style.setProperty('top', '0', 'important');
        menuBtn.style.setProperty('left', '0', 'important');
        menuBtn.style.setProperty('margin', '0', 'important');
        
        menuBtn.addEventListener('mousedown', function(e) {
            e.preventDefault();
            // Фиксируем ДО клика
            this.style.setProperty('transform', 'none', 'important');
            this.style.setProperty('translate', 'none', 'important');
            this.style.setProperty('scale', 'none', 'important');
            this.style.setProperty('position', 'relative', 'important');
            this.style.setProperty('top', '0', 'important');
            this.style.setProperty('left', '0', 'important');
        });
        
        menuBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            
            // МГНОВЕННО фиксируем позицию при клике - ДО ВСЕГО
            const btn = this;
            btn.style.setProperty('transform', 'none', 'important');
            btn.style.setProperty('translate', 'none', 'important');
            btn.style.setProperty('scale', 'none', 'important');
            btn.style.setProperty('rotate', 'none', 'important');
            btn.style.setProperty('position', 'relative', 'important');
            btn.style.setProperty('top', '0', 'important');
            btn.style.setProperty('left', '0', 'important');
            btn.style.setProperty('right', 'auto', 'important');
            btn.style.setProperty('bottom', 'auto', 'important');
            btn.style.setProperty('margin', '0', 'important');
            btn.style.setProperty('padding', '0', 'important');
            btn.style.setProperty('width', '55px', 'important');
            btn.style.setProperty('height', '55px', 'important');
            
            toggleMenu();
            
            // Фиксируем несколько раз для гарантии
            requestAnimationFrame(() => {
                btn.style.setProperty('transform', 'none', 'important');
                btn.style.setProperty('position', 'relative', 'important');
                btn.style.setProperty('top', '0', 'important');
                btn.style.setProperty('left', '0', 'important');
            });
            
            setTimeout(() => {
                btn.style.setProperty('transform', 'none', 'important');
                btn.style.setProperty('translate', 'none', 'important');
                btn.style.setProperty('position', 'relative', 'important');
                btn.style.setProperty('top', '0', 'important');
                btn.style.setProperty('left', '0', 'important');
            }, 0);
            
            setTimeout(() => {
                btn.style.setProperty('transform', 'none', 'important');
                btn.style.setProperty('position', 'relative', 'important');
                btn.style.setProperty('top', '0', 'important');
                btn.style.setProperty('left', '0', 'important');
            }, 10);
        });
        
        // Фиксируем при любом событии, которое может сдвинуть кнопку
        ['touchstart', 'touchend', 'mouseup', 'mouseleave'].forEach(eventType => {
            menuBtn.addEventListener(eventType, function() {
                this.style.setProperty('transform', 'none', 'important');
                this.style.setProperty('position', 'relative', 'important');
                this.style.setProperty('top', '0', 'important');
                this.style.setProperty('left', '0', 'important');
            });
        });
    }
    
    // Пункты меню (с проверкой существования элементов)
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            if (!requirePremiumAccess()) {
                return;
            }
            showSaveModal();
            toggleMenu();
        });
    }
    
    const loadBtn = document.getElementById('load-btn');
    if (loadBtn) {
        loadBtn.addEventListener('click', () => {
            if (!requirePremiumAccess()) {
                return;
            }
            showLoadModal();
            toggleMenu();
        });
    }
    
    const achievementsBtn = document.getElementById('achievements-btn');
    if (achievementsBtn) {
        achievementsBtn.addEventListener('click', () => {
            if (!requirePremiumAccess()) {
                return;
            }
            showAchievementsModal();
            toggleMenu();
        });
    }
    
    const inventoryBtn = document.getElementById('inventory-btn');
    if (inventoryBtn) {
        inventoryBtn.addEventListener('click', () => {
            if (!requirePremiumAccess()) {
                return;
            }
            toggleInventory();
            toggleMenu();
        });
    }
    
    const inventoryIndicator = document.getElementById('inventory-indicator');
    if (inventoryIndicator) {
        inventoryIndicator.addEventListener('click', (e) => {
            e.stopPropagation();
            if (!requirePremiumAccess()) {
                return;
            }
            toggleInventory();
        });
    }
    
    const statsBtn = document.getElementById('stats-btn');
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            if (!requirePremiumAccess()) {
                return;
            }
            showStatsModal();
            toggleMenu();
        });
    }
    
    // Кнопка статусов в левом верхнем углу
    const statusBtn = document.getElementById('status-btn');
    if (statusBtn) {
        statusBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleStatusPanel();
        });
    }
    
    // Закрытие панели статусов при клике вне её
    document.addEventListener('click', (e) => {
        const statusPanel = document.getElementById('status-panel');
        const statusBtn = document.getElementById('status-btn');
        if (statusPanel && statusBtn && 
            !statusPanel.contains(e.target) && 
            !statusBtn.contains(e.target) &&
            statusPanel.classList.contains('active')) {
            statusPanel.classList.remove('active');
        }
    });
    
    const settingsBtn = document.getElementById('settings-btn');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            previousScreen = 'main-screen'; // Сохраняем, что пришли из игры
            showScreen('settings-screen');
            toggleMenu();
        });
    }
    
    const restartBtn = document.getElementById('restart-btn');
    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (confirm('Начать игру заново? Весь прогресс будет потерян.')) {
                // Запускаем музыку, если еще не играет
                startBackgroundMusic();
                game.restart();
                showChapter(game.currentChapter);
                toggleMenu();
            }
        });
    }
    
    // Главное меню при входе
    const continueMenuBtn = document.getElementById('continue-menu-btn');
    if (continueMenuBtn) {
        continueMenuBtn.addEventListener('click', () => {
            // Запускаем fade out эффект
            fadeToGame();
        });
    }
    
    const newGameMenuBtn = document.getElementById('new-game-menu-btn');
    if (newGameMenuBtn) {
        newGameMenuBtn.addEventListener('click', () => {
            // Запускаем новую игру
            if (confirm('Начать новую игру? Текущий прогресс будет потерян.')) {
                fadeToGame(true); // true означает новую игру
            }
        });
    }
    
    const loadMenuBtn = document.getElementById('load-menu-btn');
    if (loadMenuBtn) {
        loadMenuBtn.addEventListener('click', () => {
            // "ЗАГРУЗИТЬ" открывает модальное окно загрузки
            showLoadModal();
        });
    }
    
    const recommendBtn = document.getElementById('recommend-btn');
    if (recommendBtn) {
        recommendBtn.addEventListener('click', () => {
            // Поделиться ботом через Telegram WebApp API
            shareBot();
        });
    }
    
    // Кнопка возврата в меню (в боковом меню)
    const backToMenuBtn = document.getElementById('back-to-menu-btn');
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', () => {
            toggleMenu();
            fadeToMenu();
        });
    }
    
    const settingsMenuBtn = document.getElementById('settings-menu-btn');
    if (settingsMenuBtn) {
        settingsMenuBtn.addEventListener('click', () => {
            previousScreen = 'main-menu-screen'; // Сохраняем, что пришли из главного меню
            showScreen('premium-screen');
        });
    }
    
    const backFromPremiumBtn = document.getElementById('back-from-premium-btn');
    if (backFromPremiumBtn) {
        backFromPremiumBtn.addEventListener('click', () => {
            showScreen(previousScreen || 'main-menu-screen');
        });
    }
    
    // Настройки (с проверкой существования элементов)
    const musicVolume = document.getElementById('music-volume');
    const musicVolumeValue = document.getElementById('music-volume-value');
    const soundVolume = document.getElementById('sound-volume');
    const soundVolumeValue = document.getElementById('sound-volume-value');
    const autosave = document.getElementById('autosave');
    
    if (musicVolume && musicVolumeValue) {
        musicVolume.addEventListener('input', (e) => {
            const volume = e.target.value;
            musicVolumeValue.textContent = volume + '%';
            game.settings.musicVolume = parseInt(volume);
            updateMusicVolume();
            saveSettings();
        });
    }
    
    if (soundVolume && soundVolumeValue) {
        soundVolume.addEventListener('input', (e) => {
            const volume = e.target.value;
            soundVolumeValue.textContent = volume + '%';
            game.settings.soundVolume = parseInt(volume);
            saveSettings();
        });
    }
    
    // Настройки звуков
    const enableMusic = document.getElementById('enable-music');
    const enableSounds = document.getElementById('enable-sounds');
    
    if (enableMusic) {
        enableMusic.addEventListener('change', (e) => {
            game.settings.enableMusic = e.target.checked;
            
            const backgroundMusic = document.getElementById('background-music');
            const tensionMusic = document.getElementById('tension-music');
            const menuMusic = document.getElementById('menu-music');
            
            if (!e.target.checked) {
                [backgroundMusic, tensionMusic, menuMusic].forEach(track => {
                    if (track) {
                        track.pause();
                        track.currentTime = 0;
                    }
                });
            } else {
                const activeScreen = document.querySelector('.screen.active');
                if (activeScreen && activeScreen.id === 'main-menu-screen') {
                    startMenuMusic();
                } else if (activeScreen && activeScreen.id === 'main-screen') {
                    startBackgroundMusic();
                }
            }
            
            saveSettings();
        });
    }
    
    if (enableSounds) {
        enableSounds.addEventListener('change', (e) => {
            game.settings.enableSounds = e.target.checked;
            if (!e.target.checked) {
                stopAllSounds();
            }
            saveSettings();
        });
    }
    
    // Настройки визуальных эффектов
    const enableEffects = document.getElementById('enable-effects');
    const enableBloodEffect = document.getElementById('enable-blood-effect');
    const enableSmokeEffect = document.getElementById('enable-smoke-effect');
    const enableLightingEffect = document.getElementById('enable-lighting-effect');
    const enableFlashEffect = document.getElementById('enable-flash-effect');
    
    if (enableEffects) {
        enableEffects.addEventListener('change', (e) => {
            game.settings.enableEffects = e.target.checked;
            refreshCurrentVisualEffects();
            saveSettings();
        });
    }
    
    if (enableBloodEffect) {
        enableBloodEffect.addEventListener('change', (e) => {
            game.settings.enableBloodEffect = e.target.checked;
            refreshCurrentVisualEffects();
            saveSettings();
        });
    }
    
    if (enableSmokeEffect) {
        enableSmokeEffect.addEventListener('change', (e) => {
            game.settings.enableSmokeEffect = e.target.checked;
            refreshCurrentVisualEffects();
            saveSettings();
        });
    }
    
    if (enableLightingEffect) {
        enableLightingEffect.addEventListener('change', (e) => {
            game.settings.enableLightingEffect = e.target.checked;
            if (!e.target.checked) {
                removeLightingEffect();
            }
            refreshCurrentVisualEffects();
            saveSettings();
        });
    }
    
    if (enableFlashEffect) {
        enableFlashEffect.addEventListener('change', (e) => {
            game.settings.enableFlashEffect = e.target.checked;
            refreshCurrentVisualEffects();
            saveSettings();
        });
    }
    
    if (autosave) {
        autosave.addEventListener('change', (e) => {
            game.settings.autosave = e.target.checked;
            saveSettings();
        });
    }
    
    // Новые настройки
    const autoScroll = document.getElementById('auto-scroll');
    const scrollSpeed = document.getElementById('scroll-speed');
    const scrollSpeedValue = document.getElementById('scroll-speed-value');
    const fontSize = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const contrast = document.getElementById('contrast');
    const accessibilityMode = document.getElementById('accessibility-mode');
    const soundSubtitles = document.getElementById('sound-subtitles');
    
    if (autoScroll) {
        autoScroll.addEventListener('change', (e) => {
            game.settings.autoScroll = e.target.checked;
            saveSettings();
        });
    }
    
    if (scrollSpeed && scrollSpeedValue) {
        scrollSpeed.addEventListener('input', (e) => {
            const speed = e.target.value;
            scrollSpeedValue.textContent = speed;
            game.settings.scrollSpeed = parseInt(speed);
            saveSettings();
        });
    }
    
    if (fontSize && fontSizeValue) {
        fontSize.addEventListener('input', (e) => {
            const size = e.target.value;
            fontSizeValue.textContent = size + 'px';
            game.settings.fontSize = parseInt(size);
            applyFontSize(size);
            saveSettings();
        });
    }
    
    if (contrast) {
        contrast.addEventListener('change', (e) => {
            game.settings.contrast = e.target.value;
            applyContrast(e.target.value);
            saveSettings();
        });
    }
    
    if (accessibilityMode) {
        accessibilityMode.addEventListener('change', (e) => {
            game.settings.accessibilityMode = e.target.checked;
            applyAccessibilityMode(e.target.checked);
            saveSettings();
        });
    }
    
    if (soundSubtitles) {
        soundSubtitles.addEventListener('change', (e) => {
            game.settings.soundSubtitles = e.target.checked;
            saveSettings();
        });
    }
    
    // Кнопка очистки кэша
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
        clearCacheBtn.addEventListener('click', async () => {
            if (confirm('Очистить кэш и обновить игру? Страница будет перезагружена.')) {
                clearCacheBtn.disabled = true;
                clearCacheBtn.textContent = 'Очистка...';
                
                await clearAllCaches();
                
                // Отменяем регистрацию Service Worker
                if ('serviceWorker' in navigator) {
                    try {
                        const registrations = await navigator.serviceWorker.getRegistrations();
                        await Promise.all(registrations.map(reg => reg.unregister()));
                        console.log('Service Worker отменен');
                    } catch (error) {
                        console.error('Ошибка при отмене Service Worker:', error);
                    }
                }
                
                // Перезагружаем страницу с очисткой кэша
                window.location.reload(true);
            }
        });
    }
}

function applyFontSize(size) {
    const chapterText = document.getElementById('chapter-text');
    if (chapterText) {
        chapterText.style.fontSize = size + 'px';
    }
}

function applyContrast(contrastLevel) {
    const body = document.body;
    if (!body) return;
    
    body.classList.remove('contrast-normal', 'contrast-high', 'contrast-very-high');
    body.classList.add('contrast-' + contrastLevel);
}

function applyAccessibilityMode(enabled) {
    const body = document.body;
    if (!body) return;
    
    if (enabled) {
        body.classList.add('accessibility-mode');
        // Увеличиваем размеры кнопок и элементов
        document.querySelectorAll('.choice-btn, .menu-item').forEach(el => {
            el.style.minHeight = '60px';
            el.style.fontSize = '18px';
        });
    } else {
        body.classList.remove('accessibility-mode');
        // Возвращаем обычные размеры
        document.querySelectorAll('.choice-btn, .menu-item').forEach(el => {
            el.style.minHeight = '';
            el.style.fontSize = '';
        });
    }
}

function setupMenu() {
    // Переключение экранов
    const menuScreenBtn = document.getElementById('menu-screen-btn');
    if (menuScreenBtn) {
        menuScreenBtn.addEventListener('click', () => {
            showScreen('menu-screen');
        });
    }
    
    const backToGameBtn = document.getElementById('back-to-game-btn');
    if (backToGameBtn) {
        backToGameBtn.addEventListener('click', () => {
            // Запускаем музыку, если еще не играет
            startBackgroundMusic();
            showScreen('main-screen');
        });
    }
    
    const settingsScreenBtn = document.getElementById('settings-screen-btn');
    if (settingsScreenBtn) {
        settingsScreenBtn.addEventListener('click', () => {
            previousScreen = 'menu-screen'; // Сохраняем, что пришли из меню игры
            showScreen('settings-screen');
        });
    }
    
    // Обработчик для кнопки "Назад" в настройках
    const backFromSettingsBtn = document.getElementById('back-from-settings-btn');
    if (backFromSettingsBtn) {
        // Используем onclick вместо addEventListener для простоты (перезаписывает предыдущие)
        backFromSettingsBtn.onclick = function(e) {
            e.preventDefault();
            e.stopPropagation();
            // Возвращаемся на предыдущий экран
            const targetScreen = previousScreen || 'main-menu-screen';
            showScreen(targetScreen);
            return false;
        };
    }
    
    const continueGameBtn = document.getElementById('continue-game-btn');
    if (continueGameBtn) {
        continueGameBtn.addEventListener('click', () => {
            if (game.load()) {
                showChapter(game.currentChapter);
                showScreen('main-screen');
            } else {
                showNotification('Сохранение не найдено. Начните новую игру.');
            }
        });
    }
    
    const newGameBtn = document.getElementById('new-game-btn');
    if (newGameBtn) {
        newGameBtn.addEventListener('click', () => {
            if (confirm('Начать новую игру? Текущий прогресс будет потерян.')) {
                // Запускаем музыку, если еще не играет
                startBackgroundMusic();
                game.restart();
                showChapter(game.currentChapter);
                showScreen('main-screen');
            }
        });
    }
}

function fadeToGame(startNew = false) {
    const mainMenuScreen = document.getElementById('main-menu-screen');
    if (!mainMenuScreen) return;
    
    // Создаем элемент затемнения для плавного перехода
    let darkOverlay = document.getElementById('transition-overlay');
    if (!darkOverlay) {
        darkOverlay = document.createElement('div');
        darkOverlay.id = 'transition-overlay';
        darkOverlay.className = 'transition-overlay';
        document.body.appendChild(darkOverlay);
    }
    
    // Принудительно сбрасываем все классы и стили
    darkOverlay.classList.remove('fade-in-dark', 'fade-out-dark');
    darkOverlay.style.display = 'block';
    darkOverlay.style.background = 'rgba(0, 0, 0, 0)';
    
    // Небольшая задержка для начала рендеринга
    requestAnimationFrame(() => {
        // Начинаем плавное затемнение
        requestAnimationFrame(() => {
            darkOverlay.classList.add('fade-in-dark');
        });
    });
    
    // После полного затемнения (2.5 секунды) переключаемся на игровой экран
    setTimeout(() => {
        // Запускаем музыку, если еще не играет (после взаимодействия пользователя)
        startBackgroundMusic();
        
        if (startNew) {
            // Начинаем новую игру
            game.restart();
        } else {
            // Пробуем загрузить сохранение, если нет - начинаем новую игру
            if (!game.load()) {
                game.restart();
            } else {
                // Обновляем индикаторы после загрузки
                updateStatusDisplay();
                updateInventoryDisplay();
                updateChapterProgress();
                
                // Восстанавливаем погоду и время суток
                if (game.weather) {
                    setWeather(game.weather);
                }
                if (game.timeOfDay) {
                    setTimeOfDay(game.timeOfDay);
                }
            }
        }
        
        // Обновляем индикаторы для новой игры
        updateStatusDisplay();
        updateInventoryDisplay();
        updateChapterProgress();
        
        showChapter(game.currentChapter);
        showScreen('main-screen');
        
        // Плавно убираем затемнение (еще 1.5 секунды)
        setTimeout(() => {
            darkOverlay.classList.remove('fade-in-dark');
            darkOverlay.classList.add('fade-out-dark');
            
            setTimeout(() => {
                darkOverlay.style.display = 'none';
                darkOverlay.classList.remove('fade-out-dark');
                darkOverlay.style.background = 'rgba(0, 0, 0, 0)';
            }, 1500); // Время для fade-out
        }, 300); // Небольшая задержка перед началом fade-out
    }, 2500); // Время для полного затемнения (2.5 секунды - МЕДЛЕННО И ПЛАВНО)
}

function shareBot() {
    // Используем Telegram WebApp API для поделиться ботом
    const shareText = `${SHARE_TEXT}\n${SHARE_LINK}`;
    
    // Используем правильный API Telegram WebApp для поделиться
    if (tg && tg.shareText) {
        // Метод shareText доступен в Telegram WebApp API
        try {
            tg.shareText(shareText);
            return;
        } catch (e) {
            console.log('Ошибка shareText:', e);
        }
    }
    
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(SHARE_LINK)}&text=${encodeURIComponent(SHARE_TEXT)}`;
    if (tg && tg.openTelegramLink) {
        try {
            tg.openTelegramLink(shareUrl);
            return;
        } catch (e) {
            console.log('Ошибка openTelegramLink:', e);
        }
    }
    
    // Альтернативный способ - через openLink
    if (tg && tg.openLink) {
        try {
            tg.openLink(shareUrl);
            return;
        } catch (e) {
            console.log('Ошибка openLink:', e);
        }
    }
    
    // Fallback - используем Web Share API если доступен
    if (navigator.share) {
        navigator.share({
            title: 'Мор. Эпоха мёртвых',
            text: SHARE_TEXT,
            url: SHARE_LINK
        }).catch(err => {
            console.log('Ошибка при попытке поделиться:', err);
            // Если не получилось, пробуем скопировать в буфер
            copyToClipboard(shareText);
        });
    } else {
        // Последний вариант - копируем текст в буфер обмена
        copyToClipboard(shareText);
    }
}

function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            showNotification('Текст скопирован в буфер обмена! Поделитесь им вручную.');
        }).catch(err => {
            console.log('Ошибка при копировании:', err);
            showNotification('Поделитесь вручную: ' + text);
        });
    } else {
        // Старый способ для старых браузеров
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification('Текст скопирован в буфер обмена!');
        } catch (err) {
            showNotification('Поделитесь вручную: ' + text);
        }
        document.body.removeChild(textArea);
    }
}

function fadeToMenu() {
    const mainScreen = document.getElementById('main-screen');
    if (!mainScreen) return;
    
    // Останавливаем все звуки из глав перед переходом в меню
    stopAllSounds();
    
    // Добавляем класс для fade out
    mainScreen.classList.add('fade-out');
    
    // После завершения анимации переключаемся на меню
    setTimeout(() => {
        showScreen('main-menu-screen');
        
        // Убираем класс fade-out для следующего использования
        mainScreen.classList.remove('fade-out');
    }, 500); // Длительность анимации
}

function showScreen(screenId) {
    // Сохраняем текущий активный экран как предыдущий (только если он существует и не является целевым экраном)
    if (screenId !== 'settings-screen') {
        const currentActiveScreen = document.querySelector('.screen.active');
        if (currentActiveScreen && currentActiveScreen.id && currentActiveScreen.id !== screenId) {
            previousScreen = currentActiveScreen.id;
        }
    }
    
    // Закрываем все модальные окна при смене экрана
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Закрываем меню игры, если открыто
    const menuPanel = document.getElementById('menu-panel');
    if (menuPanel && menuPanel.classList.contains('active')) {
        menuPanel.classList.remove('active');
    }
    
    // Переключаем музыку в зависимости от экрана
    if (screenId === 'main-menu-screen') {
        // В главном меню - играет музыка меню
        stopGameMusic();
        stopAllSounds(); // Останавливаем все звуки из глав при переходе в меню
        startMenuMusic();
    } else if (screenId === 'main-screen') {
        // В игре - играет игровая музыка
        stopMenuMusic();
        startBackgroundMusic();
        // Обновляем статусы при показе игрового экрана
        setTimeout(() => {
            updateStatusDisplay();
        }, 100);
    } else {
        // На других экранах останавливаем музыку меню, но не игровую
        stopMenuMusic();
    }
    
    // Переключаем экраны
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
        screen.classList.remove('fade-out');
    });
    
    const screen = document.getElementById(screenId);
    if (screen) {
        screen.classList.add('active');
    }
}

function showChapter(chapterId) {
    const chapter = game.getChapter(chapterId);
    
    // Обновляем заголовок
    const chapterTitle = document.getElementById('chapter-title');
    if (chapterTitle) {
        chapterTitle.textContent = chapter.title;
    }
    
    // Обновляем текст с typewriter эффектом (если включен)
    const chapterText = document.getElementById('chapter-text');
    if (chapterText) {
        if (game.settings.autoScroll && game.settings.scrollSpeed > 0) {
            typewriterText(chapterText, chapter.text, game.settings.scrollSpeed);
        } else {
            chapterText.textContent = chapter.text;
        }
        // Прокручиваем текст наверх при переходе на новую главу
        chapterText.scrollTop = 0;
    }
    
    // Обновляем фон
    const bgImage = document.getElementById('background-image');
    if (bgImage) {
        if (chapter.background) {
            bgImage.style.backgroundImage = `url(${chapter.background})`;
        } else {
            bgImage.style.backgroundImage = 'url(images/default.jpg)';
        }
    }
    
    // Устанавливаем погоду и время суток из главы (если указаны)
    if (chapter.weather) {
        setWeather(chapter.weather);
    }
    if (chapter.timeOfDay) {
        setTimeOfDay(chapter.timeOfDay);
    }
    
    // Эффекты экрана для важных событий
    if (chapter.screenEffect) {
        if (chapter.screenEffect === 'shake') {
            triggerScreenShake();
        } else if (chapter.screenEffect === 'fade') {
            triggerScreenFade();
        }
    }
    
    // Вибрация для важных событий
    if (chapter.vibrate) {
        vibrate(chapter.vibrate);
    }
    
    // Переключение музыки: тревожная музыка для напряженных моментов, основная для спокойных
    switchMusicForChapter(chapter);
    
    // Воспроизводим звуковые эффекты главы
    if (chapter.sounds && Array.isArray(chapter.sounds)) {
        playSounds(chapter.sounds, chapter.text);
    }
    
    // Визуальные эффекты для глав
    applyVisualEffects(chapter, chapterId);
    
    // Обновляем кнопки выбора
    const choicesContainer = document.getElementById('choices-container');
    if (choicesContainer) {
        choicesContainer.innerHTML = '';
        
        if (chapter.choices && chapter.choices.length > 0) {
            let choices = chapter.choices;

            if (
                choices.length === 1 &&
                choices[0].text &&
                choices[0].text.toLowerCase().includes('продолж') &&
                !chapter.__autoExpandedChoices
            ) {
                choices = [
                    choices[0],
                    {
                        text: 'Осмотреться',
                        next: choices[0].next,
                        effects: { emotional: 'Спокоен' }
                    }
                ];
                chapter.choices = choices;
                chapter.__autoExpandedChoices = true;
            }

            let visibleIndex = 0;
            choices.forEach((choice, index) => {
                const requiresItem = choice.requiresItem && !game.hasItem(choice.requiresItem);
                const requiresFlags = Array.isArray(choice.requiresFlags) &&
                    !choice.requiresFlags.every(flag => game.hasFlag(flag));
                
                if (requiresItem || requiresFlags) {
                    return;
                }
                
                visibleIndex += 1;
                const btn = document.createElement('button');
                btn.className = 'choice-btn';

                let choiceText = `${visibleIndex}. ${choice.text}`;
                btn.textContent = choiceText;
                btn.dataset.index = index;
                choicesContainer.appendChild(btn);
            });
        } else {
            const btn = document.createElement('button');
            btn.className = 'choice-btn';
            btn.textContent = 'Продолжить →';
            btn.onclick = () => showChapter('intro');
            choicesContainer.appendChild(btn);
        }
        
        // Прокручиваем кнопки выбора наверх при переходе на новую главу
        choicesContainer.scrollTop = 0;
    }
    
    // Обновляем индикаторы
    updateStatusDisplay();
    updateInventoryDisplay();
    
    // Настраиваем отслеживание прогресса чтения
    setTimeout(() => {
        setupChapterProgressTracking();
        updateChapterProgress();
    }, 100);
    
    // Автосохранение
    if (game.settings.autosave) {
        game.save();
    }
}

function handleChoice(choiceIndex) {
    // Звук клика воспроизводится автоматически через setupClickSounds()
    
    // Запускаем музыку, если еще не играет (после взаимодействия пользователя)
    ensureMusicPlaying();
    
    if (game.makeChoice(choiceIndex)) {
        // Обновляем индикаторы после выбора
        updateStatusDisplay();
        updateInventoryDisplay();
        updateChapterProgress();
        
        showChapter(game.currentChapter);
    } else {
        showNotification('Ошибка выбора или недостаточно предметов');
    }
}

function toggleMenu() {
    const menuPanel = document.getElementById('menu-panel');
    const menuBtn = document.getElementById('menu-btn');
    const gameMenu = document.getElementById('game-menu');
    
    // АБСОЛЮТНО фиксируем кнопку ДО открытия меню - она НЕ ДОЛЖНА двигаться
    if (menuBtn) {
        // Сохраняем ТОЧНУЮ позицию кнопки ДО любых изменений
        const btnRect = menuBtn.getBoundingClientRect();
        const fixedTop = btnRect.top;
        const fixedRight = window.innerWidth - btnRect.right;
        
        // СРАЗУ фиксируем все позиционные свойства - ДО toggle
        menuBtn.style.setProperty('transform', 'none', 'important');
        menuBtn.style.setProperty('translate', 'none', 'important');
        menuBtn.style.setProperty('scale', 'none', 'important');
        menuBtn.style.setProperty('rotate', 'none', 'important');
        menuBtn.style.setProperty('position', 'relative', 'important');
        menuBtn.style.setProperty('top', '0', 'important');
        menuBtn.style.setProperty('left', '0', 'important');
        menuBtn.style.setProperty('right', 'auto', 'important');
        menuBtn.style.setProperty('bottom', 'auto', 'important');
        menuBtn.style.setProperty('margin', '0', 'important');
        menuBtn.style.setProperty('padding', '0', 'important');
        menuBtn.style.setProperty('width', '55px', 'important');
        menuBtn.style.setProperty('height', '55px', 'important');
        menuBtn.style.setProperty('box-sizing', 'border-box', 'important');
    }
    
    // Фиксируем контейнер меню - он не должен двигаться
    if (gameMenu) {
        gameMenu.style.setProperty('position', 'fixed', 'important');
        gameMenu.style.setProperty('top', '20px', 'important');
        gameMenu.style.setProperty('right', '20px', 'important');
        gameMenu.style.setProperty('transform', 'none', 'important');
        gameMenu.style.setProperty('translate', 'none', 'important');
        gameMenu.style.setProperty('scale', 'none', 'important');
        gameMenu.style.setProperty('margin', '0', 'important');
        gameMenu.style.setProperty('padding', '0', 'important');
        gameMenu.style.setProperty('width', 'auto', 'important');
        gameMenu.style.setProperty('height', 'auto', 'important');
    }
    
    // СНАЧАЛА фиксируем позицию меню-панели, ПОТОМ открываем - чтобы не влиять на layout
    if (menuPanel) {
        // Фиксируем ВСЕ свойства ДО toggle
        menuPanel.style.setProperty('position', 'fixed', 'important');
        menuPanel.style.setProperty('top', '80px', 'important');
        menuPanel.style.setProperty('right', '20px', 'important');
        menuPanel.style.setProperty('transform', 'none', 'important');
        menuPanel.style.setProperty('translate', 'none', 'important');
        menuPanel.style.setProperty('margin', '0', 'important');
        menuPanel.style.setProperty('width', 'auto', 'important');
        menuPanel.style.setProperty('height', 'auto', 'important');
        
        // ТОЛЬКО ПОСЛЕ фиксации переключаем класс
        menuPanel.classList.toggle('active');
        
        // Еще раз фиксируем ПОСЛЕ toggle - на всякий случай
        requestAnimationFrame(() => {
            menuPanel.style.setProperty('position', 'fixed', 'important');
            menuPanel.style.setProperty('top', '80px', 'important');
            menuPanel.style.setProperty('right', '20px', 'important');
            menuPanel.style.setProperty('transform', 'none', 'important');
        });
    }
    
    // МНОЖЕСТВЕННАЯ фиксация через requestAnimationFrame и setTimeout
    requestAnimationFrame(() => {
        if (menuBtn) {
            menuBtn.style.setProperty('transform', 'none', 'important');
            menuBtn.style.setProperty('position', 'relative', 'important');
            menuBtn.style.setProperty('top', '0', 'important');
            menuBtn.style.setProperty('left', '0', 'important');
        }
        if (gameMenu) {
            gameMenu.style.setProperty('position', 'fixed', 'important');
            gameMenu.style.setProperty('top', '20px', 'important');
            gameMenu.style.setProperty('right', '20px', 'important');
            gameMenu.style.setProperty('transform', 'none', 'important');
        }
    });
    
    setTimeout(() => {
        if (menuBtn) {
            menuBtn.style.setProperty('transform', 'none', 'important');
            menuBtn.style.setProperty('position', 'relative', 'important');
            menuBtn.style.setProperty('top', '0', 'important');
            menuBtn.style.setProperty('left', '0', 'important');
        }
        if (gameMenu) {
            gameMenu.style.setProperty('position', 'fixed', 'important');
            gameMenu.style.setProperty('top', '20px', 'important');
            gameMenu.style.setProperty('right', '20px', 'important');
            gameMenu.style.setProperty('transform', 'none', 'important');
        }
    }, 0);
    
    setTimeout(() => {
        if (menuBtn) {
            menuBtn.style.setProperty('transform', 'none', 'important');
            menuBtn.style.setProperty('position', 'relative', 'important');
        }
        if (gameMenu) {
            gameMenu.style.setProperty('position', 'fixed', 'important');
            gameMenu.style.setProperty('top', '20px', 'important');
            gameMenu.style.setProperty('right', '20px', 'important');
        }
    }, 50);
}

// Модальные окна
function showSaveModal() {
    createModals();
    
    // Закрываем другие модальные окна
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Обновляем содержимое модального окна сохранения
    const modalBody = document.querySelector('#save-modal .modal-body');
    if (modalBody && game) {
        if (game.isPremiumFeatureAvailable('unlimitedSaves')) {
            // Премиум: показываем список слотов
            const slots = game.getSaveSlots();
            modalBody.innerHTML = `
                <p>Выберите слот для сохранения:</p>
                <div id="save-slots-list" style="margin-top: 15px;">
                    ${slots.map((slot, index) => `
                        <button class="modal-btn" onclick="saveToSlot('${slot}')" style="width: 100%; margin-bottom: 10px;">
                            Слот ${index + 1}: ${slot === 'default' ? 'Основное сохранение' : slot}
                        </button>
                    `).join('')}
                    <button class="modal-btn modal-btn-secondary" onclick="createNewSaveSlot()" style="width: 100%;">
                        + Создать новый слот
                    </button>
                </div>
            `;
        } else {
            // Бесплатная версия: только одно сохранение
            modalBody.innerHTML = `
                <p>Игра будет сохранена в вашем браузере.</p>
                <p class="modal-note">💡 Система множественных сохранений доступна в полной версии.</p>
            `;
        }
    }
    
    const modal = document.getElementById('save-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function saveToSlot(slotId) {
    if (game.save(slotId)) {
        showNotification('Игра сохранена!');
        closeModal('save-modal');
    } else {
        showNotification('Ошибка сохранения. Проверьте премиум-статус.');
    }
}

function createNewSaveSlot() {
    const slotName = prompt('Введите название слота:');
    if (slotName && slotName.trim()) {
        saveToSlot(slotName.trim());
    }
}

window.saveToSlot = saveToSlot;
window.createNewSaveSlot = createNewSaveSlot;

function showLoadModal() {
    createModals();
    
    // Закрываем другие модальные окна
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    
    const modalBody = document.querySelector('#load-modal .modal-body');
    if (modalBody && game) {
        if (game.isPremiumFeatureAvailable('unlimitedSaves')) {
            // Премиум: показываем список всех сохранений
            const slots = game.getSaveSlots();
            const savesList = [];
            
            slots.forEach(slot => {
                const saveKey = slot === 'default' ? 'pandemic_game_save' : `pandemic_game_save_${slot}`;
                const saved = localStorage.getItem(saveKey);
                if (saved) {
                    try {
                        const data = JSON.parse(saved);
                        const date = new Date(data.timestamp);
                        const chapter = game.getChapter(data.currentChapter);
                        const chapterTitle = chapter ? chapter.title : data.currentChapter;
                        savesList.push({
                            slot: slot,
                            date: date,
                            chapter: chapterTitle
                        });
                    } catch (e) {
                        console.error('Ошибка парсинга сохранения:', e);
                    }
                }
            });
            
            if (savesList.length > 0) {
                modalBody.innerHTML = `
                    <p>Выберите сохранение для загрузки:</p>
                    <div id="load-slots-list" style="margin-top: 15px;">
                        ${savesList.map((save, index) => `
                            <button class="modal-btn" onclick="loadFromSlot('${save.slot}')" style="width: 100%; margin-bottom: 10px; text-align: left;">
                                <div style="font-weight: bold;">${save.slot === 'default' ? 'Основное сохранение' : save.slot}</div>
                                <div style="font-size: 12px; color: #999;">${save.date.toLocaleString('ru-RU')} - ${save.chapter}</div>
                            </button>
                        `).join('')}
                    </div>
                `;
            } else {
                modalBody.innerHTML = '<p style="text-align: center; color: #999;">Сохранения не найдены</p>';
            }
        } else {
            // Бесплатная версия: только одно сохранение
            const saved = localStorage.getItem('pandemic_game_save');
            const loadInfo = document.getElementById('load-info');
            const loadConfirmBtn = document.getElementById('load-confirm-btn');
            
            if (saved) {
                try {
                    const data = JSON.parse(saved);
                    const date = new Date(data.timestamp);
                    if (loadInfo) {
                        const chapter = game.getChapter(data.currentChapter);
                        const chapterTitle = chapter ? chapter.title : data.currentChapter;
                        loadInfo.textContent = `Сохранение от ${date.toLocaleString('ru-RU')}. Глава: ${chapterTitle}`;
                    }
                    if (loadConfirmBtn) {
                        loadConfirmBtn.style.display = 'block';
                    }
                } catch (e) {
                    if (loadInfo) {
                        loadInfo.textContent = 'Ошибка загрузки сохранения';
                    }
                    if (loadConfirmBtn) {
                        loadConfirmBtn.style.display = 'none';
                    }
                }
            } else {
                if (loadInfo) {
                    loadInfo.textContent = 'Сохранение не найдено';
                }
                if (loadConfirmBtn) {
                    loadConfirmBtn.style.display = 'none';
                }
            }
        }
    }
    
    const modal = document.getElementById('load-modal');
    if (modal) {
        modal.classList.add('active');
    }
}

function loadFromSlot(slotId) {
    if (game.load(slotId)) {
        // Обновляем все индикаторы после загрузки
        updateStatusDisplay();
        updateInventoryDisplay();
        updateChapterProgress();
        
        // Восстанавливаем погоду и время суток
        if (game.weather) {
            setWeather(game.weather);
        }
        if (game.timeOfDay) {
            setTimeOfDay(game.timeOfDay);
        }
        
        showChapter(game.currentChapter);
        showNotification('Игра загружена!');
        closeModal('load-modal');
        showScreen('main-screen');
    } else {
        showNotification('Ошибка загрузки сохранения');
    }
}

window.loadFromSlot = loadFromSlot;

function createModals() {
    // Проверяем, не созданы ли уже модальные окна
    if (document.getElementById('save-modal')) {
        return;
    }
    
    const modalsHTML = `
        <!-- Модальное окно сохранения -->
        <div id="save-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>💾 Сохранение игры</h2>
                    <button class="modal-close" onclick="closeModal('save-modal')">×</button>
                </div>
                <div class="modal-body">
                    <p>Игра будет сохранена в вашем браузере.</p>
                    <p class="modal-note">💡 Система сохранений доступна по платной подписке.</p>
                </div>
                <div class="modal-footer">
                    <button class="modal-btn" onclick="saveGameFromModal()">Сохранить</button>
                    <button class="modal-btn modal-btn-secondary" onclick="closeModal('save-modal')">Отмена</button>
                </div>
            </div>
        </div>

        <!-- Модальное окно загрузки -->
        <div id="load-modal" class="modal">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>📂 Загрузка игры</h2>
                    <button class="modal-close" onclick="closeModal('load-modal')">×</button>
                </div>
                <div class="modal-body">
                    <p id="load-info">Загрузка сохранения...</p>
                </div>
                <div class="modal-footer">
                    <button id="load-confirm-btn" class="modal-btn" onclick="loadGameFromModal()" style="display: none;">Загрузить</button>
                    <button class="modal-btn modal-btn-secondary" onclick="closeModal('load-modal')">Отмена</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalsHTML);
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
    }
}

// Закрытие модальных окон при клике вне их области (после создания модальных окон)
setTimeout(() => {
    document.addEventListener('click', (e) => {
        // Если клик по затемнённому фону (само модальное окно, но не его содержимое)
        const modal = e.target.closest('.modal');
        if (modal && e.target === modal) {
            modal.classList.remove('active');
        }
    });
}, 500);

function saveGameFromModal() {
    game.save();
    showNotification('Игра сохранена!');
    closeModal('save-modal');
}

function loadGameFromModal() {
    if (game.load()) {
        // Обновляем все индикаторы после загрузки
        updateStatusDisplay();
        updateInventoryDisplay();
        updateChapterProgress();
        
        // Восстанавливаем погоду и время суток
        if (game.weather) {
            setWeather(game.weather);
        }
        if (game.timeOfDay) {
            setTimeOfDay(game.timeOfDay);
        }
        
        showChapter(game.currentChapter);
        showNotification('Игра загружена!');
        closeModal('load-modal');
        showScreen('main-screen');
    } else {
        showNotification('Ошибка загрузки сохранения');
    }
}

// Глобальные функции для модальных окон (вызываются из HTML onclick)
window.closeModal = closeModal;
window.loadGameFromModal = loadGameFromModal;
window.saveGameFromModal = saveGameFromModal;

// Функция покупки премиум-версии
async function purchasePremium() {
    if (!game) {
        return;
    }

    const userId = getTelegramUserId();
    const initData = tg && tg.initData ? tg.initData : '';

    if (!userId && !initData) {
        alert('Открывайте оплату из Telegram, чтобы мы могли подтвердить пользователя.');
        return;
    }

    try {
        showNotification('Открываю оплату...');
        const response = await fetch(`${PAYMENTS_API_BASE}/api/payments/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                init_data: initData,
                plan: 'premium'
            })
        });

        if (!response.ok) {
            showNotification('Не удалось создать оплату. Попробуйте позже.');
            return;
        }

        const data = await response.json();
        if (!data.confirmation_url || !data.payment_id) {
            showNotification('Ошибка платежного сервиса. Попробуйте позже.');
            return;
        }

        savePendingPayment({
            payment_id: data.payment_id,
            created_at: Date.now()
        });

        openPaymentUrl(data.confirmation_url);
    } catch (e) {
        showNotification('Ошибка сети при создании оплаты.');
    }
}

window.purchasePremium = purchasePremium;


function playSound(soundName, options = {}) {
    try {
        // Проверяем, включены ли звуки
        if (game && game.settings && game.settings.enableSounds === false) {
            return null;
        }
        
        let soundFile;
        
        // Если передан полный путь, используем его
        if (soundName.includes('/') || soundName.includes('\\')) {
            soundFile = soundName;
        } else if (soundName === 'click') {
            soundFile = 'audio/short-click-of-a-computer-mouse.mp3';
        } else {
            soundFile = `audio/${soundName}.mp3`;
        }
        
        // Создаем новый экземпляр Audio для каждого звука (позволяет воспроизводить звуки быстро друг за другом)
        const sound = new Audio(soundFile);
        sound.volume = options.volume !== undefined ? options.volume : ((game && game.settings ? game.settings.soundVolume : 70) / 100);
        sound.currentTime = 0;
        
        // Если указан loop, включаем зацикливание
        if (options.loop) {
            sound.loop = true;
        }
        
        sound.play().catch(e => {
            // Игнорируем ошибки автовоспроизведения
            console.log('Не удалось воспроизвести звук:', e);
        });

        if (game && game.settings && game.settings.soundSubtitles && soundName !== 'click') {
            const subtitleText = options.subtitle || soundName;
            if (subtitleText) {
                showNotification(`🔊 ${subtitleText}`);
            }
        }
        
        // Сохраняем звук в список активных (для возможности остановки)
        activeSounds.push(sound);
        
        // Удаляем звук из списка после окончания воспроизведения
        sound.addEventListener('ended', () => {
            const index = activeSounds.indexOf(sound);
            if (index > -1) {
                activeSounds.splice(index, 1);
            }
        });
        
        return sound;
    } catch (e) {
        console.log('Ошибка воспроизведения звука:', e);
        return null;
    }
}

// Хранилище для всех активных звуков (чтобы можно было их остановить)
let activeLoopingSounds = [];
let activeSounds = []; // Все активные звуки (включая незацикленные)

// Функция для остановки всех звуков (и зацикленных, и обычных)
function stopAllSounds() {
    // Останавливаем зацикленные звуки
    activeLoopingSounds.forEach(sound => {
        if (sound && !sound.paused) {
            sound.pause();
            sound.currentTime = 0;
        }
    });
    activeLoopingSounds = [];
    
    // Останавливаем все остальные активные звуки
    activeSounds.forEach(sound => {
        if (sound && !sound.paused) {
            sound.pause();
            sound.currentTime = 0;
        }
    });
    activeSounds = [];
}

// Функция для остановки всех зацикленных звуков (для совместимости)
function stopAllLoopingSounds() {
    stopAllSounds();
}

// Функция для воспроизведения нескольких звуков
function playSounds(sounds, chapterText = '') {
    if (!sounds || !Array.isArray(sounds)) return;
    
    // Останавливаем предыдущие зацикленные звуки при переходе на новую главу
    stopAllLoopingSounds();
    
    const minStartDelay = 3000;
    const readingTimeMs = estimateReadingTimeMs(chapterText);
    const totalWindow = Math.min(Math.max(readingTimeMs, 12000), 90000);
    const soundCount = sounds.length || 1;
    
    const blockedSoundParts = [
        'aa8b64ca38f350', // выстрел
        'long-lingering-sound-after-firing', // выстрел
        'monster', // мутанты
        'rychanie', // рычание
        'Zvuk_laya', // лай/рычание собаки
        'Sobaka', // собачьи звуки
        'dog_barking' // собачьи звуки
    ];

    let playedAny = false;

    const shouldBlock = (filePath) => {
        if (!filePath) return false;
        const lower = String(filePath).toLowerCase();
        return blockedSoundParts.some(part => lower.includes(part.toLowerCase()));
    };

    sounds.forEach(soundConfig => {
        if (typeof soundConfig === 'string') {
            // Просто имя файла
            if (!shouldBlock(soundConfig)) {
                setTimeout(() => {
                    playSound(soundConfig);
                    playedAny = true;
                }, minStartDelay);
            }
        } else if (typeof soundConfig === 'object') {
            // Объект с настройками {file: 'path', delay: 1000, volume: 0.5, loop: false, at: 0.5}
            let delay = soundConfig.delay || 0;
            const filePath = soundConfig.file || soundConfig.name;

            if (shouldBlock(filePath)) {
                return;
            }
            
            if (soundConfig.at !== undefined) {
                const position = Math.max(0, Math.min(1, soundConfig.at));
                delay = minStartDelay + Math.floor(totalWindow * position);
            } else if (delay < minStartDelay) {
                const index = sounds.indexOf(soundConfig);
                const position = (index + 1) / (soundCount + 1);
                delay = minStartDelay + Math.floor(totalWindow * position);
            }
            
            setTimeout(() => {
                const sound = playSound(soundConfig.file || soundConfig.name, {
                    volume: soundConfig.volume,
                    loop: soundConfig.loop
                });
                
                // Если звук зациклен, сохраняем его для возможности остановки
                if (soundConfig.loop && sound) {
                    activeLoopingSounds.push(sound);
                }
                playedAny = true;
            }, delay);
        }
    });

    // Если все эффекты заблокированы, добавляем нейтральный звук
    if (!playedAny) {
        setTimeout(() => {
            playSound('audio/2-steps-on-soft-snow_z1hnzm4u.mp3', { volume: 0.5 });
        }, minStartDelay);
    }
}

function estimateReadingTimeMs(text, wordsPerMinute = 170) {
    if (!text) {
        return 12000;
    }
    
    const words = text.trim().split(/\s+/).length;
    const minutes = words / wordsPerMinute;
    return Math.max(12000, Math.floor(minutes * 60000));
}

function updateMusicVolume() {
    const backgroundMusic = document.getElementById('background-music');
    const tensionMusic = document.getElementById('tension-music');
    const menuMusic = document.getElementById('menu-music');
    const volume = (game.settings.musicVolume || 50) / 100;
    
    if (backgroundMusic) {
        backgroundMusic.volume = volume;
    }
    
    if (tensionMusic) {
        tensionMusic.volume = volume;
    }
    
    if (menuMusic) {
        menuMusic.volume = volume;
    }
}

function startBackgroundMusic() {
    if (game && game.settings && game.settings.enableMusic === false) {
        return;
    }
    const music = document.getElementById('background-music');
    if (music) {
        // Устанавливаем громкость из настроек
        music.volume = (game.settings.musicVolume || 50) / 100;
        
        // Убеждаемся, что музыка будет играть циклично
        music.loop = true;
        
        // Пытаемся запустить музыку (может не сработать без взаимодействия пользователя)
        const playMusic = () => {
            music.play().then(() => {
                console.log('Фоновая музыка запущена');
            }).catch(e => {
                console.log('Не удалось воспроизвести музыку:', e);
            });
        };
        
        // Пытаемся запустить сразу
        playMusic();
        
        // Если автозапуск заблокирован, запускаем после первого взаимодействия пользователя
        const startMusicOnInteraction = () => {
            playMusic();
            document.removeEventListener('click', startMusicOnInteraction);
            document.removeEventListener('touchstart', startMusicOnInteraction);
        };
        
        // Проверяем, играет ли музыка, если нет - ждем взаимодействия
        setTimeout(() => {
            if (music.paused) {
                console.log('Автозапуск музыки заблокирован. Музыка запустится после первого взаимодействия пользователя.');
                document.addEventListener('click', startMusicOnInteraction, { once: true });
                document.addEventListener('touchstart', startMusicOnInteraction, { once: true });
            }
        }, 100);
    }
}

function ensureMusicPlaying() {
    // Убеждаемся, что хотя бы одна из музык играет
    const backgroundMusic = document.getElementById('background-music');
    const tensionMusic = document.getElementById('tension-music');
    
    if (backgroundMusic && backgroundMusic.paused && tensionMusic && tensionMusic.paused) {
        // Если обе музыки остановлены, запускаем основную
        startBackgroundMusic();
    }
}

// Функции для управления музыкой меню
function startMenuMusic() {
    // Проверяем, включена ли музыка
    if (game && game.settings && game.settings.enableMusic === false) {
        return;
    }
    
    const menuMusic = document.getElementById('menu-music');
    if (menuMusic) {
        const targetVolume = (game && game.settings ? game.settings.musicVolume : 50) / 100;
        menuMusic.volume = targetVolume;
        menuMusic.loop = true;
        
        const playMusic = () => {
            // Пробуем автозапуск через muted (иногда разрешено даже без взаимодействия)
            menuMusic.muted = true;
            menuMusic.play().then(() => {
                menuMusic.muted = false;
                menuMusic.volume = targetVolume;
                console.log('Музыка меню запущена');
            }).catch(e => {
                menuMusic.muted = false;
                console.log('Не удалось воспроизвести музыку меню:', e);
            });
        };
        
        // Пытаемся запустить сразу
        playMusic();
        
        // Если автозапуск заблокирован, запускаем после первого взаимодействия пользователя
        // Используем capture phase, чтобы перехватить все клики (включая клики по кнопкам)
        const startMusicOnInteraction = (e) => {
            playMusic();
            // Удаляем все обработчики
            document.removeEventListener('click', startMusicOnInteraction, true);
            document.removeEventListener('touchstart', startMusicOnInteraction, true);
            document.removeEventListener('mousedown', startMusicOnInteraction, true);
            document.removeEventListener('keydown', startMusicOnInteraction, true);
        };
        
        // Проверяем, играет ли музыка, если нет - ждем взаимодействия
        setTimeout(() => {
            if (menuMusic.paused) {
                console.log('Автозапуск музыки меню заблокирован. Музыка запустится после первого взаимодействия пользователя.');
                // Используем capture phase для перехвата всех событий
                document.addEventListener('click', startMusicOnInteraction, { once: true, capture: true });
                document.addEventListener('touchstart', startMusicOnInteraction, { once: true, capture: true });
                document.addEventListener('mousedown', startMusicOnInteraction, { once: true, capture: true });
                document.addEventListener('keydown', startMusicOnInteraction, { once: true, capture: true });
            }
        }, 100);
    }
}

function stopMenuMusic() {
    const menuMusic = document.getElementById('menu-music');
    if (menuMusic && !menuMusic.paused) {
        menuMusic.pause();
        menuMusic.currentTime = 0;
    }
}

function stopGameMusic() {
    const backgroundMusic = document.getElementById('background-music');
    const tensionMusic = document.getElementById('tension-music');
    
    if (backgroundMusic && !backgroundMusic.paused) {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
    }
    
    if (tensionMusic && !tensionMusic.paused) {
        tensionMusic.pause();
        tensionMusic.currentTime = 0;
    }
}

function switchMusicForChapter(chapter) {
    const backgroundMusic = document.getElementById('background-music');
    const tensionMusic = document.getElementById('tension-music');
    
    if (!backgroundMusic || !tensionMusic) return;
    
    // Устанавливаем громкость для обеих композиций
    const volume = game.settings.musicVolume / 100;
    backgroundMusic.volume = volume;
    tensionMusic.volume = volume;
    
    // Проверяем, нужна ли тревожная музыка для этой главы
    const needsTensionMusic = chapter.tensionMusic === true;
    
    if (needsTensionMusic) {
        // Включаем тревожную музыку, выключаем основную
        console.log('Включаем тревожную музыку для главы:', chapter.title);
        
        // Плавно уменьшаем громкость основной музыки и останавливаем
        if (!backgroundMusic.paused) {
            const fadeOut = setInterval(() => {
                if (backgroundMusic.volume > 0) {
                    backgroundMusic.volume = Math.max(0, backgroundMusic.volume - 0.1);
                } else {
                    backgroundMusic.pause();
                    backgroundMusic.currentTime = 0; // Сбрасываем позицию
                    backgroundMusic.volume = volume; // Возвращаем громкость для следующего включения
                    clearInterval(fadeOut);
                }
            }, 50);
        } else {
            backgroundMusic.pause();
        }
        
        // Включаем тревожную музыку
        tensionMusic.loop = true;
        if (tensionMusic.paused) {
            tensionMusic.currentTime = 0; // Начинаем с начала
            tensionMusic.play().catch(e => {
                console.log('Не удалось воспроизвести тревожную музыку:', e);
            });
        }
    } else {
        // Включаем основную музыку, выключаем тревожную
        console.log('Возвращаемся к основной музыке для главы:', chapter.title);
        
        // Плавно уменьшаем громкость тревожной музыки и останавливаем
        if (!tensionMusic.paused) {
            const fadeOut = setInterval(() => {
                if (tensionMusic.volume > 0) {
                    tensionMusic.volume = Math.max(0, tensionMusic.volume - 0.1);
                } else {
                    tensionMusic.pause();
                    tensionMusic.currentTime = 0; // Сбрасываем позицию
                    tensionMusic.volume = volume; // Возвращаем громкость для следующего включения
                    clearInterval(fadeOut);
                }
            }, 50);
        } else {
            tensionMusic.pause();
        }
        
        // Включаем основную музыку
        backgroundMusic.loop = true;
        if (backgroundMusic.paused) {
            backgroundMusic.currentTime = 0; // Начинаем с начала (если была остановлена)
            backgroundMusic.play().catch(e => {
                console.log('Не удалось воспроизвести основную музыку:', e);
            });
        }
    }
}

function loadSettings() {
    const saved = localStorage.getItem('pandemic_game_settings');
    if (saved) {
        try {
            game.settings = { ...game.settings, ...JSON.parse(saved) };
        } catch (e) {
            console.error('Ошибка загрузки настроек:', e);
        }
    }
    
    // Обновляем значения в интерфейсе
    const musicVolume = document.getElementById('music-volume');
    const musicVolumeValue = document.getElementById('music-volume-value');
    const soundVolume = document.getElementById('sound-volume');
    const soundVolumeValue = document.getElementById('sound-volume-value');
    const autosave = document.getElementById('autosave');
    
    if (musicVolume && musicVolumeValue) {
        musicVolume.value = game.settings.musicVolume || 50;
        musicVolumeValue.textContent = (game.settings.musicVolume || 50) + '%';
    }
    
    if (soundVolume && soundVolumeValue) {
        soundVolume.value = game.settings.soundVolume || 70;
        soundVolumeValue.textContent = (game.settings.soundVolume || 70) + '%';
    }
    
    // Загружаем настройки звуков
    const enableMusic = document.getElementById('enable-music');
    const enableSounds = document.getElementById('enable-sounds');
    
    if (enableMusic) {
        enableMusic.checked = game.settings.enableMusic !== false;
    }
    
    if (enableSounds) {
        enableSounds.checked = game.settings.enableSounds !== false;
    }
    
    // Загружаем настройки визуальных эффектов
    const enableEffects = document.getElementById('enable-effects');
    const enableBloodEffect = document.getElementById('enable-blood-effect');
    const enableSmokeEffect = document.getElementById('enable-smoke-effect');
    const enableLightingEffect = document.getElementById('enable-lighting-effect');
    const enableFlashEffect = document.getElementById('enable-flash-effect');
    
    if (enableEffects) {
        enableEffects.checked = game.settings.enableEffects !== false;
    }
    
    if (enableBloodEffect) {
        enableBloodEffect.checked = game.settings.enableBloodEffect !== false;
    }
    
    if (enableSmokeEffect) {
        enableSmokeEffect.checked = game.settings.enableSmokeEffect !== false;
    }
    
    if (enableLightingEffect) {
        enableLightingEffect.checked = game.settings.enableLightingEffect !== false;
    }
    
    if (enableFlashEffect) {
        enableFlashEffect.checked = game.settings.enableFlashEffect !== false;
    }
    
    if (autosave) {
        autosave.checked = game.settings.autosave !== false;
    }
    
    // Загружаем новые настройки
    const autoScroll = document.getElementById('auto-scroll');
    const scrollSpeed = document.getElementById('scroll-speed');
    const scrollSpeedValue = document.getElementById('scroll-speed-value');
    const fontSize = document.getElementById('font-size');
    const fontSizeValue = document.getElementById('font-size-value');
    const contrast = document.getElementById('contrast');
    const accessibilityMode = document.getElementById('accessibility-mode');
    const soundSubtitles = document.getElementById('sound-subtitles');
    
    if (autoScroll) {
        autoScroll.checked = game.settings.autoScroll || false;
    }
    
    if (scrollSpeed && scrollSpeedValue) {
        scrollSpeed.value = game.settings.scrollSpeed || 50;
        scrollSpeedValue.textContent = game.settings.scrollSpeed || 50;
    }
    
    if (fontSize && fontSizeValue) {
        fontSize.value = game.settings.fontSize || 18;
        fontSizeValue.textContent = (game.settings.fontSize || 18) + 'px';
        applyFontSize(game.settings.fontSize || 18);
    }
    
    if (contrast) {
        contrast.value = game.settings.contrast || 'normal';
        applyContrast(game.settings.contrast || 'normal');
    }
    
    if (accessibilityMode) {
        accessibilityMode.checked = game.settings.accessibilityMode || false;
        applyAccessibilityMode(game.settings.accessibilityMode || false);
    }
    
    if (soundSubtitles) {
        soundSubtitles.checked = game.settings.soundSubtitles || false;
    }
    
    // Обновляем громкость музыки
    updateMusicVolume();
}

function saveSettings() {
    localStorage.setItem('pandemic_game_settings', JSON.stringify(game.settings));
}

// Функция для добавления звука клика ко всем кнопкам и интерактивным элементам
function setupClickSounds() {
    console.log('Настройка звуков клика...');
    
    // Функция для воспроизведения звука клика
    const playClickSound = () => {
        try {
            if (game && game.settings && game.settings.enableSounds === false) {
                return;
            }
            const sound = new Audio('audio/short-click-of-a-computer-mouse.mp3');
            sound.volume = (game && game.settings ? game.settings.soundVolume : 70) / 100;
            sound.currentTime = 0;
            sound.play().catch(e => {
                // Игнорируем ошибки автовоспроизведения (звук будет работать после первого клика пользователя)
                console.log('Не удалось воспроизвести звук клика (это нормально при первом клике):', e.message);
            });
        } catch (e) {
            console.log('Ошибка создания звука клика:', e);
        }
    };
    
    // Используем делегирование событий для всех кликов на документе
    document.addEventListener('click', (e) => {
        const target = e.target;
        
        // Проверяем, является ли элемент кнопкой или интерактивным элементом
        const isInteractive = 
            target.tagName === 'BUTTON' ||
            target.tagName === 'A' ||
            target.classList.contains('choice-btn') ||
            target.classList.contains('menu-item') ||
            target.classList.contains('menu-nav-item') ||
            target.classList.contains('menu-btn') ||
            target.classList.contains('back-btn') ||
            target.classList.contains('premium-btn') ||
            target.classList.contains('recommend-btn') ||
            target.classList.contains('menu-screen-btn') ||
            target.closest('button') !== null ||
            target.closest('a') !== null ||
            target.getAttribute('role') === 'button' ||
            (target.getAttribute('tabindex') !== null && target.getAttribute('tabindex') !== '-1');
        
        // Исключаем элементы, которые не должны издавать звук
        const excludeClasses = ['modal-close', 'modal-backdrop'];
        const shouldExclude = excludeClasses.some(className => 
            target.classList.contains(className) || target.closest('.' + className)
        );
        
        // Исключаем input элементы (checkbox, range и т.д.)
        const isInput = target.tagName === 'INPUT' && 
            (target.type === 'checkbox' || target.type === 'range' || target.type === 'text');
        
        if (isInteractive && !shouldExclude && !isInput) {
            playClickSound();
        }
    }, true); // Используем capture phase для перехвата всех кликов
    
    // Также добавляем для touch событий (мобильные устройства)
    document.addEventListener('touchend', (e) => {
        const target = e.target;
        
        const isInteractive = 
            target.tagName === 'BUTTON' ||
            target.tagName === 'A' ||
            target.classList.contains('choice-btn') ||
            target.classList.contains('menu-item') ||
            target.classList.contains('menu-nav-item') ||
            target.classList.contains('menu-btn') ||
            target.classList.contains('back-btn') ||
            target.classList.contains('premium-btn') ||
            target.classList.contains('recommend-btn') ||
            target.classList.contains('menu-screen-btn') ||
            target.closest('button') !== null ||
            target.closest('a') !== null ||
            target.getAttribute('role') === 'button' ||
            (target.getAttribute('tabindex') !== null && target.getAttribute('tabindex') !== '-1');
        
        const excludeClasses = ['modal-close', 'modal-backdrop'];
        const shouldExclude = excludeClasses.some(className => 
            target.classList.contains(className) || target.closest('.' + className)
        );
        
        const isInput = target.tagName === 'INPUT' && 
            (target.type === 'checkbox' || target.type === 'range' || target.type === 'text');
        
        if (isInteractive && !shouldExclude && !isInput) {
            playClickSound();
        }
    }, true);
    
    console.log('Звуки клика настроены');
}

// Обновление индикаторов статусов
function updateStatusDisplay() {
    if (!game || !game.playerData) return;
    
    const status = game.playerData.status || {
        mental: 'В здравом рассудке',
        physical: 'Бодр',
        emotional: 'Спокоен'
    };
    
    const mentalStatus = document.getElementById('mental-status');
    const physicalStatus = document.getElementById('physical-status');
    const emotionalStatus = document.getElementById('emotional-status');
    
    if (mentalStatus) {
        mentalStatus.textContent = status.mental || 'В здравом рассудке';
    } else {
        console.warn('Элемент mental-status не найден');
    }
    
    if (physicalStatus) {
        physicalStatus.textContent = status.physical || 'Бодр';
    } else {
        console.warn('Элемент physical-status не найден');
    }
    
    if (emotionalStatus) {
        emotionalStatus.textContent = status.emotional || 'Спокоен';
    } else {
        console.warn('Элемент emotional-status не найден');
    }
}

// Переключение панели статусов
function toggleStatusPanel() {
    const statusPanel = document.getElementById('status-panel');
    if (statusPanel) {
        statusPanel.classList.toggle('active');
        // Обновляем статусы при открытии панели
        if (statusPanel.classList.contains('active')) {
            updateStatusDisplay();
        }
    } else {
        // Создаем панель, если её нет
        createStatusPanel();
        const newPanel = document.getElementById('status-panel');
        if (newPanel) {
            newPanel.classList.add('active');
            updateStatusDisplay();
        }
    }
}

// Создание панели статусов
function createStatusPanel() {
    // Проверяем, не создана ли уже панель
    if (document.getElementById('status-panel')) {
        return;
    }
    
    const statusPanelHTML = `
        <div id="status-panel" class="status-panel">
            <div class="status-panel-title">📊 Статус героя</div>
            <div class="status-content" id="status-content">
                <div class="status-item">
                    <span class="status-label">Состояние:</span>
                    <span class="status-value" id="mental-status">В здравом рассудке</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Физическое:</span>
                    <span class="status-value" id="physical-status">Бодр</span>
                </div>
                <div class="status-item">
                    <span class="status-label">Эмоции:</span>
                    <span class="status-value" id="emotional-status">Спокоен</span>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', statusPanelHTML);
}

// Экспортируем функции глобально
window.toggleStatusPanel = toggleStatusPanel;
window.createStatusPanel = createStatusPanel;

// Обновление индикатора инвентаря
function updateInventoryDisplay() {
    if (!game) return;
    
    const inventoryIndicator = document.getElementById('inventory-indicator');
    const inventoryItems = document.getElementById('inventory-items');
    
    if (!inventoryIndicator || !inventoryItems) return;

    if (!isPremiumActive()) {
        inventoryIndicator.classList.remove('has-items');
        inventoryIndicator.style.display = 'none';
        inventoryVisible = false;
        return;
    }
    
    const items = game.playerData.inventory;
    
    if (items.length === 0) {
        inventoryIndicator.classList.remove('has-items');
        inventoryIndicator.style.display = 'none';
        inventoryVisible = false;
        return;
    }
    
    inventoryIndicator.classList.add('has-items');
    if (!inventoryVisible) {
        inventoryIndicator.style.display = 'none';
        return;
    }
    inventoryItems.innerHTML = '';
    
    items.forEach(item => {
        const itemDiv = document.createElement('div');
        itemDiv.className = 'inventory-item';
        itemDiv.innerHTML = `
            <span class="inventory-item-icon">${item.icon || '📦'}</span>
            <span>${item.name || item.id}</span>
        `;
        inventoryItems.appendChild(itemDiv);
    });
}

// Управление погодой
function setWeather(weatherType) {
    if (!game) return;
    
    game.weather = weatherType;
    const particlesContainer = document.getElementById('particles-container');
    if (!particlesContainer) return;
    
    // Очищаем предыдущие эффекты
    particlesContainer.innerHTML = '';
    
    switch (weatherType) {
        case 'snow':
            createSnowEffect();
            break;
        case 'rain':
            createRainEffect();
            break;
        case 'fog':
            createFogEffect();
            break;
        case 'clear':
            // Нет эффектов
            break;
    }
}

function createSnowEffect() {
    const container = document.getElementById('particles-container');
    if (!container) return;
    
    for (let i = 0; i < 50; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.textContent = '❄';
        snowflake.style.left = Math.random() * 100 + '%';
        snowflake.style.animationDuration = (Math.random() * 3 + 2) + 's';
        snowflake.style.animationDelay = Math.random() * 2 + 's';
        snowflake.style.opacity = Math.random() * 0.5 + 0.5;
        container.appendChild(snowflake);
    }
}

function createRainEffect() {
    const container = document.getElementById('particles-container');
    if (!container) return;
    
    for (let i = 0; i < 100; i++) {
        const raindrop = document.createElement('div');
        raindrop.style.position = 'absolute';
        raindrop.style.width = '2px';
        raindrop.style.height = '20px';
        raindrop.style.background = 'rgba(100, 200, 255, 0.6)';
        raindrop.style.left = Math.random() * 100 + '%';
        raindrop.style.animation = `fall ${Math.random() * 0.5 + 0.3}s linear infinite`;
        raindrop.style.animationDelay = Math.random() * 0.5 + 's';
        container.appendChild(raindrop);
    }
}

function createFogEffect() {
    const container = document.getElementById('particles-container');
    if (!container) return;
    
    const fog = document.createElement('div');
    fog.style.position = 'absolute';
    fog.style.width = '100%';
    fog.style.height = '100%';
    fog.style.background = 'radial-gradient(circle, rgba(200, 200, 200, 0.3) 0%, transparent 70%)';
    fog.style.animation = 'fogMove 10s ease-in-out infinite';
    container.appendChild(fog);
}

// Управление временем суток
function setTimeOfDay(time) {
    if (!game) return;
    
    game.timeOfDay = time;
    const overlay = document.querySelector('.overlay');
    if (!overlay) return;
    
    // Изменяем затемнение в зависимости от времени суток
    switch (time) {
        case 'night':
            overlay.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.85) 100%)';
            break;
        case 'dawn':
            overlay.style.background = 'linear-gradient(to bottom, rgba(255,150,0,0.2) 0%, rgba(0,0,0,0.7) 100%)';
            break;
        case 'dusk':
            overlay.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, rgba(255,100,0,0.3) 100%)';
            break;
        case 'day':
        default:
            overlay.style.background = 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 100%)';
            break;
    }
}

// Анимация текста (typewriter эффект)
function typewriterText(element, text, speed = 50) {
    if (!element) return;
    
    element.textContent = '';
    let i = 0;
    
    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Эффекты экрана
function triggerScreenShake() {
    const mainScreen = document.getElementById('main-screen');
    if (mainScreen) {
        mainScreen.classList.add('screen-shake');
        setTimeout(() => {
            mainScreen.classList.remove('screen-shake');
        }, 500);
    }
}

function triggerScreenFade() {
    const mainScreen = document.getElementById('main-screen');
    if (mainScreen) {
        mainScreen.classList.add('screen-fade');
        setTimeout(() => {
            mainScreen.classList.remove('screen-fade');
        }, 300);
    }
}

// Вибрация (для мобильных устройств)
function vibrate(pattern = [100]) {
    if (navigator.vibrate) {
        navigator.vibrate(pattern);
    }
}

// ============================================
// ВИЗУАЛЬНЫЕ ЭФФЕКТЫ
// ============================================

// Эффекты крови и ран
function createBloodEffect() {
    let bloodContainer = document.getElementById('blood-effect');
    if (!bloodContainer) {
        bloodContainer = document.createElement('div');
        bloodContainer.id = 'blood-effect';
        bloodContainer.className = 'blood-effect';
        document.body.appendChild(bloodContainer);
    }
    
    // Создаем капли крови
    for (let i = 0; i < 20; i++) {
        const droplet = document.createElement('div');
        droplet.className = 'blood-droplet';
        droplet.style.left = Math.random() * 100 + '%';
        droplet.style.top = Math.random() * 100 + '%';
        droplet.style.animationDelay = Math.random() * 0.5 + 's';
        droplet.style.animationDuration = (Math.random() * 2 + 1) + 's';
        bloodContainer.appendChild(droplet);
    }
    
    bloodContainer.classList.add('active');
    setTimeout(() => {
        bloodContainer.classList.remove('active');
        setTimeout(() => {
            bloodContainer.innerHTML = '';
        }, 500);
    }, 1500); // Увеличено в 3 раза (с 500ms до 1500ms)
}

function triggerBloodPulse() {
    const overlay = document.querySelector('.overlay');
    if (overlay) {
        overlay.classList.add('blood-pulse');
        setTimeout(() => {
            overlay.classList.remove('blood-pulse');
        }, 2000);
    }
}

// Эффекты огня и дыма
function createSmokeEffect(count = 10) {
    const particlesContainer = document.getElementById('particles-container');
    if (!particlesContainer) return;
    
    for (let i = 0; i < count; i++) {
        const smoke = document.createElement('div');
        smoke.className = 'smoke-particle';
        smoke.style.left = Math.random() * 100 + '%';
        smoke.style.animationDelay = Math.random() * 8 + 's';
        smoke.style.animationDuration = (Math.random() * 4 + 6) + 's';
        particlesContainer.appendChild(smoke);
        
        setTimeout(() => {
            if (smoke.parentNode) {
                smoke.parentNode.removeChild(smoke);
            }
        }, 10000);
    }
}

// Динамическое освещение
function createLightingEffect(type = 'default') {
    let lighting = document.getElementById('lighting-effect');
    if (!lighting) {
        lighting = document.createElement('div');
        lighting.id = 'lighting-effect';
        lighting.className = 'lighting-effect';
        document.body.appendChild(lighting);
    }
    
    lighting.className = 'lighting-effect ' + type;
    lighting.classList.add('active');
    
    return lighting;
}

function removeLightingEffect() {
    const lighting = document.getElementById('lighting-effect');
    if (lighting) {
        lighting.classList.remove('active');
    }
}

function clearVisualEffects() {
    const particlesContainer = document.getElementById('particles-container');
    if (particlesContainer) {
        particlesContainer.innerHTML = '';
    }
    
    const bloodContainer = document.getElementById('blood-effect');
    if (bloodContainer) {
        bloodContainer.classList.remove('active');
        bloodContainer.innerHTML = '';
    }
    
    const flash = document.getElementById('flash-effect');
    if (flash) {
        flash.classList.remove('active');
    }
    
    const overlay = document.querySelector('.overlay');
    if (overlay) {
        overlay.classList.remove('blood-pulse');
    }
    
    removeLightingEffect();
}

function refreshCurrentVisualEffects() {
    if (!game) return;
    if (game.settings.enableEffects === false) {
        clearVisualEffects();
        return;
    }
    
    clearVisualEffects();
    const chapter = game.getChapter(game.currentChapter);
    if (chapter) {
        applyVisualEffects(chapter, game.currentChapter);
    }
}

// Эффекты для важных событий
function triggerFlash() {
    let flash = document.getElementById('flash-effect');
    if (!flash) {
        flash = document.createElement('div');
        flash.id = 'flash-effect';
        flash.className = 'flash-effect';
        document.body.appendChild(flash);
    }
    
    flash.classList.add('active');
    setTimeout(() => {
        flash.classList.remove('active');
    }, 200);
}

function triggerImpact() {
    let impact = document.getElementById('impact-effect');
    if (!impact) {
        impact = document.createElement('div');
        impact.id = 'impact-effect';
        impact.className = 'impact-effect';
        document.body.appendChild(impact);
    }
    
    impact.classList.add('active');
    setTimeout(() => {
        impact.classList.remove('active');
    }, 500);
}

// Эффекты для мутантов
function applyMutantDistortion(element) {
    if (element) {
        element.classList.add('mutant-distortion');
    }
}

function removeMutantDistortion(element) {
    if (element) {
        element.classList.remove('mutant-distortion');
    }
}

function applyMutantGlow(element) {
    if (element) {
        element.classList.add('mutant-glow');
    }
}

function applyDangerPulse(element) {
    if (element) {
        element.classList.add('danger-pulse');
    }
}

// Улучшенные переходы
function triggerChapterTransition(callback) {
    let transition = document.getElementById('chapter-transition');
    if (!transition) {
        transition = document.createElement('div');
        transition.id = 'chapter-transition';
        transition.className = 'chapter-transition';
        document.body.appendChild(transition);
    }
    
    transition.classList.add('active');
    setTimeout(() => {
        transition.classList.remove('active');
        if (callback) callback();
    }, 1000);
}

// UI улучшения - уведомления
function showNotification(text, duration = 3000) {
    // Удаляем предыдущее уведомление, если есть
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.classList.add('fade-out');
        setTimeout(() => {
            if (existingNotification.parentNode) {
                existingNotification.parentNode.removeChild(existingNotification);
            }
        }, 300);
    }
    
    // Пробуем использовать Telegram API, если доступен
    if (tg && tg.showAlert && duration === 3000) {
        try {
            tg.showAlert(text);
            return;
        } catch (e) {
            // Если не получилось, используем визуальное уведомление
        }
    }
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = text;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, duration);
}

function showAchievementNotification(title, description) {
    const achievement = document.createElement('div');
    achievement.className = 'achievement-notification';
    achievement.innerHTML = `
        <div style="font-size: 48px; margin-bottom: 10px;">🏆</div>
        <div style="font-size: 24px; font-weight: bold; margin-bottom: 5px;">${title}</div>
        <div style="font-size: 16px;">${description}</div>
    `;
    document.body.appendChild(achievement);
    
    setTimeout(() => {
        achievement.style.animation = 'achievementPop 0.6s ease-out reverse';
        setTimeout(() => {
            if (achievement.parentNode) {
                achievement.parentNode.removeChild(achievement);
            }
        }, 600);
    }, 3000);
}

// Вспомогательные функции для эффектов
function highlightText(element, keywords = []) {
    if (!element || !keywords.length) return;
    
    let text = element.textContent;
    keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        text = text.replace(regex, '<span class="text-highlight">$1</span>');
    });
    element.innerHTML = text;
}

function applyTextShock(element) {
    if (element) {
        element.classList.add('text-shock');
        setTimeout(() => {
            element.classList.remove('text-shock');
        }, 300);
    }
}

// Интеграция визуальных эффектов для глав
function applyVisualEffects(chapter, chapterId) {
    // Проверяем, включены ли визуальные эффекты
    if (game && game.settings && game.settings.enableEffects === false) {
        return;
    }
    
    // Эффекты для атаки мутанта
    if (chapterId === 'mutant_attack') {
        setTimeout(() => {
            if (game && game.settings && game.settings.enableFlashEffect !== false) {
                triggerFlash(); // Вспышка при появлении мутанта
            }
            triggerImpact(); // Удар при атаке
            if (game && game.settings && game.settings.enableBloodEffect !== false) {
                createBloodEffect(); // Эффект крови
            }
        }, 2000);
        
        const bgImage = document.getElementById('background-image');
        if (bgImage) {
            applyMutantDistortion(bgImage);
            setTimeout(() => removeMutantDistortion(bgImage), 5000);
        }
    }
    
    // Эффекты для раненого Троя
    if (chapterId === 'troy_injured') {
        setTimeout(() => {
            if (game && game.settings && game.settings.enableBloodEffect !== false) {
                triggerBloodPulse(); // Пульсирующий эффект крови
                createBloodEffect(); // Капли крови
            }
        }, 500);
    }
    
    // Эффекты для города с горящими зданиями
    if (chapterId === 'city_approach') {
        setTimeout(() => {
            if (game && game.settings && game.settings.enableSmokeEffect !== false) {
                createSmokeEffect(15); // Дым от горящих зданий
            }
            // Эффект огня убран
        }, 1000);
    }
    
    // Эффекты для больницы
    if (chapterId === 'hospital_search') {
        if (game && game.settings && game.settings.enableLightingEffect !== false) {
            createLightingEffect('default'); // Освещение для больницы
        }
    }
    
    // Эффекты для ночных сцен
    if (chapter.timeOfDay === 'night' || chapterId === 'first_night') {
        if (game && game.settings && game.settings.enableLightingEffect !== false) {
            createLightingEffect('candle'); // Свет свечи для ночных сцен
        }
    }
    
    // Эффекты для выстрелов
    if (chapter.sounds && chapter.sounds.some(s => s.file && s.file.includes('aa8b64ca38f350'))) {
        setTimeout(() => {
            if (game && game.settings && game.settings.enableFlashEffect !== false) {
                triggerFlash(); // Вспышка при выстреле
            }
        }, 2000);
    }
}

// Модальное окно достижений
function showAchievementsModal() {
    createModals();
    
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Проверяем, существует ли уже модальное окно достижений
    let modal = document.getElementById('achievements-modal');
    if (!modal) {
        const modalHTML = `
            <div id="achievements-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🏆 Достижения</h2>
                        <button class="modal-close" onclick="closeModal('achievements-modal')">×</button>
                    </div>
                    <div class="modal-body">
                        <div id="achievements-list" class="history-list"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-secondary" onclick="closeModal('achievements-modal')">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('achievements-modal');
    }
    
    const achievementsList = document.getElementById('achievements-list');
    if (achievementsList && game) {
        achievementsList.innerHTML = '';
        
        Object.keys(game.achievements).forEach(key => {
            const achievement = game.achievements[key];
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.opacity = achievement.unlocked ? '1' : '0.5';
            div.innerHTML = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">${achievement.icon}</span>
                    <div>
                        <div style="font-weight: bold; margin-bottom: 5px;">${achievement.name}</div>
                        <div style="font-size: 12px; color: #999;">${achievement.description}</div>
                    </div>
                    ${achievement.unlocked ? '<span style="margin-left: auto; color: #ffd700;">✓</span>' : '<span style="margin-left: auto; color: #666;">🔒</span>'}
                </div>
            `;
            achievementsList.appendChild(div);
        });
    }
    
    if (modal) {
        modal.classList.add('active');
    }
}

// Переключение инвентаря
function toggleInventory() {
    const inventoryIndicator = document.getElementById('inventory-indicator');
    if (inventoryIndicator) {
        inventoryVisible = !inventoryVisible;
        if (inventoryVisible) {
            inventoryIndicator.style.display = 'block';
        } else {
            inventoryIndicator.style.display = 'none';
        }
    }
}

// Модальное окно статистики
function showStatsModal() {
    createModals();
    
    document.querySelectorAll('.modal.active').forEach(modal => {
        modal.classList.remove('active');
    });
    
    // Проверяем, существует ли уже модальное окно статистики
    let modal = document.getElementById('stats-modal');
    if (!modal) {
        const modalHTML = `
            <div id="stats-modal" class="modal">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>📊 Статистика игры</h2>
                        <button class="modal-close" onclick="closeModal('stats-modal')">×</button>
                    </div>
                    <div class="modal-body stats-modal-content">
                        <div id="stats-content"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="modal-btn modal-btn-secondary" onclick="closeModal('stats-modal')">Закрыть</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modal = document.getElementById('stats-modal');
    }
    
    const statsContent = document.getElementById('stats-content');
    if (statsContent && game) {
        // Обновляем время игры перед показом статистики
        game.updatePlayTime();
        
        const stats = game.gameStats;
        const playTimeHours = Math.floor(stats.totalPlayTime / 3600000);
        const playTimeMinutes = Math.floor((stats.totalPlayTime % 3600000) / 60000);
        const playTimeSeconds = Math.floor((stats.totalPlayTime % 60000) / 1000);
        
        statsContent.innerHTML = `
            <h3 style="margin-bottom: 15px; color: #d4d4d4;">Ваша статистика</h3>
            <div class="stat-row">
                <span class="stat-label">Время игры:</span>
                <span class="stat-value">${playTimeHours}ч ${playTimeMinutes}м ${playTimeSeconds}с</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Сделано выборов:</span>
                <span class="stat-value">${stats.choicesCount}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Перезапусков:</span>
                <span class="stat-value">${stats.restarts}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Смертей:</span>
                <span class="stat-value">${stats.deaths}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Посещено глав:</span>
                <span class="stat-value">${game.playerData.visitedChapters.length}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Разблокировано достижений:</span>
                <span class="stat-value">${game.playerData.achievements.length} / ${Object.keys(game.achievements).length}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">Предметов в инвентаре:</span>
                <span class="stat-value">${game.playerData.inventory.length}</span>
            </div>
            
            <h3 style="margin-top: 30px; margin-bottom: 15px; color: #d4d4d4;">Социальная статистика</h3>
            <div class="stat-row">
                <span class="stat-label">Всего игроков:</span>
                <span class="stat-value">${game.socialStats.totalPlayers || 'Нет данных'}</span>
            </div>
            <p style="color: #999; font-size: 12px; margin-top: 15px; text-align: center;">
                Статистика выборов других игроков отображается в истории выборов
            </p>
        `;
    }
    
    if (modal) {
        modal.classList.add('active');
    }
}

// Обновление прогресс-бара главы (на основе прокрутки текста)
function updateChapterProgress() {
    if (!game) return;
    
    const progressBar = document.getElementById('chapter-progress-bar');
    const chapterText = document.getElementById('chapter-text');
    
    if (!progressBar || !chapterText) return;
    
    // Вычисляем прогресс на основе прокрутки текста
    const scrollTop = chapterText.scrollTop;
    const scrollHeight = chapterText.scrollHeight - chapterText.clientHeight;
    const progress = scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0;
    
    progressBar.style.width = Math.min(100, Math.max(0, progress)) + '%';
}

// Отслеживание прокрутки текста для обновления прогресс-бара
let progressTrackingSetup = false;
function setupChapterProgressTracking() {
    const chapterText = document.getElementById('chapter-text');
    if (chapterText && !progressTrackingSetup) {
        chapterText.addEventListener('scroll', updateChapterProgress, { passive: true });
        progressTrackingSetup = true;
    }
    // Обновляем при загрузке главы
    updateChapterProgress();
}
