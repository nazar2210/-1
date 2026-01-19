"""
Тестовый скрипт для проверки работы базы данных
"""
import sys
from pathlib import Path
from game.player import SaveManager, Player

def test_database():
    """Тестирование работы с базой данных"""
    print("🧪 Тестирование базы данных...")
    print("-" * 50)
    
    # Проверяем наличие базы данных
    db_path = 'game_data.db'
    if not Path(db_path).exists():
        print(f"⚠️  База данных {db_path} не найдена.")
        print("Создайте её с помощью: python create_fake_db.py")
        return False
    
    try:
        save_manager = SaveManager(db_path=db_path)
        
        # Тест 1: Получение количества игроков
        print("\n✅ Тест 1: Подсчёт игроков")
        count = save_manager.get_player_count()
        print(f"   Найдено игроков: {count}")
        
        if count == 0:
            print("   ⚠️  База данных пуста. Запустите create_fake_db.py")
            return False
        
        # Тест 2: Загрузка первого игрока
        print("\n✅ Тест 2: Загрузка игрока")
        all_players = save_manager.get_all_players()
        if all_players:
            test_player = all_players[0]
            print(f"   Загружен игрок: {test_player.user_id}")
            print(f"   Текущая глава: {test_player.current_chapter}")
            print(f"   Инвентарь: {test_player.inventory}")
            print(f"   Выборов в истории: {len(test_player.choices_history)}")
        else:
            print("   ❌ Не удалось загрузить игроков")
            return False
        
        # Тест 3: Создание нового игрока
        print("\n✅ Тест 3: Создание нового игрока")
        new_player = Player(user_id=999999999)
        new_player.name = "Тестовый Игрок"
        new_player.set_current_chapter('intro')
        new_player.add_to_inventory('Тестовый предмет')
        new_player.add_choice('intro', 0, 'Тестовый выбор')
        
        save_manager.save_player(new_player)
        print(f"   Создан игрок: {new_player.user_id}")
        
        # Тест 4: Загрузка созданного игрока
        print("\n✅ Тест 4: Загрузка созданного игрока")
        loaded_player = save_manager.load_player(999999999)
        if loaded_player:
            print(f"   ✅ Игрок успешно загружен")
            print(f"   Имя: {loaded_player.name}")
            print(f"   Глава: {loaded_player.current_chapter}")
            print(f"   Инвентарь: {loaded_player.inventory}")
            
            if loaded_player.inventory == ['Тестовый предмет']:
                print("   ✅ Инвентарь сохранён корректно")
            else:
                print("   ❌ Ошибка: инвентарь не совпадает")
                return False
        else:
            print("   ❌ Не удалось загрузить игрока")
            return False
        
        # Тест 5: Обновление игрока
        print("\n✅ Тест 5: Обновление игрока")
        loaded_player.set_current_chapter('chapter2')
        loaded_player.add_to_inventory('Второй предмет')
        save_manager.save_player(loaded_player)
        
        updated_player = save_manager.load_player(999999999)
        if updated_player.current_chapter == 'chapter2' and len(updated_player.inventory) == 2:
            print("   ✅ Игрок успешно обновлён")
        else:
            print("   ❌ Ошибка при обновлении")
            return False
        
        # Тест 6: get_or_create_player
        print("\n✅ Тест 6: get_or_create_player")
        player = save_manager.get_or_create_player(888888888)
        print(f"   Получен/создан игрок: {player.user_id}")
        
        # Тест 7: Удаление тестового игрока
        print("\n✅ Тест 7: Удаление тестового игрока")
        deleted = save_manager.delete_player(999999999)
        if deleted:
            print("   ✅ Тестовый игрок удалён")
        else:
            print("   ⚠️  Не удалось удалить игрока")
        
        # Финальная статистика
        print("\n" + "="*50)
        print("📊 ФИНАЛЬНАЯ СТАТИСТИКА")
        print("="*50)
        final_count = save_manager.get_player_count()
        print(f"Всего игроков в базе: {final_count}")
        
        print("\n✅ Все тесты пройдены успешно!")
        return True
        
    except Exception as e:
        print(f"\n❌ Ошибка при тестировании: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == '__main__':
    success = test_database()
    sys.exit(0 if success else 1)
