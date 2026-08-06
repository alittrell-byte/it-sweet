import { parseAssetsCsv, assetsToCsv } from '../../src/modules/assets/csv';
import { Asset } from '../../src/modules/assets/asset.model';

describe('parseAssetsCsv', () => {
  it('parses a well-formed row into CreateAssetInput', () => {
    // customFields is JSON, so its embedded quotes must be CSV-escaped ("" ) and the
    // whole field quoted - this is what a real spreadsheet export would produce.
    const csv = 'name,type,status,serialNumber,vendor,purchaseDate,warrantyExpiry,licenseSeatsPurchased,notes,customFields\n' +
      'Dell Laptop,hardware,available,SN123,Dell,2024-01-01,2027-01-01,,Spare unit,"{""color"":""black""}"';
    const [result] = parseAssetsCsv(csv);
    expect(result.status).toBe('parsed');
    expect(result.data).toMatchObject({
      name: 'Dell Laptop',
      type: 'hardware',
      status: 'available',
      serialNumber: 'SN123',
      vendor: 'Dell',
      customFields: { color: 'black' },
    });
  });

  it('rejects a row missing the required name column', () => {
    const csv = 'name,type\n,hardware';
    const [result] = parseAssetsCsv(csv);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/name/i);
  });

  it('rejects a row with an invalid type', () => {
    const csv = 'name,type\nWidget,not_a_real_type';
    const [result] = parseAssetsCsv(csv);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/type/i);
  });

  it('rejects a row whose customFields column is not valid JSON', () => {
    const csv = 'name,type,customFields\nWidget,hardware,{not valid json}';
    const [result] = parseAssetsCsv(csv);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/JSON/i);
  });

  it('rejects a non-numeric licenseSeatsPurchased value', () => {
    const csv = 'name,type,licenseSeatsPurchased\nOffice 365,software_license,many';
    const [result] = parseAssetsCsv(csv);
    expect(result.status).toBe('error');
    expect(result.error).toMatch(/licenseSeatsPurchased/);
  });

  it('reports the correct 1-indexed-plus-header row number for later rows', () => {
    const csv = 'name,type\nGood One,hardware\n,hardware\nGood Two,hardware';
    const results = parseAssetsCsv(csv);
    expect(results[1].row).toBe(3);
    expect(results[1].status).toBe('error');
  });
});

describe('assetsToCsv', () => {
  it('round-trips a minimal asset through export then import', () => {
    const asset = Asset.build({
      name: 'Roundtrip Widget',
      type: 'peripheral',
      status: 'available',
      serialNumber: 'RT-1',
      customFields: { location: 'HQ' },
    });
    const csv = assetsToCsv([asset]);
    const [result] = parseAssetsCsv(csv);
    expect(result.status).toBe('parsed');
    expect(result.data).toMatchObject({
      name: 'Roundtrip Widget',
      type: 'peripheral',
      serialNumber: 'RT-1',
      customFields: { location: 'HQ' },
    });
  });
});
