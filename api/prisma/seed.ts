import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Upsert — always ensures correct password and clears force-change flag
  const hash = await bcrypt.hash('Kaname07!', 12);
  await prisma.user.upsert({
    where: { email: 'harunakata@hotmail.com' },
    update: {
      password_hash: hash,
      must_change_password: false,
      is_active: true,
    },
    create: {
      email: 'harunakata@hotmail.com',
      name: 'Admin',
      role: 'OWNER',
      password_hash: hash,
      must_change_password: false,
      is_active: true,
    },
  });
  console.log('Admin user upserted: harunakata@hotmail.com');

  // Seed default company settings row if missing
  const settingsCount = await prisma.companySettings.count();
  if (settingsCount === 0) {
    await prisma.companySettings.create({
      data: {
        company_name: 'OPN Renovation',
        website: 'https://opnrenovation.com',
        invoice_prefix: 'INV',
        estimate_prefix: 'EST',
        deposit_required: true,
        deposit_percentage: 30,
        payment_terms_days: 7,
      },
    });
    console.log('Default company settings created.');
  }

  // Seed default scheduler settings row if missing
  const schedulerCount = await prisma.schedulerSettings.count();
  if (schedulerCount === 0) {
    await prisma.schedulerSettings.create({
      data: {
        buffer_minutes: 30,
        min_notice_hours: 24,
        booking_window_days: 60,
        reminder_hours_before: 24,
      },
    });
    console.log('Default scheduler settings created.');
  }

  // Seed default appointment type
  const apptTypeCount = await prisma.appointmentType.count();
  if (apptTypeCount === 0) {
    await prisma.appointmentType.create({
      data: {
        name: 'Free Estimate Walk-Through',
        description: 'A quick walk-through to discuss your project and provide a free estimate.',
        duration_minutes: 30,
        is_active: true,
      },
    });
    console.log('Default appointment type created.');
  }

  // Seed default contract template
  const contractCount = await prisma.contractTemplate.count();
  if (contractCount === 0) {
    await prisma.contractTemplate.create({
      data: {
        name: 'Residential Standard',
        description: 'Standard residential painting contract',
        body_text: `<h2>PAINTING SERVICES AGREEMENT</h2>
<p>This agreement is entered into between <strong>{company_name}</strong> and <strong>{customer_name}</strong> (the "Client").</p>

<h3>Project Details</h3>
<p><strong>Property Address:</strong> {job_address}</p>
<p><strong>Estimate Number:</strong> {estimate_number}</p>
<p><strong>Total Contract Price:</strong> {total_price}</p>
<p><strong>Deposit Amount:</strong> {deposit_amount}</p>

<h3>Scope of Work</h3>
<p>OPN Renovation agrees to perform the painting services as detailed in the estimate referenced above.</p>

<h3>Payment Terms</h3>
<p>A deposit of {deposit_amount} is due upon signing this contract. The remaining balance is due within {payment_terms} days of project completion.</p>

<h3>Terms & Conditions</h3>
<p>1. OPN Renovation will supply all labor, materials, and equipment unless otherwise specified.</p>
<p>2. Client agrees to provide reasonable access to the property during scheduled work hours.</p>
<p>3. Any changes to the scope of work must be agreed upon in writing by both parties.</p>
<p>4. OPN Renovation is fully insured. Proof of insurance available upon request.</p>
<p>5. OPN Renovation is not responsible for existing damage discovered during preparation.</p>

<h3>Warranty</h3>
<p>OPN Renovation warrants all workmanship for one (1) year from the date of completion.</p>

<p>By signing below, both parties agree to the terms and conditions of this contract.</p>`,
        requires_initials: false,
        signature_label: 'Customer Signature',
        company_sig_label: 'Authorized by OPN Renovation',
        is_default: true,
      },
    });
    console.log('Default contract template created.');
  }

  // Seed Iowa municipality tax profiles
  const taxCount = await prisma.taxProfile.count();
  if (taxCount === 0) {
    // Iowa state sales tax: 6%. Most incorporated municipalities have adopted the 1% Local Option Sales Tax (LOST).
    // Rates sourced from Iowa Dept of Revenue. Verify before filing.
    const iowaMunicipalities = [
      // Des Moines metro – Polk County
      { name: 'Des Moines, IA', municipality: 'Des Moines', state_rate: 0.06, local_rate: 0.01, is_default: true },
      { name: 'Ankeny, IA', municipality: 'Ankeny', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'West Des Moines, IA', municipality: 'West Des Moines', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Urbandale, IA', municipality: 'Urbandale', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Johnston, IA', municipality: 'Johnston', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Waukee, IA', municipality: 'Waukee', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clive, IA', municipality: 'Clive', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Windsor Heights, IA', municipality: 'Windsor Heights', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Pleasant Hill, IA', municipality: 'Pleasant Hill', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Altoona, IA', municipality: 'Altoona', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Bondurant, IA', municipality: 'Bondurant', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Grimes, IA', municipality: 'Grimes', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Polk City, IA', municipality: 'Polk City', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Mitchellville, IA', municipality: 'Mitchellville', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Warren County (south metro)
      { name: 'Norwalk, IA', municipality: 'Norwalk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Indianola, IA', municipality: 'Indianola', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Carlisle, IA', municipality: 'Carlisle', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Dallas County (west metro)
      { name: 'Adel, IA', municipality: 'Adel', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Perry, IA', municipality: 'Perry', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Woodward, IA', municipality: 'Woodward', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Madison County
      { name: 'Winterset, IA', municipality: 'Winterset', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Other major Iowa cities
      { name: 'Cedar Rapids, IA', municipality: 'Cedar Rapids', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Iowa City, IA', municipality: 'Iowa City', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Coralville, IA', municipality: 'Coralville', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'North Liberty, IA', municipality: 'North Liberty', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Marion, IA', municipality: 'Marion', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Davenport, IA', municipality: 'Davenport', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Bettendorf, IA', municipality: 'Bettendorf', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Sioux City, IA', municipality: 'Sioux City', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Waterloo, IA', municipality: 'Waterloo', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Cedar Falls, IA', municipality: 'Cedar Falls', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Ames, IA', municipality: 'Ames', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Dubuque, IA', municipality: 'Dubuque', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Council Bluffs, IA', municipality: 'Council Bluffs', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Mason City, IA', municipality: 'Mason City', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Burlington, IA', municipality: 'Burlington', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clinton, IA', municipality: 'Clinton', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Ottumwa, IA', municipality: 'Ottumwa', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Fort Dodge, IA', municipality: 'Fort Dodge', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Marshalltown, IA', municipality: 'Marshalltown', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Muscatine, IA', municipality: 'Muscatine', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Keokuk, IA', municipality: 'Keokuk', state_rate: 0.06, local_rate: 0.01, is_default: false },
    ];

    for (const m of iowaMunicipalities) {
      await prisma.taxProfile.create({
        data: {
          name: m.name,
          state_code: 'IA',
          state_rate: m.state_rate,
          local_rate: m.local_rate,
          municipality: m.municipality,
          taxable_labor: false,
          is_default: m.is_default,
        },
      });
    }
    console.log(`Iowa tax profiles seeded: ${iowaMunicipalities.length} municipalities.`);
  }

  // Seed default availability rules (Mon–Fri 8am–5pm, Sat 8am–1pm)
  const availCount = await prisma.availabilityRule.count();
  if (availCount === 0) {
    const weekdays = [1, 2, 3, 4, 5]; // Mon–Fri
    for (const day of weekdays) {
      await prisma.availabilityRule.create({
        data: { day_of_week: day, start_time: '08:00', end_time: '17:00', is_active: true },
      });
    }
    await prisma.availabilityRule.create({
      data: { day_of_week: 6, start_time: '08:00', end_time: '13:00', is_active: true },
    });
    console.log('Default availability rules created.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
