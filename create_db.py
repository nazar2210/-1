"""
Скрипт для создания фейковой базы данных с тестовыми данными
"""
import sqlite3
import json
from pathlib import Path
from datetime import datetime, timedelta
import random

# Путь к базе данных
DB_PATH = 'game_data.db'

# Фейковые имена игроков
FAKE_NAMES = [
    "Алексей", "Мария", "Дмитрий", "Анна", "Иван", 
    "Елена", "Сергей", "Ольга", "Андрей", "Татьяна"
]

# Фейковые user_id (реальные ID пользователей Telegram обычно 9-10 цифр)
FAKE_USER_IDS = [
    123456789, 987654321, 555444333, 111222333, 999888777,
    444555666, 777888999, 333222111, 666777888, 222333444
]

# Главы для фейковых прогрессов
CHAPTERS = [
    'intro', 'window', 'troy_pet', 'sounds_report', 'observation',
    'grandfather_plan', 'defense_plan', 'parents_question', 'first_night',
    'preparation', 'sleep_attempt', 'morning_after', 'defense_strengthen',
    'farm_check', 'mutant_attack', 'troy_injured', 'search_antibiotics',
    'hospital_search', 'return_to_troy', 'epilogue'
]

# Фейковые предметы для инвентаря
ITEMS = [
    "Ружьё", "Патроны", "Аптечка", "Фонарик", "Нож",
    "Антибиотики", "Еда", "Вода", "Радио", "Карта"
]

# Фейковые выборы
CHOICES = [
    "Продолжить", "Сообщить дедушке о звуках", "Внимательно наблюдать",
    "Погладить Троя", "Поговорить с дедушкой", "Встать и подойти к дедушке",
    "Приготовить ружьё", "Кричать дедушке", "Подбежать к Трою",
    "Отправиться искать антибиотики", "Попытаться найти лекарства в деревне",
    "Остаться с Троем", "Искать больницу", "Вернуться к Трою"
]

