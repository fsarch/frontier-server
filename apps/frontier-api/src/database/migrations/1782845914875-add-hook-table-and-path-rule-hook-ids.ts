import { MigrationInterface, QueryRunner, TableColumn, Table } from 'typeorm';

export class AddHookTableAndPathRuleHookIds1782845914875 implements MigrationInterface {
  name = 'AddHookTableAndPathRuleHookIds1782845914875';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create hook table
    await queryRunner.createTable(new Table({
      name: 'hook',
      columns: [
        {
          name: 'id',
          type: 'uuid',
          isPrimary: true,
          primaryKeyConstraintName: 'pk_hook',
          generationStrategy: 'uuid',
        },
        {
          name: 'name',
          type: 'varchar',
          length: '256',
          isNullable: false,
        },

        {
          name: 'creation_time',
          type: 'timestamp with time zone',
          isNullable: false,
          default: 'now()',
        },
        {
          name: 'deletion_time',
          type: 'timestamp with time zone',
          isNullable: true,
        },
      ],
    }));

    // Add pre_hook_id and post_hook_id columns to path_rule table
    await queryRunner.addColumn('path_rule', new TableColumn({
      name: 'pre_hook_id',
      type: 'uuid',
      isNullable: true,
    }));

    await queryRunner.addColumn('path_rule', new TableColumn({
      name: 'post_hook_id',
      type: 'uuid',
      isNullable: true,
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const pathRuleTable = await queryRunner.getTable('path_rule');
    const preHookIdColumn = pathRuleTable?.columns.find((column) => column.name === 'pre_hook_id');
    const postHookIdColumn = pathRuleTable?.columns.find((column) => column.name === 'post_hook_id');

    if (postHookIdColumn) {
      await queryRunner.dropColumn('path_rule', 'post_hook_id');
    }

    if (preHookIdColumn) {
      await queryRunner.dropColumn('path_rule', 'pre_hook_id');
    }

    // Drop hook table
    await queryRunner.dropTable('hook');
  }
}
