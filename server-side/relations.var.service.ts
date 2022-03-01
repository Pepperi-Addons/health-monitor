import { PapiClient, InstalledAddon } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server'
import MonitorSettingsService from './monitor-settings.service';

interface FieldData {
    Id: string,
    Value: string
}
export interface SettingsData {
    Fields: [ FieldData ]
}

function instanceOfSettingsData(object: any): object is SettingsData {
    let isValid = true;

    isValid = isValid && 'Fields' in object;

    object.Fields.forEach((field: FieldData) => {
        isValid = isValid && 'Id' in field;
        isValid = isValid && 'Value' in field;

        if (!isValid) {
            return isValid;
        }
    });

    return isValid;
}

export class VarRelation {

    papiClient: PapiClient;
    readonly monitorLevelSettingId: string

    constructor(client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });

        this.monitorLevelSettingId = '0';
    };

    async var_get_updated_settings(client: Client, request: Request) {
        
        if (!instanceOfSettingsData(request.body)) {
            throw new Error("Bad request")
        }
        const settings = request.body as SettingsData;
        const monitorSettingsService = new MonitorSettingsService(client);
    
        const data = {};
        const monitorLevelValue = parseInt(settings.Fields.find(field => field.Id === this.monitorLevelSettingId).Value);
        data['MonitorLevel'] = monitorLevelValue;
    
        return await monitorSettingsService.setMonitorSettings(data);
    };
    
    async var_send_current_settings(client: Client, request: Request) {
        const monitorSettingsService = new MonitorSettingsService(client);
        const settings = await monitorSettingsService.getMonitorSettings();
    
        return {
            Fields: [
                {
                    Id: this.monitorLevelSettingId,
                    Value: settings.MonitorLevel
                },
            ]
        }
    };
}

export default VarRelation;