import { Client } from "@pepperi-addons/debug-server/dist";
import MonitorSettingsService from "./monitor-settings.service";

export class SyncDateTimeStringBuilderService {
    monitorSettingsService = new MonitorSettingsService(this.client);

    constructor(private client: Client) {
    }
    // get maintenance window hours from settings table, and build a date time string sync to display on dashboard

    async getSyncDateTimeString() {
        const maintananceWindowTime: string = await this.getMaintenanceWindowHours();
        const maintenanceWindowArray1 = (maintananceWindowTime.split(':'))
        const maintenanceWindowArray = maintenanceWindowArray1.map((item) => {return parseInt(item)});
        
        const dateNow = new Date();
        const startTime = (new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate(), maintenanceWindowArray[0], maintenanceWindowArray[1])).toISOString();
        const endTime = (new Date(dateNow.getFullYear(), dateNow.getMonth(), dateNow.getDate(), maintenanceWindowArray[0] + 1, maintenanceWindowArray[1])).toISOString();

        const syncDateTimeString = `CreationDateTime>${startTime} AND CreationDateTime<${endTime}`;
        return syncDateTimeString;
    }

    async getMaintenanceWindowHours() {
        try {
            return (await this.monitorSettingsService.papiClient.metaData.flags.name('Maintenance').get()).MaintenanceWindow;
            
        } catch(err) {
            console.log(`error getting maintenance window: ${err}`);
        }
    }
}