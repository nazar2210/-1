// Service Worker для офлайн-режима
// Обновляем версию кэша для принудительного обновления
const CACHE_NAME = 'pandemic-game-v2-' + Date.now();
const STATIC_CACHE = 'pandemic-game-static-v2';
const DYNAMIC_CACHE = 'pandemic-game-dynamic-v2';

const urlsToCache = [
    '/',
    '/index.html',
    '/styles.css',
    '/images/photo_5408967021451480141_y.jpg',
    '/audio/botabateau_-_Halloween_Lurking_71372883.mp3',
    '/audio/Horror_Music_Collection_-_Underworld_Horror_Music_71419675.mp3',
    '/audio/Labyrinth-of-Lost-Dreams-MP3(chosic.com).mp3',
    '/audio/short-click-of-a-computer-mouse.mp3'
];

// Файлы, которые должны обновляться с сервера (network first)
const DYNAMIC_FILES = [
    '/game.js',
    '/app.js'
];

// Установка Service Worker
self.addEventListener('install', (event) => {
    console.log('Service Worker: Установка новой версии');
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('Service Worker: Кэш статических файлов открыт');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Service Worker: Ошибка кэширования статических файлов:', error);
            })
    );
    // Принудительно активируем новый Service Worker
    self.skipWaiting();
});

// Активация Service Worker
self.addEventListener('activate', (event) => {
    console.log('Service Worker: Активация новой версии');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    // Удаляем все старые версии кэша
                    if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE && !cacheName.startsWith('pandemic-game-v2-')) {
                        console.log('Service Worker: Удаление старого кэша:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // Берем контроль над всеми страницами сразу
            return self.clients.claim();
        })
    );
});

// Перехват запросов
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isDynamicFile = DYNAMIC_FILES.some(file => url.pathname.endsWith(file));
    
    if (isDynamicFile) {
        // Для динамических файлов используем стратегию "Network First"
        // Всегда пытаемся загрузить с сервера, если не получается - используем кэш
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // Если получили ответ с сервера, обновляем кэш
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(DYNAMIC_CACHE)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                    }
                    return response;
                })
                .catch(() => {
                    // Если не удалось загрузить с сервера, используем кэш
                    return caches.match(event.request)
                        .then((cachedResponse) => {
                            if (cachedResponse) {
                                return cachedResponse;
                            }
                            // Если нет в кэше, возвращаем ошибку
                            throw new Error('Нет соединения и нет в кэше');
                        });
                })
        );
    } else {
        // Для статических файлов используем стратегию "Cache First"
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        // Обновляем кэш в фоне (stale-while-revalidate)
                        fetch(event.request)
                            .then((response) => {
                                if (response && response.status === 200) {
                                    const responseToCache = response.clone();
                                    caches.open(STATIC_CACHE)
                                        .then((cache) => {
                                            cache.put(event.request, responseToCache);
                                        });
                                }
                            })
                            .catch(() => {
                                // Игнорируем ошибки обновления
                            });
                        return cachedResponse;
                    }
                    
                    // Если нет в кэше, загружаем с сервера
                    return fetch(event.request).then((response) => {
                        if (!response || response.status !== 200 || response.type !== 'basic') {
                            return response;
                        }
                        
                        const responseToCache = response.clone();
                        const cacheToUse = isDynamicFile ? DYNAMIC_CACHE : STATIC_CACHE;
                        caches.open(cacheToUse)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return response;
                    }).catch(() => {
                        // Если запрос не удался и это HTML, возвращаем офлайн-страницу
                        if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/index.html');
                        }
                    });
                })
        );
    }
});

// Синхронизация при подключении
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-game-data') {
        event.waitUntil(syncGameData());
    }
});

function syncGameData() {
    // Здесь можно добавить синхронизацию данных с сервером
    return Promise.resolve();
}
