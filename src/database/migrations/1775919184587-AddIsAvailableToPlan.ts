import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsAvailableToPlan1775919184587 implements MigrationInterface {
    name = 'AddIsAvailableToPlan1775919184587'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plans" ADD "is_available" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "plans" DROP COLUMN "is_available"`);
    }

}
