import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  try {
    const ownerEmail = process.env.OWNER_EMAIL || 'owner@local';
    const ownerPassword = process.env.OWNER_PASSWORD || 'changeme-owner-123';
    const ownerUsername = process.env.OWNER_USERNAME || 'owner';

    const hashedPassword = await argon2.hash(ownerPassword);

    await prisma.user.upsert({
      where: { email: ownerEmail },
      update: {
        password: hashedPassword,
        status: 'ACTIVE',
        role: 'ADMIN',
      },
      create: {
        email: ownerEmail,
        username: ownerUsername,
        password: hashedPassword,
        firstName: 'Owner',
        lastName: 'Account',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    console.log('✅ Owner user ready:', { email: ownerEmail, username: ownerUsername });
    console.log('   Set OWNER_PASSWORD on Render and re-run seed to rotate password.');
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
