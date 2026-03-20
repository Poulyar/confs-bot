import { MigrationInterface, QueryRunner } from "typeorm";

export class AddHasJoinedChannelToUser1774260000000 implements MigrationInterface {
    name = 'AddHasJoinedChannelToUser1774260000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" ADD COLUMN "has_joined_channel" boolean NOT NULL DEFAULT false`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "has_joined_channel"`);
    }

}
