import { CustomContext } from '../../types';
import { UserService } from '../../services/user.service';
import { Markup } from 'telegraf';
import { en } from '../../locales/en';

export const authMiddleware = async (ctx: CustomContext, next: () => Promise<void>) => {
    if (!ctx.from) {
        return await next();
    }

    // Find user in database
    const user = await UserService.findByTelegramId(ctx.from.id);

    if (user) {
        // User exists, attach to context
        ctx.dbUser = user;

        if (!user.is_active) {
            await ctx.reply('Your account has been deactivated. Please contact support.');
            return;
        }

        // If the user hasn't selected a language yet, force them to do so before proceeding
        if (!user.language) {
            // Allow the callback queries for language selection to pass through
            if (ctx.callbackQuery && 'data' in ctx.callbackQuery) {
                const data = ctx.callbackQuery.data;
                if (data === 'set_lang_en' || data === 'set_lang_fa') {
                    return await next();
                }
            }

            const langKeyboard = Markup.inlineKeyboard([
                Markup.button.callback('🇺🇸 English', 'set_lang_en'),
                Markup.button.callback('🇮🇷 فارسی', 'set_lang_fa')
            ]);
            await ctx.reply(en.choose_language_first, langKeyboard);
            return;
        }

        return await next(); // Proceed to next handler
    } else {
        // User does not exist (Gatekeeping phase)

        // Check if the message is a text containing a potential code
        if (ctx.message && 'text' in ctx.message) {
            const text = ctx.message.text.trim();

            // If they just typed /start, ask for the code
            if (text === '/start') {
                await ctx.reply('Welcome to vPrivate VPN VIP.\nThis is an invite-only service. Please enter your invitation code:');
                return;
            }

            // If they used a deep-link: /start <CODE>
            let potentialCode = text;
            if (text.startsWith('/start ')) {
                potentialCode = text.split(' ')[1].trim();
            }

            // Try to use the code
            const newUser = await UserService.useInvitationAndCreateUser(ctx.from.id, ctx.from.username, potentialCode);

            if (newUser) {
                ctx.dbUser = newUser;
                await ctx.reply('Invitation accepted! Welcome aboard. Type /start to see the main menu.');
                // We could proceed next() here, but forcing them to re-type /start is often cleaner for state
                return;
            } else {
                await ctx.reply('Invalid or expired invitation code. Please try again or type /start.');
                return;
            }
        }

        // Default response for non-text or unhandled states
        await ctx.reply('Access denied. Please send a valid invitation code.');
    }
};
