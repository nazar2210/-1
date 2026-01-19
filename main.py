"""
Главный файл для запуска Telegram-бота игры-новеллы "Пандемия. Эпоха хаоса"
"""

import logging
import sqlite3
from datetime import datetime
import requests
from telegram import Update
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes, MessageHandler, filters

import config
from handlers import game_handlers

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /start"""
    try:
        user = update.effective_user
        logger.info(f"Получена команда /start от пользователя {user.id} ({user.first_name})")
        
        welcome_text = f"""
Привет.

Добро пожаловать в квест-игру *"Мор. Эпоха мёртвых"*

🎮 *Откройте мини-приложение для полного игрового опыта!*

В игре вас ждут:
✨ Красивая графика и атмосфера.
🎵 Фоновая музыка и звуковые эффекты.
📖 Интерактивный сюжет с выбором.
💾 Система сохранений доступна по платной подписке.
"""
        
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
        
        # URL вашего веб-приложения
        web_app_url = "https://nazar-roan.vercel.app/"
        
        keyboard = [[
            InlineKeyboardButton(
                "🎮 Открыть игру", 
                web_app=WebAppInfo(url=web_app_url)
            )
        ], [
            InlineKeyboardButton("📖 О игре", callback_data="about_game")
        ]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            welcome_text,
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
        logger.info(f"Сообщение /start отправлено пользователю {user.id}")
    except Exception as e:
        logger.error(f"Ошибка в обработчике /start: {e}", exc_info=True)
        try:
            await update.message.reply_text("Произошла ошибка. Попробуйте еще раз.")
        except:
            pass


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /help"""
    help_text = """
*📖 Помощь по игре*

*Команды:*
/start - Начать игру или вернуться в главное меню
/help - Показать эту справку
/continue - Продолжить игру с последней сохранённой главы
/grant_premium - Выдать подписку (админ)
/whoami - Показать ваш user_id

*Игровой процесс:*
- Читайте текст глав
- Выбирайте действия с помощью кнопок
- Ваши решения влияют на сюжет
- Используйте меню для управления игрой
- Регулярно сохраняйте прогресс

*Удачи в выживании!* 🎮
"""
    await update.message.reply_text(help_text, parse_mode='Markdown')


async def continue_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик команды /continue"""
    await game_handlers.handle_continue(update, context)


def ensure_premium_tables():
    conn = sqlite3.connect(config.DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS premium_users (
            user_id INTEGER PRIMARY KEY,
            is_active INTEGER NOT NULL DEFAULT 0,
            activated_at TEXT,
            payment_id TEXT
        )
        """
    )
    conn.commit()
    conn.close()


def set_premium_active(user_id: int, payment_id: str | None = None):
    ensure_premium_tables()
    conn = sqlite3.connect(config.DATABASE_PATH)
    cursor = conn.cursor()
    now = datetime.utcnow().isoformat()
    cursor.execute(
        """
        INSERT INTO premium_users (user_id, is_active, activated_at, payment_id)
        VALUES (?, 1, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            is_active=1,
            activated_at=excluded.activated_at,
            payment_id=excluded.payment_id
        """,
        (user_id, now, payment_id),
    )
    conn.commit()
    conn.close()


def is_admin(user_id: int) -> bool:
    return user_id in config.ADMIN_USER_IDS


