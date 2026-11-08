import * as bcrypt from 'bcrypt';
import { UserRole } from '../../common/enums/user-role.enum';
import { User } from '../../modules/users/entities/user.entity';
import dataSource from '../database-source';

async function seedSuperAdmin(): Promise<void> {
  const name = process.env.SUPER_ADMIN_NAME;
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      'Defina SUPER_ADMIN_NAME, SUPER_ADMIN_EMAIL e SUPER_ADMIN_PASSWORD no .env.dev',
    );
  }

  await dataSource.initialize();

  try {
    const users = dataSource.getRepository(User);
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await users
      .createQueryBuilder('user')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();

    if (existing) {
      existing.name = name;
      existing.email = email;
      existing.passwordHash = passwordHash;
      existing.role = UserRole.SUPER_ADMIN;
      existing.restaurantId = null;
      existing.isActive = true;
      await users.save(existing);
      console.log(`SUPER_ADMIN actualizado: ${email}`);
      return;
    }

    const superAdmin = users.create({
      name,
      email,
      passwordHash,
      role: UserRole.SUPER_ADMIN,
      restaurantId: null,
      isActive: true,
    });

    await users.save(superAdmin);
    console.log(`SUPER_ADMIN criado: ${email}`);
  } finally {
    await dataSource.destroy();
  }
}

seedSuperAdmin().catch((error: unknown) => {
  console.error('Falha ao criar o SUPER_ADMIN:', error);
  process.exitCode = 1;
});
