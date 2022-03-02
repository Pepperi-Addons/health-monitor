import { PapiClient, InstalledAddon } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server';
import { ClientData } from './client-data'
import jwtDecode from "jwt-decode";

class MonitorSettingsService {

    papiClient: PapiClient
    clientData: ClientData

    constructor(client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });

        this.clientData = new ClientData(client.OAuthAccessToken, client.AddonUUID, client.AddonSecretKey);
    }

    getAddons(): Promise<InstalledAddon[]> {
        return this.papiClient.addons.installedAddons.find({});
    }

    async getMonitorSettings() {
        const distributorID = jwtDecode(this.clientData.OAuthAccessToken)['pepperi.distributorid'].toString();
        const addonUUID = this.clientData.addonUUID;
        const monitorSettings = await this.papiClient.addons.data.uuid(addonUUID).table('HealthMonitorSettings').key(distributorID).get();
        return monitorSettings.Data;
    }

    async setMonitorSettings(data) {
        const distributorID = jwtDecode(this.clientData.OAuthAccessToken)['pepperi.distributorid'].toString();
        const addonUUID = this.clientData.addonUUID;
        const settingsBodyADAL = {
            Key: distributorID,
            Data: data
        };
        const settingsResponse = await this.papiClient.addons.data.uuid(addonUUID).table('HealthMonitorSettings').upsert(settingsBodyADAL);
        return settingsResponse.Data;
    }
}

export default MonitorSettingsService;