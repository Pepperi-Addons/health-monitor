import { PapiClient, InstalledAddon, Relation } from '@pepperi-addons/papi-sdk'
import { Client, Request } from '@pepperi-addons/debug-server'
import MonitorSettingsService from './monitor-settings.service';
import { GetMonitorCronExpression } from './installation';

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

export class VarRelationService {

    papiClient: PapiClient;
    readonly monitorLevelSettingId: string
    readonly relation: Relation;

    constructor(client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });

        this.monitorLevelSettingId = '0';
        
        this.relation = {
            Name: "HealthMonitorVarSettings",
            AddonUUID: client.AddonUUID,
            RelationName: "VarSettings",
            Type: "AddonAPI",
            Description: "Health Monitor relation to Var Settings, Var users can edit monitor settings via the Var addon",
            AddonRelativeURL: "/api/var_settings_callback",
    
            AdditionalParams: {
                Title: "Health Monitor",
                Fields: [{
                    Id: this.monitorLevelSettingId,
                    Label: "Monitor Level",
                    PepComponent: "textbox",
                    Type: "int",
                    Disabled: false
                }]
            }
        }
    };

    async var_get_updated_settings(client: Client, request: Request) {
        
        if (!instanceOfSettingsData(request.body)) {
            const errorJson = {
                ActionUUID: client.ActionUUID,
                AddonUUID: client.AddonUUID,
                Token: client.OAuthAccessToken,
                Request: request.body,
            }
            throw new Error(`${JSON.stringify(errorJson)}`)
        }
        const settings = request.body as SettingsData;
        const monitorSettingsService = new MonitorSettingsService(client);
    
        
        const fieldData: FieldData = (settings.Fields.find(field => field.Id === this.monitorLevelSettingId) as FieldData);
        const monitorLevelValue = parseInt(fieldData.Value);
        
        // Update cron expression
        await this.updateCronExpression(monitorSettingsService, monitorLevelValue);

        const data = {};
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

    async updateCronExpression(monitorSettingsService: MonitorSettingsService, monitorLevelValue: number) {
        const maintenance = await monitorSettingsService.papiClient.metaData.flags.name('Maintenance').get();
        const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);
        const cronExpression = GetMonitorCronExpression(monitorSettingsService.clientData.OAuthAccessToken, maintenanceWindowHour, monitorLevelValue)          

        const codeJob = await monitorSettingsService.papiClient.codeJobs.upsert({
            UUID: (await monitorSettingsService.getMonitorSettings()).SyncFailedCodeJobUUID,
            CronExpression: cronExpression,
        } as any); // Using "as any" to avoid filling all fields.

        console.log("result object recieved from Code jobs is: " + JSON.stringify(codeJob));
    }
}

export default VarRelationService;