require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('node:child_process');

const prisma = new PrismaClient();

async function ensureSeeded() {
  try {
    const existingAdmin = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (existingAdmin) {
      console.log('✅ Base de datos ya inicializada (usuario admin encontrado). Omitiendo seed.');
      return;
    }

    console.log('🌱 Base de datos nueva detectada en despliegue. Ejecutando seed inicial...');
    execSync('node prisma/seed.js', { stdio: 'inherit' });
  } catch (error) {
    console.error('⚠️ Error verificando/ejecutando autoSeed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

ensureSeeded();
