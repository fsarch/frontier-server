import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class AddCorsPolicyTable1777326431513 implements MigrationInterface {
  name = 'AddCorsPolicyTable1777326431513';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    await queryRunner.createTable(
      new Table({
        name: 'cors_policy',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_cors_policy',
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
            name: 'allow_credentials',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'allowed_origins',
            type: 'text',
            isArray: true,
            isNullable: true,
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
        foreignKeys: [{
          name: 'fk__cors_policy__domain_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['domain_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'domain_group',
        }],
        indices: [{
          name: 'IDX__cors_policy__domain_group_id',
          columnNames: ['domain_group_id'],
        }],
      }),
    );

    await queryRunner.addColumn('path_rule', new TableColumn({
      name: 'cors_policy_id',
      type: 'uuid',
      isNullable: true,
    }));

    await queryRunner.createForeignKey('path_rule', new TableForeignKey({
      name: 'fk__path_rule__cors_policy_id',
      onUpdate: 'NO ACTION',
      onDelete: 'SET NULL',
      columnNames: ['cors_policy_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'cors_policy',
    }));

    await queryRunner.createIndex('path_rule', new TableIndex({
      name: 'IDX__path_rule__cors_policy_id',
      columnNames: ['cors_policy_id'],
    }));
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const pathRuleTable = await queryRunner.getTable('path_rule');
    const corsPolicyForeignKey = pathRuleTable?.foreignKeys.find((foreignKey) => foreignKey.name === 'fk__path_rule__cors_policy_id');
    const corsPolicyIndex = pathRuleTable?.indices.find((index) => index.name === 'IDX__path_rule__cors_policy_id');

    if (corsPolicyIndex) {
      await queryRunner.dropIndex('path_rule', corsPolicyIndex);
    }

    if (corsPolicyForeignKey) {
      await queryRunner.dropForeignKey('path_rule', corsPolicyForeignKey);
    }

    await queryRunner.dropColumn('path_rule', 'cors_policy_id');
    await queryRunner.dropTable('cors_policy');
  }
}

