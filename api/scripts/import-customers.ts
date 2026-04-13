/**
 * Import customers from "Customers list 2026.xlsx"
 * - Rows where Name == Company name → company only (no individual contact)
 * - Rows with a distinct person name + company → create Company + Contact linked
 * - Rows with just a person name (no company) → contact only
 */
import { PrismaClient } from '@prisma/client';
import * as xlsx from 'xlsx';
import * as path from 'path';

const prisma = new PrismaClient();

interface Row {
  name: string;
  company: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  phone: string | null;
  email: string | null;
}

async function main() {
  const filePath = path.resolve('/Users/alexandronakata/Downloads/Customers list 2026.xlsx');
  const wb = xlsx.readFile(filePath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = xlsx.utils.sheet_to_json(ws, { defval: null }) as Record<string, unknown>[];

  const rows: Row[] = raw.map((r) => ({
    name:    (r['Name']           as string | null)?.trim()   || '',
    company: (r['Company name']   as string | null)?.trim()   || null,
    address: (r['Street Address'] as string | null)?.trim()   || null,
    city:    (r['City']           as string | null)?.trim()   || null,
    state:   (r['State']          as string | null)?.trim()   || null,
    zip:     (r['Zip']            as string | null)?.toString().trim() || null,
    phone:   (r['Phone']          as string | null)?.trim()   || null,
    email:   (r['Email']          as string | null)?.trim()   || null,
  }));

  let companiesCreated = 0;
  let contactsCreated  = 0;
  let skipped          = 0;

  for (const row of rows) {
    if (!row.name) { skipped++; continue; }

    const isBusinessOnly = row.company && row.company.toLowerCase() === row.name.toLowerCase();

    if (isBusinessOnly) {
      // Pure company row — create Company only
      const existing = await prisma.company.findFirst({ where: { name: { equals: row.company!, mode: 'insensitive' } } });
      if (existing) { console.log(`  skip company (exists): ${row.company}`); skipped++; continue; }
      await prisma.company.create({
        data: {
          name:    row.company!,
          phone:   row.phone   || undefined,
          email:   row.email   || undefined,
          address: row.address || undefined,
          city:    row.city    || undefined,
          state:   row.state   || undefined,
          zip:     row.zip     || undefined,
        },
      });
      console.log(`  + company: ${row.company}`);
      companiesCreated++;
    } else {
      // Person (with optional company link)
      const nameParts = row.name.split(/\s+/);
      const firstName = nameParts[0] || row.name;
      const lastName  = nameParts.slice(1).join(' ') || '';

      // Resolve or create linked company
      let companyId: string | undefined;
      if (row.company) {
        let co = await prisma.company.findFirst({ where: { name: { equals: row.company, mode: 'insensitive' } } });
        if (!co) {
          co = await prisma.company.create({
            data: {
              name:    row.company,
              phone:   row.phone   || undefined,
              address: row.address || undefined,
              city:    row.city    || undefined,
              state:   row.state   || undefined,
              zip:     row.zip     || undefined,
            },
          });
          console.log(`  + company: ${row.company}`);
          companiesCreated++;
        }
        companyId = co.id;
      }

      // Need a unique email — generate placeholder if missing
      const email = row.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}.noemail@placeholder.local`.replace(/\s+/g, '');

      const existing = await prisma.contact.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } });
      if (existing) { console.log(`  skip contact (exists): ${row.name}`); skipped++; continue; }

      await prisma.contact.create({
        data: {
          first_name: firstName,
          last_name:  lastName,
          email,
          phone:      row.phone   || undefined,
          address:    row.address || undefined,
          city:       row.city    || undefined,
          state:      row.state   || undefined,
          zip:        row.zip     || undefined,
          company:    row.company || undefined,
          company_id: companyId,
          type:       'CUSTOMER',
          subscribed: true,
        },
      });
      console.log(`  + contact: ${row.name}${row.company ? ` (${row.company})` : ''}`);
      contactsCreated++;
    }
  }

  console.log(`\nDone. Companies: ${companiesCreated}, Contacts: ${contactsCreated}, Skipped: ${skipped}`);
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
