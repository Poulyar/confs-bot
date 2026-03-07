import { CustomContext } from '../../types';
import { UserService } from '../../services/user.service';

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

        return await next(); // Proceed to next handler
    } else {
        // User does not exist (Gatekeeping phase)

        // Check if the message is a text containing a potential code
        if (ctx.message && 'text' in ctx.message) {
            const text = ctx.message.text.trim();

            // Ignore /start command itself, ask for code instead
            if (text === '/start') {
                await ctx.reply('Welcome to Napster VPN VIP.\nThis is an invite-only service. Please enter your invitation code:');
                return;
            }

            // Try to use the text as an invitation code
            const newUser = await UserService.useInvitationAndCreateUser(ctx.from.id, ctx.from.username, text);

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
