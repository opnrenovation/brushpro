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

  // Upsert default service agreement template (updates body if already exists)
  const defaultTemplate = await prisma.contractTemplate.findFirst({ where: { is_default: true } });
  const serviceAgreementBody = `PAINTING SERVICES AGREEMENT

This Painting Services Agreement ("Agreement") is entered into as of {date} between {company_name} ("Service Provider") and {customer_name} ("Client").

1. SCOPE OF WORK

Service Provider agrees to furnish all labor and materials necessary to complete the following services at the property located at {job_address}:

{scope_of_work}

2. AGREEMENT PRICE

The total price for the services described above is {total_price} (Reference: Estimate {estimate_number}). This price includes all labor and materials unless otherwise noted in the estimate.

3. PAYMENT TERMS

A deposit of 30% is due upon signing this agreement. The remaining balance is due upon completion of the project and final walkthrough. Accepted forms of payment include check, cash, and credit card.

4. PAINT SELECTIONS

Client is responsible for selecting and confirming all paint colors prior to the commencement of work. Color changes requested after work has begun may result in additional charges and schedule adjustments.

5. CHANGES TO SCOPE

Any additions or modifications to the agreed scope of work require written approval by both parties prior to execution. Such changes may affect the agreement price and project timeline.

6. PROPERTY ACCESS AND PREPARATION

Client agrees to provide reasonable access to the property during scheduled work hours. Client is responsible for clearing personal belongings, furniture, and valuables from work areas before the scheduled start.

7. COMPLETION AND INSPECTION

Upon completion, Client will have the opportunity to inspect all completed work. Any workmanship concerns must be communicated to Service Provider in writing within 3 business days of project completion.

8. WORKMANSHIP WARRANTY

Service Provider warrants all workmanship for one (1) year from the date of project completion. This warranty covers defects in application and does not extend to damage caused by moisture intrusion, structural movement, substrate failure, or normal wear and tear.

9. INSURANCE

Service Provider maintains general liability insurance coverage. A certificate of insurance is available upon request.

10. CANCELLATION POLICY

Client may cancel this agreement with 48 hours written notice prior to the scheduled start date. If materials have been ordered or work has commenced, Client is responsible for all costs incurred to that point.

11. LIMITATION OF LIABILITY

Service Provider's liability under this agreement is limited to the total agreement price. Service Provider is not responsible for pre-existing damage or deficiencies discovered during the course of work.

12. GOVERNING LAW

This Agreement shall be governed by the laws of the State of Iowa. Any disputes arising from this Agreement shall first be submitted to mediation before proceeding to arbitration or litigation.

By signing this agreement, Client acknowledges having read, understood, and agreed to all terms and conditions set forth herein.`;

  if (!defaultTemplate) {
    await prisma.contractTemplate.create({
      data: {
        name: 'Residential Standard',
        description: 'Standard residential painting services agreement',
        body_text: serviceAgreementBody,
        requires_initials: false,
        signature_label: 'Client Signature',
        company_sig_label: 'Authorized by Service Provider',
        is_default: true,
      },
    });
    console.log('Default service agreement template created.');
  } else {
    await prisma.contractTemplate.update({
      where: { id: defaultTemplate.id },
      data: { body_text: serviceAgreementBody, name: 'Residential Standard' },
    });
    console.log('Default service agreement template updated.');
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