def create_database():
    """Создать базу данных и таблицы"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Создаём таблицу игроков
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS players (
            user_id INTEGER PRIMARY KEY,
            current_chapter TEXT NOT NULL DEFAULT 'intro',
            visited_chapters TEXT NOT NULL DEFAULT '[]',
            inventory TEXT NOT NULL DEFAULT '[]',
            choices_history TEXT NOT NULL DEFAULT '[]',
            name TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            play_time INTEGER DEFAULT 0,
            total_choices INTEGER DEFAULT 0
        )
    ''')
    
    # Создаём таблицу статистики
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS statistics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            total_players INTEGER DEFAULT 0,
            total_games_started INTEGER DEFAULT 0,
            total_games_completed INTEGER DEFAULT 0,
            most_popular_chapter TEXT,
            most_popular_choice TEXT,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Создаём таблицу достижений
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            achievement_id TEXT NOT NULL,
            achievement_name TEXT NOT NULL,
            unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES players(user_id)
        )
    ''')
    
    conn.commit()
    print(f"✅ База данных создана: {DB_PATH}")
    return conn

def generate_fake_player(user_id, name, chapter_index=None):
    """Генерировать фейкового игрока"""
    if chapter_index is None:
        chapter_index = random.randint(0, len(CHAPTERS) - 1)
    
    current_chapter = CHAPTERS[chapter_index]
    visited_chapters = CHAPTERS[:chapter_index + 1]
    
    # Генерируем случайный инвентарь
    inventory_size = random.randint(0, min(5, chapter_index + 1))
    inventory = random.sample(ITEMS, min(inventory_size, len(ITEMS)))
    
    # Генерируем историю выборов
    choices_history = []
    for i in range(min(chapter_index, len(CHOICES))):
        choices_history.append({
            'chapter': CHAPTERS[i] if i < len(CHAPTERS) else 'intro',
            'choice': random.randint(0, 2),
            'text': random.choice(CHOICES),
            'timestamp': (datetime.now() - timedelta(days=random.randint(1, 30))).isoformat()
        })
    
    return {
        'user_id': user_id,
        'current_chapter': current_chapter,
        'visited_chapters': visited_chapters,
        'inventory': inventory,
        'choices_history': choices_history,
        'name': name,
        'play_time': random.randint(60, 3600 * 24),  # От 1 минуты до 24 часов
        'total_choices': len(choices_history)
    }

def insert_fake_players(conn, count=10):
    """Вставить фейковых игроков в базу данных"""
    cursor = conn.cursor()
    
    # Очищаем таблицу перед вставкой (если нужно)
    cursor.execute('DELETE FROM players')
    cursor.execute('DELETE FROM achievements')
    
    for i in range(count):
        user_id = FAKE_USER_IDS[i] if i < len(FAKE_USER_IDS) else 100000000 + i
        name = FAKE_NAMES[i] if i < len(FAKE_NAMES) else f"Игрок_{i+1}"
        
        # Разнообразные прогрессы: от новичков до почти завершивших игру
        if i < 3:
            # Новички (первые 3 главы)
            chapter_index = random.randint(0, 3)
        elif i < 7:
            # Средний прогресс (середина игры)
            chapter_index = random.randint(4, 10)
        elif i < 9:
            # Продвинутые игроки
            chapter_index = random.randint(11, 15)
        else:
            # Почти завершили игру
            chapter_index = random.randint(16, len(CHAPTERS) - 1)
        
        player = generate_fake_player(user_id, name, chapter_index)
        
        # Вставляем игрока
        cursor.execute('''
            INSERT INTO players 
            (user_id, current_chapter, visited_chapters, inventory, 
             choices_history, name, play_time, total_choices, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            player['user_id'],
            player['current_chapter'],
            json.dumps(player['visited_chapters'], ensure_ascii=False),
            json.dumps(player['inventory'], ensure_ascii=False),
            json.dumps(player['choices_history'], ensure_ascii=False),
            player['name'],
            player['play_time'],
            player['total_choices'],
            datetime.now() - timedelta(days=random.randint(1, 90)),
            datetime.now() - timedelta(hours=random.randint(1, 48))
        ))
        
        # Добавляем случайные достижения для некоторых игроков
        if random.random() > 0.3:  # 70% игроков имеют достижения
            achievements = [
                ('survivor', 'Выживший'),
                ('defender', 'Защитник'),
                ('explorer', 'Исследователь'),
                ('warrior', 'Воин')
            ]
            for ach_id, ach_name in random.sample(achievements, random.randint(1, 3)):
                cursor.execute('''
                    INSERT INTO achievements (user_id, achievement_id, achievement_name, unlocked_at)
                    VALUES (?, ?, ?, ?)
                ''', (
                    user_id,
                    ach_id,
                    ach_name,
                    datetime.now() - timedelta(days=random.randint(1, 30))
                ))
    
    conn.commit()
    print(f"✅ Вставлено {count} фейковых игроков")

def insert_fake_statistics(conn):
    """Вставить фейковую статистику"""
    cursor = conn.cursor()
    
    cursor.execute('DELETE FROM statistics')
    
    cursor.execute('''
        INSERT INTO statistics 
        (total_players, total_games_started, total_games_completed, 
         most_popular_chapter, most_popular_choice, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (
        150,  # Всего игроков
        200,  # Всего начатых игр
        45,   # Завершённых игр
        'intro',
        'Продолжить',
        datetime.now()
    ))
    
    conn.commit()
    print("✅ Вставлена фейковая статистика")

def print_database_info(conn):
    """Вывести информацию о базе данных"""
    cursor = conn.cursor()
    
    # Количество игроков
    cursor.execute('SELECT COUNT(*) FROM players')
    player_count = cursor.fetchone()[0]
    
    # Количество достижений
    cursor.execute('SELECT COUNT(*) FROM achievements')
    achievement_count = cursor.fetchone()[0]
    
    # Средний прогресс
    cursor.execute('SELECT current_chapter FROM players')
    chapters = [row[0] for row in cursor.fetchall()]
    
    print("\n" + "="*50)
    print("📊 ИНФОРМАЦИЯ О БАЗЕ ДАННЫХ")
    print("="*50)
    print(f"Игроков в базе: {player_count}")
    print(f"Достижений разблокировано: {achievement_count}")
    print(f"Уникальных глав: {len(set(chapters))}")
    print("\nПримеры игроков:")
    
    cursor.execute('''
        SELECT user_id, name, current_chapter, total_choices 
        FROM players 
        LIMIT 5
    ''')
    for row in cursor.fetchall():
        print(f"  👤 {row[1]} (ID: {row[0]}) - Глава: {row[2]}, Выборов: {row[3]}")
    
    print("="*50 + "\n")

def main():
    """Главная функция"""
    print("🚀 Создание фейковой базы данных...")
    print("-" * 50)
    
    # Проверяем, существует ли база данных
    if Path(DB_PATH).exists():
        response = input(f"⚠️  База данных {DB_PATH} уже существует. Перезаписать? (y/n): ")
        if response.lower() != 'y':
            print("❌ Отменено")
            return
        Path(DB_PATH).unlink()
        print(f"🗑️  Старая база данных удалена")
    
    # Создаём базу данных
    conn = create_database()
    
    try:
        # Вставляем фейковых игроков
        player_count = int(input("Сколько игроков создать? (по умолчанию 10): ") or "10")
        insert_fake_players(conn, player_count)
        
        # Вставляем статистику
        insert_fake_statistics(conn)
        
        # Выводим информацию
        print_database_info(conn)
        
        print(f"✅ Фейковая база данных успешно создана: {DB_PATH}")
        
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == '__main__':
    main()
