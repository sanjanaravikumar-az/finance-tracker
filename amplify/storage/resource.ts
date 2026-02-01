import { defineStorage } from "@aws-amplify/backend";

const branchName = process.env.AWS_BRANCH ?? "sandbox";

export const storage = defineStorage({ name: `financetrackerd28ba5967ba1457a889f86f1c898a7c029933-${branchName}`, access: allow => ({
        "public/*": [allow.guest.to(["read"]), allow.authenticated.to(["write", "read", "delete"])],
        "protected/{entity_id}/*": [allow.authenticated.to(["write", "read", "delete"])],
        "private/{entity_id}/*": [allow.authenticated.to(["write", "read", "delete"])]
    }) });
