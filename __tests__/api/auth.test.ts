import { login } from '@/api/auth';

describe('mock auth.login', () => {
  it('accepts any non-empty username with password "1234"', async () => {
    const result = await login('maria', '1234');
    expect(result.token).toMatch(/^mock-token-/);
    expect(result.cashier.username).toBe('maria');
    expect(result.cashier.name).toBe('Maria');
    expect(result.cashier.id).toBe('C-MARIA');
  });

  it('rejects an empty username', async () => {
    await expect(login('   ', '1234')).rejects.toThrow(/username/i);
  });

  it('rejects the wrong password', async () => {
    await expect(login('maria', 'nope')).rejects.toThrow(/credentials/i);
  });
});
