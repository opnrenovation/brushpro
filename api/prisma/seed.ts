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
      { name: 'Des Moines, IA', municipality: 'Des Moines', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: true },
      { name: 'Ankeny, IA', municipality: 'Ankeny', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'West Des Moines, IA', municipality: 'West Des Moines', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Urbandale, IA', municipality: 'Urbandale', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Johnston, IA', municipality: 'Johnston', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Waukee, IA', municipality: 'Waukee', county: 'Dallas', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clive, IA', municipality: 'Clive', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Windsor Heights, IA', municipality: 'Windsor Heights', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Pleasant Hill, IA', municipality: 'Pleasant Hill', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Altoona, IA', municipality: 'Altoona', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Bondurant, IA', municipality: 'Bondurant', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Grimes, IA', municipality: 'Grimes', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Polk City, IA', municipality: 'Polk City', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Mitchellville, IA', municipality: 'Mitchellville', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Warren County (south metro)
      { name: 'Norwalk, IA', municipality: 'Norwalk', county: 'Warren', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Indianola, IA', municipality: 'Indianola', county: 'Warren', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Carlisle, IA', municipality: 'Carlisle', county: 'Warren', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Dallas County (west metro)
      { name: 'Adel, IA', municipality: 'Adel', county: 'Dallas', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Perry, IA', municipality: 'Perry', county: 'Dallas', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Woodward, IA', municipality: 'Woodward', county: 'Dallas', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Madison County
      { name: 'Winterset, IA', municipality: 'Winterset', county: 'Madison', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // Other major Iowa cities
      { name: 'Cedar Rapids, IA', municipality: 'Cedar Rapids', county: 'Linn', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Iowa City, IA', municipality: 'Iowa City', county: 'Johnson', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Coralville, IA', municipality: 'Coralville', county: 'Johnson', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'North Liberty, IA', municipality: 'North Liberty', county: 'Johnson', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Marion, IA', municipality: 'Marion', county: 'Linn', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Davenport, IA', municipality: 'Davenport', county: 'Scott', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Bettendorf, IA', municipality: 'Bettendorf', county: 'Scott', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Sioux City, IA', municipality: 'Sioux City', county: 'Woodbury', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Waterloo, IA', municipality: 'Waterloo', county: 'Black Hawk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Cedar Falls, IA', municipality: 'Cedar Falls', county: 'Black Hawk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Ames, IA', municipality: 'Ames', county: 'Story', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Dubuque, IA', municipality: 'Dubuque', county: 'Dubuque', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Council Bluffs, IA', municipality: 'Council Bluffs', county: 'Pottawattamie', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Mason City, IA', municipality: 'Mason City', county: 'Cerro Gordo', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Burlington, IA', municipality: 'Burlington', county: 'Des Moines', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clinton, IA', municipality: 'Clinton', county: 'Clinton', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Ottumwa, IA', municipality: 'Ottumwa', county: 'Wapello', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Fort Dodge, IA', municipality: 'Fort Dodge', county: 'Webster', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Marshalltown, IA', municipality: 'Marshalltown', county: 'Marshall', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Muscatine, IA', municipality: 'Muscatine', county: 'Muscatine', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Keokuk, IA', municipality: 'Keokuk', county: 'Lee', state_rate: 0.06, local_rate: 0.01, is_default: false },
      // One countywide profile per Iowa county (all 6% + 1% local option)
      { name: 'Adair' + ' County, IA', municipality: 'Countywide', county: 'Adair', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Adams' + ' County, IA', municipality: 'Countywide', county: 'Adams', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Allamakee' + ' County, IA', municipality: 'Countywide', county: 'Allamakee', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Appanoose' + ' County, IA', municipality: 'Countywide', county: 'Appanoose', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Audubon' + ' County, IA', municipality: 'Countywide', county: 'Audubon', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Benton' + ' County, IA', municipality: 'Countywide', county: 'Benton', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Black Hawk' + ' County, IA', municipality: 'Countywide', county: 'Black Hawk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Boone' + ' County, IA', municipality: 'Countywide', county: 'Boone', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Bremer' + ' County, IA', municipality: 'Countywide', county: 'Bremer', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Buchanan' + ' County, IA', municipality: 'Countywide', county: 'Buchanan', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Buena Vista' + ' County, IA', municipality: 'Countywide', county: 'Buena Vista', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Butler' + ' County, IA', municipality: 'Countywide', county: 'Butler', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Calhoun' + ' County, IA', municipality: 'Countywide', county: 'Calhoun', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Carroll' + ' County, IA', municipality: 'Countywide', county: 'Carroll', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Cass' + ' County, IA', municipality: 'Countywide', county: 'Cass', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Cedar' + ' County, IA', municipality: 'Countywide', county: 'Cedar', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Cerro Gordo' + ' County, IA', municipality: 'Countywide', county: 'Cerro Gordo', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Cherokee' + ' County, IA', municipality: 'Countywide', county: 'Cherokee', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Chickasaw' + ' County, IA', municipality: 'Countywide', county: 'Chickasaw', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clarke' + ' County, IA', municipality: 'Countywide', county: 'Clarke', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clay' + ' County, IA', municipality: 'Countywide', county: 'Clay', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clayton' + ' County, IA', municipality: 'Countywide', county: 'Clayton', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Clinton' + ' County, IA', municipality: 'Countywide', county: 'Clinton', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Crawford' + ' County, IA', municipality: 'Countywide', county: 'Crawford', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Dallas' + ' County, IA', municipality: 'Countywide', county: 'Dallas', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Davis' + ' County, IA', municipality: 'Countywide', county: 'Davis', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Decatur' + ' County, IA', municipality: 'Countywide', county: 'Decatur', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Delaware' + ' County, IA', municipality: 'Countywide', county: 'Delaware', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Des Moines' + ' County, IA', municipality: 'Countywide', county: 'Des Moines', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Dickinson' + ' County, IA', municipality: 'Countywide', county: 'Dickinson', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Dubuque' + ' County, IA', municipality: 'Countywide', county: 'Dubuque', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Emmet' + ' County, IA', municipality: 'Countywide', county: 'Emmet', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Fayette' + ' County, IA', municipality: 'Countywide', county: 'Fayette', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Floyd' + ' County, IA', municipality: 'Countywide', county: 'Floyd', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Franklin' + ' County, IA', municipality: 'Countywide', county: 'Franklin', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Fremont' + ' County, IA', municipality: 'Countywide', county: 'Fremont', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Greene' + ' County, IA', municipality: 'Countywide', county: 'Greene', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Grundy' + ' County, IA', municipality: 'Countywide', county: 'Grundy', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Guthrie' + ' County, IA', municipality: 'Countywide', county: 'Guthrie', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Hamilton' + ' County, IA', municipality: 'Countywide', county: 'Hamilton', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Hancock' + ' County, IA', municipality: 'Countywide', county: 'Hancock', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Hardin' + ' County, IA', municipality: 'Countywide', county: 'Hardin', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Harrison' + ' County, IA', municipality: 'Countywide', county: 'Harrison', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Henry' + ' County, IA', municipality: 'Countywide', county: 'Henry', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Howard' + ' County, IA', municipality: 'Countywide', county: 'Howard', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Humboldt' + ' County, IA', municipality: 'Countywide', county: 'Humboldt', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Ida' + ' County, IA', municipality: 'Countywide', county: 'Ida', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Iowa' + ' County, IA', municipality: 'Countywide', county: 'Iowa', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Jackson' + ' County, IA', municipality: 'Countywide', county: 'Jackson', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Jasper' + ' County, IA', municipality: 'Countywide', county: 'Jasper', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Jefferson' + ' County, IA', municipality: 'Countywide', county: 'Jefferson', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Johnson' + ' County, IA', municipality: 'Countywide', county: 'Johnson', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Jones' + ' County, IA', municipality: 'Countywide', county: 'Jones', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Keokuk' + ' County, IA', municipality: 'Countywide', county: 'Keokuk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Kossuth' + ' County, IA', municipality: 'Countywide', county: 'Kossuth', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Lee' + ' County, IA', municipality: 'Countywide', county: 'Lee', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Linn' + ' County, IA', municipality: 'Countywide', county: 'Linn', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Louisa' + ' County, IA', municipality: 'Countywide', county: 'Louisa', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Lucas' + ' County, IA', municipality: 'Countywide', county: 'Lucas', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Lyon' + ' County, IA', municipality: 'Countywide', county: 'Lyon', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Madison' + ' County, IA', municipality: 'Countywide', county: 'Madison', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Mahaska' + ' County, IA', municipality: 'Countywide', county: 'Mahaska', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Marion' + ' County, IA', municipality: 'Countywide', county: 'Marion', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Marshall' + ' County, IA', municipality: 'Countywide', county: 'Marshall', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Mills' + ' County, IA', municipality: 'Countywide', county: 'Mills', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Mitchell' + ' County, IA', municipality: 'Countywide', county: 'Mitchell', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Monona' + ' County, IA', municipality: 'Countywide', county: 'Monona', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Monroe' + ' County, IA', municipality: 'Countywide', county: 'Monroe', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Montgomery' + ' County, IA', municipality: 'Countywide', county: 'Montgomery', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Muscatine' + ' County, IA', municipality: 'Countywide', county: 'Muscatine', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: "O'Brien" + ' County, IA', municipality: 'Countywide', county: "O'Brien", state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Osceola' + ' County, IA', municipality: 'Countywide', county: 'Osceola', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Page' + ' County, IA', municipality: 'Countywide', county: 'Page', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Palo Alto' + ' County, IA', municipality: 'Countywide', county: 'Palo Alto', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Plymouth' + ' County, IA', municipality: 'Countywide', county: 'Plymouth', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Pocahontas' + ' County, IA', municipality: 'Countywide', county: 'Pocahontas', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Polk' + ' County, IA', municipality: 'Countywide', county: 'Polk', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Pottawattamie' + ' County, IA', municipality: 'Countywide', county: 'Pottawattamie', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Poweshiek' + ' County, IA', municipality: 'Countywide', county: 'Poweshiek', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Ringgold' + ' County, IA', municipality: 'Countywide', county: 'Ringgold', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Sac' + ' County, IA', municipality: 'Countywide', county: 'Sac', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Scott' + ' County, IA', municipality: 'Countywide', county: 'Scott', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Shelby' + ' County, IA', municipality: 'Countywide', county: 'Shelby', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Sioux' + ' County, IA', municipality: 'Countywide', county: 'Sioux', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Story' + ' County, IA', municipality: 'Countywide', county: 'Story', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Tama' + ' County, IA', municipality: 'Countywide', county: 'Tama', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Taylor' + ' County, IA', municipality: 'Countywide', county: 'Taylor', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Union' + ' County, IA', municipality: 'Countywide', county: 'Union', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Van Buren' + ' County, IA', municipality: 'Countywide', county: 'Van Buren', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Wapello' + ' County, IA', municipality: 'Countywide', county: 'Wapello', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Warren' + ' County, IA', municipality: 'Countywide', county: 'Warren', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Washington' + ' County, IA', municipality: 'Countywide', county: 'Washington', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Wayne' + ' County, IA', municipality: 'Countywide', county: 'Wayne', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Webster' + ' County, IA', municipality: 'Countywide', county: 'Webster', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Winnebago' + ' County, IA', municipality: 'Countywide', county: 'Winnebago', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Winneshiek' + ' County, IA', municipality: 'Countywide', county: 'Winneshiek', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Woodbury' + ' County, IA', municipality: 'Countywide', county: 'Woodbury', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Worth' + ' County, IA', municipality: 'Countywide', county: 'Worth', state_rate: 0.06, local_rate: 0.01, is_default: false },
      { name: 'Wright' + ' County, IA', municipality: 'Countywide', county: 'Wright', state_rate: 0.06, local_rate: 0.01, is_default: false },
    ];

    for (const m of iowaMunicipalities) {
      await prisma.taxProfile.create({
        data: {
          name: m.name,
          state_code: 'IA',
          state_rate: m.state_rate,
          local_rate: m.local_rate,
          municipality: m.municipality,
          county: m.county,
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
