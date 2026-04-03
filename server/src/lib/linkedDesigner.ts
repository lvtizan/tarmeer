import pool from '../config/database';

type UserIdentity = {
  id: number;
  email?: string | null;
};

type DesignerRow = {
  id: number;
  user_id?: number | null;
  email?: string | null;
};

type LinkedDesignerResolution = {
  designer: DesignerRow | null;
  shouldLinkByEmail: boolean;
};

export function resolveLinkedDesigner(
  user: UserIdentity,
  linkedByUserId: DesignerRow[],
  linkedByEmail: DesignerRow[],
): LinkedDesignerResolution {
  const directMatch = linkedByUserId[0] ?? null;
  if (directMatch) {
    return {
      designer: directMatch,
      shouldLinkByEmail: false,
    };
  }

  const emailMatch = linkedByEmail[0] ?? null;
  if (!emailMatch) {
    return {
      designer: null,
      shouldLinkByEmail: false,
    };
  }

  return {
    designer: {
      ...emailMatch,
      user_id: user.id,
    },
    shouldLinkByEmail: emailMatch.user_id !== user.id,
  };
}

export async function findOrLinkDesignerForUser(user: UserIdentity) {
  if (!user.email) {
    return null;
  }

  const [linkedRows] = await pool.execute(
    'SELECT id, user_id, email FROM designers WHERE user_id = ? AND deleted_at IS NULL LIMIT 1',
    [user.id],
  );
  const [emailRows] = await pool.execute(
    'SELECT id, user_id, email FROM designers WHERE email = ? AND deleted_at IS NULL LIMIT 1',
    [user.email],
  );

  const resolution = resolveLinkedDesigner(
    user,
    linkedRows as DesignerRow[],
    emailRows as DesignerRow[],
  );

  if (!resolution.designer) {
    return null;
  }

  if (resolution.shouldLinkByEmail) {
    await pool.execute(
      'UPDATE designers SET user_id = ? WHERE id = ?',
      [user.id, resolution.designer.id],
    );
  }

  return resolution.designer;
}
