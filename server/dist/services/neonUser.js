import { prisma } from "../config/prisma.js";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * Finds a Neon user by nonempty ID, or by email when no nonempty ID is supplied.
 *
 * @param filter - ID takes precedence over email, even when invalid or unmatched.
 * Email is trimmed and matched case-insensitively.
 * @returns The first matching record, or null when no record matches or both
 * filter values are absent or empty.
 */
export const findNeonUser = async (filter) => {
    if (filter.id) {
        try {
            const isUuid = UUID_PATTERN.test(filter.id);
            const rows = isUuid
                ? await prisma.$queryRaw `
            SELECT id, name, email, role, "createdAt" as "createdAt"
            FROM neon_auth."user"
            WHERE id = ${filter.id}::uuid
            LIMIT 1;
          `
                : await prisma.$queryRaw `
            SELECT id, name, email, role, "createdAt" as "createdAt"
            FROM neon_auth."user"
            WHERE id::text = ${filter.id}::text
            LIMIT 1;
          `;
            return rows[0] || null;
        }
        catch {
            return null;
        }
    }
    if (filter.email) {
        try {
            const rows = await prisma.$queryRaw `
            SELECT id, name, email, role, "createdAt" as "createdAt"
            FROM neon_auth."user"
            WHERE LOWER(email) = ${filter.email.trim().toLowerCase()}
            LIMIT 1;
            `;
            return rows[0] || null;
        }
        catch {
            return null;
        }
    }
    return null;
};
export const updateNeonUserRole = async (userId, role, client = prisma) => {
    try {
        const isUuid = UUID_PATTERN.test(userId);
        if (isUuid) {
            await client.$executeRaw `
      UPDATE neon_auth."user"
      SET role = ${role}, "updatedAt" = NOW()
      WHERE id = ${userId}::uuid AND (role IS NULL OR role != 'admin')
      `;
        }
        else {
            await client.$executeRaw `
      UPDATE neon_auth."user"
      SET role = ${role}, "updatedAt" = NOW()
      WHERE id::text = ${userId}::text AND (role IS NULL OR role != 'admin')
      `;
        }
    }
    catch (e) {
        console.error(e);
        throw e;
    }
};
export const findNeonUsersByIds = async (ids) => {
    if (!ids || ids.length === 0)
        return {};
    try {
        const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
        const rows = await prisma.$queryRaw `
    SELECT id, name, email, role, "createdAt" as "createdAt"
    FROM neon_auth."user"
    WHERE id::text = ANY(${uniqueIds})
    `;
        const map = {};
        for (const row of rows) {
            map[row.id] = row;
        }
        return map;
    }
    catch (e) {
        console.error(e);
        return {};
    }
};
export const findNeonMerchants = async () => {
    try {
        return await prisma.$queryRaw `
    SELECT id, name, email, role, "createdAt" as "createdAt"
    FROM neon_auth."user"
    WHERE role = 'merchant'
    ORDER BY "createdAt" DESC`;
    }
    catch (e) {
        console.error(e);
        throw e;
    }
};
export const countNeonMerchants = async () => {
    try {
        const rows = await prisma.$queryRaw `
    SELECT COUNT(*) as count
    FROM neon_auth."user"
    WHERE role = 'merchant'
    `;
        return Number(rows[0]?.count || 0);
    }
    catch (e) {
        console.error(e);
        return 0;
    }
};
