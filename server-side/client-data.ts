export class ClientData {

    readonly OAuthAccessToken: string;
    readonly addonUUID: string;
    readonly addonSecretKey: string | undefined;

    public constructor(OAuthAccessToken: string, addonUUID: string, secretKey: string | undefined) {
        this.OAuthAccessToken = OAuthAccessToken;
        this.addonUUID = addonUUID;
        this.addonSecretKey = secretKey;
    }

} export default ClientData;
