import { AppDataSource } from '../database/data-source';
import { Plan } from '../database/entities';

export class PlanService {
    static getRepository() {
        return AppDataSource.getRepository(Plan);
    }

    /**
     * Retrieves all plans sorted by price ascending.
     */
    static async getAllPlans(): Promise<Plan[]> {
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
