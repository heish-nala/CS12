export const VALID_ORG_ROLES = ['owner', 'admin', 'member'] as const;
export type OrgRole = typeof VALID_ORG_ROLES[number];

export function isValidOrgRole(role: string): role is OrgRole {
    return (VALID_ORG_ROLES as readonly string[]).includes(role);
}

export function generateOrgSlug(name: string): string {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
}
