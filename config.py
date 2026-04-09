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

# Абсолютный путь: иначе при другом cwd у payment_server и бота появляются разные БД и «слетает» премиум
DATABASE_PATH = os.getenv('DATABASE_PATH', str(BASE_DIR / 'game_data.db'))

# Настройки оплаты (ЮKassa + СБП)
YOOKASSA_SHOP_ID = os.getenv('YOOKASSA_SHOP_ID', '')
YOOKASSA_SECRET_KEY = os.getenv('YOOKASSA_SECRET_KEY', '')
PAYMENT_RETURN_URL = os.getenv('PAYMENT_RETURN_URL', 'https://webapp-blue-mu.vercel.app/')
PREMIUM_PRICE_RUB = os.getenv('PREMIUM_PRICE_RUB', '99.00')
PAYMENT_SERVER_URL = os.getenv('PAYMENT_SERVER_URL', 'http://localhost:9000')
ADMIN_API_TOKEN = os.getenv('ADMIN_API_TOKEN', '').strip()

# Пробные одноразовые промокоды (только цифры), через запятую. Пустая строка — не создавать коды при старте.
_default_trial_promos = (
    '384729105847,592038475610,847362918405,192837465029,638291047583,'
    '475829103647,291047583629,847510293846,563829104758,729384756102'
)
_trial_raw = os.getenv('TRIAL_PROMO_CODES', _default_trial_promos)
TRIAL_PROMO_CODES = [c.strip() for c in _trial_raw.split(',') if c.strip() and c.strip().isdigit()]

# Администраторы бота (список user_id через запятую)
_admin_env = [
    int(value.strip())
    for value in os.getenv('ADMIN_USER_IDS', '').split(',')
    if value.strip().isdigit()
]
# Резервные админы (если ADMIN_USER_IDS не задан)
ADMIN_USER_IDS = _admin_env or [5421268585, 7966676163]