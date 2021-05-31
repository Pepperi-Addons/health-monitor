import { PapiClient, InstalledAddon } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server';
import jwtDecode from "jwt-decode";

class MyService {

    papiClient: PapiClient

    constructor(private client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });
    }

    doSomething() {
        console.log("doesn't really do anything....");
    }

    getAddons(): Promise<InstalledAddon[]> {
        return this.papiClient.addons.installedAddons.find({});
    }

    async getMonitorSettings() {
        const distributorID = jwtDecode(this.client.OAuthAccessToken)['pepperi.distributorid'].toString();
        const addonUUID= this.client.AddonUUID;
        const monitorSettings = await this.papiClient.addons.data.uuid(addonUUID).table('HealthMonitorSettings').key(distributorID).get();
        return monitorSettings.Data;
    }
    
    async setMonitorSettings(data) {
        const distributorID = jwtDecode(this.client.OAuthAccessToken)['pepperi.distributorid'].toString();
        const addonUUID= this.client.AddonUUID;
        const settingsBodyADAL= {
            Key: distributorID,
            Data: data
        };
        const settingsResponse = await this.papiClient.addons.data.uuid(addonUUID).table('HealthMonitorSettings').upsert(settingsBodyADAL);
        return settingsResponse;
    }
}

export default MyService;