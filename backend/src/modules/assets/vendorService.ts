import { BadRequestError, NotFoundError } from '../../common/errors';
import { Contract } from './contract.model';
import { Vendor } from './vendor.model';

export interface VendorInput {
  name: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}

export function listVendors(): Promise<Vendor[]> {
  return Vendor.findAll({ order: [['name', 'ASC']] });
}

export async function getVendor(id: string): Promise<Vendor> {
  const vendor = await Vendor.findByPk(id);
  if (!vendor) throw new NotFoundError('Vendor not found');
  return vendor;
}

export function createVendor(input: VendorInput): Promise<Vendor> {
  return Vendor.create(input);
}

export async function updateVendor(id: string, input: Partial<VendorInput>): Promise<Vendor> {
  const vendor = await getVendor(id);
  await vendor.update(input);
  return vendor;
}

export async function deleteVendor(id: string): Promise<void> {
  const vendor = await getVendor(id);
  // Assets pointing at this vendor are fine (vendor_id is SET NULL on delete) - but silently
  // cascading away contract history because someone deleted a vendor record would be a real
  // data-loss surprise, so that's blocked explicitly instead (same principle as KB category
  // delete-safety: block with a clear reason rather than cascade or orphan silently).
  const contractCount = await Contract.count({ where: { vendorId: id } });
  if (contractCount > 0) {
    throw new BadRequestError(
      `Cannot delete "${vendor.name}": it still has ${contractCount} contract${contractCount === 1 ? '' : 's'} attached. Reassign or remove them first.`
    );
  }
  await vendor.destroy();
}
