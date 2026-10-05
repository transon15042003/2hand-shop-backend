/**
 * Bootstrap first shop owner (or additional owners).
 * Usage: pnpm run admin:create-owner -- --username son --password 'secret' --name 'Son'
 */
import 'dotenv/config';
import { adminAuthService } from '../src/services/admin-auth.service.js';

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

async function main() {
  const username = arg('--username') || process.env.ADMIN_USERNAME;
  const password = arg('--password') || process.env.ADMIN_PASSWORD;
  const displayName = arg('--name') || username || 'Chủ shop';

  if (!username || !password) {
    console.error('Usage: pnpm run admin:create-owner -- --username <u> --password <p> [--name <display>]');
    process.exit(1);
  }

  const user = await adminAuthService.createOwner(username, password, displayName);
  console.log('Created owner:', JSON.stringify(user, null, 2));
  process.exit(0);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
