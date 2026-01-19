"""
Скрипт для просмотра данных из фейковой базы данных
"""
import sqlite3
import json
from pathlib import Path

DB_PATH = 'game_data.db'

def view_database():
    """Просмотр содержимого базы данных"""
    if not Path(DB_PATH).exists():
        print(f"❌ База данных {DB_PATH} не найдена!")
        print("Сначала запустите: python create_fake_db.py")
        return
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    print("\n" + "="*70)
    print("📊 ПРОСМОТР БАЗЫ ДАННЫХ")
    print("="*70)
    
    # Общая статистика
    cursor.execute('SELECT COUNT(*) FROM players')
    player_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT COUNT(*) FROM achievements')
    achievement_count = cursor.fetchone()[0]
    
    print(f"\n📈 Общая статистика:")
    print(f"  • Всего игроков: {player_count}")
    print(f"  • Всего достижений: {achievement_count}")
    
    # Статистика по главам
    cursor.execute('SELECT current_chapter, COUNT(*) as count FROM players GROUP BY current_chapter ORDER BY count DESC')
    chapters = cursor.fetchall()
    
    print(f"\n📖 Прогресс по главам:")
    for chapter, count in chapters[:10]:
        print(f"  • {chapter}: {count} игроков")
    
    # Игроки с наибольшим прогрессом
    cursor.execute('''
        SELECT user_id, name, current_chapter, total_choices, play_time
        FROM players
        ORDER BY total_choices DESC
        LIMIT 5
    ''')
    
    print(f"\n🏆 Топ-5 игроков по прогрессу:")
    for i, (user_id, name, chapter, choices, play_time) in enumerate(cursor.fetchall(), 1):
        hours = play_time // 3600
        minutes = (play_time % 3600) // 60
        print(f"  {i}. {name} (ID: {user_id})")
        print(f"     Глава: {chapter} | Выборов: {choices} | Время: {hours}ч {minutes}м")
    
    # Детальная информация об игроке
    print(f"\n" + "-"*70)
    player_id = input("Введите user_id игрока для детального просмотра (или Enter для выхода): ").strip()
    
    if player_id:
        try:
            player_id = int(player_id)
            cursor.execute('''
                SELECT user_id, name, current_chapter, visited_chapters, 
                       inventory, choices_history, created_at, updated_at, 
                       play_time, total_choices
                FROM players
                WHERE user_id = ?
            ''', (player_id,))
            
            row = cursor.fetchone()
            
            if row:
                print(f"\n👤 Детальная информация об игроке:")
                print(f"  • ID: {row[0]}")
                print(f"  • Имя: {row[1] or 'Не указано'}")
                print(f"  • Текущая глава: {row[2]}")
                print(f"  • Посещённых глав: {len(json.loads(row[3]))}")
                print(f"  • Инвентарь: {', '.join(json.loads(row[4])) or 'Пусто'}")
                print(f"  • Всего выборов: {row[9]}")
                print(f"  • Время игры: {row[8] // 3600}ч {(row[8] % 3600) // 60}м")
                print(f"  • Создан: {row[6]}")
                print(f"  • Обновлён: {row[7]}")
                
                choices = json.loads(row[5])
                if choices:
                    print(f"\n  📚 История выборов:")
                    for i, choice in enumerate(choices[-5:], 1):  # Последние 5
                        print(f"    {i}. {choice.get('text', 'N/A')} (Глава: {choice.get('chapter', 'N/A')})")
            else:
                print(f"❌ Игрок с ID {player_id} не найден")
        except ValueError:
            print("❌ Неверный формат ID")
    
    conn.close()
    print("\n" + "="*70)

if __name__ == '__main__':
    view_database()
