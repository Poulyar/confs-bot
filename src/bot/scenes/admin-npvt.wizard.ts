import { Scenes, Markup } from 'telegraf';
import { CustomContext } from '../../types';
import { PlanService } from '../../services/plan.service';
import { NpvtService } from '../../services/npvt.service';
import { logger } from '../../utils/logger';
import { t, SupportedLanguage } from '../../locales';

export const adminNpvtWizard = new Scenes.WizardScene<CustomContext>(
    'ADMIN_NPVT_WIZARD',

    // Step 1: Ask admin to send a zip file
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';
        await ctx.reply(t(lang, 'admin_npvt_send_zip'));
        return ctx.wizard.next();
    },

    // Step 2: Receive the zip, then ask which plan
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        // Must be a document
        if (!ctx.message || !('document' in ctx.message)) {
            await ctx.reply(t(lang, 'admin_npvt_wrong_file'));
            return;
        }

        const doc = ctx.message.document;
        const fileName = doc.file_name?.toLowerCase() ?? '';

        if (!fileName.endsWith('.zip')) {
            await ctx.reply(t(lang, 'admin_npvt_wrong_file'));
            return;
        }

        // Download the zip
        const fileLink = await ctx.telegram.getFileLink(doc.file_id);
        const response = await fetch(fileLink.href);
        const arrayBuffer = await response.arrayBuffer();
        const zipBuffer = Buffer.from(arrayBuffer);

        // Store in scene state
        (ctx.scene.state as any).zipBuffer = zipBuffer;

        // Show plan selector
        const plans = await PlanService.getAllPlans();
        const buttons = plans.map(plan => [
            Markup.button.callback(`${plan.name}`, `npvt_plan_${plan.id}`)
        ]);
        buttons.push([Markup.button.callback('❌ Cancel', 'npvt_cancel')]);

        await ctx.reply(t(lang, 'admin_npvt_select_plan'), Markup.inlineKeyboard(buttons));
        return ctx.wizard.next();
    },

    // Step 3: Plan selected — extract zip and save to DB
    async (ctx) => {
        const lang = (ctx.dbUser?.language as SupportedLanguage) || 'en';

        if (!ctx.callbackQuery || !('data' in ctx.callbackQuery)) return;
        const action = ctx.callbackQuery.data;
        await ctx.answerCbQuery();

        if (action === 'npvt_cancel') {
            await ctx.reply('Upload cancelled.');
            return ctx.scene.leave();
        }

        if (!action.startsWith('npvt_plan_')) return;

        const planId = parseInt(action.split('_')[2], 10);
        const plan = await PlanService.getPlanById(planId);
        if (!plan) {
            await ctx.reply(t(lang, 'admin_npvt_error'));
            return ctx.scene.leave();
        }

        const { zipBuffer } = ctx.scene.state as any;

        try {
            const count = await NpvtService.saveFromZip(zipBuffer, planId);
            await ctx.reply(t(lang, 'admin_npvt_success', { count: count.toString(), planName: plan.name }));
        } catch (e: any) {
            logger.error(`NPVT upload error: ${e.message}`);
            if (e.message.includes('No .npvt files')) {
                await ctx.reply(t(lang, 'admin_npvt_no_npvt'));
            } else {
                await ctx.reply(t(lang, 'admin_npvt_error'));
            }
        }

        return ctx.scene.leave();
    }
);
