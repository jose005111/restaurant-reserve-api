import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateBrandingDto } from './update-branding.dto';
import { CreateRestaurantDto } from '../../restaurants/dto/create-restaurant.dto';
import { UpdateRestaurantDto } from '../../restaurants/dto/update-restaurant.dto';

describe('Branding and onboarding input contracts', () => {
  it.each([
    'primaryColor',
    'secondaryColor',
    'accentColor',
    'backgroundColor',
    'surfaceColor',
    'textColor',
    'themeMode',
    'borderRadius',
  ])('rejects null for required branding column %s', async (field) => {
    expect(
      await validate(plainToInstance(UpdateBrandingDto, { [field]: null })),
    ).not.toHaveLength(0);
  });

  it('keeps omitted branding fields and clears nullable blank fields', async () => {
    const dto = plainToInstance(UpdateBrandingDto, {
      welcomeTitle: '   ',
      welcomeMessage: null,
      footerText: '',
      instagramUrl: '',
      facebookUrl: '   ',
      websiteUrl: null,
      whatsapp: '',
      fontFamily: '',
      primaryColor: ' #abcdef ',
      borderRadius: 0,
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      welcomeTitle: null,
      welcomeMessage: null,
      footerText: null,
      instagramUrl: null,
      facebookUrl: null,
      websiteUrl: null,
      whatsapp: null,
      fontFamily: null,
      primaryColor: '#abcdef',
      borderRadius: 0,
    });
    expect(dto.themeMode).toBeUndefined();
  });

  it.each([
    { primaryColor: '' },
    { primaryColor: '#fff' },
    { themeMode: '' },
    { borderRadius: 33 },
    { fontFamily: 'Untrusted font' },
    { websiteUrl: 'http://example.com' },
    { websiteUrl: 'ftp://example.com' },
  ])('rejects invalid styles or links: %j', async (input) => {
    expect(
      await validate(plainToInstance(UpdateBrandingDto, input)),
    ).not.toHaveLength(0);
  });

  it('normalizes optional onboarding fields and preserves server defaults', async () => {
    const dto = plainToInstance(CreateRestaurantDto, {
      name: '  Luanda Grill ',
      slug: ' ',
      phone: ' ',
      address: '',
      currency: '',
      admin: {
        name: ' Owner ',
        email: ' OWNER@EXAMPLE.COM ',
        password: 'test-password',
      },
    });
    expect(await validate(dto)).toHaveLength(0);
    expect(dto).toMatchObject({
      name: 'Luanda Grill',
      phone: null,
      address: null,
      admin: { name: 'Owner', email: 'owner@example.com' },
    });
    expect(dto.slug).toBeUndefined();
    expect(dto.currency).toBeUndefined();
  });

  it.each([
    'name',
    'currency',
    'plan',
    'maxTables',
    'maxMenuItems',
    'maxUsers',
  ])('rejects null in non-nullable restaurant field %s', async (field) => {
    expect(
      await validate(plainToInstance(UpdateRestaurantDto, { [field]: null })),
    ).not.toHaveLength(0);
  });

  it('rejects whitespace-only required names', async () => {
    const dto = plainToInstance(CreateRestaurantDto, {
      name: '   ',
      admin: {
        name: ' ',
        email: 'owner@example.com',
        password: 'test-password',
      },
    });
    expect(await validate(dto)).not.toHaveLength(0);
  });
});
