import { User } from '../../modules/auth/user.model';
import { UserPermission } from '../../modules/auth/userPermission.model';
import { Ticket } from '../../modules/tickets/ticket.model';
import { TicketComment } from '../../modules/tickets/ticketComment.model';
import { TicketAttachment } from '../../modules/tickets/ticketAttachment.model';
import { TicketStatusHistory } from '../../modules/tickets/ticketStatusHistory.model';
import { TicketWatcher } from '../../modules/tickets/ticketWatcher.model';
import { CannedResponse } from '../../modules/tickets/cannedResponse.model';
import { NotificationGroup } from '../../modules/notifications/notificationGroup.model';
import { NotificationGroupMember } from '../../modules/notifications/notificationGroupMember.model';
import { KnowledgeBaseArticle } from '../../modules/knowledge-base/article.model';
import { Asset } from '../../modules/assets/asset.model';
import { AssetAssignment } from '../../modules/assets/assetAssignment.model';
import { AssetCustomFieldDefinition } from '../../modules/assets/assetCustomFieldDefinition.model';
import { TicketAsset } from '../../modules/assets/ticketAsset.model';
import { LogSource } from '../../modules/logs/logSource.model';
import { LogEntry } from '../../modules/logs/logEntry.model';
import { AlertRule } from '../../modules/logs/alertRule.model';
import { AlertEvent } from '../../modules/logs/alertEvent.model';
import { LogRetentionSetting } from '../../modules/logs/logRetentionSetting.model';

// Ticket <-> User
Ticket.belongsTo(User, { as: 'requester', foreignKey: 'requesterId' });
Ticket.belongsTo(User, { as: 'assignee', foreignKey: 'assigneeId' });
User.hasMany(Ticket, { as: 'requestedTickets', foreignKey: 'requesterId' });
User.hasMany(Ticket, { as: 'assignedTickets', foreignKey: 'assigneeId' });

// Ticket <-> Comments
Ticket.hasMany(TicketComment, { as: 'comments', foreignKey: 'ticketId' });
TicketComment.belongsTo(Ticket, { as: 'ticket', foreignKey: 'ticketId' });
TicketComment.belongsTo(User, { as: 'author', foreignKey: 'authorId' });

// Ticket <-> Attachments
Ticket.hasMany(TicketAttachment, { as: 'attachments', foreignKey: 'ticketId' });
TicketAttachment.belongsTo(Ticket, { as: 'ticket', foreignKey: 'ticketId' });
TicketComment.hasMany(TicketAttachment, { as: 'attachments', foreignKey: 'commentId' });
TicketAttachment.belongsTo(TicketComment, { as: 'comment', foreignKey: 'commentId' });
TicketAttachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById' });

// Ticket <-> Status history
Ticket.hasMany(TicketStatusHistory, { as: 'statusHistory', foreignKey: 'ticketId' });
TicketStatusHistory.belongsTo(Ticket, { as: 'ticket', foreignKey: 'ticketId' });
TicketStatusHistory.belongsTo(User, { as: 'changedBy', foreignKey: 'changedById' });

// Ticket <-> Watchers (many-to-many via TicketWatcher)
Ticket.belongsToMany(User, { as: 'watchers', through: TicketWatcher, foreignKey: 'ticketId', otherKey: 'userId' });
User.belongsToMany(Ticket, { as: 'watchedTickets', through: TicketWatcher, foreignKey: 'userId', otherKey: 'ticketId' });

// Notification groups <-> Users (many-to-many via NotificationGroupMember)
NotificationGroup.belongsToMany(User, {
  as: 'members',
  through: NotificationGroupMember,
  foreignKey: 'groupId',
  otherKey: 'userId',
});
User.belongsToMany(NotificationGroup, {
  as: 'notificationGroups',
  through: NotificationGroupMember,
  foreignKey: 'userId',
  otherKey: 'groupId',
});

CannedResponse.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
KnowledgeBaseArticle.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// User <-> Permissions
User.hasMany(UserPermission, { as: 'permissionGrants', foreignKey: 'userId' });
UserPermission.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Asset <-> Assignments
Asset.hasMany(AssetAssignment, { as: 'assignments', foreignKey: 'assetId' });
AssetAssignment.belongsTo(Asset, { as: 'asset', foreignKey: 'assetId' });
AssetAssignment.belongsTo(User, { as: 'assignedToUser', foreignKey: 'assignedToUserId' });
AssetAssignment.belongsTo(User, { as: 'assignedBy', foreignKey: 'assignedById' });

// Ticket <-> Assets (many-to-many via TicketAsset)
Ticket.belongsToMany(Asset, { as: 'linkedAssets', through: TicketAsset, foreignKey: 'ticketId', otherKey: 'assetId' });
Asset.belongsToMany(Ticket, { as: 'linkedTickets', through: TicketAsset, foreignKey: 'assetId', otherKey: 'ticketId' });

// Logs
LogSource.hasMany(LogEntry, { as: 'entries', foreignKey: 'sourceId' });
LogEntry.belongsTo(LogSource, { as: 'source', foreignKey: 'sourceId' });
LogSource.hasMany(AlertRule, { as: 'alertRules', foreignKey: 'sourceId' });
AlertRule.belongsTo(LogSource, { as: 'source', foreignKey: 'sourceId' });
AlertRule.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
AlertRule.hasMany(AlertEvent, { as: 'events', foreignKey: 'ruleId' });
AlertEvent.belongsTo(AlertRule, { as: 'rule', foreignKey: 'ruleId' });
AlertEvent.belongsTo(Ticket, { as: 'resolvedTicket', foreignKey: 'resolvedTicketId' });

export {
  User,
  UserPermission,
  Ticket,
  TicketComment,
  TicketAttachment,
  TicketStatusHistory,
  TicketWatcher,
  CannedResponse,
  NotificationGroup,
  NotificationGroupMember,
  KnowledgeBaseArticle,
  Asset,
  AssetAssignment,
  AssetCustomFieldDefinition,
  TicketAsset,
  LogSource,
  LogEntry,
  AlertRule,
  AlertEvent,
  LogRetentionSetting,
};
