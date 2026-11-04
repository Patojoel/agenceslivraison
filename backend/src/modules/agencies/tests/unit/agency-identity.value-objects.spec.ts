import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Email, InvalidEmail } from '@shared/domain/value-objects/email';
import { identityChangeOf } from '../../domain/agency-identity';
import { InvalidAgencyField } from '../../domain/exceptions/agency.exceptions';
import { Description } from '../../domain/value-objects/description';
import { HeadquartersAddress } from '../../domain/value-objects/headquarters-address';
import { HeadquartersCity } from '../../domain/value-objects/headquarters-city';
import { LegalName } from '../../domain/value-objects/legal-name';
import { Niu } from '../../domain/value-objects/niu';
import { PrimaryPhone } from '../../domain/value-objects/primary-phone';
import { Rccm } from '../../domain/value-objects/rccm';
import { TradeName } from '../../domain/value-objects/trade-name';

interface Bounds { readonly name: string; readonly of: (raw: string) => { readonly value: string }; readonly min: number; readonly max: number }

const BOUNDED: readonly Bounds[] = [
  { name: 'legal name', of: LegalName.of, min: 2, max: 200 },
  { name: 'headquarters city', of: HeadquartersCity.of, min: 2, max: 80 },
  { name: 'headquarters address', of: HeadquartersAddress.of, min: 5, max: 300 },
  { name: 'RCCM', of: Rccm.of, min: 5, max: 40 },
  { name: 'trade name', of: TradeName.of, min: 2, max: 120 },
];

for (const { name, of, min, max } of BOUNDED) {
  test(`${name}: accepted from ${min} to ${max} characters, refused one below and one above`, () => {
    assert.throws(() => of('x'.repeat(min - 1)), Error);
    assert.equal(of('x'.repeat(min)).value.length, min);
    assert.equal(of('x'.repeat(max)).value.length, max);
    assert.throws(() => of('x'.repeat(max + 1)), Error);
  });

  test(`${name}: characters are counted as PostgreSQL does and control characters are refused`, () => {
    assert.throws(() => of('😀'.repeat(min - 1)), Error);
    assert.equal(of('😀'.repeat(min)).value, '😀'.repeat(min));
    assert.throws(() => of(`${'x'.repeat(min)}\u0000`), Error);
    assert.throws(() => of(`${'x'.repeat(min)}\u0007`), Error);
  });
}

test('legal name, city and address lose edge spaces and reduce inner runs of spaces to one', () => {
  assert.equal(LegalName.of('  Express   Douala  SARL ').value, 'Express Douala SARL');
  assert.equal(HeadquartersCity.of('  Port \t  Harcourt ').value, 'Port Harcourt');
  assert.equal(HeadquartersAddress.of(' Rue Joss,\n face   pharmacie ').value, 'Rue Joss, face pharmacie');
});

test('the length is measured after normalization', () => {
  assert.throws(() => HeadquartersCity.of('  A   '), InvalidAgencyField);
  assert.throws(() => LegalName.of(' x    '), InvalidAgencyField);
  assert.equal(LegalName.of(`${'x'.repeat(100)}     ${'y'.repeat(99)}`).value.length, 200);
});

test('a refused value names the field and nothing else', () => {
  assert.throws(() => LegalName.of('x'), (error: unknown) => error instanceof InvalidAgencyField && error.kind === 'invalid' && error.message === 'Invalid agency field: legalName');
  assert.throws(() => Niu.of('short'), (error: unknown) => error instanceof InvalidAgencyField && error.message === 'Invalid agency field: niu');
});

test('primary phone: Cameroonian numbers are normalized to +237 and nine digits starting with 2 or 6', () => {
  const accepted: readonly [string, string][] = [
    ['6 77 12 34 56', '+237677123456'],
    ['+237 2 33 42 11 00', '+237233421100'],
    ['+237677123456', '+237677123456'],
    ['677123456', '+237677123456'],
    ['  233 42 11 00 ', '+237233421100'],
    ['6 99 00 11 22', '+237699001122'],
  ];
  for (const [typed, stored] of accepted) assert.equal(PrimaryPhone.of(typed).value, stored, typed);
});

