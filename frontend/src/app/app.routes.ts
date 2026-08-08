import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { ShellComponent } from './shared/layout/shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'tickets' },
      {
        path: 'account/change-password',
        loadComponent: () =>
          import('./features/auth/change-password/change-password.component').then((m) => m.ChangePasswordComponent),
      },
      {
        path: 'tickets/new',
        loadComponent: () =>
          import('./features/tickets/ticket-create/ticket-create.component').then((m) => m.TicketCreateComponent),
      },
      {
        path: 'tickets/:id',
        loadComponent: () =>
          import('./features/tickets/ticket-detail/ticket-detail.component').then((m) => m.TicketDetailComponent),
      },
      {
        path: 'tickets',
        loadComponent: () =>
          import('./features/tickets/ticket-list/ticket-list.component').then((m) => m.TicketListComponent),
      },
      {
        path: 'dashboard',
        canActivate: [permissionGuard('tickets.view_dashboard')],
        loadComponent: () => import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'settings/canned-responses',
        canActivate: [permissionGuard('tickets.manage_canned_responses')],
        loadComponent: () =>
          import('./features/settings/canned-responses/canned-responses.component').then(
            (m) => m.CannedResponsesComponent
          ),
      },
      {
        path: 'settings/ticket-templates',
        canActivate: [permissionGuard('tickets.manage_templates')],
        loadComponent: () =>
          import('./features/settings/ticket-templates/ticket-templates.component').then(
            (m) => m.TicketTemplatesComponent
          ),
      },
      {
        path: 'settings/teams',
        canActivate: [permissionGuard('tickets.manage_teams')],
        loadComponent: () => import('./features/settings/teams/teams.component').then((m) => m.TeamsComponent),
      },
      {
        path: 'settings/recurring-tickets',
        canActivate: [permissionGuard('tickets.manage_recurring')],
        loadComponent: () =>
          import('./features/settings/recurring-tickets/recurring-tickets.component').then(
            (m) => m.RecurringTicketsComponent
          ),
      },
      {
        path: 'settings/kb-templates',
        canActivate: [permissionGuard('kb.manage_templates')],
        loadComponent: () =>
          import('./features/settings/kb-templates/kb-templates.component').then((m) => m.KbTemplatesComponent),
      },
      {
        path: 'settings/notification-groups',
        canActivate: [permissionGuard('notifications.manage_groups')],
        loadComponent: () =>
          import('./features/settings/notification-groups/notification-groups.component').then(
            (m) => m.NotificationGroupsComponent
          ),
      },
      {
        path: 'users',
        canActivate: [permissionGuard('users.view')],
        loadComponent: () => import('./features/users/user-list/user-list.component').then((m) => m.UserListComponent),
      },
      {
        path: 'users/new',
        canActivate: [permissionGuard('users.create')],
        loadComponent: () =>
          import('./features/users/user-create/user-create.component').then((m) => m.UserCreateComponent),
      },
      {
        path: 'users/:id',
        canActivate: [permissionGuard('users.view')],
        loadComponent: () => import('./features/users/user-edit/user-edit.component').then((m) => m.UserEditComponent),
      },
      {
        path: 'assets/new',
        canActivate: [permissionGuard('assets.create')],
        loadComponent: () => import('./features/assets/asset-create/asset-create.component').then((m) => m.AssetCreateComponent),
      },
      {
        path: 'assets/license-compliance',
        canActivate: [permissionGuard('assets.view')],
        loadComponent: () =>
          import('./features/assets/license-compliance/license-compliance.component').then(
            (m) => m.LicenseComplianceComponent
          ),
      },
      {
        path: 'assets/depreciation-report',
        canActivate: [permissionGuard('assets.view')],
        loadComponent: () =>
          import('./features/assets/depreciation-report/depreciation-report.component').then(
            (m) => m.DepreciationReportComponent
          ),
      },
      {
        path: 'settings/vendors',
        canActivate: [permissionGuard('assets.manage_vendors')],
        loadComponent: () => import('./features/settings/vendors/vendors.component').then((m) => m.VendorsComponent),
      },
      {
        path: 'assets/:id',
        canActivate: [permissionGuard('assets.view')],
        loadComponent: () => import('./features/assets/asset-detail/asset-detail.component').then((m) => m.AssetDetailComponent),
      },
      {
        path: 'assets',
        canActivate: [permissionGuard('assets.view')],
        loadComponent: () => import('./features/assets/asset-list/asset-list.component').then((m) => m.AssetListComponent),
      },
      {
        path: 'settings/custom-field-definitions',
        canActivate: [permissionGuard('assets.manage_custom_fields')],
        loadComponent: () =>
          import('./features/settings/custom-field-definitions/custom-field-definitions.component').then(
            (m) => m.CustomFieldDefinitionsComponent
          ),
      },
      {
        path: 'logs',
        canActivate: [permissionGuard('logs.view')],
        loadComponent: () => import('./features/logs/log-search/log-search.component').then((m) => m.LogSearchComponent),
      },
      {
        path: 'logs/tail',
        canActivate: [permissionGuard('logs.view')],
        loadComponent: () => import('./features/logs/log-tail/log-tail.component').then((m) => m.LogTailComponent),
      },
      {
        path: 'logs/dashboard',
        canActivate: [permissionGuard('logs.view')],
        loadComponent: () =>
          import('./features/logs/log-dashboard/log-dashboard.component').then((m) => m.LogDashboardComponent),
      },
      {
        path: 'logs/sources',
        canActivate: [permissionGuard('logs.manage_sources')],
        loadComponent: () =>
          import('./features/logs/log-sources/log-sources.component').then((m) => m.LogSourcesComponent),
      },
      {
        path: 'logs/alert-rules',
        canActivate: [permissionGuard('logs.manage_alerts')],
        loadComponent: () =>
          import('./features/logs/alert-rules/alert-rules.component').then((m) => m.AlertRulesComponent),
      },
      {
        // Visible to everyone, including customers - the external space is meant to be
        // browsable by anyone; the backend enforces internal-space/manage-action permissions.
        path: 'kb/new',
        canActivate: [permissionGuard('kb.manage_internal', 'kb.manage_external')],
        loadComponent: () =>
          import('./features/knowledge-base/kb-article-edit/kb-article-edit.component').then(
            (m) => m.KbArticleEditComponent
          ),
      },
      {
        path: 'kb/categories',
        canActivate: [permissionGuard('kb.manage_categories')],
        loadComponent: () =>
          import('./features/knowledge-base/kb-categories/kb-categories.component').then((m) => m.KbCategoriesComponent),
      },
      {
        path: 'kb/:id/edit',
        canActivate: [permissionGuard('kb.manage_internal', 'kb.manage_external')],
        loadComponent: () =>
          import('./features/knowledge-base/kb-article-edit/kb-article-edit.component').then(
            (m) => m.KbArticleEditComponent
          ),
      },
      {
        path: 'kb/:id',
        loadComponent: () =>
          import('./features/knowledge-base/kb-article-view/kb-article-view.component').then(
            (m) => m.KbArticleViewComponent
          ),
      },
      {
        path: 'kb',
        loadComponent: () =>
          import('./features/knowledge-base/kb-browse/kb-browse.component').then((m) => m.KbBrowseComponent),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
