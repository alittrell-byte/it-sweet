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
import { SavedSearch } from '../../modules/logs/savedSearch.model';
import { LogRetentionSetting } from '../../modules/logs/logRetentionSetting.model';
import { KnowledgeBaseCategory } from '../../modules/knowledge-base/category.model';
import { KnowledgeBaseArticleRevision } from '../../modules/knowledge-base/articleRevision.model';
import { KnowledgeBaseArticleAttachment } from '../../modules/knowledge-base/articleAttachment.model';
import { TicketKnowledgeBaseArticle } from '../../modules/knowledge-base/ticketKnowledgeBaseArticle.model';
import { TicketTemplate } from '../../modules/tickets/ticketTemplate.model';
import { TicketTimeEntry } from '../../modules/tickets/ticketTimeEntry.model';
import { TicketSatisfactionSurvey } from '../../modules/tickets/ticketSatisfactionSurvey.model';
import { Team } from '../../modules/tickets/team.model';
import { TeamMembership } from '../../modules/tickets/teamMembership.model';
import { TicketEscalationHistory } from '../../modules/tickets/ticketEscalationHistory.model';
import { Tag } from '../../modules/tickets/tag.model';
import { TicketTag } from '../../modules/tickets/ticketTag.model';
import { TicketSavedView } from '../../modules/tickets/ticketSavedView.model';
import { RecurringTicketTemplate } from '../../modules/tickets/recurringTicketTemplate.model';
import { KbArticleTemplate } from '../../modules/knowledge-base/articleTemplate.model';
import { KbArticleFeedback } from '../../modules/knowledge-base/articleFeedback.model';
import { Vendor } from '../../modules/assets/vendor.model';
import { Contract } from '../../modules/assets/contract.model';
import { AssetHistory } from '../../modules/assets/assetHistory.model';
import { Patch } from '../../modules/patches/patch.model';
import { AssetPatchStatus } from '../../modules/patches/assetPatchStatus.model';
import { PatchAgentKey } from '../../modules/patches/patchAgentKey.model';
import { MaintenanceWindow } from '../../modules/patches/maintenanceWindow.model';
import { ScheduledReport } from '../../modules/reporting/scheduledReport.model';
import { Project } from '../../modules/projects/project.model';
import { ProjectTask } from '../../modules/projects/projectTask.model';
import { ProjectMember } from '../../modules/projects/projectMember.model';
import { ProjectTaskDependency } from '../../modules/projects/projectTaskDependency.model';
import { ProjectTicketLink } from '../../modules/projects/projectTicketLink.model';
import { ProjectAssetLink } from '../../modules/projects/projectAssetLink.model';

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

// Knowledge base
KnowledgeBaseArticle.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
KnowledgeBaseArticle.belongsTo(User, { as: 'updatedBy', foreignKey: 'updatedById' });
KnowledgeBaseArticle.belongsTo(KnowledgeBaseCategory, { as: 'category', foreignKey: 'categoryId' });
KnowledgeBaseCategory.belongsTo(KnowledgeBaseCategory, { as: 'parent', foreignKey: 'parentId' });
KnowledgeBaseCategory.hasMany(KnowledgeBaseCategory, { as: 'children', foreignKey: 'parentId' });
KnowledgeBaseArticle.hasMany(KnowledgeBaseArticleRevision, { as: 'revisions', foreignKey: 'articleId' });
KnowledgeBaseArticleRevision.belongsTo(KnowledgeBaseArticle, { as: 'article', foreignKey: 'articleId' });
KnowledgeBaseArticleRevision.belongsTo(User, { as: 'editedBy', foreignKey: 'editedById' });
KnowledgeBaseArticle.hasMany(KnowledgeBaseArticleAttachment, { as: 'attachments', foreignKey: 'articleId' });
KnowledgeBaseArticleAttachment.belongsTo(KnowledgeBaseArticle, { as: 'article', foreignKey: 'articleId' });
KnowledgeBaseArticleAttachment.belongsTo(User, { as: 'uploadedBy', foreignKey: 'uploadedById' });

