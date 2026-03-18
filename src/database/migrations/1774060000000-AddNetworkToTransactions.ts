import { MigrationInterface, QueryRunner } from "typeorm";

export class AddNetworkToTransactions1774060000000 implements MigrationInterface {
    name = 'AddNetworkToTransactions1774060000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" ADD COLUMN "network" character varying(20)`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "transactions" DROP COLUMN "network"`);
    }

}
