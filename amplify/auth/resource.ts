import { defineAuth } from "@aws-amplify/backend";
import { financetrackere30b1453 } from "../function/financetrackere30b1453/resource";

export const auth = defineAuth({
    loginWith: {
        email: {
            verificationEmailSubject: "Your verification code",
            verificationEmailBody: () => "Your verification code is {####}"
        }
    },
    userAttributes: {
        email: {
            required: true,
            mutable: true
        }
    },
    multifactor: {
        mode: "OFF"
    },
    access: (allow: any) => [
        allow.resource(financetrackere30b1453).to(["manageGroupMembership"]),
        allow.resource(financetrackere30b1453).to(["managePasswordRecovery"]),
        allow.resource(financetrackere30b1453).to(["createUser"]),
        allow.resource(financetrackere30b1453).to(["setUserSettings"]),
        allow.resource(financetrackere30b1453).to(["manageUsers"]),
        allow.resource(financetrackere30b1453).to(["disableUser"]),
        allow.resource(financetrackere30b1453).to(["setUserMfaPreference"]),
        allow.resource(financetrackere30b1453).to(["updateUserAttributes"]),
        allow.resource(financetrackere30b1453).to(["forgetDevice"]),
        allow.resource(financetrackere30b1453).to(["enableUser"]),
        allow.resource(financetrackere30b1453).to(["updateDeviceStatus"]),
        allow.resource(financetrackere30b1453).to(["getDevice"]),
        allow.resource(financetrackere30b1453).to(["getUser"]),
        allow.resource(financetrackere30b1453).to(["deleteUserAttributes"]),
        allow.resource(financetrackere30b1453).to(["deleteUser"])
    ],
});
