export interface PermissionDefinition {
  key: string;
  label: string;
}

export interface PermissionModule {
  module: string;
  label: string;
  permissions: PermissionDefinition[];
}

// The full set of grantable, checkbox-editable permissions, grouped by module. Each new
// module (Assets, Log Monitoring, Patch Management, ...) adds its own entry here and
// wires matching requirePermission(...) checks into its routes - the user edit page
// renders this catalog generically, so no frontend changes are needed to pick up a
// newly added module's permissions.
export const PERMISSION_CATALOG: PermissionModule[] = [
  {
    module: 'users',
    label: 'User Management',
    permissions: [
      { key: 'users.view', label: 'View users' },
      { key: 'users.create', label: 'Create users' },
      { key: 'users.edit', label: 'Edit users' },
      { key: 'users.delete', label: 'Delete users' },
      { key: 'users.manage_permissions', label: "Manage other users' permissions" },
    ],
  },
  {
    module: 'tickets',
    label: 'Ticketing',
    permissions: [
      { key: 'tickets.view_dashboard', label: 'View the ticket dashboard' },
      { key: 'tickets.manage_canned_responses', label: 'Manage canned responses' },
      { key: 'tickets.approve', label: 'Approve or reject tickets pending approval' },
      { key: 'tickets.manage_templates', label: 'Manage ticket templates' },
      { key: 'tickets.manage_teams', label: 'Manage teams/queues and their membership' },
      { key: 'tickets.manage_recurring', label: 'Manage recurring ticket templates' },
    ],
  },
  {
    module: 'notifications',
    label: 'Notification Groups',
    permissions: [{ key: 'notifications.manage_groups', label: 'Manage notification groups' }],
  },
  {
    module: 'knowledge_base',
    label: 'Knowledge Base',
    permissions: [
      { key: 'kb.view_internal', label: 'View internal (staff-only) articles' },
      { key: 'kb.manage_internal', label: 'Create/edit/delete internal articles' },
      { key: 'kb.manage_external', label: 'Create/edit/delete external (customer-facing) articles' },
      { key: 'kb.manage_categories', label: 'Manage KB categories' },
      { key: 'kb.manage_templates', label: 'Manage KB article templates' },
      { key: 'kb.review_internal', label: 'Approve or request changes on internal articles pending review' },
      { key: 'kb.review_external', label: 'Approve or request changes on external articles pending review' },
    ],
  },
  {
    module: 'assets',
    label: 'Asset Management',
    permissions: [
      { key: 'assets.view', label: 'View assets' },
      { key: 'assets.create', label: 'Create assets' },
      { key: 'assets.edit', label: 'Edit assets' },
      { key: 'assets.delete', label: 'Delete assets' },
      { key: 'assets.assign', label: 'Assign, check out, and check in assets' },
      { key: 'assets.manage_custom_fields', label: 'Manage custom field definitions' },
      { key: 'assets.import_export', label: 'Bulk import/export assets via CSV' },
      { key: 'assets.manage_vendors', label: 'Manage vendors and contracts' },
    ],
  },
  {
    module: 'logs',
    label: 'Log Monitoring',
    permissions: [
      { key: 'logs.view', label: 'Search, tail, and view the log dashboard' },
      { key: 'logs.view_all_sources', label: 'View all log sources, bypassing team restrictions' },
      { key: 'logs.manage_sources', label: 'Register/edit log sources and API keys' },
      { key: 'logs.manage_alerts', label: 'Manage alert rules' },
      { key: 'logs.manage_retention', label: 'Edit retention settings and trigger purges' },
    ],
  },
  {
    module: 'patches',
    label: 'Patch Management',
    permissions: [
      { key: 'patches.view', label: 'View the patch catalog, compliance report, and maintenance windows' },
      { key: 'patches.manage_catalog', label: 'Approve or decline patches' },
      { key: 'patches.manage_agents', label: 'Generate/rotate per-asset patch agent keys' },
      { key: 'patches.manage_windows', label: 'Create/edit maintenance windows' },
    ],
  },
  {
    module: 'reports',
    label: 'Reporting & Insights',
    permissions: [
      { key: 'reports.view', label: 'View the overview dashboard and knowledge base feedback report' },
      { key: 'reports.manage_scheduled', label: 'Create/edit scheduled report emails' },
    ],
  },
  {
    module: 'projects',
    label: 'Project Management',
    permissions: [
      { key: 'projects.view', label: 'View projects, tasks, and the board' },
      { key: 'projects.create', label: 'Create projects' },
      { key: 'projects.manage', label: 'Edit/delete projects, change status, and manage team membership' },
      { key: 'projects.manage_tasks', label: 'Create/edit tasks, dependencies, board moves, and ticket/asset linking' },
      { key: 'projects.delete_tasks', label: 'Delete tasks' },
    ],
  },
];

export const ALL_PERMISSION_KEYS: string[] = PERMISSION_CATALOG.flatMap((m) => m.permissions.map((p) => p.key));

export function isValidPermissionKey(key: string): boolean {
  return ALL_PERMISSION_KEYS.includes(key);
}