test('primary phone: wrong prefix, wrong length, foreign or malformed numbers are refused', () => {
  const refused = ['677 12 34', '5 77 12 34 56', '7 77 12 34 56', '1 77 12 34 56', '0 77 12 34 56', '+33 6 12 34 56 78', '6 77 12 34 56 7', '6771234567', '67712345', '', '   ', '+237 677 12 34', '+2376771234567', '237677123456', '+238677123456', '6-77-12-34-56', '6 77 12 34 5a', '＋237677123456', '++237677123456', '\u0000677123456'];
  for (const typed of refused) assert.throws(() => PrimaryPhone.of(typed), InvalidAgencyField, JSON.stringify(typed));
});

test('NIU: exactly 14 letters or digits', () => {
  assert.equal(Niu.of('M012345678901A').value, 'M012345678901A');
  assert.equal(Niu.of(' M012345678901A ').value, 'M012345678901A');
  for (const refused of ['M0123456789A', 'M012345678901AB', 'M01234567890-A', 'M012345678 01A', 'M012345678901É', '', '   ']) {
    assert.throws(() => Niu.of(refused), InvalidAgencyField, refused);
  }
  assert.equal(Niu.of('A'.repeat(14)).value.length, 14);
  assert.throws(() => Niu.of('A'.repeat(13)), InvalidAgencyField);
  assert.throws(() => Niu.of('A'.repeat(15)), InvalidAgencyField);
});

test('the contact e-mail is the shared Email value object', () => {
  assert.equal(Email.of('Contact@Express.cm').value, 'contact@express.cm');
  assert.throws(() => Email.of('contact@'), InvalidEmail);
});

test('description: 0 to 1000 characters of plain text, kept as text, newlines allowed, control characters refused', () => {
  assert.equal(Description.of('x'.repeat(1000)).value.length, 1000);
  assert.throws(() => Description.of('   '), InvalidAgencyField);
  assert.throws(() => Description.of('x'.repeat(1001)), InvalidAgencyField);
  assert.equal(Description.of('  Livraison express\ndans Douala  ').value, 'Livraison express\ndans Douala');
  assert.equal(Description.of('<b>gras</b> & <script>alert(1)</script>').value, '<b>gras</b> & <script>alert(1)</script>');
  assert.throws(() => Description.of('abc\u0000'), InvalidAgencyField);
  assert.throws(() => Description.of('abc\u001b[31m'), InvalidAgencyField);
  assert.equal(Description.of('😀'.repeat(1000)).value, '😀'.repeat(1000));
  assert.throws(() => Description.of('😀'.repeat(1001)), InvalidAgencyField);
});

test('description: blank text is not a description', () => {
  assert.equal(Description.ofOptional('   '), null);
  assert.equal(Description.ofOptional(''), null);
  assert.equal(Description.ofOptional(null), null);
  assert.equal(Description.ofOptional(' ok ')?.value, 'ok');
});

test('trade name refuses control characters instead of failing in the database', () => {
  assert.throws(() => TradeName.of('Express\u0000Douala'), Error);
});

test('the contact e-mail of an identity change refuses control and format characters, with an invalid error', () => {
  for (const raw of ['a\u0000@b.cm', 'a\u0007@b.cm', 'a\u001b@b.cm', 'a\u202E@b.cm', 'a\u200B@b.cm', 'a@b\u007F.cm']) {
    assert.throws(() => identityChangeOf({ contactEmail: raw }), (error: unknown) => error instanceof InvalidAgencyField && error.kind === 'invalid' && error.field === 'contactEmail', JSON.stringify(raw));
  }
});

test('a valid contact e-mail passes, is normalized, and can still be cleared', () => {
  assert.equal(identityChangeOf({ contactEmail: ' Contact@Express.cm ' }).contactEmail?.value, 'contact@express.cm');
  assert.equal(identityChangeOf({ contactEmail: null }).contactEmail, null);
  assert.equal(identityChangeOf({ contactEmail: '  ' }).contactEmail, null);
  assert.equal(identityChangeOf({}).contactEmail, undefined);
});
