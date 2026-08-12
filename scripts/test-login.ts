import { prisma } from '../lib/prisma';
import bcrypt from 'bcryptjs';

async function testLogin() {
  const admin = await prisma.admin.findUnique({ where: { email: 'sampadchowdhury777@gmail.com' } });
  if (!admin) {
    console.log('No admin found');
  } else {
    console.log('Admin found, checking password...');
    const isValid = await bcrypt.compare('Wb24q0929@123@bhartiislove', admin.passwordHash);
    console.log('Password is valid:', isValid);
  }
}

testLogin().catch(console.error);
