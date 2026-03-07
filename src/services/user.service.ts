import { AppDataSource } from '../database/data-source';
import { User, InvitationCode } from '../database/entities';

const userRepository = AppDataSource.getRepository(User);
const invitationRepository = AppDataSource.getRepository(InvitationCode);

export class UserService {
    /**
     * Finds a user by their Telegram ID
     */
    static async findByTelegramId(telegramId: number): Promise<User | null> {
        return userRepository.findOne({ where: { telegram_id: telegramId } });
    }

    /**
     * Validates an invitation code and creates a new user if valid.
     */
    static async useInvitationAndCreateUser(telegramId: number, username: string | undefined, codeStr: string): Promise<User | null> {
        // 1. Find the code
        const invCode = await invitationRepository.findOne({
            where: { code: codeStr, is_used: false },
            relations: ['creator']
        });

        if (!invCode) {
            return null; // Invalid or already used
        }

        // 2. Wrap in transaction to ensure atomicity
        return await AppDataSource.transaction(async (transactionalEntityManager) => {
            // Create user
            const newUser = new User();
            newUser.telegram_id = telegramId;
            newUser.username = username || '';
            newUser.invited_by_user_id = invCode.creator_id;

            const savedUser = await transactionalEntityManager.save(newUser);

            // Mark code as used
            invCode.is_used = true;
            invCode.used_by_id = savedUser.id;
            await transactionalEntityManager.save(invCode);

            return savedUser;
        });
    }

    static async generateInvitationCode(creatorId: number, count: number = 1): Promise<InvitationCode[]> {
        const codes: InvitationCode[] = [];
        for (let i = 0; i < count; i++) {
            const code = new InvitationCode();
            // Generate a random 10 character code
            code.code = Math.random().toString(36).substring(2, 12).toUpperCase();
            code.creator_id = creatorId;
            codes.push(code);
        }
        return await invitationRepository.save(codes);
    }
}
