type ProjectPersistenceInput = {
  title: string;
  description: string;
  style?: string | null;
  location?: string | null;
  area?: string | null;
  year?: string | null;
  cost?: string | number | null;
  images?: unknown;
  tags?: unknown;
  status: string;
};

type ProjectPersistenceValues = {
  title: string;
  description: string;
  style: string | null;
  location: string | null;
  area: string | null;
  year: string | null;
  cost: string | number | null;
  images: string;
  tags: string;
  status: string;
};

function toNullableString(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized === '' ? null : normalized;
}

function toNullableCost(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  return value as string | number;
}

function toJsonArrayString(value: unknown) {
  return JSON.stringify(Array.isArray(value) ? value : []);
}

export function buildProjectPersistenceValues(input: ProjectPersistenceInput): ProjectPersistenceValues {
  return {
    title: input.title,
    description: input.description,
    style: toNullableString(input.style),
    location: toNullableString(input.location),
    area: toNullableString(input.area),
    year: toNullableString(input.year),
    cost: toNullableCost(input.cost),
    images: toJsonArrayString(input.images),
    tags: toJsonArrayString(input.tags),
    status: input.status,
  };
}
