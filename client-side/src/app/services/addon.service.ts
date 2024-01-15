import { AddonData } from '@pepperi-addons/papi-sdk';
import { Injectable } from '@angular/core';
import { config } from '../app.config';
import { PepAddonService, PepSessionService } from '@pepperi-addons/ngx-lib';

@Injectable({ providedIn: 'root' })
export class AddonService {

    filtersDistinctValues: any;

    constructor(
        public session:  PepSessionService,
        private addonService: PepAddonService
    ) {}

    async initHealthMonitorDashaboardData(): Promise<AddonData> {
        return await this.addonService.getAddonApiCall(config.AddonUUID, 'api', `health_monitor_dashboard`).toPromise();
    }

    async initChartsData(): Promise<AddonData> {
        return await this.addonService.getAddonApiCall(config.AddonUUID, 'api', `get_sync_aggregations_from_elastic`).toPromise();
    }
}
