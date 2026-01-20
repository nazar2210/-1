"""
Конфигурация бота
"""
import os
from dotenv import load_dotenv
from pathlib import Path

# Определяем путь к директории, где находится config.py
BASE_DIR = Path(__file__).resolve().parent

# Загружаем .env из той же директории, где находится config.py
env_path = BASE_DIR / '.env'

# Пробуем загрузить через dotenv
if env_path.exists():
    load_dotenv(dotenv_path=str(env_path), override=True)
else:
    # Пробуем загрузить из текущей директории
    load_dotenv(override=True)

# Получаем токен из переменных окружения
BOT_TOKEN = os.getenv('BOT_TOKEN')
if BOT_TOKEN:
    BOT_TOKEN = BOT_TOKEN.strip()

# Если токен не загрузился через dotenv, пытаемся прочитать напрямую из файла
if not BOT_TOKEN or BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
    if env_path.exists():
        try:
            with open(env_path, 'r', encoding='utf-8-sig') as f:  # utf-8-sig удаляет BOM если есть
                for line in f:
                    line = line.strip()
                    if line.startswith('BOT_TOKEN='):
                        BOT_TOKEN = line.split('=', 1)[1].strip()
                        # Сохраняем в переменные окружения для дальнейшего использования
                        os.environ['BOT_TOKEN'] = BOT_TOKEN
                        break
        except Exception:
            pass

# Устанавливаем значение по умолчанию, если токен всё ещё не найден
if not BOT_TOKEN:
    BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE'

DATABASE_PATH = 'game_data.db'

# Настройки оплаты (ЮKassa + СБП)
YOOKASSA_SHOP_ID = os.getenv('YOOKASSA_SHOP_ID', '')
YOOKASSA_SECRET_KEY = os.getenv('YOOKASSA_SECRET_KEY', '')
PAYMENT_RETURN_URL = os.getenv('PAYMENT_RETURN_URL', 'https://nazar-roan.vercel.app/')
PREMIUM_PRICE_RUB = os.getenv('PREMIUM_PRICE_RUB', '199.00')
PAYMENT_SERVER_URL = os.getenv('PAYMENT_SERVER_URL', 'http://localhost:9000')
ADMIN_API_TOKEN = os.getenv('ADMIN_API_TOKEN', '').strip()

# Администраторы бота (список user_id через запятую)
_admin_env = [
    int(value.strip())
    for value in os.getenv('ADMIN_USER_IDS', '').split(',')
    if value.strip().isdigit()
]
# Резервные админы (если ADMIN_USER_IDS не задан)
ADMIN_USER_IDS = _admin_env or [5421268585, 7966676163]