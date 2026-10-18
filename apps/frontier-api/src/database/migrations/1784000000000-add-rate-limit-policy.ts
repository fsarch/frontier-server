import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class AddRateLimitPolicy1784000000000 implements MigrationInterface {
  name = 'AddRateLimitPolicy1784000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    await queryRunner.createTable(
      new Table({
        name: 'rate_limit_policy',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_rate_limit_policy',
          },
          {
            name: 'domain_group_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '256',
            isNullable: false,
          },
          {
            name: 'enabled',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'request_limit',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'window_seconds',
            type: 'int',
            isNullable: false,
            default: 60,
          },
          {
            name: 'key_type',
            type: 'varchar',
            length: '32',
            isNullable: false,
            default: "'ip'",
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
          {
            name: 'deletion_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: true,
          },
        ],
        foreignKeys: [
          {
            name: 'fk__rate_limit_policy__domain_group_id',
            onUpdate: 'NO ACTION',
            onDelete: 'NO ACTION',
            columnNames: ['domain_group_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'domain_group',
          },
        ],
        indices: [
          {
            name: 'IDX__rate_limit_policy__domain_group_id',
            columnNames: ['domain_group_id'],
          },
        ],
      }),
    );

    await queryRunner.addColumn(
      'path_rule',
      new TableColumn({
        name: 'rate_limit_policy_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    await queryRunner.createForeignKey(
      'path_rule',
      new TableForeignKey({
        name: 'fk__path_rule__rate_limit_policy_id',
        onUpdate: 'NO ACTION',
        onDelete: 'SET NULL',
        columnNames: ['rate_limit_policy_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'rate_limit_policy',
      }),
    );

    await queryRunner.createIndex(
      'path_rule',
      new TableIndex({
        name: 'IDX__path_rule__rate_limit_policy_id',
        columnNames: ['rate_limit_policy_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const pathRuleTable = await queryRunner.getTable('path_rule');
    const rateLimitPolicyForeignKey = pathRuleTable?.foreignKeys.find(
      (foreignKey) => foreignKey.name === 'fk__path_rule__rate_limit_policy_id',
    );
    const rateLimitPolicyIndex = pathRuleTable?.indices.find(
      (index) => index.name === 'IDX__path_rule__rate_limit_policy_id',
    );

    if (rateLimitPolicyIndex) {
      await queryRunner.dropIndex('path_rule', rateLimitPolicyIndex);
    }

    if (rateLimitPolicyForeignKey) {
      await queryRunner.dropForeignKey('path_rule', rateLimitPolicyForeignKey);
    }

    await queryRunner.dropColumn('path_rule', 'rate_limit_policy_id');
    await queryRunner.dropTable('rate_limit_policy');
  }
}
