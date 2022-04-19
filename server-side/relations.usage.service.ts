import { PapiClient, Relation } from '@pepperi-addons/papi-sdk'
import { Client } from '@pepperi-addons/debug-server'
import MonitorSettingsService from './monitor-settings.service';
import { getCloudWatchLogs } from './addon-usage';
import ClientData from './client-data';
import jwtDecode from "jwt-decode";

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

    async getUsageData(client: Client) {
        let size = 0
        let todaysResult: any = undefined

        // Get latest entry
        const monthlyAddonUsageResponse = await this.papiClient.addons.data.uuid(this.clientData.addonUUID).table('DailyAddonUsage').iter({ order_by: "CreationDateTime desc", page_size: 1 }).toArray();

        // Check that data is from today
        if (monthlyAddonUsageResponse && monthlyAddonUsageResponse[0]
            && new Date(monthlyAddonUsageResponse[0].CreationDateTime!).toDateString() == new Date().toDateString()) {
            todaysResult = monthlyAddonUsageResponse[0]
        }
        
        // if there is no data about addon's usage in the last day, take it from cloud watch.
        if (todaysResult === undefined || (todaysResult as any).AddonsUsage === undefined) {
            const monitorSettingsService = new MonitorSettingsService(client);
            const distributorUUID = jwtDecode(monitorSettingsService.clientData.OAuthAccessToken)['pepperi.distributoruuid'];
            todaysResult = { AddonsUsage: await getCloudWatchLogs(monitorSettingsService, distributorUUID) }
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