async def grant_premium(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Выдать подписку пользователю (админ)"""
    user = update.effective_user
    logger.info(f"Команда /grant_premium от пользователя {user.id if user else 'unknown'}")
    if not user or not is_admin(user.id):
        admins = ", ".join(str(uid) for uid in config.ADMIN_USER_IDS) or "не задано"
        await update.message.reply_text(
            f"⛔️ Недостаточно прав.\nВаш user_id: {user.id if user else 'неизвестен'}\nАдмины: {admins}"
        )
        return

    target_id = user.id
    if context.args:
        try:
            target_id = int(context.args[0])
        except ValueError:
            await update.message.reply_text("Неверный user_id. Пример: /grant_premium 123456789")
            return

    # Если указан внешний payment server, пробуем выдать подписку там
    if config.PAYMENT_SERVER_URL and config.ADMIN_API_TOKEN:
        try:
            response = requests.post(
                f"{config.PAYMENT_SERVER_URL}/api/admin/grant",
                json={"user_id": target_id},
                headers={"X-Admin-Token": config.ADMIN_API_TOKEN},
                timeout=10,
            )
            if response.ok:
                await update.message.reply_text(f"✅ Подписка активирована для user_id: {target_id}")
                return
            await update.message.reply_text(
                f"❌ Ошибка сервера оплаты: {response.status_code} {response.text}"
            )
            return
        except Exception as e:
            await update.message.reply_text(f"❌ Ошибка соединения с сервером оплаты: {e}")
            return

    set_premium_active(target_id)
    await update.message.reply_text(f"✅ Подписка активирована для user_id: {target_id}")


async def whoami(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать user_id отправителя"""
    user = update.effective_user
    if not user:
        await update.message.reply_text("Не удалось определить user_id.")
        return
    await update.message.reply_text(f"Ваш user_id: {user.id}")


async def admin_list(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать список админов"""
    admins = ", ".join(str(uid) for uid in config.ADMIN_USER_IDS) or "не задано"
    await update.message.reply_text(f"Админы: {admins}")


async def unknown_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Ответ на неизвестные команды"""
    if update.message:
        await update.message.reply_text(
            "Команда не распознана.\nДоступные: /start /help /whoami /grant_premium"
        )


async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработчик callback-запросов"""
    query = update.callback_query
    if not query:
        return
    
    await query.answer()
    data = query.data
    
    if data == 'about_game':
        about_text = """
*📖 О игре "Мор. Эпоха мёртвых"*

Интерактивная текстовая квест-игра, основанная на сюжете о выживании во время пандемии.

*Сюжет:*
Вы играете за главного героя, который вместе с дедушкой и верным псом пытается выжить в мире, охваченном хаосом. Ваши решения влияют на развитие сюжета и судьбу персонажей.

*Особенности:*
✨ Красивая графика и атмосфера
🎵 Фоновая музыка и звуковые эффекты
📖 Интерактивный сюжет с выбором
💾 Система сохранений

*Удачи в выживании!* 🎮
"""
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
        
        keyboard = [[
            InlineKeyboardButton("⬅️ Назад", callback_data="back_to_start")
        ]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(about_text, reply_markup=reply_markup, parse_mode='Markdown')
    elif data == 'start_game':
        await game_handlers.start_game(update, context)
    elif data.startswith('choice_') or data.startswith('next_'):
        await game_handlers.handle_choice(update, context)
    elif data.startswith('continue_'):
        await game_handlers.handle_continue(update, context)
    elif data == 'restart':
        await game_handlers.handle_restart(update, context)
    elif data == 'menu':
        await game_handlers.handle_choice(update, context)
    elif data == 'save':
        await game_handlers.handle_choice(update, context)
    elif data == 'history':
        await game_handlers.handle_history(update, context)
    elif data == 'back_to_start':
        # Возврат к начальному сообщению с кнопкой открыть игру
        welcome_text = f"""
Привет.

Добро пожаловать в квест-игру *"Мор. Эпоха мёртвых"*

🎮 *Откройте мини-приложение для полного игрового опыта!*

В игре вас ждут:
✨ Красивая графика и атмосфера.
🎵 Фоновая музыка и звуковые эффекты.
📖 Интерактивный сюжет с выбором.
💾 Система сохранений доступна по платной подписке.
"""
        from telegram import InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
        
        web_app_url = "https://nazar-roan.vercel.app/"
        
        keyboard = [[
            InlineKeyboardButton(
                "🎮 Открыть игру", 
                web_app=WebAppInfo(url=web_app_url)
            )
        ], [
            InlineKeyboardButton("📖 О игре", callback_data="about_game")
        ]]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await query.edit_message_text(welcome_text, reply_markup=reply_markup, parse_mode='Markdown')


async def set_bot_info(application):
    """Устанавливает информацию о боте (название, описание)"""
    try:
        from telegram import Bot
        bot = Bot(token=config.BOT_TOKEN)
        
        # Устанавливаем имя бота
        await bot.set_my_name("Мор. Эпоха мёртвых")
        
        # Устанавливаем описание бота
        await bot.set_my_description(
            "🎮 Интерактивная квест-игра о выживании в эпоху хаоса. "
            "Красивая графика, атмосферная музыка и захватывающий сюжет!"
        )
        
        # Устанавливаем короткое описание (для команды /start)
        await bot.set_my_short_description(
            "🎮 Интерактивная квест-игра о выживании"
        )
        
        logger.info("Информация о боте обновлена")
    except Exception as e:
        logger.warning(f"Не удалось установить информацию о боте: {e}")
        logger.info("Вы можете установить имя и описание бота вручную через @BotFather")


def main():
    """Главная функция запуска бота"""
    if config.BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
        logger.error("Пожалуйста, установите BOT_TOKEN в файле .env или config.py")
        return
    
    # Создание приложения
    application = Application.builder().token(config.BOT_TOKEN).build()
    
    # Установка информации о боте (название, описание)
    # Примечание: Для установки аватарки нужно использовать @BotFather вручную
    async def post_init(app: Application):
        await set_bot_info(app)
    
    application.post_init = post_init
    
    # Регистрация обработчиков
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("continue", continue_command))
    application.add_handler(CommandHandler("grant_premium", grant_premium))
    application.add_handler(CommandHandler("whoami", whoami))
    application.add_handler(CommandHandler("admin_list", admin_list))
    application.add_handler(MessageHandler(filters.COMMAND, unknown_command))
    application.add_handler(CallbackQueryHandler(callback_handler))
    
    logger.info(f"Админы: {config.ADMIN_USER_IDS}")
    # Запуск бота
    logger.info("Бот запущен!")
    logger.info("Примечание: Для установки аватарки бота используйте @BotFather -> /setuserpic")
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
