import { Client } from '@pepperi-addons/debug-server/dist';
import { PapiClient } from '@pepperi-addons/papi-sdk';
import { AUDIT_DATA_LOG_ADDON_UUID, AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES } from './entities';
import MonitorSettingsService from './monitor-settings.service';

export class AuditDataLogSyncService {
    private monitorSettingsService = new MonitorSettingsService(this.client);
    private papiClient: PapiClient;

    constructor(private client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey,
            actionUUID: client.ActionUUID
        });
    }

    async getAuditDataLogSync(functionName: AUDIT_DATA_LOG_SYNC_FUNCTION_NAMES, syncBody) {
        try{
            const res = await this.papiClient.post(`/addons/api/${AUDIT_DATA_LOG_ADDON_UUID}/api/${functionName}`, syncBody);
            return res;
        } catch (err) {
            console.error(`Could not get sync data from audit data log, error: ${err}`);
        }
    }

    private async getMonitorSettings() {
        return await this.monitorSettingsService.getMonitorSettings();
    }

    async getJobUUID() {        
        return (await this.getMonitorSettings()).SyncFailedCodeJobUUID;
    }

    async getUptimeSyncData() {
        const monitorSettings = await this.getMonitorSettings();
        const codeJobUUID = monitorSettings.SyncFailedCodeJobUUID;
        const monitorLevel = monitorSettings.MonitorLevel;
        return { CodeJobUUID: codeJobUUID, MonitorLevel: monitorLevel };
    }
}