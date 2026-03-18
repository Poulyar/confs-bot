import { AppDataSource } from '../database/data-source';
import { NpvtConfig } from '../database/entities/NpvtConfig';

export class NpvtService {

    static getRepository() {
        return AppDataSource.getRepository(NpvtConfig);
    }

    /**
     * Extracts all .npvt entries from a zip buffer, base64-encodes each,
     * and bulk-inserts them into the pool as unassigned for the given plan.
     */
    static async saveFromZip(zipBuffer: Buffer, planId: number): Promise<number> {
        const AdmZip = require('adm-zip');
        const zip = new AdmZip(zipBuffer);
        const entries = zip.getEntries().filter((e: any) =>
            !e.isDirectory &&
            e.entryName.toLowerCase().endsWith('.npvt') &&
            !e.name.startsWith('._') // Exclude macOS AppleDouble resource fork files
        );

        if (entries.length === 0) {
            throw new Error('No .npvt files found in the uploaded zip.');
        }

        const configs: Partial<NpvtConfig>[] = entries.map((entry: any) => ({
            plan_id: planId,
            filename: entry.name,
            file_data: entry.getData().toString('base64'),
            is_assigned: false,
        }));

        await this.getRepository().insert(configs as NpvtConfig[]);
        return configs.length;
    }

    /**
     * Atomically claims one available config for the given plan
     * and links it to the subscription. Returns null if pool is empty.
     */
    static async claimForSubscription(subId: number, planId: number, manager?: any): Promise<NpvtConfig | null> {
        const work = async (m: any) => {
            const repo = m.getRepository(NpvtConfig);

            // Lock a single available row for this plan
            const config = await repo
                .createQueryBuilder('c')
                .where('c.plan_id = :planId', { planId })
                .andWhere('c.is_assigned = false')
                .orderBy('c.uploaded_at', 'ASC')
                .setLock('pessimistic_write')
                .limit(1)
                .getOne();

            if (!config) return null;

            config.is_assigned = true;
            config.assigned_to_sub_id = subId;
            return await m.save(config);
        };

        if (manager) {
            return await work(manager);
        } else {
            return await AppDataSource.transaction(work);
        }
    }

    /**
     * Returns the assigned NpvtConfig for a subscription (for re-download).
     */
    static async getConfigForSub(subId: number): Promise<NpvtConfig | null> {
        return await this.getRepository().findOne({
            where: { assigned_to_sub_id: subId }
        });
    }

    /**
     * Returns pool stats grouped by plan (available / total count).
     */
    static async getPoolStats(): Promise<{ planId: number, planName: string, available: number, total: number }[]> {
        const rows = await this.getRepository()
            .createQueryBuilder('c')
            .leftJoin('c.plan', 'plan')
            .select('c.plan_id', 'planId')
            .addSelect('plan.name', 'planName')
            .addSelect('COUNT(c.id)', 'total')
            .addSelect('SUM(CASE WHEN c.is_assigned = false THEN 1 ELSE 0 END)', 'available')
            .groupBy('c.plan_id')
            .addGroupBy('plan.name')
            .getRawMany();

        return rows.map(r => ({
            planId: r.planId,
            planName: r.planName,
            total: parseInt(r.total),
            available: parseInt(r.available),
        }));
    }
}
