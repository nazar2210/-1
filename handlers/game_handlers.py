"""
Обработчики для игры-новеллы
"""

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ContextTypes
from game.story import StoryManager
from game.player import SaveManager


story_manager = StoryManager()
save_manager = SaveManager()


async def start_game(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начать игру"""
    try:
        query = update.callback_query
        if query:
            await query.answer()
        
        user_id = update.effective_user.id
        player = save_manager.get_or_create_player(user_id)
        
        chapter = story_manager.get_chapter(player.current_chapter)
        if not chapter:
            chapter = story_manager.get_chapter('intro')
            player.set_current_chapter('intro')
        
        await send_chapter(update, context, chapter, player)
    except Exception as e:
        import logging
        logger = logging.getLogger(__name__)
        logger.error(f"Ошибка в start_game: {e}", exc_info=True)
        if update.callback_query:
            await update.callback_query.answer("Произошла ошибка. Попробуйте еще раз.", show_alert=True)
        elif update.message:
            await update.message.reply_text("Произошла ошибка. Попробуйте еще раз.")


async def send_chapter(update: Update, context: ContextTypes.DEFAULT_TYPE, 
                      chapter, player):
    """Отправить главу с выбором действий"""
    text = chapter.get_text_with_choices()
    
    keyboard = []
    if chapter.has_choices():
        for i, choice in enumerate(chapter.choices, 1):
            keyboard.append([
                InlineKeyboardButton(
                    f"{i}. {choice['text']}", 
                    callback_data=f"choice_{chapter.chapter_id}_{i-1}"
                )
            ])
    else:
        # Если нет выбора, предлагаем продолжить
        if chapter.next_chapter:
            keyboard.append([
                InlineKeyboardButton(
                    "Продолжить →", 
                    callback_data=f"next_{chapter.next_chapter}"
                )
            ])
    
    keyboard.append([
        InlineKeyboardButton("📖 Меню", callback_data="menu"),
        InlineKeyboardButton("💾 Сохранить", callback_data="save")
    ])
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    if update.callback_query:
        await update.callback_query.edit_message_text(
            text=text,
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )
    else:
        await update.message.reply_text(
            text=text,
            reply_markup=reply_markup,
            parse_mode='Markdown'
        )


async def handle_choice(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработать выбор игрока"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    player = save_manager.get_or_create_player(user_id)
    
    data = query.data
    
    if data.startswith('choice_'):
        # Обработка выбора (формат: choice_{chapter_id}_{choice_index})
        parts = data.split('_')
        if len(parts) >= 3:
            # Берём последний элемент как индекс, всё остальное (кроме 'choice') как chapter_id
            choice_index = int(parts[-1])
            chapter_id = '_'.join(parts[1:-1])  # Объединяем всё между 'choice' и индексом
            
            current_chapter = story_manager.get_chapter(chapter_id)
            if current_chapter and current_chapter.choices:
                if 0 <= choice_index < len(current_chapter.choices):
                    choice = current_chapter.choices[choice_index]
                    player.add_choice(chapter_id, choice_index, choice['text'])
                    
                    next_chapter = story_manager.get_next_chapter(chapter_id, choice_index)
                    if next_chapter:
                        player.set_current_chapter(next_chapter.chapter_id)
                        save_manager.save_player(player)
                        await send_chapter(update, context, next_chapter, player)
                    else:
                        await query.edit_message_text("Ошибка: следующая глава не найдена.")
                else:
                    await query.edit_message_text("Ошибка: неверный индекс выбора.")
            else:
                await query.edit_message_text("Ошибка: глава не найдена или нет выборов.")
    
    elif data.startswith('next_'):
        # Переход к следующей главе
        chapter_id = data.split('_', 1)[1]
        next_chapter = story_manager.get_chapter(chapter_id)
        if next_chapter:
            player.set_current_chapter(next_chapter.chapter_id)
            save_manager.save_player(player)
            await send_chapter(update, context, next_chapter, player)
    
    elif data == 'menu':
        await show_menu(update, context, player)
    
    elif data == 'save':
        save_manager.save_player(player)
        await query.answer("Игра сохранена! ✅", show_alert=True)


async def show_menu(update: Update, context: ContextTypes.DEFAULT_TYPE, player):
    """Показать меню игры"""
    query = update.callback_query
    await query.answer()
    
    text = f"""*📖 Меню игры*

Текущая глава: {player.current_chapter}
Посещённых глав: {len(player.visited_chapters)}

*Доступные действия:*"""
    
    keyboard = [
        [InlineKeyboardButton("▶️ Продолжить игру", callback_data=f"continue_{player.current_chapter}")],
        [InlineKeyboardButton("🔄 Начать заново", callback_data="restart")],
        [InlineKeyboardButton("📚 История выборов", callback_data="history")],
        [InlineKeyboardButton("❌ Закрыть меню", callback_data=f"continue_{player.current_chapter}")]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        text=text,
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )


async def handle_continue(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Продолжить игру с текущей главы"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    player = save_manager.get_or_create_player(user_id)
    
    # Проверяем формат callback_data (может быть continue_{chapter_id} или просто continue)
    data = query.data
    if data.startswith('continue_'):
        chapter_id = data.split('_', 1)[1]
        chapter = story_manager.get_chapter(chapter_id)
    else:
        chapter = story_manager.get_chapter(player.current_chapter)
    
    if chapter:
        await send_chapter(update, context, chapter, player)


async def handle_restart(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Начать игру заново"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    player = save_manager.get_or_create_player(user_id)
    player.current_chapter = 'intro'
    player.visited_chapters = set(['intro'])
    player.choices_history = []
    save_manager.save_player(player)
    
    chapter = story_manager.get_chapter('intro')
    await send_chapter(update, context, chapter, player)


async def handle_history(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Показать историю выборов"""
    query = update.callback_query
    await query.answer()
    
    user_id = update.effective_user.id
    player = save_manager.get_or_create_player(user_id)
    
    if not player.choices_history:
        text = "История выборов пуста."
    else:
        text = "*📚 История ваших выборов:*\n\n"
        for i, choice_entry in enumerate(player.choices_history[-10:], 1):
            text += f"{i}. {choice_entry['text']}\n"
    
    keyboard = [[InlineKeyboardButton("⬅️ Назад", callback_data="menu")]]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await query.edit_message_text(
        text=text,
        reply_markup=reply_markup,
        parse_mode='Markdown'
    )
