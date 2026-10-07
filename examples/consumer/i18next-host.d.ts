import "i18next";

declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "host";
        resources: {host: {hello: string}};
        returnNull: false;
        strictKeyChecks: true;
    }
}
