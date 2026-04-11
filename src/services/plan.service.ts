import { AppDataSource } from '../database/data-source';
import { Plan } from '../database/entities';
import { Not } from 'typeorm';

export class PlanService {
    static getRepository() {
        return AppDataSource.getRepository(Plan);
    }

    /**
     * Retrieves all plans sorted by price ascending.
     * Excludes the auto-generated "Free Trial" plan since it cannot be purchased.
     */
    static async getAllPlans(): Promise<Plan[]> {
        return await this.getRepository().find({
            where: {
                name: Not('Free Trial'), // Hardcoded exclusion based on SubscriptionService gen name
                is_available: true
            },
            order: {
                price_usdt: 'ASC'
            }
        });
    }

    /**
     * Retrieves all plans for admin use, including the "Free Trial" plan.
     */
    static async getAllPlansForAdmin(): Promise<Plan[]> {
        return await this.getRepository().find({
            order: {
                price_usdt: 'ASC'
            }
        });
    }

    /**
     * Finds a plan by its ID.
     */
    static async getPlanById(id: number): Promise<Plan | null> {
        return await this.getRepository().findOne({ where: { id } });
    }
}
