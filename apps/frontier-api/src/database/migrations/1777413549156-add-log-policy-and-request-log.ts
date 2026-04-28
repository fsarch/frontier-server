import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class AddLogPolicyAndRequestLog1777413549156 implements MigrationInterface {
  name = 'AddLogPolicyAndRequestLog1777413549156';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    await queryRunner.createTable(
      new Table({
        name: 'log_policy',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_log_policy',
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
            name: 'retention_time_seconds',
            type: 'bigint',
            isNullable: false,
            default: '604800',
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
          name: 'fk__log_policy__domain_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['domain_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'domain_group',
        }],
        indices: [{
          name: 'IDX__log_policy__domain_group_id',
          columnNames: ['domain_group_id'],
        }],
      }),
    );

    await queryRunner.addColumn('path_rule', new TableColumn({
      name: 'log_policy_id',
      type: 'uuid',
      isNullable: true,
    }));

    await queryRunner.createForeignKey('path_rule', new TableForeignKey({
      name: 'fk__path_rule__log_policy_id',
      onUpdate: 'NO ACTION',
      onDelete: 'SET NULL',
      columnNames: ['log_policy_id'],
      referencedColumnNames: ['id'],
      referencedTableName: 'log_policy',
    }));

    await queryRunner.createIndex('path_rule', new TableIndex({
      name: 'IDX__path_rule__log_policy_id',
      columnNames: ['log_policy_id'],
    }));

    await queryRunner.createTable(
      new Table({
        name: 'request_log',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_request_log',
          },
          {
            name: 'domain_group_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'path_rule_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'log_policy_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'incoming_method',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'incoming_url',
            type: 'varchar',
            length: '4096',
            isNullable: false,
          },
          {
            name: 'incoming_headers',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'upstream_method',
            type: 'varchar',
            length: '16',
            isNullable: false,
          },
          {
            name: 'upstream_url',
            type: 'varchar',
            length: '4096',
            isNullable: false,
          },
          {
            name: 'upstream_headers',
            type: 'jsonb',
            isNullable: false,
          },
          {
            name: 'response_status_code',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'request_time_ms',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'expiration_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
          },
          {
            name: 'creation_time',
            type: getDataType(databaseType, 'timestamp'),
            isNullable: false,
            default: 'now()',
          },
        ],
        foreignKeys: [{
          name: 'fk__request_log__domain_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['domain_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'domain_group',
        }, {
          name: 'fk__request_log__path_rule_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['path_rule_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'path_rule',
        }, {
          name: 'fk__request_log__log_policy_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['log_policy_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'log_policy',
        }],
        indices: [{
          name: 'IDX__request_log__domain_group_id',
          columnNames: ['domain_group_id'],
        }, {
          name: 'IDX__request_log__path_rule_id',
          columnNames: ['path_rule_id'],
        }, {
          name: 'IDX__request_log__log_policy_id',
          columnNames: ['log_policy_id'],
        }, {
          name: 'IDX__request_log__creation_time',
          columnNames: ['creation_time'],
        }, {
          name: 'IDX__request_log__expiration_time',
          columnNames: ['expiration_time'],
        }],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('request_log');

    const pathRuleTable = await queryRunner.getTable('path_rule');
    const logPolicyForeignKey = pathRuleTable?.foreignKeys.find((foreignKey) => foreignKey.name === 'fk__path_rule__log_policy_id');
    const logPolicyIndex = pathRuleTable?.indices.find((index) => index.name === 'IDX__path_rule__log_policy_id');

    if (logPolicyIndex) {
      await queryRunner.dropIndex('path_rule', logPolicyIndex);
    }

    if (logPolicyForeignKey) {
      await queryRunner.dropForeignKey('path_rule', logPolicyForeignKey);
    }

    await queryRunner.dropColumn('path_rule', 'log_policy_id');
    await queryRunner.dropTable('log_policy');
  }
}

