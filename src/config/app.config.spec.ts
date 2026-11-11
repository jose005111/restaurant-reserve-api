import appConfig from './app.config';

describe('public menu URL', () => {
  const previousUrl = process.env.PUBLIC_MENU_BASE_URL;

  afterAll(() => {
    if (previousUrl === undefined) delete process.env.PUBLIC_MENU_BASE_URL;
    else process.env.PUBLIC_MENU_BASE_URL = previousUrl;
  });

  it.each([
    ['https://menu.example.com', 'https://menu.example.com/m'],
    ['https://menu.example.com/m/', 'https://menu.example.com/m'],
  ])('normalizes %s to %s', (configured, expected) => {
    process.env.PUBLIC_MENU_BASE_URL = configured;
    expect(appConfig().publicMenuBaseUrl).toBe(expected);
  });
});
