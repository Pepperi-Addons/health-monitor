import { PapiClient, InstalledAddon, Relation } from '@pepperi-addons/papi-sdk'
import { Client, Request } from '@pepperi-addons/debug-server'
import MonitorSettingsService from './monitor-settings.service';
import { daily_addon_usage, getCloudWatchLogs } from './addon-usage';
import ClientData from './client-data';

export class UsageRelationService {

    papiClient: PapiClient;
    clientData: ClientData
    readonly relation: Relation;

    constructor(client: Client) {
        this.papiClient = new PapiClient({
            baseURL: client.BaseURL,
            token: client.OAuthAccessToken,
            addonUUID: client.AddonUUID,
            addonSecretKey: client.AddonSecretKey
        });

        this.clientData = new ClientData(client.OAuthAccessToken, client.AddonUUID, client.AddonSecretKey);

        this.relation = {
            Name: "HealthMonitorUsageMonitor",
            AddonUUID: client.AddonUUID,
            RelationName: "UsageMonitor",
            Type: "AddonAPI",
            Description: "Health Monitor relation to Usage Monitor",
            AddonRelativeURL: "/api/usage_callback",
        }
    };

    async getUsageData(client: Client, request: Request) {
        const today = new Date();
        let size = 0
        
        // Get 3 latest entries
        const monthlyAddonUsageResponse = await this.papiClient.addons.data.uuid(this.clientData.addonUUID).table('DailyAddonUsage').iter({ order_by: "CreationDateTime desc", page_size: 1 }).toArray();

        // Search for data from today
        let todaysResult = monthlyAddonUsageResponse.find((dailyUsage) => {
            const timeString = dailyUsage.CreationDateTime!
            const time = new Date(timeString)
            return time.toDateString() == today.toDateString()
        })
        
        // If data not found take it from AWS
        if (todaysResult === undefined || (todaysResult as any).AddonsUsage === undefined) {
            const monitorSettingsService = new MonitorSettingsService(client);
            const distributor = await monitorSettingsService.papiClient.get('/distributor');
            todaysResult = { AddonsUsage: await getCloudWatchLogs(monitorSettingsService, today.getTime(), distributor) }
        }

        // Summerize all addons usage
        for (const value in todaysResult.AddonsUsage) {
            size += (todaysResult.AddonsUsage[value]).MemoryUsage
        }
        
        return {
            Title: "Usage",
            Resources: [
                {
                    Data: "Serverless functions usage ",
                    Description: "Server processing time (lambda functions)",
                    Size: size
                }
            ],
            "ReportingPeriod": "Weekly",
            "AggregationFunction": "SUM"
        }
    }
}

export default UsageRelationService;