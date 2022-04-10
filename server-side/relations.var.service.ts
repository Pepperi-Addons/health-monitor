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
    readonly monitorLevelSettingId: string;
    readonly addonDailyUsageId: string;

    readonly relation: Relation;

    constructor(client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });

        this.monitorLevelSettingId = '0';
        this.addonDailyUsageId = '1';
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
                }, {
                    Id: this.addonDailyUsageId,
                    Label: "Addon Daily Usage Limit",
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
        
        const monitorLevelFieldData = settings.Fields.find(field => field.Id === this.monitorLevelSettingId) as FieldData;
        const addonDailyUsageFieldData = settings.Fields.find(field => field.Id === this.addonDailyUsageId) as FieldData;
        
        const monitorLevelValue = parseInt(monitorLevelFieldData.Value);
        const addonDailyUsageValue = parseInt(addonDailyUsageFieldData.Value);

        console.log(`Got new values from VAR settings: ${JSON.stringify(settings)}`)

        // Update cron expression
        await this.update_cron_expression(monitorSettingsService, monitorLevelValue);
        
        let adalData = await monitorSettingsService.getMonitorSettings()
        adalData.MonitorLevel = monitorLevelValue
        adalData.MemoryUsageLimit = addonDailyUsageValue

        const updateResult = await monitorSettingsService.setMonitorSettings(adalData);
        console.log(`Updated values from VAR: ${JSON.stringify(updateResult)}`)
        return updateResult;
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
                {
                    Id: this.addonDailyUsageId,
                    Value: settings.MemoryUsageLimit
                }
            ]
        }
    };

    async update_cron_expression(monitorSettingsService: MonitorSettingsService, monitorLevelValue: number) {
        const maintenance = await monitorSettingsService.papiClient.metaData.flags.name('Maintenance').get();
        const maintenanceWindowHour = parseInt(maintenance.MaintenanceWindow.split(':')[0]);
        const cronExpression = GetMonitorCronExpression(monitorSettingsService.clientData.OAuthAccessToken, maintenanceWindowHour, monitorLevelValue)          

        const monitorSettings = await monitorSettingsService.getMonitorSettings()
        const codeJob = await monitorSettingsService.papiClient.codeJobs.upsert({
            UUID: monitorSettings.SyncFailedCodeJobUUID,
            CronExpression: cronExpression,
        } as any); // Using "as any" to avoid filling all fields.

        console.log("result object recieved from Code jobs is: " + JSON.stringify(codeJob));
    }
}

export default VarRelationService;