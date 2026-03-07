import { AppDataSource } from './database/data-source';
import { User, InvitationCode } from './database/entities';

async function seed() {
    await AppDataSource.initialize();

    const userRepository = AppDataSource.getRepository(User);
    const codeRepository = AppDataSource.getRepository(InvitationCode);

    /*
     * CHANGE THIS to your actual Telegram User ID so you can act as Admin
     */
    const ADMIN_TELEGRAM_ID = 123456789;

    console.log(`Seeding Admin User ID: ${ADMIN_TELEGRAM_ID}...`);

    let admin = await userRepository.findOne({ where: { telegram_id: ADMIN_TELEGRAM_ID } });
    if (!admin) {
        admin = new User();
        admin.telegram_id = ADMIN_TELEGRAM_ID;
        admin.username = 'Admin';
        admin.is_active = true;
        // Hardcode ID to 1 for our admin checks
        admin.id = 1;
        await userRepository.save(admin);
        console.log('Admin user created!');
    } else {
        console.log('Admin user already exists.');
    }

    console.log('Generating 1 free invitation code: VIP-TEST-2026');

    let code = await codeRepository.findOne({ where: { code: 'VIP-TEST-2026' } });
    if (!code) {
        code = new InvitationCode();
        code.code = 'VIP-TEST-2026';
        code.creator_id = admin.id;
        await codeRepository.save(code);
        console.log('Invitation Code VIP-TEST-2026 created!');
    } else {
        console.log('Invitation Code already exists.');
    }


    console.log('Seed complete. You can exit and run the bot now.');
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
