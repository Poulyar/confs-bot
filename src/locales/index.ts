import { en } from './en';
import { fa } from './fa';

const dictionaries = { en, fa };

export type SupportedLanguage = 'en' | 'fa';
export type TranslationKey = keyof typeof en;

export function t(lang: SupportedLanguage, key: TranslationKey, params: Record<string, string | number> = {}): string {
    let text = dictionaries[lang][key] || dictionaries['en'][key];

    for (const [k, v] of Object.entries(params)) {
        text = text.replace(new RegExp(`{{${k}}}`, 'g'), String(v));
    }

    return text;
}