// KB review workflow
KnowledgeBaseArticle.belongsTo(User, { as: 'submittedForReviewBy', foreignKey: 'submittedForReviewById' });
KnowledgeBaseArticle.belongsTo(User, { as: 'reviewedBy', foreignKey: 'reviewedById' });

// KB article templates
KbArticleTemplate.belongsTo(KnowledgeBaseCategory, { as: 'suggestedCategory', foreignKey: 'suggestedCategoryId' });
KbArticleTemplate.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// KB article feedback
KnowledgeBaseArticle.hasMany(KbArticleFeedback, { as: 'feedback', foreignKey: 'articleId' });
KbArticleFeedback.belongsTo(KnowledgeBaseArticle, { as: 'article', foreignKey: 'articleId' });
KbArticleFeedback.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Ticket <-> KB Articles (many-to-many via TicketKnowledgeBaseArticle)
Ticket.belongsToMany(KnowledgeBaseArticle, {
  as: 'linkedArticles',
  through: TicketKnowledgeBaseArticle,
  foreignKey: 'ticketId',
  otherKey: 'articleId',
});
KnowledgeBaseArticle.belongsToMany(Ticket, {
  as: 'linkedTickets',
  through: TicketKnowledgeBaseArticle,
  foreignKey: 'articleId',
  otherKey: 'ticketId',
});

// User <-> Permissions
User.hasMany(UserPermission, { as: 'permissionGrants', foreignKey: 'userId' });
UserPermission.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Asset <-> Assignments
Asset.hasMany(AssetAssignment, { as: 'assignments', foreignKey: 'assetId' });
AssetAssignment.belongsTo(Asset, { as: 'asset', foreignKey: 'assetId' });
AssetAssignment.belongsTo(User, { as: 'assignedToUser', foreignKey: 'assignedToUserId' });
AssetAssignment.belongsTo(User, { as: 'assignedBy', foreignKey: 'assignedById' });

// Vendors + Contracts
Asset.belongsTo(Vendor, { as: 'vendor', foreignKey: 'vendorId' });
Vendor.hasMany(Asset, { as: 'assets', foreignKey: 'vendorId' });
Contract.belongsTo(Vendor, { as: 'vendor', foreignKey: 'vendorId' });
Vendor.hasMany(Contract, { as: 'contracts', foreignKey: 'vendorId' });
Contract.belongsTo(Asset, { as: 'asset', foreignKey: 'assetId' });
Asset.hasMany(Contract, { as: 'contracts', foreignKey: 'assetId' });

// Asset audit trail
AssetHistory.belongsTo(User, { as: 'changedBy', foreignKey: 'changedById' });

// Ticket <-> Assets (many-to-many via TicketAsset)
Ticket.belongsToMany(Asset, { as: 'linkedAssets', through: TicketAsset, foreignKey: 'ticketId', otherKey: 'assetId' });
Asset.belongsToMany(Ticket, { as: 'linkedTickets', through: TicketAsset, foreignKey: 'assetId', otherKey: 'ticketId' });

// Ticket templates
Ticket.belongsTo(TicketTemplate, { as: 'sourceTemplate', foreignKey: 'sourceTemplateId' });
TicketTemplate.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// Approval workflow
Ticket.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
Ticket.belongsTo(User, { as: 'rejectedBy', foreignKey: 'rejectedById' });

// Teams/queues
Ticket.belongsTo(Team, { as: 'team', foreignKey: 'teamId' });
Team.belongsTo(Team, { as: 'escalatesTo', foreignKey: 'escalatesToTeamId' });
Team.belongsToMany(User, { as: 'members', through: TeamMembership, foreignKey: 'teamId', otherKey: 'userId' });
User.belongsToMany(Team, { as: 'teams', through: TeamMembership, foreignKey: 'userId', otherKey: 'teamId' });

