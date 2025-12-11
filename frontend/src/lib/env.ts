export function isTestEnv(): boolean {
  try {
    return process.env.NODE_ENV === 'test';
  } catch (e) {
    return false;
  }
}

export default isTestEnv;
