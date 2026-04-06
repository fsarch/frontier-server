import { MigrationInterface, QueryRunner, Table } from 'typeorm';
import { getDataType } from './utils/data-type.mapper.js';

export class BaseTables1720373216667 implements MigrationInterface {
  name = 'BaseTables1720373216667';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const databaseType = queryRunner.connection.driver.options.type;

    // region DomainGroup
    await queryRunner.createTable(
      new Table({
        name: 'domain_group',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_domain_group',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '256',
            isNullable: false,
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
      }),
    );
    // endregion

    // region DomainGroupDomain
    await queryRunner.createTable(
      new Table({
        name: 'domain_group_domain',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_domain_group_domain',
          },
          {
            name: 'domain_group_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'domain_name',
            type: 'varchar',
            length: '2048',
            isNullable: false,
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
          name: 'fk__domain_group_domain__domain_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['domain_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'domain_group',
        }],
        indices: [{
          name: 'IDX__domain_group_domain__domain_group_id',
          columnNames: ['domain_group_id'],
        }, {
          name: 'IDX__domain_group_domain__domain_name',
          columnNames: ['domain_name'],
        }, {
          name: 'UI__domain_group_domain__domain_name',
          columnNames: ['domain_name'],
          isUnique: true,
          where: 'deletion_time IS NULL',
        }],
      }),
    );
    // endregion

    // region UpstreamGroup
    await queryRunner.createTable(
      new Table({
        name: 'upstream_group',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_upstream_group',
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
          name: 'fk__upstream_group__domain_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['domain_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'domain_group',
        }],
        indices: [{
          name: 'IDX__upstream_group__domain_group_id',
          columnNames: ['domain_group_id'],
        }],
      }),
    );
    // endregion

    // region Upstream
    await queryRunner.createTable(
      new Table({
        name: 'upstream',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_upstream',
          },
          {
            name: 'upstream_group_id',
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
            name: 'host',
            type: 'varchar',
            length: '2048',
            isNullable: false,
          },
          {
            name: 'port',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'path',
            type: 'varchar',
            length: '2048',
            isNullable: false,
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
          name: 'fk__upstream__upstream_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['upstream_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'upstream_group',
        }],
        indices: [{
          name: 'IDX__upstream__upstream_group_id',
          columnNames: ['upstream_group_id'],
        }, {
          name: 'IDX__upstream__host__port',
          columnNames: ['host', 'port'],
        }],
      }),
    );
    // endregion

    // region CachePolicy
    await queryRunner.createTable(
      new Table({
        name: 'cache_policy',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_cache_policy',
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
            name: 'enable_cache_tags',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'cache_tags_header',
            type: 'varchar',
            length: '256',
            isNullable: true,
          },
          {
            name: 'divergence_headers',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'divergence_cookies',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'divergence_query_parameters',
            type: 'varchar',
            isArray: true,
            isNullable: true,
          },
          {
            name: 'min_ttl',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'max_ttl',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'default_ttl',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'enable_stale_while_error',
            type: 'boolean',
            isNullable: false,
            default: true,
          },
          {
            name: 'stale_while_error_time',
            type: 'bigint',
            isNullable: true,
          },
          {
            name: 'enable_stale_while_revalidate',
            type: 'boolean',
            isNullable: false,
            default: false,
          },
          {
            name: 'stale_while_revalidate_time',
            type: 'bigint',
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
          name: 'fk__cache_policy__domain_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['domain_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'domain_group',
        }],
        indices: [{
          name: 'IDX__cache_policy__domain_group_id',
          columnNames: ['domain_group_id'],
        }],
      }),
    );
    // endregion

    // region PathRule
    await queryRunner.createTable(
      new Table({
        name: 'path_rule',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            primaryKeyConstraintName: 'pk_path_rule',
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
            name: 'path',
            type: 'varchar',
            length: '2048',
            isNullable: false,
          },
          {
            name: 'order',
            type: 'bigint',
            isNullable: false,
          },
          {
            name: 'cache_policy_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'upstream_group_id',
            type: 'uuid',
            isNullable: false,
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
          name: 'fk__path_rule__domain_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['domain_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'domain_group',
        }, {
          name: 'fk__path_rule__cache_policy_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['cache_policy_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'cache_policy',
        }, {
          name: 'fk__path_rule__upstream_group_id',
          onUpdate: 'NO ACTION',
          onDelete: 'NO ACTION',
          columnNames: ['upstream_group_id'],
          referencedColumnNames: ['id'],
          referencedTableName: 'upstream_group',
        }],
        indices: [{
          name: 'IDX__path_rule__domain_group_id',
          columnNames: ['domain_group_id'],
        }],
      }),
    );
    // endregion
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('path_rule');
    await queryRunner.dropTable('cache_policy');
    await queryRunner.dropTable('upstream');
    await queryRunner.dropTable('upstream_group');
    await queryRunner.dropTable('domain_group_domain');
    await queryRunner.dropTable('domain_group');
  }
}
