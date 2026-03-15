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
