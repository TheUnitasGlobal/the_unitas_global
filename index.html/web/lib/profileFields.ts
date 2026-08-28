/**
 * Shared option sets + light validation for the UNITAS cognitive profile.
 *
 * These fields feed the "UNITAS rank / cognitive-intelligence algorithm"
 * (see the business docs). `full_name`, `email`/`phone`, `age`, `gender` and
 * `nationality` are the identity core; `blood`, `mbti`, `iq`, `eq` are
 * explicitly optional -- the user may pick "미표기" (undisclosed), which is
 * stored as SQL NULL.
 *
 * Nothing here talks to Supabase; consumers map the values onto
 * `profiles` columns / `auth.signUp` metadata themselves.
 */

/** Sentinel select value meaning "prefer not to say" -> persisted as null. */
export const UNDISCLOSED = '';

export const GENDER_OPTIONS = ['female', 'male', 'nonbinary', 'other'] as const;
export type GenderOption = (typeof GENDER_OPTIONS)[number];

export const BLOOD_OPTIONS = ['A', 'B', 'O', 'AB'] as const;
export type BloodOption = (typeof BLOOD_OPTIONS)[number];

export const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
] as const;
export type MbtiOption = (typeof MBTI_OPTIONS)[number];

export const AGE_MIN = 14;
export const AGE_MAX = 120;

/** Plausible human range; anything outside is almost certainly a typo. */
export const IQ_MIN = 40;
export const IQ_MAX = 200;
export const EQ_MIN = 0;
export const EQ_MAX = 200;

export interface CognitiveProfileInput {
  fullName: string;
  age: string;
  gender: string;
  nationality: string;
  blood: string;
  mbti: string;
  iq: string;
  eq: string;
}

export const EMPTY_COGNITIVE_PROFILE: CognitiveProfileInput = {
  fullName: '',
  age: '',
  gender: '',
  nationality: '',
  blood: '',
  mbti: '',
  iq: '',
  eq: '',
};

function optionalInt(raw: string, min: number, max: number): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < min || n > max) return undefined; // undefined = invalid
  return n;
}

export interface NormalizedCognitiveProfile {
  full_name: string | null;
  age: number | null;
  gender: string | null;
  nationality: string | null;
  blood: string | null;
  mbti: string | null;
  iq: number | null;
  eq: number | null;
}

export interface ProfileValidationResult {
  ok: boolean;
  /** Field-keyed error ids for i18n lookup (`Account.err.*`). */
  errors: Partial<Record<keyof CognitiveProfileInput, string>>;
  /** Present only when ok. Ready to send as `profiles` update / signup metadata. */
  value?: NormalizedCognitiveProfile;
}

/**
 * @param requireName when true (sign-up / first completion) an empty name is an
 *        error; when false (later profile edits where the name is locked) it is
 *        simply passed through.
 */
export function validateCognitiveProfile(
  input: CognitiveProfileInput,
  { requireName = true }: { requireName?: boolean } = {},
): ProfileValidationResult {
  const errors: ProfileValidationResult['errors'] = {};

  const fullName = input.fullName.trim();
  if (requireName && fullName.length < 1) errors.fullName = 'nameRequired';
  if (fullName.length > 80) errors.fullName = 'nameTooLong';

  const age = optionalInt(input.age, AGE_MIN, AGE_MAX);
  if (age === undefined) errors.age = 'ageRange';

  const iq = optionalInt(input.iq, IQ_MIN, IQ_MAX);
  if (iq === undefined) errors.iq = 'iqRange';

  const eq = optionalInt(input.eq, EQ_MIN, EQ_MAX);
  if (eq === undefined) errors.eq = 'eqRange';

  const gender =
    input.gender && (GENDER_OPTIONS as readonly string[]).includes(input.gender)
      ? input.gender
      : null;
  const blood =
    input.blood && (BLOOD_OPTIONS as readonly string[]).includes(input.blood)
      ? input.blood
      : null;
  const mbti =
    input.mbti && (MBTI_OPTIONS as readonly string[]).includes(input.mbti) ? input.mbti : null;

  const ok = Object.keys(errors).length === 0;
  return {
    ok,
    errors,
    value: ok
      ? {
          full_name: fullName || null,
          age: (age ?? null) as number | null,
          gender,
          nationality: input.nationality.trim() || null,
          blood,
          mbti,
          iq: (iq ?? null) as number | null,
          eq: (eq ?? null) as number | null,
        }
      : undefined,
  };
}