// Escalation history
Ticket.hasMany(TicketEscalationHistory, { as: 'escalationHistory', foreignKey: 'ticketId' });
TicketEscalationHistory.belongsTo(Ticket, { as: 'ticket', foreignKey: 'ticketId' });
TicketEscalationHistory.belongsTo(Team, { as: 'fromTeam', foreignKey: 'fromTeamId' });
TicketEscalationHistory.belongsTo(Team, { as: 'toTeam', foreignKey: 'toTeamId' });
TicketEscalationHistory.belongsTo(User, { as: 'escalatedBy', foreignKey: 'escalatedById' });

// Time tracking
Ticket.hasMany(TicketTimeEntry, { as: 'timeEntries', foreignKey: 'ticketId' });
TicketTimeEntry.belongsTo(Ticket, { as: 'ticket', foreignKey: 'ticketId' });
TicketTimeEntry.belongsTo(User, { as: 'technician', foreignKey: 'technicianId' });

// CSAT
Ticket.hasOne(TicketSatisfactionSurvey, { as: 'survey', foreignKey: 'ticketId' });
TicketSatisfactionSurvey.belongsTo(Ticket, { as: 'ticket', foreignKey: 'ticketId' });

// Tags (many-to-many via TicketTag)
Ticket.belongsToMany(Tag, { as: 'tags', through: TicketTag, foreignKey: 'ticketId', otherKey: 'tagId' });
Tag.belongsToMany(Ticket, { as: 'tickets', through: TicketTag, foreignKey: 'tagId', otherKey: 'ticketId' });

// Saved views
TicketSavedView.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Recurring ticket templates
RecurringTicketTemplate.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
RecurringTicketTemplate.belongsTo(User, { as: 'assignee', foreignKey: 'assigneeId' });

// Logs
LogSource.hasMany(LogEntry, { as: 'entries', foreignKey: 'sourceId' });
LogEntry.belongsTo(LogSource, { as: 'source', foreignKey: 'sourceId' });
LogSource.hasMany(AlertRule, { as: 'alertRules', foreignKey: 'sourceId' });
AlertRule.belongsTo(LogSource, { as: 'source', foreignKey: 'sourceId' });
AlertRule.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });
AlertRule.hasMany(AlertEvent, { as: 'events', foreignKey: 'ruleId' });
AlertEvent.belongsTo(AlertRule, { as: 'rule', foreignKey: 'ruleId' });
AlertEvent.belongsTo(Ticket, { as: 'resolvedTicket', foreignKey: 'resolvedTicketId' });
AlertRule.belongsTo(NotificationGroup, { as: 'notifyGroup', foreignKey: 'notifyGroupId' });
LogSource.belongsTo(Team, { as: 'restrictedToTeam', foreignKey: 'restrictedToTeamId' });
LogSource.belongsTo(Asset, { as: 'asset', foreignKey: 'assetId' });
SavedSearch.belongsTo(User, { as: 'user', foreignKey: 'userId' });
ScheduledReport.belongsTo(NotificationGroup, { as: 'notifyGroup', foreignKey: 'notifyGroupId' });
ScheduledReport.belongsTo(User, { as: 'createdBy', foreignKey: 'createdById' });

// Patch management
Asset.hasMany(AssetPatchStatus, { as: 'patchStatuses', foreignKey: 'assetId' });
AssetPatchStatus.belongsTo(Asset, { as: 'asset', foreignKey: 'assetId' });
Patch.hasMany(AssetPatchStatus, { as: 'assetStatuses', foreignKey: 'patchId' });
AssetPatchStatus.belongsTo(Patch, { as: 'patch', foreignKey: 'patchId' });
Patch.belongsTo(User, { as: 'approvedBy', foreignKey: 'approvedById' });
Asset.hasOne(PatchAgentKey, { as: 'patchAgentKey', foreignKey: 'assetId' });
PatchAgentKey.belongsTo(Asset, { as: 'asset', foreignKey: 'assetId' });
MaintenanceWindow.belongsTo(Team, { as: 'team', foreignKey: 'teamId' });

