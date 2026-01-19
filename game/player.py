"""
Система управления игроком и сохранениями
"""
import sqlite3
import json
from datetime import datetime


class Player:
    """Класс для представления игрока"""
    
    def __init__(self, user_id):
        self.user_id = user_id
        self.current_chapter = 'intro'
        self.visited_chapters = set(['intro'])
        self.inventory = []
        self.choices_history = []
        self.name = None
    
    def set_current_chapter(self, chapter_id):
        """Установить текущую главу"""
        self.current_chapter = chapter_id
        self.visited_chapters.add(chapter_id)
    
    def add_to_inventory(self, item):
        """Добавить предмет в инвентарь"""
        if item not in self.inventory:
            self.inventory.append(item)
    
    def add_choice(self, chapter_id, choice_index, choice_text):
        """Добавить выбор в историю"""
        self.choices_history.append({
            'chapter': chapter_id,
            'choice': choice_index,
            'text': choice_text
        })
    
    def to_dict(self):
        """Преобразовать игрока в словарь для сохранения"""
        return {
            'user_id': self.user_id,
            'current_chapter': self.current_chapter,
            'visited_chapters': list(self.visited_chapters),
            'inventory': self.inventory,
            'choices_history': self.choices_history,
            'name': self.name
        }
    
    @classmethod
    def from_dict(cls, data):
        """Создать игрока из словаря"""
        player = cls(data['user_id'])
        player.current_chapter = data.get('current_chapter', 'intro')
        player.visited_chapters = set(data.get('visited_chapters', ['intro']))
        player.inventory = data.get('inventory', [])
        player.choices_history = data.get('choices_history', [])
        player.name = data.get('name')
        return player


class SaveManager:
    """Менеджер для сохранения и загрузки игры"""
    
    def __init__(self, db_path='game_data.db'):
        self.db_path = db_path
        self._init_database()
    
    def _init_database(self):
        """Инициализировать базу данных"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Создаём таблицу игроков, если её нет
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
        
        conn.commit()
        conn.close()
    
    def _get_connection(self):
        """Получить подключение к базе данных"""
        return sqlite3.connect(self.db_path)
    
    def save_player(self, player):
        """Сохранить данные игрока в базу данных"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            player_dict = player.to_dict()
            
            cursor.execute('''
                INSERT OR REPLACE INTO players 
                (user_id, current_chapter, visited_chapters, inventory, 
                 choices_history, name, updated_at, total_choices)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                player_dict['user_id'],
                player_dict['current_chapter'],
                json.dumps(player_dict['visited_chapters'], ensure_ascii=False),
                json.dumps(player_dict['inventory'], ensure_ascii=False),
                json.dumps(player_dict['choices_history'], ensure_ascii=False),
                player_dict.get('name'),
                datetime.now().isoformat(),
                len(player_dict['choices_history'])
            ))
            
            conn.commit()
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def load_player(self, user_id):
        """Загрузить данные игрока из базы данных"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT user_id, current_chapter, visited_chapters, inventory, 
                       choices_history, name
                FROM players
                WHERE user_id = ?
            ''', (user_id,))
            
            row = cursor.fetchone()
            
            if row:
                return Player.from_dict({
                    'user_id': row[0],
                    'current_chapter': row[1],
                    'visited_chapters': json.loads(row[2]) if row[2] else [],
                    'inventory': json.loads(row[3]) if row[3] else [],
                    'choices_history': json.loads(row[4]) if row[4] else [],
                    'name': row[5]
                })
            
            return None
        finally:
            conn.close()
    
    def get_or_create_player(self, user_id):
        """Получить существующего игрока или создать нового"""
        player = self.load_player(user_id)
        if player is None:
            player = Player(user_id)
            self.save_player(player)
        return player
    
    def get_all_players(self):
        """Получить всех игроков (для статистики)"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('''
                SELECT user_id, current_chapter, visited_chapters, inventory, 
                       choices_history, name
                FROM players
            ''')
            
            players = []
            for row in cursor.fetchall():
                players.append(Player.from_dict({
                    'user_id': row[0],
                    'current_chapter': row[1],
                    'visited_chapters': json.loads(row[2]) if row[2] else [],
                    'inventory': json.loads(row[3]) if row[3] else [],
                    'choices_history': json.loads(row[4]) if row[4] else [],
                    'name': row[5]
                }))
            
            return players
        finally:
            conn.close()
    
    def delete_player(self, user_id):
        """Удалить игрока из базы данных"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('DELETE FROM players WHERE user_id = ?', (user_id,))
            conn.commit()
            return cursor.rowcount > 0
        finally:
            conn.close()
    
    def get_player_count(self):
        """Получить количество игроков"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute('SELECT COUNT(*) FROM players')
            return cursor.fetchone()[0]
        finally:
            conn.close()