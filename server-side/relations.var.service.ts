import { PapiClient, InstalledAddon, Relation } from '@pepperi-addons/papi-sdk'
import { Client, Request } from '@pepperi-addons/debug-server'
import MonitorSettingsService from './monitor-settings.service';
import { GetMonitorCronExpression } from './installation';
import { IPepGenericFormDataView } from '@pepperi-addons/ngx-composite-lib/generic-form';

//monitor object every x minutes
export enum VALID_MONITOR_LEVEL_VALUES {
    Never = 0,
    Low = 30,   //every 30 minutes
    High = 5    //every 5 minutes
  }

const SystemHealthFields: any[] = [
    {
        FieldID: 'MemoryUsageLimit',
        Type: 'TextBox',
        Title: 'Memory Usage Limit',
        Mandatory: false,
        ReadOnly: false,
        Layout: {
            Origin: {
                X: 0,
                Y: 1
            },
            Size: {
                Width: 1,
                Height: 0
            }
        },
        Style: {
            Alignment: {
                Horizontal: 'Stretch',
                Vertical: 'Stretch'
            }
        }
    },
    {
        FieldID: 'MonitorLevel',
        Type: 'ComboBox',
        Title: 'Monitor Level',
        Mandatory: false,
        ReadOnly: false,
        Layout: {
            Origin: {
                X: 1,
                Y: 2
            },
            Size: {
                Width: 1,
                Height: 0
            }
        },
        Style: {
            Alignment: {
                Horizontal: 'Stretch',
                Vertical: 'Stretch'
            }
        },
        OptionalValues: [{ Key: "Low", Value: "Low: Every 30 min" }, { Key: "High", Value: "High: Every 5 min + pro active" }, { Key: "Never", Value: "Never" }]
    }
]


const healthMonitorDataView: IPepGenericFormDataView = {
    UID: 'ABCD-DCBA-FGHD-POLK',
    Type: 'Form',
    Hidden: false,
    Columns: [{}],
    Context: {
        Object: {
            Resource: "None",
            InternalID: 1,
        },
        Name: 'System Health data view',
        ScreenSize: 'Tablet',
        Profile: {
            InternalID: 1,
            Name: 'MyProfile'
        }
    },
    Fields: SystemHealthFields,
    Rows: []
};


interface FieldData {
    Id: string
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

            Title: "SystemHealth", //The title of the tab in which the fields will appear
            DataView: healthMonitorDataView
        }
    };

    async var_get_updated_settings(client: Client, request: Request) {
        const settings = request.body;
        const monitorSettingsService = new MonitorSettingsService(client);

        const monitorLevelValue = settings.MonitorLevel;
        const addonDailyUsageValue = settings.MemoryUsageLimit;
        console.log(`Got new values from VAR settings: ${JSON.stringify(settings)}`)

        // Update settings in ADAL
        let adalData = await monitorSettingsService.getMonitorSettings()

        adalData.MonitorLevel = monitorLevelValue
        let monitorLevelForCron = VALID_MONITOR_LEVEL_VALUES[`${monitorLevelValue}`]
        await this.update_cron_expression(monitorSettingsService, monitorLevelForCron); // Update cron expression

        adalData.MemoryUsageLimit = addonDailyUsageValue

        const updateResult = await monitorSettingsService.setMonitorSettings(adalData);
        console.log(`Updated values from VAR: ${JSON.stringify(updateResult)}`)
        return updateResult;
    };

    async var_send_current_settings(client: Client, request: Request) {
        const monitorSettingsService = new MonitorSettingsService(client);
        const settings = await monitorSettingsService.getMonitorSettings();

        return { 
            MonitorLevel: settings.MonitorLevel,
            MemoryUsageLimit: settings.MemoryUsageLimit
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