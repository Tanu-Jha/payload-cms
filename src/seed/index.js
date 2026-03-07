const payload = require('payload');
const dotenv = require('dotenv');

dotenv.config();

const seed = async () => {
  await payload.init({
    secret: process.env.PAYLOAD_SECRET || 'default-secret-change-me',
    local: true,
  });

  console.log('\n🌱 Starting seed process...\n');

  try {
    // ─── 1. Users ────────────────────────────────────────────

    console.log('Creating users...');

    const adminUser = await payload.create({
      collection: 'users',
      data: {
        name: 'Admin User',
        email: 'admin@workflow.com',
        password: 'admin123',
        role: 'admin',
        department: 'Management',
      },
    });
    console.log(`  ✓ Admin:    ${adminUser.email}`);

    const managerUser = await payload.create({
      collection: 'users',
      data: {
        name: 'Sarah Manager',
        email: 'manager@workflow.com',
        password: 'manager123',
        role: 'manager',
        department: 'Operations',
      },
    });
    console.log(`  ✓ Manager:  ${managerUser.email}`);

    const reviewerUser = await payload.create({
      collection: 'users',
      data: {
        name: 'John Reviewer',
        email: 'reviewer@workflow.com',
        password: 'reviewer123',
        role: 'reviewer',
        department: 'Content',
      },
    });
    console.log(`  ✓ Reviewer: ${reviewerUser.email}`);

    const editorUser = await payload.create({
      collection: 'users',
      data: {
        name: 'Emily Editor',
        email: 'editor@workflow.com',
        password: 'editor123',
        role: 'editor',
        department: 'Content',
      },
    });
    console.log(`  ✓ Editor:   ${editorUser.email}`);

    // ─── 2. Blog Posts ───────────────────────────────────────

    console.log('\nCreating blog posts...');

    const blog1 = await payload.create({
      collection: 'blogs',
      data: {
        title: 'Introduction to Payload CMS',
        content: [{ children: [{ text: 'Payload CMS is a powerful, open-source headless CMS built with Node.js. It provides a flexible admin panel and robust API for content management.' }] }],
        author: editorUser.id,
        category: 'technology',
        status: 'draft',
        priority: 'normal',
      },
    });
    console.log(`  ✓ Blog: "${blog1.title}"`);

    const blog2 = await payload.create({
      collection: 'blogs',
      data: {
        title: 'Best Practices for Workflow Automation',
        content: [{ children: [{ text: 'Automating approval workflows can significantly improve team productivity and reduce bottlenecks in document processing.' }] }],
        author: editorUser.id,
        category: 'business',
        status: 'draft',
        priority: 'high',
      },
    });
    console.log(`  ✓ Blog: "${blog2.title}"`);

    // ─── 3. Contracts ────────────────────────────────────────

    console.log('\nCreating contracts...');

    const contract1 = await payload.create({
      collection: 'contracts',
      data: {
        title: 'Enterprise SaaS Agreement - Acme Corp',
        client: 'Acme Corporation',
        description: 'Annual SaaS subscription agreement for the enterprise platform.',
        amount: 150000,
        contractType: 'service',
        status: 'draft',
        startDate: '2025-04-01',
        endDate: '2026-03-31',
      },
    });
    console.log(`  ✓ Contract: "${contract1.title}" ($${contract1.amount})`);

    const contract2 = await payload.create({
      collection: 'contracts',
      data: {
        title: 'NDA - Beta Technologies',
        client: 'Beta Technologies Inc.',
        description: 'Non-disclosure agreement for product partnership.',
        amount: 0,
        contractType: 'nda',
        status: 'draft',
        startDate: '2025-03-15',
        endDate: '2027-03-14',
      },
    });
    console.log(`  ✓ Contract: "${contract2.title}" ($${contract2.amount})`);

    const contract3 = await payload.create({
      collection: 'contracts',
      data: {
        title: 'Vendor Agreement - CloudHost Pro',
        client: 'CloudHost Pro',
        description: 'Infrastructure hosting vendor agreement with premium SLA.',
        amount: 75000,
        contractType: 'vendor',
        status: 'draft',
        startDate: '2025-05-01',
        endDate: '2026-04-30',
      },
    });
    console.log(`  ✓ Contract: "${contract3.title}" ($${contract3.amount})`);

    // ─── 4. Workflow Definitions ─────────────────────────────

    console.log('\nCreating workflow definitions...');

    const blogWorkflow = await payload.create({
      collection: 'workflows',
      data: {
        name: 'Blog Post Approval Flow',
        description: 'Standard 3-step approval: Editor Review → Manager Approval → Admin Sign-off.',
        targetCollection: 'blogs',
        isActive: true,
        triggerConditions: {
          triggerOn: 'both',
          fieldConditions: [
            { fieldPath: 'status', operator: 'equals', value: 'draft' },
          ],
        },
        steps: [
          {
            stepName: 'Editor Review',
            stepOrder: 1,
            stepType: 'review',
            assigneeType: 'role',
            assignedRole: 'editor',
            requiredPreviousOutcome: 'any',
            slaHours: 24,
            instructions: 'Review for grammar, style, and accuracy. Approve or reject with feedback.',
          },
          {
            stepName: 'Manager Approval',
            stepOrder: 2,
            stepType: 'approval',
            assigneeType: 'role',
            assignedRole: 'manager',
            requiredPreviousOutcome: 'reviewed',
            slaHours: 48,
            instructions: 'Approve for publication. Check brand alignment and factual accuracy.',
          },
          {
            stepName: 'Admin Final Sign-off',
            stepOrder: 3,
            stepType: 'sign_off',
            assigneeType: 'role',
            assignedRole: 'admin',
            requiredPreviousOutcome: 'approved',
            slaHours: 72,
            instructions: 'Final sign-off before the blog goes live.',
          },
        ],
        createdByUser: adminUser.id,
      },
    });
    console.log(`  ✓ Workflow: "${blogWorkflow.name}" (3 steps)`);

    const contractWorkflow = await payload.create({
      collection: 'workflows',
      data: {
        name: 'Contract Approval Flow',
        description: 'Multi-stage contract approval with conditional branching. Contracts over $100,000 require executive review.',
        targetCollection: 'contracts',
        isActive: true,
        triggerConditions: {
          triggerOn: 'both',
          fieldConditions: [
            { fieldPath: 'status', operator: 'equals', value: 'draft' },
          ],
        },
        steps: [
          {
            stepName: 'Reviewer Initial Check',
            stepOrder: 1,
            stepType: 'review',
            assigneeType: 'role',
            assignedRole: 'reviewer',
            requiredPreviousOutcome: 'any',
            slaHours: 12,
            instructions: 'Verify contract details, client information, and completeness.',
          },
          {
            stepName: 'Manager Approval',
            stepOrder: 2,
            stepType: 'approval',
            assigneeType: 'role',
            assignedRole: 'manager',
            requiredPreviousOutcome: 'reviewed',
            slaHours: 24,
            instructions: 'Review contract terms and approve for further processing.',
          },
          {
            stepName: 'Executive Review (High Value)',
            stepOrder: 3,
            stepType: 'approval',
            assigneeType: 'role',
            assignedRole: 'admin',
            conditions: [
              { fieldPath: 'amount', operator: 'greater_than', value: '100000' },
            ],
            requiredPreviousOutcome: 'approved',
            slaHours: 48,
            instructions: 'High-value contract requires executive approval. Review terms carefully.',
          },
          {
            stepName: 'Final Legal Sign-off',
            stepOrder: 4,
            stepType: 'sign_off',
            assigneeType: 'role',
            assignedRole: 'admin',
            requiredPreviousOutcome: 'approved',
            slaHours: 72,
            instructions: 'Final legal sign-off. Ensure all compliance requirements are met.',
          },
        ],
        createdByUser: adminUser.id,
      },
    });
    console.log(`  ✓ Workflow: "${contractWorkflow.name}" (4 steps, conditional branching)`);

    // ─── Summary ─────────────────────────────────────────────

    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║        SEED COMPLETED SUCCESSFULLY           ║');
    console.log('╠══════════════════════════════════════════════╣');
    console.log('║                                              ║');
    console.log('║  Demo Credentials:                           ║');
    console.log('║  Admin    → admin@workflow.com / admin123    ║');
    console.log('║  Manager  → manager@workflow.com / manager123║');
    console.log('║  Reviewer → reviewer@workflow.com / reviewer123║');
    console.log('║  Editor   → editor@workflow.com / editor123  ║');
    console.log('║                                              ║');
    console.log('║  Data Created:                               ║');
    console.log('║  • 4 Users                                   ║');
    console.log('║  • 2 Blog Posts                              ║');
    console.log('║  • 3 Contracts                               ║');
    console.log('║  • 2 Workflow Definitions                    ║');
    console.log('║    - Blog Approval Flow (3 steps)            ║');
    console.log('║    - Contract Approval Flow (4 steps)        ║');
    console.log('║                                              ║');
    console.log('╚══════════════════════════════════════════════╝\n');

  } catch (error) {
    console.error('Seed error:', error);
  }

  process.exit(0);
};

seed();
