import { Component, computed, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

interface NavChild {
  label: string;
  path: string;
}

interface NavModule {
  key: string;
  label: string;
  children: NavChild[];
}

interface FlyoutPosition {
  top: number;
  left: number;
}

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <div class="flex h-screen overflow-hidden">
      <!-- Catches outside clicks to close whichever module flyout is open, without
           intercepting clicks inside the sidebar or the flyout itself. -->
      @if (openModule()) {
        <div class="fixed inset-0 z-10" (click)="closeModule()"></div>
      }

      <aside class="w-56 shrink-0 bg-slate-900 text-slate-200 flex flex-col z-20 relative">
        <div class="p-4 font-semibold text-white border-b border-slate-700">IT Help Desk</div>

        <nav class="flex-1 overflow-y-auto py-2">
          @for (mod of modules(); track mod.key) {
            <button
              type="button"
              (click)="toggleModule(mod.key, $event)"
              class="w-full text-left px-4 py-2.5 flex justify-between items-center hover:bg-slate-800 transition-colors"
              [class.bg-slate-800]="openModule() === mod.key"
            >
              <span>{{ mod.label }}</span>
              <span class="text-slate-500">&rsaquo;</span>
            </button>
          }
        </nav>

        <div class="p-4 border-t border-slate-700 text-xs">
          <div class="text-white">{{ auth.currentUser()?.displayName }}</div>
          <div class="text-slate-400">
            {{ auth.currentUser()?.role }}{{ auth.isSuperAdmin() ? ' · super admin' : '' }}
          </div>
          <a routerLink="/account/change-password" class="mt-2 block text-slate-300 hover:text-white">Change Password</a>
          <button (click)="logout()" class="mt-1 text-slate-300 hover:text-white">Log out</button>
        </div>
      </aside>

      <!-- Rendered fixed to the viewport (not nested in the scrolling sidebar nav) so it
           always floats in front of the page at the button's real position, instead of
           being clipped/scrolled by the sidebar's own overflow. -->
      @if (openModuleData(); as mod) {
        <div
          class="fixed w-56 bg-white text-slate-800 rounded-md shadow-xl border border-gray-200 py-1 z-40"
          [style.top.px]="flyoutPosition().top"
          [style.left.px]="flyoutPosition().left"
        >
          @for (child of mod.children; track child.path) {
            <a
              [routerLink]="child.path"
              routerLinkActive="bg-gray-100 font-medium"
              (click)="closeModule()"
              class="block px-4 py-2 text-sm hover:bg-gray-50"
            >
              {{ child.label }}
            </a>
          }
        </div>
      }

      <main class="flex-1 overflow-y-auto p-6 bg-gray-50">
        <router-outlet />
      </main>
    </div>
  `,
})
export class ShellComponent {
  readonly openModule = signal<string | null>(null);
  readonly flyoutPosition = signal<FlyoutPosition>({ top: 0, left: 0 });

  readonly modules = computed<NavModule[]>(() => {
    const isStaff = this.auth.isStaff();
    const modules: NavModule[] = [
      {
        key: 'tickets',
        label: 'Ticketing',
        children: [
          { label: isStaff ? 'All Tickets' : 'My Tickets', path: '/tickets' },
          { label: 'New Ticket', path: '/tickets/new' },
          ...(this.auth.hasPermission('tickets.view_dashboard') ? [{ label: 'Dashboard', path: '/dashboard' }] : []),
          ...(this.auth.hasPermission('tickets.manage_canned_responses')
            ? [{ label: 'Canned Responses', path: '/settings/canned-responses' }]
            : []),
          ...(this.auth.hasPermission('tickets.manage_templates')
            ? [{ label: 'Ticket Templates', path: '/settings/ticket-templates' }]
            : []),
          ...(this.auth.hasPermission('tickets.manage_teams') ? [{ label: 'Teams / Queues', path: '/settings/teams' }] : []),
          ...(this.auth.hasPermission('tickets.manage_recurring')
            ? [{ label: 'Recurring Tickets', path: '/settings/recurring-tickets' }]
            : []),
        ],
      },
    ];

    // Visible to everyone, including customers - unlike every other module, the Knowledge
    // Base's external space is meant to be browsable by any authenticated user. Management
    // actions (new article, categories) are still permission-gated children.
    modules.push({
      key: 'kb',
      label: 'Knowledge Base',
      children: [
        { label: 'Browse', path: '/kb' },
        ...(this.auth.hasPermission('kb.manage_internal') || this.auth.hasPermission('kb.manage_external')
          ? [{ label: '+ New Article', path: '/kb/new' }]
          : []),
        ...(this.auth.hasPermission('kb.manage_categories') ? [{ label: 'Categories', path: '/kb/categories' }] : []),
        ...(this.auth.hasPermission('kb.manage_templates') ? [{ label: 'Article Templates', path: '/settings/kb-templates' }] : []),
      ],
    });

    if (this.auth.hasPermission('assets.view')) {
      modules.push({
        key: 'assets',
        label: 'Assets',
        children: [
          { label: 'All Assets', path: '/assets' },
          ...(this.auth.hasPermission('assets.create') ? [{ label: '+ Quick Add', path: '/assets/new' }] : []),
          { label: 'License Compliance', path: '/assets/license-compliance' },
          { label: 'Depreciation Report', path: '/assets/depreciation-report' },
          ...(this.auth.hasPermission('assets.manage_vendors') ? [{ label: 'Vendors & Contracts', path: '/settings/vendors' }] : []),
          ...(this.auth.hasPermission('assets.manage_custom_fields')
            ? [{ label: 'Custom Fields', path: '/settings/custom-field-definitions' }]
            : []),
        ],
      });
    }

    if (this.auth.hasPermission('logs.view')) {
      modules.push({
        key: 'logs',
        label: 'Logs',
        children: [
          { label: 'Search', path: '/logs' },
          { label: 'Live Tail', path: '/logs/tail' },
          { label: 'Dashboard', path: '/logs/dashboard' },
          ...(this.auth.hasPermission('logs.manage_sources') ? [{ label: 'Sources & Retention', path: '/logs/sources' }] : []),
          ...(this.auth.hasPermission('logs.manage_alerts') ? [{ label: 'Alert Rules', path: '/logs/alert-rules' }] : []),
        ],
      });
    }

    if (this.auth.hasPermission('patches.view')) {
      modules.push({
        key: 'patches',
        label: 'Patch Management',
        children: [
          { label: 'Compliance Report', path: '/patches/compliance-report' },
          { label: 'Catalog', path: '/patches/catalog' },
          { label: 'Maintenance Windows', path: '/patches/maintenance-windows' },
        ],
      });
    }

    if (this.auth.hasPermission('reports.view')) {
      modules.push({
        key: 'reports',
        label: 'Reporting',
        children: [
          { label: 'Overview', path: '/reports/overview' },
          { label: 'KB Feedback', path: '/reports/kb-feedback' },
          { label: 'Scheduled Reports', path: '/reports/scheduled-reports' },
        ],
      });
    }

    if (this.auth.hasPermission('projects.view')) {
      modules.push({
        key: 'projects',
        label: 'Projects',
        children: [
          { label: 'All Projects', path: '/projects' },
          ...(this.auth.hasPermission('projects.create') ? [{ label: '+ New Project', path: '/projects/new' }] : []),
          ...(this.auth.hasPermission('projects.manage_templates')
            ? [{ label: 'Project Templates', path: '/projects/templates' }]
            : []),
        ],
      });
    }

    if (this.auth.hasPermission('notifications.manage_groups')) {
      modules.push({
        key: 'notifications',
        label: 'Notifications',
        children: [{ label: 'Notification Groups', path: '/settings/notification-groups' }],
      });
    }

    if (this.auth.hasPermission('users.view')) {
      modules.push({
        key: 'users',
        label: 'Users',
        children: [
          { label: 'All Users', path: '/users' },
          ...(this.auth.hasPermission('users.create') ? [{ label: '+ New User', path: '/users/new' }] : []),
        ],
      });
    }

    return modules;
  });

  readonly openModuleData = computed<NavModule | null>(() => {
    const key = this.openModule();
    return key ? (this.modules().find((m) => m.key === key) ?? null) : null;
  });

  constructor(
    readonly auth: AuthService,
    private readonly router: Router
  ) {}

  toggleModule(key: string, event: MouseEvent): void {
    if (this.openModule() === key) {
      this.closeModule();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.flyoutPosition.set({ top: rect.top, left: rect.right + 4 });
    this.openModule.set(key);
  }

  closeModule(): void {
    this.openModule.set(null);
  }

  async logout(): Promise<void> {
    await this.auth.logout();
    this.router.navigate(['/login']);
  }
}
