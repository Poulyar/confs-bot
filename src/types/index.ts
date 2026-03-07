import { Context, Scenes } from 'telegraf';
import { User } from '../database/entities';

// Define a custom context that extending Telegraf's Context
export interface CustomContext extends Context {
    // We attach our DB User entity here so other middlewares/commands can access it
    dbUser?: User;

    // Define scene session data if we use wizards later
    scene: Scenes.SceneContextScene<CustomContext, Scenes.WizardSessionData>;
    wizard: Scenes.WizardContextWizard<CustomContext>;
}
