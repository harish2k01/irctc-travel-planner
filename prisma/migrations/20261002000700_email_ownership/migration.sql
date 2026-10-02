-- Earlier password setup also stamped this flag for manually shared invitations
-- and temporary passwords. Those timestamps cannot establish email ownership.
-- Clear only the verification marker once; preserve accounts, sessions and workspaces.
UPDATE "User" SET "emailVerifiedAt" = NULL WHERE "emailVerifiedAt" IS NOT NULL;
