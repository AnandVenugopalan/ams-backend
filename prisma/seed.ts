import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Check and create admin user
  const adminExists = await prisma.user.findUnique({
    where: { username: 'admin' },
  });

  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin@123', 10);
    await prisma.user.create({
      data: {
        fullName: 'System Admin',
        email: 'admin@ams.com',
        username: 'admin',
        password: hashedPassword,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('Admin user created');
  } else {
    console.log('Admin user already exists');
  }

  // Check and create staff user
  const staffExists = await prisma.user.findUnique({
    where: { username: 'staff' },
  });

  if (!staffExists) {
    const hashedPassword = await bcrypt.hash('staff@123', 10);
    await prisma.user.create({
      data: {
        fullName: 'Staff User',
        email: 'staff@ams.com',
        username: 'staff',
        password: hashedPassword,
        role: 'STAFF',
        isActive: true,
      },
    });
    console.log('Staff user created');
  } else {
    console.log('Staff user already exists');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });