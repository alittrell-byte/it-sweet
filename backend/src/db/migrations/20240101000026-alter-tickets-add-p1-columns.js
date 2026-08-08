'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tickets', 'team_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'teams', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('tickets', 'source_template_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'ticket_templates', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('tickets', 'requires_approval', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });
    await queryInterface.addColumn('tickets', 'approval_status', {
      type: Sequelize.ENUM('none', 'pending', 'approved', 'rejected'),
      allowNull: false,
      defaultValue: 'none',
    });
    await queryInterface.addColumn('tickets', 'approved_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('tickets', 'approved_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('tickets', 'rejected_by_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'users', key: 'id' },
      onDelete: 'SET NULL',
    });
    await queryInterface.addColumn('tickets', 'rejected_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('tickets', 'approval_reason', { type: Sequelize.TEXT, allowNull: true });

    // Sequelize's changeColumn does NOT actually alter a Postgres enum TYPE when only adding
    // a value - it silently succeeds without emitting the necessary ALTER TYPE, leaving the
    // underlying type unchanged (confirmed the hard way: migration reported success, but
    // inserting 'pending_approval' afterward failed with a Postgres enum_in error). Postgres
    // enum types need an explicit ALTER TYPE ... ADD VALUE; MySQL's ENUM is inline on the
    // column, so changeColumn works fine there.
    if (queryInterface.sequelize.getDialect() === 'postgres') {
      await queryInterface.sequelize.query("ALTER TYPE \"enum_tickets_status\" ADD VALUE IF NOT EXISTS 'pending_approval'");
    } else {
      await queryInterface.changeColumn('tickets', 'status', {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'pending_approval', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      });
    }

    await queryInterface.addIndex('tickets', ['team_id']);
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('tickets', ['team_id']);
    // Postgres has no supported "remove enum value" operation short of recreating the type
    // (and re-pointing every dependent column/table) - left as a no-op there, since this is a
    // purely additive value with no down-path short of a much more invasive rebuild. MySQL's
    // inline enum can shrink safely as long as no existing row uses the removed value.
    if (queryInterface.sequelize.getDialect() !== 'postgres') {
      await queryInterface.changeColumn('tickets', 'status', {
        type: Sequelize.ENUM('new', 'in_progress', 'waiting', 'resolved', 'closed'),
        allowNull: false,
        defaultValue: 'new',
      });
    }
    await queryInterface.removeColumn('tickets', 'approval_reason');
    await queryInterface.removeColumn('tickets', 'rejected_at');
    await queryInterface.removeColumn('tickets', 'rejected_by_id');
    await queryInterface.removeColumn('tickets', 'approved_at');
    await queryInterface.removeColumn('tickets', 'approved_by_id');
    await queryInterface.removeColumn('tickets', 'approval_status');
    await queryInterface.removeColumn('tickets', 'requires_approval');
    await queryInterface.removeColumn('tickets', 'source_template_id');
    await queryInterface.removeColumn('tickets', 'team_id');
  },
};
