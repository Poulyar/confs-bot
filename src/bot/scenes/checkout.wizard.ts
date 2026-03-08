import { Scenes, Markup } from 'telegraf';
import { CustomContext } from '../../types';
import { PlanService } from '../../services/plan.service';
import { logger } from '../../utils/logger';

// Hardcoded Dummy Wallets for now
const WALLETS = {
    'TRC20': 'T-DummyAddress-TRC20-123456',
    'ERC20': '0x-DummyAddress-ERC20-123456',
    'TON': 'UQ-DummyAddress-TON-123456'
};

export const checkoutWizard = new Scenes.WizardScene<CustomContext>(
    'CHECKOUT_WIZARD',

    // Step 1: User just clicked a plan, ask for Network
    async (ctx) => {
        // We expect the payload to be like: buy_plan_1
        // But since this is step 1 of the wizard, we actually need to capture that ID
        // when they enter the scene. We will pass it in the scene state.
        const planId = (ctx.scene.state as any).planId;

        if (!planId) {
            await ctx.reply("Error: No plan selected. Please try again.");
            return ctx.scene.leave();
        }

        const plan = await PlanService.getPlanById(Number(planId));
        if (!plan) {
            await ctx.reply("Error: Plan not found.");
            return ctx.scene.leave();
        }

        (ctx.scene.state as any).plan = plan;

        const networkKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('USDT (TRC20)', 'network_TRC20')],
            [Markup.button.callback('USDT (ERC20)', 'network_ERC20')],
            [Markup.button.callback('USDT (TON)', 'network_TON')],
            [Markup.button.callback('❌ Cancel', 'cancel_checkout')]
        ]);

        await ctx.reply(
            `You selected: *${plan.name}*\nPrice: *$${plan.price_usdt} USDT*\n\nPlease select your preferred network for payment:`,
            { parse_mode: 'Markdown', ...networkKeyboard }
        );

        return ctx.wizard.next();
    },

    // Step 2: Handle Network Selection & Ask for TXID
    async (ctx) => {
        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) {
            await ctx.reply("Please click one of the network buttons.");
            return;
        }

        const action = ctx.callbackQuery.data;

        if (action === 'cancel_checkout') {
            await ctx.reply("Checkout cancelled.");
            await ctx.answerCbQuery();
            return ctx.scene.leave();
        }

        if (!action.startsWith('network_')) {
            await ctx.reply("Invalid network selection.");
            return;
        }

        const network = action.split('_')[1] as keyof typeof WALLETS;
        const walletAddress = WALLETS[network];
        const plan = (ctx.scene.state as any).plan;

        (ctx.scene.state as any).network = network;

        await ctx.answerCbQuery();
        await ctx.reply(
            `🏦 *Payment Instructions*\n\n` +
            `Please send exactly *$${plan.price_usdt} USDT* via *${network}* network to the following address:\n\n` +
            `\`${walletAddress}\`\n\n` +
            `_Tap the address above to copy it._\n\n` +
            `⏳ Once you have sent the payment, please **reply to this message** with your **Transaction ID (TXID) / Hash**.`,
            { parse_mode: 'Markdown' }
        );

        return ctx.wizard.next();
    },

    // Step 3: Receive TXID
    async (ctx) => {
        if (!ctx.message || !('text' in ctx.message)) {
            await ctx.reply("Please send your Transaction ID (TXID) as text.");
            return;
        }

        const txid = ctx.message.text.trim();
        const state = ctx.scene.state as any;

        // Note: For now, we mock the success. In Phase 2, we will save this to the DB as 'pending'
        // and notify admins or auto-check the blockchain.

        await ctx.reply(
            `✅ *Payment Received!*\n\n` +
            `Thank you. We have recorded your TXID:\n\`${txid}\`\n\n` +
            `Your payment is now **Processing**. Once verified, your VPN configuration will be delivered here automatically.`,
            { parse_mode: 'Markdown' }
        );

        return ctx.scene.leave();
    }
);
