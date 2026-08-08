import { NotFoundError } from '../../common/errors';
import { Team } from '../tickets/team.model';
import { MaintenanceWindow, MaintenanceWindowRecurrence } from './maintenanceWindow.model';

export interface MaintenanceWindowInput {
  name: string;
  teamId?: string | null;
  startsAt: Date;
  endsAt: Date;
  recurrence?: MaintenanceWindowRecurrence;
  notes?: string | null;
}

export function listMaintenanceWindows(): Promise<MaintenanceWindow[]> {
  return MaintenanceWindow.findAll({ include: [{ model: Team, as: 'team', attributes: ['id', 'name'] }], order: [['startsAt', 'ASC']] });
}

export function createMaintenanceWindow(input: MaintenanceWindowInput): Promise<MaintenanceWindow> {
  return MaintenanceWindow.create(input);
}

export async function updateMaintenanceWindow(id: string, input: Partial<MaintenanceWindowInput>): Promise<MaintenanceWindow> {
  const window = await MaintenanceWindow.findByPk(id);
  if (!window) throw new NotFoundError('Maintenance window not found');
  await window.update(input);
  return window;
}

export async function deleteMaintenanceWindow(id: string): Promise<void> {
  await MaintenanceWindow.destroy({ where: { id } });
}
