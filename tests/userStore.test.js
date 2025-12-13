const fs = require('fs');
const path = require('path');
const userStore = require('../src/services/userStore');

describe('userStore file-backed', () => {
  const dataDir = path.join(__dirname, '..', 'src', 'data');
  const filePath = path.join(dataDir, 'users.json');

  beforeEach(() => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  });

  afterEach(() => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  });

  test('create, get, decrement, activate', () => {
    const u = userStore.createUser({ email: 'a@b.c' });
    expect(u).toHaveProperty('id');
    const loaded = userStore.getUserById(u.id);
    expect(loaded).not.toBeNull();
    const rem = userStore.decrementTrial(u.id);
    expect(typeof rem).toBe('number');
    const activated = userStore.activateUser(u.id);
    expect(activated.isPaid).toBe(true);
  });
});
