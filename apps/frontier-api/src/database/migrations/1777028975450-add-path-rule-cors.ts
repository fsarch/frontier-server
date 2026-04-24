import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPathRuleCors1777028975450 implements MigrationInterface {
  name = 'AddPathRuleCors1777028975450';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumns('path_rule', [
      new TableColumn({
        name: 'cors_enabled',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'cors_allow_credentials',
        type: 'boolean',
        isNullable: false,
        default: false,
      }),
      new TableColumn({
        name: 'cors_allowed_origins',
        type: 'text',
        isNullable: true,
        isArray: true,
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('path_rule', 'cors_allowed_origins');
    await queryRunner.dropColumn('path_rule', 'cors_allow_credentials');
    await queryRunner.dropColumn('path_rule', 'cors_enabled');
  }
}

