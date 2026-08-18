import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const plainPassword = process.env.ADMIN_PASSWORD;

  if (!username || !plainPassword) {
    throw new Error('ADMIN_USERNAME and ADMIN_PASSWORD must be set in your environment (.env)');
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(plainPassword, salt);

  const existing = await prisma.serverConfig.findUnique({ where: { id: 1 } });

  if (existing) {
    await prisma.serverConfig.update({
      where: { id: 1 },
      data: {
        username,
        password: hashedPassword,
        registrationOpen: true,
        isDirectLoginOpen: true,
        webName: process.env.NEXT_PUBLIC_APP_NAME || 'PW-MARCO',
        sidebarLogoUrl: 'https://i.ibb.co/YBbwNGxz/Logo-pw-removebg-preview.png',
        sidebarTitle: process.env.NEXT_PUBLIC_APP_NAME || 'PW-MARCO',
        tg_bot: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '',
        tg_channel: '',
        tg_username: '',
      },
    });
    console.log('✅ Admin config updated!');
  } else {
    await prisma.serverConfig.create({
      data: {
        id: 1,
        username,
        password: hashedPassword,
        registrationOpen: true,
        isDirectLoginOpen: true,
        webName: process.env.NEXT_PUBLIC_APP_NAME || 'PW-MARCO',
        sidebarLogoUrl: 'https://i.ibb.co/YBbwNGxz/Logo-pw-removebg-preview.png',
        sidebarTitle: process.env.NEXT_PUBLIC_APP_NAME || 'PW-MARCO',
        tg_bot: process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || '',
        tg_channel: '',
        tg_username: '',
      },
    });
    console.log('✅ Admin config created!');
  }

  console.log(`\n🔑 Admin Credentials:`);
  console.log(`   Username: ${username}`);
  console.log(`   Password: ${plainPassword}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