// Projects
Project.belongsTo(User, { as: 'owner', foreignKey: 'ownerId' });
User.hasMany(Project, { as: 'ownedProjects', foreignKey: 'ownerId' });

Project.hasMany(ProjectTask, { as: 'tasks', foreignKey: 'projectId' });
ProjectTask.belongsTo(Project, { as: 'project', foreignKey: 'projectId' });
ProjectTask.belongsTo(User, { as: 'assignee', foreignKey: 'assigneeId' });
ProjectTask.belongsTo(Ticket, { as: 'spawnedTicket', foreignKey: 'ticketId' });

// Membership - own model (not a bare join table) since it carries `role`; see project.model.ts.
Project.hasMany(ProjectMember, { as: 'members', foreignKey: 'projectId' });
ProjectMember.belongsTo(Project, { as: 'project', foreignKey: 'projectId' });
ProjectMember.belongsTo(User, { as: 'user', foreignKey: 'userId' });

// Task dependencies - self-referential many-to-many via ProjectTaskDependency. Two aliases for
// the two traversal directions: what must finish before this task can start, and what's waiting
// on this task.
ProjectTask.belongsToMany(ProjectTask, {
  as: 'dependencies',
  through: ProjectTaskDependency,
  foreignKey: 'taskId',
  otherKey: 'dependsOnTaskId',
});
ProjectTask.belongsToMany(ProjectTask, {
  as: 'dependents',
  through: ProjectTaskDependency,
  foreignKey: 'dependsOnTaskId',
  otherKey: 'taskId',
});

// Project <-> Tickets (many-to-many via ProjectTicketLink / table project_tickets)
Project.belongsToMany(Ticket, { as: 'linkedTickets', through: ProjectTicketLink, foreignKey: 'projectId', otherKey: 'ticketId' });
Ticket.belongsToMany(Project, { as: 'linkedProjects', through: ProjectTicketLink, foreignKey: 'ticketId', otherKey: 'projectId' });
// Direct associations on the through model itself, used by the list-endpoint rollup query, which
// queries ProjectTicketLink directly with a Ticket include rather than going through the M2M.
ProjectTicketLink.belongsTo(Ticket, { as: 'ticket', foreignKey: 'ticketId' });
ProjectTicketLink.belongsTo(Project, { as: 'project', foreignKey: 'projectId' });

// Project <-> Assets (many-to-many via ProjectAssetLink / table project_assets)
Project.belongsToMany(Asset, { as: 'linkedAssets', through: ProjectAssetLink, foreignKey: 'projectId', otherKey: 'assetId' });
Asset.belongsToMany(Project, { as: 'linkedProjects', through: ProjectAssetLink, foreignKey: 'assetId', otherKey: 'projectId' });

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
  SavedSearch,
  KnowledgeBaseCategory,
  KnowledgeBaseArticleRevision,
  KnowledgeBaseArticleAttachment,
  TicketKnowledgeBaseArticle,
  TicketTemplate,
  TicketTimeEntry,
  TicketSatisfactionSurvey,
  Team,
  TeamMembership,
  TicketEscalationHistory,
  Tag,
  TicketTag,
  TicketSavedView,
  RecurringTicketTemplate,
  KbArticleTemplate,
  KbArticleFeedback,
  Vendor,
  Contract,
  AssetHistory,
  Patch,
  AssetPatchStatus,
  PatchAgentKey,
  MaintenanceWindow,
  ScheduledReport,
  Project,
  ProjectTask,
  ProjectMember,
  ProjectTaskDependency,
  ProjectTicketLink,
  ProjectAssetLink,
};
